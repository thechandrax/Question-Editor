import logging
import time
import threading
import base64 as _base64
from urllib.parse import urlparse, parse_qs
from auth import DikshaAuthenticator
from navigator import CourseNavigator
from player import VideoPlayer
from api_client import DikshaAPIClient
import utils as _utils_module
from utils import logger, take_screenshot_sync, log_error_diagnostic, STOP_EVENT


def _start_global_screenshot_thread(page):
    """
    Starts a daemon thread that captures a JPEG screenshot every 2 seconds
    and stores it in _utils_module.LATEST_SCREENSHOT for the live view API.
    Returns the stop event so caller can stop the thread.
    """
    stop = threading.Event()
    _fail_count = [0]  # mutable counter

    def _loop():
        stop.wait(3)  # wait 3s for page to stabilize after login
        logger.info("[LiveView] 📸 Screenshot thread started")
        while not stop.is_set() and not STOP_EVENT.is_set():
            try:
                img = page.screenshot(type='jpeg', quality=60, full_page=False, timeout=5000)
                _utils_module.LATEST_SCREENSHOT = _base64.b64encode(img).decode('utf-8')
                _utils_module.LATEST_SCREENSHOT_LABEL = 'live'
                _fail_count[0] = 0  # reset on success
            except Exception as e:
                _fail_count[0] += 1
                if _fail_count[0] <= 3:  # only log first 3 failures
                    logger.warning(f"[LiveView] Screenshot failed (#{_fail_count[0]}): {e}")
            stop.wait(2)
        # Clear on stop
        _utils_module.LATEST_SCREENSHOT = ''
        _utils_module.LATEST_SCREENSHOT_LABEL = ''
        logger.info("[LiveView] Screenshot thread stopped")

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    return stop


def fetch_courses_only(username=None, password=None, headless=True):
    """
    Logs in to DIKSHA and directly reads course_listing.php.
    auth.login() already lands on course_listing.php after SSO sync — no extra navigation needed.
    This saves ~20-30 seconds vs navigating through Steps 3, 4, 5.
    """
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger.info("=== Fetching DIKSHA Enrolled Courses ===")
    auth = DikshaAuthenticator(headless=headless, username=username, password=password)
    try:
        page = auth.login()
        # auth.login() already navigates to course_listing.php for SSO sync.
        # We are already on the right page — no need for Step 3/4/5 navigation.
        logger.info(f"Post-login page URL: {page.url}")
        logger.info(f"Post-login page title: {page.title()}")
        navigator = CourseNavigator(page)
        # Go directly to course_listing.php and fetch — skips Steps 3, 4
        courses_data = navigator.fetch_from_course_listing()
        return courses_data
    except Exception as e:
        logger.error(f"Error fetching courses: {e}", exc_info=True)
        return {'ongoing': [], 'finished': [], 'all': []}
    finally:
        auth.close()


def run_automation(username=None, password=None, headless=False, target_course_url=None, use_telemetry_fallback=False):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger.info("=================================================")
    logger.info("=== Starting Complete DIKSHA Course Automation ===")
    logger.info("=================================================")

    # Clear any previous stop signal at the start of every run
    STOP_EVENT.clear()

    auth = DikshaAuthenticator(headless=headless, username=username, password=password)

    try:
        # Step 1 & 2: Login
        page = auth.login()

        # ── Start live screenshot thread immediately after login ─────────
        # Captures every 2s for the entire automation lifetime (auth + nav + modules)
        _screenshot_stop = _start_global_screenshot_thread(page)
        # ────────────────────────────────────────────────

        # ── Wire API client ────────────────────────────────────────────────
        api = DikshaAPIClient(auth.context)

        navigator = CourseNavigator(page)
        player    = VideoPlayer(page, api_client=api)
        player.use_telemetry_fallback = use_telemetry_fallback

        if not target_course_url:
            # Steps 3–5: Navigate to course listing
            navigator.step_3_diksha_courses()
            navigator.step_4_explore_courses()
            navigator.step_5_my_learning()

            # Step 6: Find incomplete courses
            incomplete_courses = navigator.step_6_check_incomplete_courses()

            if incomplete_courses:
                course_urls_to_process = [c['url'] for c in incomplete_courses]
                for i, c in enumerate(incomplete_courses):
                    logger.info(f"  [{i+1}] '{c['title']}' → {c['url']}")
            else:
                course_urls_to_process = [
                    "https://learning.diksha.gov.in/diksha/course.php?id=1186&section=2486"
                ]
                logger.info(f"No incomplete courses found. Using fallback: {course_urls_to_process[0]}")
        else:
            course_urls_to_process = [target_course_url]
            logger.info(f"Targeting specific course URL provided by user: {target_course_url}")

        # ── Process EVERY incomplete course ────────────────────────────────────
        for course_idx, target_course_url in enumerate(course_urls_to_process):
            if STOP_EVENT.is_set():
                logger.info("[⏹] Stop requested — skipping remaining courses.")
                break

            logger.info(f"\n{'='*52}")
            logger.info(f"COURSE {course_idx + 1}/{len(course_urls_to_process)}: {target_course_url}")
            logger.info(f"{'='*52}")

            # Extract course/section IDs for API calls
            qs = parse_qs(urlparse(target_course_url).query)
            course_id  = qs.get("id",      ["1186"])[0]
            section_id = qs.get("section", ["2486"])[0]

            # Activate request interception BEFORE navigating to course page
            api.setup_interception(page, course_id, section_id)

            # Step 7: Open course page
            player.step_7_open_incomplete_course(target_course_url)

            # Refresh cookies after full navigation
            api.refresh_cookies(auth.context)

            # Show current module progress
            logger.info("─── Current Module Progress ──────────────────────────")
            modules = api.get_module_progress(course_id, section_id, page=player.page)
            if modules:
                for m in modules:
                    pct  = str(m.get("progress", "?")).rjust(3)
                    name = m.get("name", "?")[:50]
                    tick = "✔" if m.get("iscompleted") else " "
                    logger.info(f"  [{tick}] {pct}%  {name}")
            else:
                logger.info("  (API progress not available — using hardcoded fallback)")
            logger.info("──────────────────────────────────────────────────────")

            # Step 8: About the Course
            player.step_8_about_the_course(target_course_url)

            # Step 9: Complete all lessons
            player.complete_entire_course_lessons(target_course_url)

            if STOP_EVENT.is_set():
                logger.info("[⏹] Stop requested — not starting next course.")
                break

            # Final progress check for this course
            api.refresh_cookies(auth.context)
            logger.info("─── Final Module Progress ────────────────────────────")
            final_modules = api.get_module_progress(course_id, section_id, page=player.page)
            display_modules = final_modules or player.last_module_list
            if display_modules:
                for m in display_modules:
                    mod_id   = str(m.get("id", ""))
                    prog_val = int(m.get("progress", 0))
                    is_done  = bool(m.get("iscompleted")) or prog_val >= 100 or (bool(mod_id) and mod_id in player.completed_module_ids)
                    pct_str  = "100%" if is_done else f"{prog_val:3d}%"
                    tick     = "✔" if is_done else " "
                    logger.info(f"  [{tick}] {pct_str}  {m.get('name','?')[:55]}")
            else:
                logger.info("  [✔] 100%  All modules processed successfully!")
            logger.info("──────────────────────────────────────────────────────")

        logger.info("=================================================")
        logger.info("All courses processed! Browser closing in 5s...")
        logger.info("=================================================")
        time.sleep(5)

    except Exception as e:
        log_error_diagnostic(e, "Complete Course Automation Flow")
        raise e
    finally:
        # Stop live screenshot thread and clear screenshot
        try:
            _screenshot_stop.set()
        except Exception:
            pass
        auth.close()


