import logging
import time
from urllib.parse import urlparse, parse_qs
from auth import DikshaAuthenticator
from navigator import CourseNavigator
from player import VideoPlayer
from api_client import DikshaAPIClient
from utils import logger, take_screenshot_sync


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


def run_automation(username=None, password=None, headless=False, target_course_url=None):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger.info("==================================================")
    logger.info("=== Starting Complete DIKSHA Course Automation ===")
    logger.info("==================================================")

    auth = DikshaAuthenticator(headless=headless, username=username, password=password)

    try:
        # Step 1 & 2: Login
        page = auth.login()

        # ── Wire API client ────────────────────────────────────────────────
        api = DikshaAPIClient(auth.context)

        navigator = CourseNavigator(page)
        player    = VideoPlayer(page, api_client=api)

        if not target_course_url:
            # Steps 3–5: Navigate to course listing
            navigator.step_3_diksha_courses()
            navigator.step_4_explore_courses()
            navigator.step_5_my_learning()

            # Step 6: Find incomplete course
            incomplete_courses = navigator.step_6_check_incomplete_courses()

            if incomplete_courses:
                target_course_url = incomplete_courses[0]['url']
                logger.info(
                    f"Targeting: '{incomplete_courses[0]['title']}' → {target_course_url}"
                )
            else:
                target_course_url = (
                    "https://learning.diksha.gov.in/diksha/course.php?id=1186&section=2486"
                )
                logger.info(f"Fallback course URL: {target_course_url}")
        else:
            logger.info(f"Targeting specific course URL provided by user: {target_course_url}")

        # Extract course/section IDs for API calls
        qs = parse_qs(urlparse(target_course_url).query)
        course_id  = qs.get("id",      ["1186"])[0]
        section_id = qs.get("section", ["2486"])[0]

        # ── Activate request interception BEFORE navigating to course page ──
        # This auto-captures the exact POST payload the browser sends to course.php
        api.setup_interception(page, course_id, section_id)

        # Step 7: Open course page (interception captures the API payload here)
        player.step_7_open_incomplete_course(target_course_url)

        # Refresh cookies after full navigation
        api.refresh_cookies(auth.context)

        # ── Show current module progress ───────────────────────────────────
        logger.info("─── Current Module Progress ──────────────────────────")
        modules = api.get_module_progress(course_id, section_id)
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

        # ── Final progress check ───────────────────────────────────────────
        api.refresh_cookies(auth.context)
        logger.info("─── Final Module Progress ────────────────────────────")
        final_modules = api.get_module_progress(course_id, section_id)
        if final_modules:
            for m in final_modules:
                pct  = str(m.get("progress", "?")).rjust(3)
                name = m.get("name", "?")[:50]
                tick = "✔" if m.get("iscompleted") else " "
                logger.info(f"  [{tick}] {pct}%  {name}")
        else:
            logger.info("  (API progress not available)")
        logger.info("──────────────────────────────────────────────────────")

        logger.info("==================================================")
        logger.info("All modules done! Keeping browser open for 30s...")
        logger.info("==================================================")
        time.sleep(30)

    except Exception as e:
        logger.error(f"Error during automation: {e}", exc_info=True)
    finally:
        auth.close()


if __name__ == "__main__":
    run_automation()
