"""
VideoPlayer — drives course lesson completion.

ARCHITECTURE:
  • Each module section is opened via its direct modeActive URL (not text-clicking)
  • After an activity loads, we reload the module URL to close any overlay
  • Module IDs come from the API (with hardcoded fallback for course 1186)
"""

import time
import random
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import Page
from utils import logger, take_screenshot_sync


# ── Fallback module list for course 1186 (confirmed from API inspection) ──────
# Used when the API client is unavailable or returns nothing.
COURSE_1186_MODULES = [
    {"id": "7629", "name": "Course Instructions"},
    {"id": "7630", "name": "Module 01"},
    {"id": "7631", "name": "Module 02"},
    {"id": "7632", "name": "Module 03"},
    {"id": "7633", "name": "Module 04"},
    {"id": "7634", "name": "Module 05"},
    {"id": "7635", "name": "Assessment"},
    {"id": "7636", "name": "Feedback Form"},
    {"id": "7637", "name": "Certificate"},
]


class VideoPlayer:

    def __init__(self, page: Page, api_client=None):
        self.page = page
        self.api = api_client
        self._course_url = ""
        self._course_id = ""
        self._section_id = "2486"

    # ------------------------------------------------------------------ #
    #  Public step methods
    # ------------------------------------------------------------------ #

    def step_7_open_incomplete_course(self, course_url: str):
        """Step 7: Navigate to selected incomplete course."""
        logger.info("==================================================")
        logger.info(f"Step 7: Opening incomplete course: {course_url}")
        logger.info("==================================================")
        self._course_url = course_url
        try:
            qs = parse_qs(urlparse(course_url).query)
            self._course_id = qs.get("id", [""])[0]
            self._section_id = qs.get("section", ["2486"])[0]
        except Exception:
            pass
        self.page.goto(course_url, wait_until="domcontentloaded")
        time.sleep(3)
        take_screenshot_sync(self.page, "step7_course_opened")

    def step_8_about_the_course(self, course_url: str):
        """Step 8: View 'About the Course' tab."""
        logger.info("==================================================")
        logger.info("Step 8: Navigating to 'About the Course' tab...")
        logger.info("==================================================")
        try:
            about_tab = (
                self.page.query_selector('a:has-text("About the Course")') or
                self.page.query_selector('button:has-text("About the Course")') or
                self.page.query_selector('text="About the Course"')
            )
            if about_tab and about_tab.is_visible():
                about_tab.click(force=True)
                time.sleep(2)
        except Exception as e:
            logger.warning(f"About tab note: {e}")
        take_screenshot_sync(self.page, "step8_about_the_course")

    def step_9_lessons_playback(self, course_url: str):
        return self.complete_entire_course_lessons(course_url)

    # ------------------------------------------------------------------ #
    #  Main lesson loop — modeActive URL navigation per module
    # ------------------------------------------------------------------ #

    def complete_entire_course_lessons(self, course_url: str) -> bool:
        """
        Iterates through every module by navigating directly to its modeActive URL.
        This is reliable regardless of sidebar collapse state.
        """
        self._course_url = course_url
        logger.info("==========================================================")
        logger.info("=== Starting Course Completion (Direct Module Navigation) ===")
        logger.info("==========================================================")

        # ── Get module list ────────────────────────────────────────────────
        module_list = self._get_module_list()
        logger.info(f"Total modules to process: {len(module_list)}")

        for module in module_list:
            mod_id   = str(module.get("id", ""))
            mod_name = module.get("name", mod_id)
            progress = int(module.get("progress", 0))
            is_done  = module.get("iscompleted", False)

            logger.info("════════════════════════════════════════════════════")
            logger.info(f"Module: '{mod_name[:55]}' | Progress: {progress}%")
            logger.info("════════════════════════════════════════════════════")

            if is_done or progress >= 100:
                logger.info("✔ Already complete — skipping.")
                continue

            if not mod_id:
                logger.warning("No module ID — skipping.")
                continue

            # Build direct module URL using modeActive
            module_url = self._build_module_url(course_url, mod_id)
            logger.info(f"Navigating to module URL: {module_url}")

            self.page.goto(module_url, wait_until="domcontentloaded", timeout=25000)
            time.sleep(3)
            take_screenshot_sync(self.page, f"module_{mod_id}_opened")

            # Process all activities inside this module
            self._process_all_activities_in_module(module_url, mod_id, mod_name)

        take_screenshot_sync(self.page, "course_lessons_finished")
        logger.info("=== Course Completion Engine Finished! ===")
        return True

    def _get_module_list(self) -> list:
        """
        Returns module list from API (with progress data) or hardcoded fallback.
        """
        if self.api and self._course_id and self._section_id:
            api_modules = self.api.get_module_progress(self._course_id, self._section_id)
            if api_modules:
                logger.info(f"Using live API module list ({len(api_modules)} modules).")
                return api_modules

        # Fallback: hardcoded module IDs for course 1186
        logger.info("API unavailable — using hardcoded fallback module list.")
        return COURSE_1186_MODULES

    def _build_module_url(self, course_url: str, module_id: str) -> str:
        """Build the direct URL for a module section."""
        # Strip any existing modeActive param
        base = course_url.split("&modeActive")[0].split("?modeActive")[0]
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}modeActive={module_id}"

    # ------------------------------------------------------------------ #
    #  Per-module activity processor
    # ------------------------------------------------------------------ #

    def _get_active_module_container(self, mod_id: str, mod_name: str):
        """Finds the DOM element representing the active module container."""
        # 1. Make sure we are on the "Lessons" tab where the activities are displayed
        try:
            lessons_tab = (
                self.page.query_selector('a:has-text("Lessons")') or
                self.page.query_selector('button:has-text("Lessons")') or
                self.page.query_selector('text="Lessons"')
            )
            if lessons_tab and lessons_tab.is_visible():
                class_attr = lessons_tab.get_attribute("class") or ""
                aria_sel = lessons_tab.get_attribute("aria-selected") or ""
                is_active = 'active' in class_attr or aria_sel == "true"
                if not is_active:
                    logger.info("  Switching to 'Lessons' tab...")
                    lessons_tab.click(force=True)
                    time.sleep(2)
        except Exception as e:
            logger.debug(f"Lessons tab check note: {e}")

        # 2. Find the module trigger element by ID/attributes
        target_el = None
        for sel in [
            f"#section-{mod_id}",
            f"[data-sectionid='{mod_id}']",
            f"[data-section-id='{mod_id}']",
            f"[data-id='{mod_id}']",
            f"#accordion-item-{mod_id}",
            f"[id*='{mod_id}']",
            f".section:has-text('{mod_name}')",
            f".card:has-text('{mod_name}')",
            f"li:has-text('{mod_name}')",
        ]:
            try:
                el = self.page.query_selector(sel)
                if el and el.is_visible():
                    target_el = el
                    logger.info(f"  Found module trigger element: {sel}")
                    
                    # Try to expand it if it's collapsed
                    try:
                        aria_expanded = el.get_attribute("aria-expanded")
                        class_attr = el.get_attribute("class") or ""
                        is_collapsed = aria_expanded == "false" or "collapsed" in class_attr
                        if is_collapsed:
                            logger.info("  Module is collapsed. Clicking header to expand...")
                            el.click(force=True)
                            time.sleep(2.5)
                    except Exception as ex:
                        logger.debug(f"Expand check note: {ex}")
                    break
            except Exception:
                pass

        if target_el:
            try:
                # Find parent section/card wrapper that contains the activities
                parent = target_el.evaluate_handle("""(node) => {
                    let p = node;
                    while (p && p.tagName !== 'BODY') {
                        if (p.classList.contains('section') || 
                            p.classList.contains('card') || 
                            p.tagName === 'LI' || 
                            p.classList.contains('course-section') ||
                            p.classList.contains('accordion-item')) {
                            return p;
                        }
                        p = p.parentElement;
                    }
                    return node; // fallback
                }""")
                container = parent.as_element()
                if container and container.is_visible():
                    logger.info(f"  Scoped module container found (wrapper)")
                    return container
            except Exception as e:
                logger.warning(f"Parent traversal error: {e}")

        # Try finding the currently expanded/visible section container as fallback
        for sel in [
            '.section.show',
            '.section.active',
            '.collapse.show',
            '.panel-collapse.in',
            '.content:visible',
        ]:
            try:
                el = self.page.query_selector(sel)
                if el and el.is_visible():
                    logger.info(f"  Scoped module container found (fallback): {sel}")
                    return el
            except Exception:
                pass
        
        logger.info("  No module container found — searching full page.")
        return self.page

    def _process_all_activities_in_module(self, module_url: str, mod_id: str, mod_name: str):
        """
        Finds and processes every activity inside a module section.
        After each activity, reloads the module URL to close any overlay
        and re-read the (now updated) activity list.
        """
        completed_titles: set = set()
        MAX_ACTIVITIES = 15

        for act_num in range(1, MAX_ACTIVITIES + 1):

            # Always start from the clean module page
            if self.page.url.split("?")[0] != module_url.split("?")[0]:
                self.page.goto(module_url, wait_until="domcontentloaded", timeout=20000)
                time.sleep(3)

            # Find active module container to scope the buttons search
            scope = self._get_active_module_container(mod_id, mod_name)

            # Find action buttons ONLY inside the active module container
            view_buttons = scope.query_selector_all(
                'button:has-text("View"),   a:has-text("View"), '
                'button:has-text("Start"),  a:has-text("Start"), '
                'button:has-text("Resume"), a:has-text("Resume"), '
                'button:has-text("Open"),   a:has-text("Open")'
            )

            unlocked_btn = None
            item_title   = f"Activity_{act_num}"

            for btn in view_buttons:
                try:
                    if not (btn.is_visible() and btn.is_enabled()):
                        continue

                    parent = (
                        btn.query_selector("xpath=ancestor::div[position()=1]") or btn
                    )
                    parent_text = parent.inner_text().strip() if parent else ""
                    clean_text  = parent_text.split("\n")[0].strip()

                    if (
                        "✔" in parent_text
                        or "Completed" in parent_text
                        or clean_text in completed_titles
                    ):
                        logger.info(f"  Already done: '{clean_text[:35]}' — skipping.")
                        continue

                    unlocked_btn = btn
                    item_title   = clean_text
                    break
                except Exception:
                    continue

            if not unlocked_btn:
                logger.info(f"  No more unlocked activities in this module (checked {act_num - 1}).")
                break

            logger.info(f"  → Opening: '{item_title[:50]}'")
            try:
                unlocked_btn.click(force=True, timeout=5000)
            except Exception:
                try:
                    unlocked_btn.dispatch_event("click")
                except Exception:
                    pass

            time.sleep(3)

            # Process the activity then return to the module page
            self._process_activity_then_return(module_url)

            completed_titles.add(item_title)
            logger.info("  Waiting 4s for server checkmark sync...")
            time.sleep(4)

    # ------------------------------------------------------------------ #
    #  Activity processor — no × button; navigate back after content loads
    # ------------------------------------------------------------------ #

    def _process_activity_then_return(self, return_url: str):
        """
        Handles video or PDF activity, then returns to `return_url`
        (the module section page) by reloading or navigating.
        """
        take_screenshot_sync(self.page, "activity_opened")
        self._inject_speed_override()

        current_url = self.page.url
        logger.info(f"  Activity URL: {current_url[:80]}")

        # ── 1. Video ──────────────────────────────────────────────────────
        video = self.page.query_selector("video")
        if video:
            logger.info("  Video detected — running 16x for up to 15s real-time...")
            start = time.time()
            while (time.time() - start) < 15:
                self._simulate_mouse()
                time.sleep(2)
                try:
                    ended = self.page.evaluate(
                        'document.querySelector("video")'
                        ' ? document.querySelector("video").ended : false'
                    )
                    if ended:
                        logger.info("  Video ended naturally.")
                        break
                except Exception:
                    pass
            logger.info("  Video done — returning to module page...")
            self._return_to_url(return_url)
            return

        # ── 2. PDF / document ─────────────────────────────────────────────
        pdf_element   = (
            self.page.query_selector("#viewerContainer") or
            self.page.query_selector(".pdfViewer") or
            self.page.query_selector(".doc-view")
        )
        iframe_has_pdf = self._iframe_contains_pdf()

        if pdf_element or iframe_has_pdf or "Course Instructions" in self.page.content():
            logger.info("  PDF detected — scrolling to last page...")
            self._scroll_pdf_to_end()
            logger.info("  PDF scrolled — returning to module page...")
            self._return_to_url(return_url)
            return

        # ── 3. Generic ────────────────────────────────────────────────────
        logger.info("  Generic activity — waiting 4s then returning...")
        time.sleep(4)
        self._return_to_url(return_url)

    # ------------------------------------------------------------------ #
    #  Navigation — reload closes overlay; goto handles new-URL activities
    # ------------------------------------------------------------------ #

    def _return_to_url(self, target_url: str):
        """
        Return to `target_url` after finishing an activity.

        Strategy:
          1. page.reload()  — if we're already on target_url with an overlay (PDF modal)
          2. page.go_back() — if activity opened a different URL
          3. page.goto()    — hard fallback, always works
        """
        try:
            current = self.page.url

            # Already on the target page → reload closes any open overlay
            if "course.php" in current and "course.php" in target_url:
                logger.info("  Reloading to close overlay and refresh activity list...")
                self.page.reload(wait_until="domcontentloaded", timeout=15000)
                time.sleep(2)
                return

            # Activity opened a new URL → go_back
            self.page.go_back(wait_until="domcontentloaded", timeout=10000)
            time.sleep(2)

            if "course.php" in self.page.url:
                return

        except Exception:
            pass

        # Hard fallback
        try:
            logger.info(f"  Hard navigating to: {target_url[:70]}")
            self.page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(3)
        except Exception as e:
            logger.error(f"  _return_to_url failed: {e}")

    # ------------------------------------------------------------------ #
    #  PDF scrolling — iframe-aware
    # ------------------------------------------------------------------ #

    def _scroll_pdf_to_end(self):
        """Scrolls the PDF viewer. Tries the hosting iframe first."""
        try:
            for frame in self.page.frames:
                if frame == self.page.main_frame:
                    continue
                url = frame.url or ""
                if not url or url == "about:blank":
                    continue
                logger.info(f"  Scrolling PDF in iframe: {url[:60]}")
                for _ in range(8):
                    try:
                        frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        time.sleep(0.5)
                        frame.keyboard.press("PageDown")
                        frame.keyboard.press("End")
                    except Exception:
                        pass
                return
        except Exception:
            pass

        # Fallback: main frame
        for _ in range(8):
            try:
                self.page.keyboard.press("PageDown")
                time.sleep(0.5)
                self.page.keyboard.press("End")
                time.sleep(0.5)
                self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            except Exception:
                pass

    def _iframe_contains_pdf(self) -> bool:
        try:
            for frame in self.page.frames:
                if frame == self.page.main_frame:
                    continue
                url = frame.url or ""
                if any(k in url.lower() for k in ["pdf", "viewer", "document", "content"]):
                    return True
                try:
                    if frame.evaluate(
                        'document.querySelector("#viewerContainer,.pdfViewer,canvas") ? true : false'
                    ):
                        return True
                except Exception:
                    pass
        except Exception:
            pass
        return False

    # ------------------------------------------------------------------ #
    #  Speed injection & mouse simulation
    # ------------------------------------------------------------------ #

    def _inject_speed_override(self):
        script = """
            if (!window.__speedOverrideActive) {
                window.__speedOverrideActive = true;
                setInterval(() => {
                    document.querySelectorAll('video').forEach(v => {
                        if (v.playbackRate !== 16.0) {
                            v.playbackRate = 16.0;
                            v.defaultPlaybackRate = 16.0;
                        }
                        if (v.paused) { v.play().catch(() => {}); }
                    });
                }, 300);
            }
        """
        try:
            self.page.evaluate(script)
        except Exception:
            pass
        try:
            for frame in self.page.frames:
                if frame == self.page.main_frame:
                    continue
                try:
                    frame.evaluate(script)
                except Exception:
                    pass
        except Exception:
            pass

    def _simulate_mouse(self):
        try:
            video = self.page.query_selector("video")
            if video:
                box = video.bounding_box()
                if box:
                    x = box["x"] + random.uniform(10, max(20, box["width"] - 10))
                    y = box["y"] + random.uniform(10, max(20, box["height"] - 10))
                    self.page.mouse.move(x, y)
        except Exception:
            pass