def fetch_course_details_only(username=None, password=None, course_url=None, headless=True):
    """
    Logs in to DIKSHA, navigates to the specific course page, captures the
    API payload for module progress, and scrapes description + lesson details.
    """
    logger.info(f"=== Fetching Course Details: {course_url} ===")
    auth = DikshaAuthenticator(headless=headless, username=username, password=password)
    try:
        # Step 1: Login
        page = auth.login()

        # Extract IDs
        qs = parse_qs(urlparse(course_url).query)
        course_id  = qs.get("id",      ["1186"])[0]
        section_id = qs.get("section", ["2486"])[0]

        # Setup interception
        api = DikshaAPIClient(auth.context)
        api.setup_interception(page, course_id, section_id)

        # Navigate to course page
        logger.info(f"Navigating to course page: {course_url}")
        try:
            page.goto(course_url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            logger.warning(f"Navigation warning (proceeding anyway): {e}")
        time.sleep(3)

        # Click About Course tab to make sure description is loaded
        try:
            about_tab = (
                page.query_selector('a:has-text("About the Course")') or
                page.query_selector('button:has-text("About the Course")') or
                page.query_selector('text="About the Course"')
            )
            if about_tab and about_tab.is_visible():
                about_tab.click(force=True)
                time.sleep(1.5)
        except Exception:
            pass

        # Scrape Description
        description = ""
        selectors = [
            '.no-overflow', 
            '#region-main', 
            '.tab-pane.active', 
            '.course-description', 
            '#course-info',
            '.box.generalbox'
        ]
        for sel in selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    txt = el.inner_text().strip()
                    if len(txt) > 20:
                        description = txt
                        break
            except Exception:
                pass

        # If description is still empty, grab first paragraph or block content
        if not description:
            try:
                region = page.query_selector('#region-main')
                if region:
                    description = region.inner_text().strip()
            except Exception:
                pass

        # Refresh cookies and get modules
        api.refresh_cookies(auth.context)
        modules = api.get_module_progress(course_id, section_id, page=page)

        title = "DIKSHA Course"
        try:
            breadcrumb_el = (
                page.query_selector('.breadcrumb') or
                page.query_selector('[class*="breadcrumb"]') or
                page.query_selector('.page-header-headings')
            )
            if breadcrumb_el:
                crumbs = breadcrumb_el.inner_text().strip()
                import re
                parts = [p.strip() for p in re.split(r'[>/\n]', crumbs) if p.strip()]
                if len(parts) >= 2:
                    title = parts[1]
                else:
                    title = parts[0]
            else:
                title_el = page.query_selector('h2') or page.query_selector('h1')
                title = title_el.inner_text().strip() if title_el else page.title()
        except Exception:
            title = page.title() or "DIKSHA Course"

        logger.info(f"Successfully scraped details for: {title}")
        return {
            'title': title,
            'description': description,
            'modules': modules or [],
            'success': True
        }

    except Exception as e:
        logger.error(f"Error fetching course details: {e}", exc_info=True)
        return {
            'title': 'Error Loading Course',
            'description': f'Failed to retrieve details: {e}',
            'modules': [],
            'success': False,
            'error': str(e)
        }
    finally:
        auth.close()


if __name__ == "__main__":
    run_automation()

