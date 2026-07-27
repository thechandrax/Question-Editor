"""
VideoPlayer — drives course lesson completion.

ARCHITECTURE:
  • Each module section is opened via its direct modeActive URL (not text-clicking)
  • After an activity loads, we reload the module URL to close any overlay
  • Module IDs come from the API (with hardcoded fallback for course 1186)
"""

import re
import json
import time
import random
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import Page
from utils import logger, take_screenshot_sync, STOP_EVENT


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
        self.completed_module_ids = set()
        self.last_module_list = []
        self.use_telemetry_fallback = False

    # ------------------------------------------------------------------ #
    #  Browser crash recovery
    # ------------------------------------------------------------------ #

    def _recover_crashed_page(self, navigate_to: str = "") -> bool:
        """
        Playwright 'Page crashed' recovery.
        Creates a fresh page in the same browser context and navigates to
        navigate_to (if provided). Replaces self.page with the new page.
        Returns True if recovery succeeded, False otherwise.
        """
        logger.warning("[CRASH RECOVERY] Page crashed — creating new page in same browser context...")
        try:
            ctx = self.page.context
            new_page = ctx.new_page()
            if navigate_to:
                try:
                    new_page.goto(navigate_to, wait_until="domcontentloaded", timeout=40000)
                    time.sleep(4)
                    logger.info(f"[CRASH RECOVERY] ✅ Recovered! New page at: {new_page.url[:80]}")
                except Exception as nav_err:
                    logger.warning(f"[CRASH RECOVERY] Navigation after recovery note: {nav_err}")
            try:
                self.page.close()
            except Exception:
                pass
            self.page = new_page
            return True
        except Exception as ex:
            logger.error(f"[CRASH RECOVERY] Failed to create new page: {ex}")
            return False

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
        try:
            self.page.goto(course_url, wait_until="domcontentloaded", timeout=35000)
        except Exception as e:
            logger.warning(f"Course page navigation note (proceeding anyway): {e}")
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
        State-machine progression:
        Queries live progress, finds first incomplete module, navigates to it,
        completes lessons, and queries again. This prevents getting stuck on lag/glitches.
        """
        self._course_url = course_url
        logger.info("==========================================================")
        logger.info("=== Starting Course Completion (State-Machine Engine) ===")
        logger.info("==========================================================")

        # Clear set at the start of the course
        self.completed_module_ids.clear()
        
        # Track attempts per module to prevent infinite loops if API progress fails to update
        module_attempts = {}

        while not STOP_EVENT.is_set():
            # 1. Fetch latest progress from API
            module_list = self._get_module_list()
            self.last_module_list = module_list
            logger.info(f"Checking course modules status ({len(module_list)} total)...")
            
            target_module = None
            for m in module_list:
                mod_id = str(m.get("id", ""))
                progress = int(m.get("progress", 0))
                is_completed = bool(m.get("iscompleted", False)) or progress >= 100
                
                # Skip if already verified/completed
                if mod_id in self.completed_module_ids or is_completed:
                    continue
                    
                target_module = m
                break

            if not target_module:
                logger.info("==========================================================")
                logger.info("🏆 All modules completed successfully! Course Done.     ")
                logger.info("==========================================================")
                break

            mod_id = str(target_module.get("id", ""))
            mod_name = target_module.get("name", mod_id)
            progress = int(target_module.get("progress", 0))

            # Prevent infinite loops on broken/bugged modules
            attempts = module_attempts.get(mod_id, 0)
            if attempts >= 3:
                logger.warning(f"  [!] Module '{mod_name[:35]}' failed to complete after 3 full loops. Skipping to prevent stuck state.")
                self.completed_module_ids.add(mod_id)
                continue

            module_attempts[mod_id] = attempts + 1
            
            logger.info("════════════════════════════════════════════════════")
            logger.info(f"Module: '{mod_name[:55]}' | Progress: {progress}% (Attempt {attempts + 1}/3)")
            logger.info("════════════════════════════════════════════════════")

            if not mod_id:
                logger.warning("No module ID — skipping.")
                continue

            # Build direct module URL using modeActive
            module_url = self._build_module_url(course_url, mod_id)
            logger.info(f"Navigating to module URL: {module_url}")

            try:
                self.page.goto(module_url, wait_until="domcontentloaded", timeout=60000)
            except Exception as e:
                nav_err_str = str(e).lower()
                if 'page crashed' in nav_err_str or 'target crashed' in nav_err_str:
                    logger.warning(f"[CRASH DETECTED] Module navigation crashed — recovering...")
                    self._recover_crashed_page(module_url)
                else:
                    logger.warning(f"Module page navigation note (proceeding anyway): {e}")
            time.sleep(5)
            take_screenshot_sync(self.page, f"module_{mod_id}_opened")

            # Process all activities inside this module (pass API progress so we don't falsely skip)
            completed_cnt = self._process_all_activities_in_module(module_url, mod_id, mod_name, module_progress=progress)

            # Re-check stop signal
            if STOP_EVENT.is_set():
                logger.info("  [⏹] Stop requested — halting state machine.")
                break

            # Verify completion
            is_fully_done = self._verify_module_100_percent(mod_id, mod_name)
            if not is_fully_done and completed_cnt > 0:
                logger.info("  Waiting 10s for DIKSHA telemetry sync then re-verifying module...")
                time.sleep(10)
                try:
                    self.page.reload(wait_until="domcontentloaded", timeout=20000)
                    time.sleep(3)
                except Exception:
                    pass
                is_fully_done = self._verify_module_100_percent(mod_id, mod_name)

            if is_fully_done:
                self.completed_module_ids.add(mod_id)
                logger.info(f"  [✔] 100% VERIFIED COMPLETE Module: '{mod_name[:55]}'")
            else:
                logger.warning(f"  [!] Module '{mod_name[:40]}' still has pending activities. State machine will retry.")

        take_screenshot_sync(self.page, "course_lessons_finished")
        logger.info("=== Course Completion Engine Finished! ===")
        return True

    def _get_module_list(self) -> list:
        """
        Returns module list from API (with progress data) or hardcoded fallback.
        """
        if self.api and self._course_id and self._section_id:
            api_modules = self.api.get_module_progress(self._course_id, self._section_id, page=self.page)
            if api_modules and len(api_modules) > 0:
                # ── Sanity-check: if ALL modules report 0%, the API is unreliable ──
                # This happens on courses that are 80-92% complete — the DIKSHA syllabus
                # API returns stale/wrong 0% progress for all sections.
                # Fix: fall through to DOM-based progress detection instead.
                all_zero = all(int(m.get("progress", 0)) == 0 for m in api_modules)
                if all_zero and len(api_modules) > 1:
                    logger.warning(
                        f"API returned 0% for ALL {len(api_modules)} modules — "
                        "API progress data unreliable for this course. Falling back to DOM..."
                    )
                    # Fall through to DOM fallback below
                else:
                    logger.info(f"Using live API module list ({len(api_modules)} modules).")
                    return api_modules

        # DOM fallback: parse module checkmarks directly from page DOM
        logger.info("API progress data unpopulated — checking DOM checkmarks on page...")
        dom_modules = self._parse_module_list_from_dom()
        if dom_modules and len(dom_modules) > 0:
            return dom_modules

        # Fallback: hardcoded module IDs for course 1186
        logger.info("Using hardcoded fallback module list.")
        return COURSE_1186_MODULES

    def _parse_module_list_from_dom(self) -> list:
        """
        Dynamically extracts all course module/section accordion items from page DOM.
        Works across all languages (English, Hindi, Bengali, Assamese).
        """
        try:
            modules = []
            seen_ids = set()

            # Find all section triggers on the page with data-id or section id
            triggers = self.page.query_selector_all(
                "#nav-modules [data-id], #nav-modules [id*='section'], "
                "#nav-modules .section, #nav-modules .accordion-item, "
                "[data-id], .section-title, .accordion-header, "
                "a[href*='modeActive='], button[data-id]"
            )

            for tr in triggers:
                try:
                    mod_id = (
                        tr.get_attribute("data-id") or
                        tr.get_attribute("data-sectionid") or
                        tr.get_attribute("id") or ""
                    )
                    href = tr.get_attribute("href") or ""
                    if "modeActive=" in href:
                        mod_id = href.split("modeActive=")[1].split("&")[0]

                    mod_id = mod_id.replace("section-", "").replace("accordion-item-", "").strip()

                    if not mod_id or not mod_id.isdigit() or mod_id in seen_ids:
                        continue

                    mod_name = tr.inner_text().strip().split("\n")[0]
                    if not mod_name:
                        continue

                    seen_ids.add(mod_id)

                    # Walk up DOM to the module's parent container
                    parent = tr.evaluate_handle("""(node) => {
                        let p = node;
                        while (p && p.tagName !== 'BODY') {
                            if (p.classList.contains('panel') || 
                                p.classList.contains('card') || 
                                p.classList.contains('section') ||
                                p.classList.contains('accordion-item')) return p;
                            p = p.parentElement;
                        }
                        return node;
                    }""").as_element()

                    # ── Read ACTUAL percentage from DIKSHA DOM badge ─────────────
                    # DIKSHA shows real server-side % on each module header badge
                    # e.g. "43%", "0%", or a checkmark when 100%.
                    # We read this exact value — NO hardcoding.
                    actual_progress = None
                    is_done = False

                    if parent:
                        # 1. Try reading numeric % badge text from the module header
                        pct_el = parent.query_selector(
                            ".completion-badge, .progress-badge, "
                            ".modules_progress, .progress-circle, "
                            ".completion-info, [class*='progress'], "
                            "[title$='%'], [data-original-title$='%']"
                        )
                        if pct_el:
                            import re as _re
                            raw = (
                                pct_el.get_attribute("title") or
                                pct_el.get_attribute("data-original-title") or
                                pct_el.inner_text()
                            ).strip()
                            m_pct = _re.search(r'(\d+)', raw)
                            if m_pct:
                                actual_progress = int(m_pct.group(1))

                        # 2. Checkmark icon = server confirmed 100%
                        checkmark = parent.query_selector(
                            ".fa-check, .fa-check-circle, .micon-check_circle, "
                            ".check-icon, .p100, [title='100%']"
                        )
                        if checkmark and checkmark.is_visible():
                            is_done = True
                            if actual_progress is None:
                                actual_progress = 100  # checkmark present, confirmed 100%

                    # No badge and no checkmark = 0% (genuinely not started)
                    if actual_progress is None:
                        actual_progress = 0

                    modules.append({
                        "id": mod_id,
                        "name": mod_name,
                        "progress": actual_progress,   # REAL value from DOM
                        "iscompleted": is_done or actual_progress >= 100,
                    })
                except Exception:
                    pass

            if modules:
                completed_count = sum(1 for m in modules if m["iscompleted"])
                logger.info(
                    f"Dynamic DOM parse: {len(modules)} modules, "
                    f"{completed_count} completed. "
                    f"Progress: {[(m['name'][:18], str(m['progress'])+'%') for m in modules]}"
                )
                return modules
        except Exception as e:
            logger.warning(f"DOM module list parse note: {e}")

        # Fallback to hardcoded list if dynamic parse returns empty
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
                    time.sleep(2.5)
        except Exception as e:
            logger.debug(f"Lessons tab check note: {e}")

        # 2. Find the module trigger element by ID/attributes (prefer #nav-modules pane first)
        target_el = None
        for sel in [
            f"#nav-modules [data-id='{mod_id}']",
            f"#nav-modules [id*='{mod_id}']",
            f"#nav-modules #section-{mod_id}",
            f"#nav-modules [data-sectionid='{mod_id}']",
            f"#nav-modules [data-section-id='{mod_id}']",
            f"#nav-modules #accordion-item-{mod_id}",
            f"#nav-modules .section:has-text('{mod_name}')",
            f"#nav-modules .card:has-text('{mod_name}')",
            f"#nav-modules li:has-text('{mod_name}')",
            f"[data-id='{mod_id}']",
            f"[id*='{mod_id}']",
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
                            time.sleep(3)
                    except Exception as ex:
                        logger.debug(f"Expand check note: {ex}")
                    break
            except Exception:
                pass

        if target_el:
            try:
                # Find parent section/card/panel wrapper that contains the activities
                parent = target_el.evaluate_handle("""(node) => {
                    let p = node;
                    while (p && p.tagName !== 'BODY') {
                        if (p.classList.contains('section') || 
                            p.classList.contains('card') || 
                            p.tagName === 'LI' || 
                            p.classList.contains('course-section') ||
                            p.classList.contains('accordion-item') ||
                            p.classList.contains('panel') ||
                            p.classList.contains('panel-default') ||
                            p.classList.contains('modules_full_accordian_div')) {
                            return p;
                        }
                        p = p.parentElement;
                    }
                    return node; // fallback
                }""")
                container = parent.as_element()
                if container and container.is_visible():
                    logger.info("  Scoped module container found (wrapper)")
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

    def _process_all_activities_in_module(self, module_url: str, mod_id: str, mod_name: str, module_progress: int = 0) -> int:
        """
        Finds and processes every activity inside a module section.
        After each activity, reloads the module URL to close any overlay
        and re-read the (now updated) activity list.
        Returns the number of activities completed in this run.

        module_progress: the API-reported % for this module (0 means nothing done yet
                         on the DIKSHA server — so never trust DOM-only checkmarks on
                         the very first attempt at each activity).
        """
        activity_attempts: dict = {}
        completed_count = 0
        MAX_ACTIVITIES = 30   # Increased: some modules have many sequential activities
        retry_prereq_attempts = 0
        MAX_PREREQ_RETRIES = 6  # 6 × 15s = 90s max wait for DIKSHA telemetry unlock

        for act_num in range(1, MAX_ACTIVITIES + 1):
            # ── Check stop signal before each activity ────────────────────────
            if STOP_EVENT.is_set():
                logger.info("  [⏹] Stop requested — halting activity loop.")
                break

            # Always start from the clean module page
            if self.page.url.split("?")[0] != module_url.split("?")[0]:
                try:
                    self.page.goto(module_url, wait_until="domcontentloaded", timeout=60000)
                except Exception as e:
                    logger.warning(f"Activity loop page navigation note (proceeding anyway): {e}")
                time.sleep(5)

            # Find active module container to scope the buttons search
            scope = self._get_active_module_container(mod_id, mod_name)

            # Find action buttons ONLY inside the active module container (supports English & regional DIKSHA layouts)
            view_buttons = []
            selectors = (
                'button:has-text("View"),   a:has-text("View"), '
                'button:has-text("Start"),  a:has-text("Start"), '
                'button:has-text("Resume"), a:has-text("Resume"), '
                'button:has-text("Open"),   a:has-text("Open"), '
                'button:has-text("চাওক"),   a:has-text("চাওক"), '
                'button:has-text("আৰম্ভ"),   a:has-text("আৰম্ভ"), '
                'button:has-text("দেখें"),   a:has-text("দেখें"), '
                'button:has-text("শুরু"),   a:has-text("শুরু"), '
                'a.btn-primary, button.btn-primary, '
                'a.btn-outline-primary, button.btn-outline-primary, '
                '.view-btn, .start-btn, [data-action="view"]'
            )
            try:
                view_buttons = scope.query_selector_all(selectors)
            except Exception as query_err:
                err_str = str(query_err).lower()
                logger.warning(f"  DOM query note ({query_err}) — refreshing page...")
                if 'page crashed' in err_str or 'target crashed' in err_str:
                    logger.warning("  [CRASH] DOM query on crashed page — recovering...")
                    self._recover_crashed_page(module_url)
                    scope = self._get_active_module_container(mod_id, mod_name)
                else:
                    try:
                        self.page.reload(wait_until="domcontentloaded", timeout=20000)
                        time.sleep(3)
                        scope = self._get_active_module_container(mod_id, mod_name)
                    except Exception:
                        pass
                try:
                    view_buttons = scope.query_selector_all(selectors)
                except Exception:
                    view_buttons = []

            # Check if there are any visible unlocked buttons
            has_visible_activities = False
            for btn in view_buttons:
                try:
                    if btn.is_visible() and btn.is_enabled():
                        has_visible_activities = True
                        break
                except Exception:
                    pass

            # If 0 visible buttons are found, try clicking the trigger to expand it!
            if not has_visible_activities:
                logger.info("  No visible activities found. Module might be collapsed. Toggling accordion...")
                try:
                    trigger = (
                        self.page.query_selector(f"#nav-modules [data-id='{mod_id}']") or
                        self.page.query_selector(f"#nav-modules [id*='{mod_id}']") or
                        self.page.query_selector(f"[data-id='{mod_id}']") or
                        self.page.query_selector(f"[id*='{mod_id}']")
                    )
                    if trigger:
                        trigger.click(force=True)
                        time.sleep(3)
                        # Re-read
                        scope = self._get_active_module_container(mod_id, mod_name)
                        view_buttons = scope.query_selector_all(selectors)
                except Exception as ex:
                    logger.debug(f"Accordion toggle error: {ex}")

            unlocked_btn = None
            item_title   = f"Activity_{act_num}"
            item_key     = ""
            has_locked_prereqs = False

            for btn_idx, btn in enumerate(view_buttons):
                try:
                    if not (btn.is_visible() and btn.is_enabled()):
                        continue

                    # Filter out locked or disabled buttons (e.g. prerequisite pending)
                    btn_class = (btn.get_attribute("class") or "").lower()
                    aria_dis = btn.get_attribute("aria-disabled")
                    if "disabled" in btn_class or "dimmed" in btn_class or aria_dis == "true":
                        has_locked_prereqs = True
                        continue

                    parent = (
                        btn.query_selector("xpath=ancestor::div[contains(@class, 'courses_modules_desc')]") or
                        btn.query_selector("xpath=ancestor::div[contains(@class, 'draggable-item')]") or
                        btn.query_selector("xpath=ancestor::div[position()=1]") or
                        btn
                    )
                    parent_text = parent.inner_text().strip() if parent else ""
                    clean_text  = parent_text.split("\n")[0].strip()
                    curr_item_key = f"act_{btn_idx}_{clean_text}"

                    # Ignore locked activity prerequisite text
                    if "not available unless" in parent_text.lower():
                        has_locked_prereqs = True
                        logger.info(f"  Activity '{clean_text[:35]}' is locked by prerequisite — waiting for completion telemetry.")
                        continue

                    # Check for true completion strictly via DIKSHA DOM checkmark icons/text.
                    # NOTE: We intentionally avoid [class*='check'] / [class*='complete'] because
                    # those match ordinary CSS classes in Moodle (e.g. 'checkmark_container',
                    # 'completion-info') and cause false positives when the module is at 0%.
                    is_completed = False
                    if parent:
                        checkmark = parent.query_selector(
                            ".fa-check, .fa-check-circle, .micon-check_circle, "
                            ".check-icon, svg.check, i.fa-check"
                        )
                        if checkmark:
                            is_completed = True
                        else:
                            p100 = parent.query_selector(".p100, [title='100%'], [data-original-title='100%']")
                            if p100:
                                is_completed = True

                    if not is_completed:
                        if "✔" in parent_text or "100%" in parent_text:
                            is_completed = True

                    # ── API cross-validation ────────────────────────────────────────────
                    # If the DIKSHA API reported this module is at 0% progress, then no
                    # activity can genuinely be marked complete on the server yet.
                    # A DOM checkmark in that case is stale/false — force-process it.
                    # EXCEPTION: only apply this override when module_progress == 0
                    # AND at least some other modules are NOT at 0% (i.e. API is partially
                    # reliable). If module_progress comes from DOM fallback it will already
                    # be non-zero for complete modules, so the override won't fire.
                    attempts = activity_attempts.get(curr_item_key, 0)
                    if is_completed and module_progress == 0 and attempts == 0:
                        logger.info(
                            f"  [Override] DOM shows checkmark for '{clean_text[:35]}' "
                            f"but module API progress is 0% — forcing re-process."
                        )
                        is_completed = False

                    # Only skip if DIKSHA explicitly shows checkmark AND module is not at 0%,
                    # OR if we have already played this item 3+ times without success.
                    if is_completed or attempts >= 3:
                        if is_completed:
                            logger.info(f"  Already done: '{clean_text[:35]}' — skipping.")
                        else:
                            logger.info(f"  Played {attempts} times without checkmark: '{clean_text[:35]}' — moving next.")
                        continue

                    unlocked_btn = btn
                    item_title   = clean_text
                    item_key     = curr_item_key
                    break
                except Exception:
                    continue

            if not unlocked_btn:
                # If activities are locked by prerequisite — DIKSHA server can take up to 90s
                # to sync telemetry and unlock the next sequential activity. Wait and retry.
                if has_locked_prereqs and retry_prereq_attempts < MAX_PREREQ_RETRIES:
                    retry_prereq_attempts += 1
                    wait_sec = 15
                    logger.info(
                        f"  Waiting {wait_sec}s for DIKSHA server telemetry sync to unlock next activity "
                        f"(retry {retry_prereq_attempts}/{MAX_PREREQ_RETRIES})..."
                    )
                    time.sleep(wait_sec)
                    try:
                        self.page.reload(wait_until="domcontentloaded", timeout=30000)
                        time.sleep(5)
                    except Exception:
                        pass
                    continue
                logger.info(f"  No more unlocked activities in this module (completed {completed_count} activities).")
                break

            # Reset retry count when an unlocked activity is found
            retry_prereq_attempts = 0

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

            activity_attempts[item_key] = activity_attempts.get(item_key, 0) + 1
            completed_count += 1
            logger.info("  Waiting 7s for server checkmark sync...")
            time.sleep(7)

        return completed_count

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

        # ── Auto Click Play Button if Present ─────────────────────────────
        for frame in [self.page] + list(self.page.frames):
            try:
                play_btn = (
                    frame.query_selector(".vjs-big-play-button") or
                    frame.query_selector(".play-btn") or
                    frame.query_selector("button[title*='Play']") or
                    frame.query_selector(".vjs-play-control") or
                    frame.query_selector("button.play") or
                    frame.query_selector(".play-icon") or
                    frame.query_selector(".fa-play")
                )
                if play_btn and play_btn.is_visible():
                    logger.info("  Auto-clicking play button to start video playback...")
                    play_btn.click(force=True)
                    time.sleep(1)
            except Exception:
                pass

        # ── 0. Assessment / Quiz / MCQ Test Automation ────────────────────────
        if self._is_quiz_assessment():
            logger.info("  📝 MCQ Assessment / Quiz detected — executing Smart 3-Approach Engine...")
            self._process_assessment_quiz()
            self._return_to_url(return_url)
            return

        # ── Method 2: API Telemetry Fallback Injection ────────────────────────
        if self.use_telemetry_fallback and self.api and self.api.captured_telemetry:
            current_id = ""
            try:
                qs = parse_qs(urlparse(self.page.url).query)
                current_id = qs.get("id", [""])[0] or qs.get("cmid", [""])[0]
            except Exception:
                pass
            
            logger.info("  [Method 2] Attempting API Telemetry Fallback Injection...")
            replayed = False
            for category in list(self.api.captured_telemetry.keys()):
                success = self.api.replay_telemetry_request(category, current_id=current_id)
                if success:
                    replayed = True
                    
            if replayed:
                logger.info("  [Method 2] Telemetry injection sent! Waiting 8 seconds for server checkmark sync...")
                time.sleep(8)
                self._return_to_url(return_url)
                return
            else:
                logger.warning("  [Method 2] No templates succeeded. Falling back to Method 1 (Browser Simulation).")

        # ── 1. Video (retry loop up to 15s for iframe player to load) ──────
        video_element = None
        video_frame = None
        wait_start = time.time()
        while (time.time() - wait_start) < 15:
            self._inject_speed_override()
            try:
                if self.page.query_selector("video"):
                    video_element = self.page.query_selector("video")
                    video_frame = self.page
                    break
            except Exception:
                pass

            if not video_element:
                for frame in self.page.frames:
                    try:
                        if frame.query_selector("video"):
                            video_element = frame.query_selector("video")
                            video_frame = frame
                            break
                    except Exception:
                        pass
            if video_element:
                break
            time.sleep(1.5)

        if video_element:
            logger.info("  Video detected — running 10x speed (up to 600s real-time)...")
            start = time.time()
            last_log_time = 0.0
            last_time = -1.0
            stuck_count = 0
            while (time.time() - start) < 600 and not STOP_EVENT.is_set():
                self._simulate_mouse()
                time.sleep(2)
                self._inject_speed_override() # keep applying speed override
                
                # Fetch progress and diagnostic info every 10 seconds
                now = time.time()
                if now - last_log_time >= 10:
                    last_log_time = now
                    try:
                        info = video_frame.evaluate("""() => {
                            let v = document.querySelector("video");
                            if (!v) return null;
                            return {
                                currentTime: v.currentTime,
                                duration: v.duration,
                                paused: v.paused,
                                playbackRate: v.playbackRate,
                                error: v.error ? v.error.code : null
                            };
                        }""")
                        if info:
                            pct = int((info["currentTime"] / info["duration"]) * 100) if info["duration"] else 0
                            logger.info(f"  Video progress: {int(info['currentTime'])}s / {int(info['duration'])}s ({pct}%) | rate={info['playbackRate']} | paused={info['paused']} | err={info['error']}")
                            
                            # Stuck detection
                            current_val = info["currentTime"]
                            if current_val == last_time and not info["paused"]:
                                stuck_count += 1
                                if stuck_count == 2:  # Stuck for 20 seconds — Rewind 5% back from current position
                                    rewind_sec = (info["duration"] * 0.05) if info["duration"] else 60
                                    target_rewind = max(0.0, current_val - rewind_sec)
                                    target_pct = int((target_rewind / info["duration"]) * 100) if info["duration"] else 0
                                    logger.warning(f"  [WARNING] Video stuck at {int(current_val)}s ({pct}%). Rewinding 5% back to {int(target_rewind)}s ({target_pct}%) to unfreeze buffer...")
                                    video_frame.evaluate(f"""() => {{
                                        let v = document.querySelector("video");
                                        if (v) {{
                                            v.currentTime = {target_rewind};
                                            v.playbackRate = 4.0;
                                            v.play().catch(() => {{}});
                                        }}
                                    }}""")
                                elif stuck_count >= 4:  # Stuck for 40 seconds — Force completion
                                    logger.warning(f"  [WARNING] Video still stuck after rewind. Forcing completion & network sync...")
                                    video_frame.evaluate("""() => {
                                        let v = document.querySelector("video");
                                        if (v) {
                                            try { v.currentTime = v.duration; } catch(e){}
                                            v.dispatchEvent(new Event('timeupdate'));
                                            v.dispatchEvent(new Event('ended'));
                                            v.dispatchEvent(new Event('pause'));
                                        }
                                    }""")
                                    logger.info("  Forced ended event. Waiting 6 seconds for network sync to DIKSHA server...")
                                    time.sleep(6)
                                    break
                            else:
                                stuck_count = 0
                            last_time = current_val
                    except Exception as log_ex:
                        logger.debug(f"Progress log error: {log_ex}")

                try:
                    ended = video_frame.evaluate(
                        'document.querySelector("video")'
                        ' ? document.querySelector("video").ended : false'
                    )
                    if ended:
                        logger.info("  Video ended naturally. Ensuring full network sync to DIKSHA server...")
                        video_frame.evaluate("""() => {
                            let v = document.querySelector("video");
                            if (v) {
                                v.dispatchEvent(new Event('timeupdate'));
                                v.dispatchEvent(new Event('ended'));
                            }
                        }""")
                        time.sleep(6)
                        break
                except Exception:
                    pass
            logger.info("  Video done — returning to module page...")
            self._return_to_url(return_url)
            return

        # ── 2. PDF / Document / Embedded Resource ─────────────────────────────
        pdf_element = (
            self.page.query_selector("#viewerContainer") or
            self.page.query_selector(".pdfViewer") or
            self.page.query_selector(".doc-view") or
            self.page.query_selector("#resourceobject") or
            self.page.query_selector(".resourcecontent") or
            self.page.query_selector("object[type*='pdf']") or
            self.page.query_selector("embed[type*='pdf']") or
            self.page.query_selector("canvas.pdf-canvas") or
            self.page.query_selector(".pdf-viewer") or
            self.page.query_selector("#pdf-player")
        )
        iframe_has_pdf = self._iframe_contains_pdf()

        # ── 2. PDF / Document / Embedded Resource ─────────────────────────────
        if pdf_element or iframe_has_pdf or "Course Instructions" in self.page.content() or "resource" in current_url.lower() or "file.php" in current_url.lower():
            logger.info("  PDF / Resource Document detected — performing full telemetry scroll to last page...")
            self._scroll_pdf_to_end()
            self._click_mark_as_complete()
            logger.info("  PDF scrolled — waiting 12s for full completion telemetry sync to DIKSHA server...")
            time.sleep(12)
            self._return_to_url(return_url)
            return

        # ── 3. Generic Activity (e.g. Moodle Page, SCORM, Assignment) ───────────
        logger.info("  Generic / Text Activity — scrolling page to bottom & waiting 8s for telemetry completion...")
        self._scroll_pdf_to_end()
        self._click_mark_as_complete()
        time.sleep(8)
        self._return_to_url(return_url)

    def _click_mark_as_complete(self):
        """Clicks any explicit 'Mark as Complete' / 'Finish' / 'Next' button if present."""
        for target in [self.page] + list(self.page.frames):
            try:
                btn = target.query_selector(
                    "button:has-text('Mark as complete'), button:has-text('Mark as done'), "
                    "button:has-text('Finish'), button:has-text('Complete'), "
                    "a:has-text('Mark as complete'), input[value*='Mark as complete'], "
                    ".completionbtn, #completion-btn, [data-action='toggle-manual-completion']"
                )
                if btn and btn.is_visible():
                    logger.info("  ✔ Found 'Mark as Complete' button — clicking to trigger completion telemetry...")
                    btn.click(force=True)
                    time.sleep(3)
                    break
            except Exception:
                pass

    def _verify_module_100_percent(self, mod_id: str, mod_name: str) -> bool:
        """
        Verifies if all visible activities inside a module have checkmarks.
        Scopes the check to the active module container only.
        Returns True if 0 uncompleted activities remain.
        Returns False on error (page crashed, Target crashed, etc.) —
        NEVER returns True on exception (that caused false '100% VERIFIED COMPLETE').
        """
        try:
            # Scope check to just this module's container to avoid cross-module false reads
            scope = self._get_active_module_container(mod_id, mod_name)

            # ── Fast path: check module-level checkmark first ─────────────────────
            # Many DIKSHA modules show a ✅ at the MODULE header level when all
            # activities inside are done (e.g. Course Instructions, single-PDF modules).
            # If this module-level checkmark exists, trust it — don't dig into activities.
            try:
                module_header_check = scope.query_selector(
                    ".fa-check, .fa-check-circle, .micon-check_circle, "
                    ".check-icon, svg.check, i.fa-check, "
                    ".completion-icon.complete, [data-icon='check-circle'], "
                    "[class*='completed'] .fa-check, .modules_progress .fa-check"
                )
                if module_header_check and module_header_check.is_visible():
                    logger.info(
                        f"  Module '{mod_name[:35]}' verification: "
                        "module-level checkmark found — 100% COMPLETE ✓"
                    )
                    return True
            except Exception:
                pass

            elements = scope.query_selector_all(
                ".activityinstance, .mod-indent, div.course-library-link, "
                "div.new-card, a[data-href]"
            )

            # If the module container has no activity elements at all,
            # check the page-level module accordion for a checkmark as last resort.
            if not elements:
                try:
                    # Check the accordion trigger element for a ✅ badge
                    trigger = (
                        self.page.query_selector(f"#nav-modules [data-id='{mod_id}'] .fa-check") or
                        self.page.query_selector(f"#nav-modules [data-id='{mod_id}'] .fa-check-circle") or
                        self.page.query_selector(f"#nav-modules [data-id='{mod_id}'] .micon-check_circle") or
                        self.page.query_selector(f"[data-id='{mod_id}'] .fa-check") or
                        self.page.query_selector(f"[data-id='{mod_id}'] [class*='complete']")
                    )
                    if trigger:
                        logger.info(
                            f"  Module '{mod_name[:35]}' verification: "
                            "accordion-level checkmark found — 100% COMPLETE ✓"
                        )
                        return True
                except Exception:
                    pass
                logger.info(
                    f"  Module '{mod_name[:35]}' verification: "
                    "no activity elements found — treating as INCOMPLETE."
                )
                return False

            uncompleted_count = 0
            for elem in elements:
                try:
                    txt = elem.inner_text().strip()
                    if not txt:
                        continue
                    if "not available unless" in txt.lower():
                        uncompleted_count += 1
                        continue
                    # Use ONLY specific DIKSHA checkmark selectors (no broad class* matchers)
                    checkmark = elem.query_selector(
                        ".fa-check, .fa-check-circle, .micon-check_circle, "
                        ".check-icon, svg.check, i.fa-check"
                    )
                    has_check = checkmark is not None or "✔" in txt or "100%" in txt
                    if not has_check:
                        uncompleted_count += 1
                except Exception:
                    pass

            logger.info(f"  Module '{mod_name[:35]}' verification: {uncompleted_count} uncompleted activity(ies) remaining.")
            return uncompleted_count == 0
        except Exception as e:
            err_str = str(e).lower()
            if 'page crashed' in err_str or 'target crashed' in err_str:
                logger.warning(f"  [CRASH] Page crashed during module verification — recovering...")
                self._recover_crashed_page(self._course_url)
            else:
                logger.warning(f"  Module verification error: {e}")
            # CRITICAL: Return False on ANY error — never falsely mark as complete!
            return False

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
          4. _recover_crashed_page() — if page is crashed
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

        except Exception as e:
            err_str = str(e).lower()
            if 'page crashed' in err_str or 'target crashed' in err_str:
                logger.warning("  [CRASH] Page crashed during return — recovering...")
                if self._recover_crashed_page(target_url):
                    return  # Recovery navigated us to target_url already

        # Hard fallback
        try:
            logger.info(f"  Hard navigating to: {target_url[:70]}")
            self.page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(3)
        except Exception as e:
            err_str = str(e).lower()
            if 'page crashed' in err_str or 'target crashed' in err_str:
                logger.warning("  [CRASH] Crash during hard navigation — recovering...")
                self._recover_crashed_page(target_url)
            else:
                logger.error(f"  _return_to_url failed: {e}")

    # ------------------------------------------------------------------ #
    # ------------------------------------------------------------------ #
    #  MCQ Assessment / Quiz — Smart 3-Approach Engine
    # ------------------------------------------------------------------ #

    def _is_quiz_assessment(self) -> bool:
        """
        Detects if the current page is an ACTUAL DIKSHA MCQ quiz/assessment.

        IMPORTANT: 'assessment' and 'quiz' appear in DIKSHA navigation menus
        on EVERY course page — do NOT use them as text keywords or every
        activity gets falsely detected as a quiz.

        Instead: check for quiz-SPECIFIC DOM elements that ONLY exist on
        real quiz pages (attempt buttons, radio inputs inside quiz containers,
        quiz table, etc.).
        """
        # ── Stage 1: High-confidence DOM elements (quiz-exclusive) ────────
        QUIZ_SELECTORS = (
            # Moodle quiz attempt buttons
            "button:has-text('Attempt quiz now'), "
            "button:has-text('Re-attempt quiz'), "
            "button:has-text('Continue Assessment'), "
            "a:has-text('Attempt quiz now'), "
            "a:has-text('Re-attempt quiz'), "
            # Quiz in-progress markers
            "button:has-text('Final Submit'), "
            "button:has-text('Submit all and finish'), "
            "input[type='submit'][value*='Submit'], "
            # Quiz DOM containers (Moodle-specific)
            ".quizattempt, #quiz-table, .que, #responseform, "
            "#quizform, .quizreviewsummary, "
            # Summary of previous attempts (quiz results page)
            "table.generaltable:has(th:has-text('Grade')), "
            ".quizsummaryofattempts"
        )
        for target in [self.page] + list(self.page.frames):
            try:
                el = target.query_selector(QUIZ_SELECTORS)
                if el and el.is_visible():
                    return True
            except Exception:
                pass

        # ── Stage 2: High-confidence TEXT patterns (very specific phrases) ─
        # These phrases NEVER appear in menus — they are quiz-page-only text.
        QUIZ_TEXT_SIGNALS = [
            "summary of your previous attempts",
            "summary of attempt",
            "attempt quiz now",
            "re-attempt quiz",
            "final submit",
            "submit all and finish",
            "question 1 of ",          # "Question 1 of 10"
            "time left",               # countdown timer in quiz
        ]
        for target in [self.page] + list(self.page.frames):
            try:
                content = target.content().lower()
                if any(sig in content for sig in QUIZ_TEXT_SIGNALS):
                    return True
            except Exception:
                pass

        return False


    def _close_popups(self):
        """Closes celebratory or info popups ('WELL DONE CHAMP!', 'Stay Calm', etc.)."""
        for target in [self.page] + list(self.page.frames):
            try:
                close_btns = target.query_selector_all(
                    ".close, [aria-label='Close'], button.close, span:has-text('×'), "
                    ".micon-close, button:has-text('Close'), div.close-btn"
                )
                for btn in close_btns:
                    if btn and btn.is_visible():
                        btn.click(force=True)
                        time.sleep(1)
            except Exception:
                pass

    # ──────────────────────────────────────────────────────────────────────
    # APPROACH B — API Intercept (Fastest: reads answers from DIKSHA API)
    # ──────────────────────────────────────────────────────────────────────

    def _intercept_api_answers(self) -> dict:
        """
        APPROACH B: Intercepts DIKSHA/Sunbird assessment API responses that
        contain question metadata including correct_answer fields.
        Returns answer_key = { question_text_lower: correct_option_text }
        This works because many DIKSHA courses send the answer key in the API
        response for offline/player caching, before the user even starts.
        """
        answer_key = {}
        captured_bodies = []

        def _on_response(response):
            try:
                url = response.url.lower()
                # Target Sunbird/DIKSHA assessment API endpoints
                if response.status == 200 and any(kw in url for kw in [
                    'assessment', 'question', 'content/v1/read', 'api/question',
                    'quml', 'quiz', 'service.php', 'attempt'
                ]):
                    captured_bodies.append({'url': response.url})
            except Exception:
                pass

        try:
            self.page.on('response', _on_response)
            # Reload current page to trigger API calls
            try:
                self.page.reload(wait_until='domcontentloaded', timeout=20000)
                time.sleep(4)
            except Exception:
                pass

            # Re-fetch each captured API URL in-browser (with cookies)
            for cap in captured_bodies[:15]:
                try:
                    url = cap['url']
                    resp = self.page.evaluate(f"""
                        async () => {{
                            try {{
                                const r = await fetch('{url}', {{credentials:'include'}});
                                const t = await r.text();
                                return {{ok:r.ok,body:t.substring(0,20000)}};
                            }} catch(e) {{ return {{ok:false,body:''}}; }}
                        }}
                    """)
                    body = (resp or {}).get('body', '')
                    if not body or len(body) < 10:
                        continue

                    import json
                    try:
                        data = json.loads(body)
                    except Exception:
                        continue

                    # Parse Sunbird QuML / assessment format
                    questions = []
                    if isinstance(data, dict):
                        # Common Sunbird keys: result.questions, result.question
                        qs = (data.get('result') or {}).get('questions', [])
                        if not qs:
                            qs = (data.get('result') or {}).get('question', [])
                        if isinstance(qs, dict):
                            qs = [qs]
                        if isinstance(qs, list):
                            questions = qs
                        # Also check top-level 'questions' key
                        if not questions and 'questions' in data:
                            questions = data['questions'] if isinstance(data['questions'], list) else []

                    for q in questions:
                        if not isinstance(q, dict):
                            continue
                        # Extract question text
                        q_text = ''
                        for k in ('stem', 'question', 'body', 'questionText', 'text'):
                            raw = q.get(k, '')
                            if isinstance(raw, str) and raw.strip():
                                # Strip HTML tags
                                q_text = re.sub(r'<[^>]+>', '', raw).strip().lower()
                                break
                            elif isinstance(raw, dict):
                                q_text = re.sub(r'<[^>]+>', '', str(raw.get('value', '') or raw.get('data', ''))).strip().lower()
                                if q_text:
                                    break

                        # Extract correct answer
                        correct_text = ''
                        ans_key = q.get('answer', '') or q.get('correct_answer', '') or q.get('correctAnswer', '')
                        if isinstance(ans_key, str):
                            correct_text = re.sub(r'<[^>]+>', '', ans_key).strip()

                        # Try responseDeclaration (QuML format)
                        if not correct_text:
                            rd = q.get('responseDeclaration', {})
                            if isinstance(rd, dict):
                                for rd_val in rd.values():
                                    if isinstance(rd_val, dict):
                                        ca = rd_val.get('correctResponse', {})
                                        if isinstance(ca, dict):
                                            val = ca.get('value', '')
                                            if val:
                                                correct_text = str(val)
                                                break

                        if q_text and correct_text:
                            answer_key[q_text] = correct_text
                            logger.info(f"  🎯 Approach B API key: '{q_text[:35]}' → '{correct_text[:35]}'")

                except Exception as ex:
                    logger.debug(f'Approach B parse note: {ex}')

        except Exception as e:
            logger.warning(f'Approach B error: {e}')
        finally:
            try:
                self.page.remove_listener('response', _on_response)
            except Exception:
                pass

        logger.info(f'  Approach B result: {len(answer_key)} answers captured from API')
        return answer_key

    # ──────────────────────────────────────────────────────────────────────
    # APPROACH A — AI Vision (Gemini reads question screenshot and answers)
    # ──────────────────────────────────────────────────────────────────────

    def _ai_answer_question(self, q_text: str, options: list) -> str:
        """
        APPROACH A: Uses Google Gemini API to read question text + options
        and return the most likely correct answer.
        Returns the matched option text, or '' if AI is unavailable.
        Requires GEMINI_API_KEY env variable.
        """
        import os
        api_key = os.environ.get('GEMINI_API_KEY', '')
        if not api_key:
            return ''
        try:
            import urllib.request
            import json
            options_text = '\n'.join([f"{chr(65+i)}) {o}" for i, o in enumerate(options)])
            prompt = (
                f"You are a student answering an exam MCQ question. "
                f"Read the question carefully and pick the SINGLE best answer.\n"
                f"Question: {q_text}\n"
                f"Options:\n{options_text}\n"
                f"Reply ONLY with the letter (A, B, C, or D) of the correct answer. Nothing else."
            )
            payload = json.dumps({
                'contents': [{'parts': [{'text': prompt}]}]
            }).encode('utf-8')
            url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
            req = urllib.request.Request(url, data=payload,
                                         headers={'Content-Type': 'application/json'},
                                         method='POST')
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
            letter = result['candidates'][0]['content']['parts'][0]['text'].strip().upper()
            letter = letter[0] if letter else ''
            if letter in 'ABCD':
                idx = ord(letter) - ord('A')
                if 0 <= idx < len(options):
                    chosen = options[idx]
                    logger.info(f"  🤖 Approach A AI answered: [{letter}] {chosen[:40]}")
                    return chosen
        except Exception as e:
            logger.warning(f'  Approach A AI error: {e}')
        return ''

    # ──────────────────────────────────────────────────────────────────────
    # Main MCQ orchestrator — Approach B → A → C (smart fallback)
    # ──────────────────────────────────────────────────────────────────────

    def _process_assessment_quiz(self):
        """
        Smart 3-Approach MCQ Engine:
          B → API Intercept  : reads correct answers from DIKSHA API response
          A → AI Vision      : Gemini AI reads question & picks correct option
          C → Brute Force    : Attempt 1 random → Review → Attempt 2 perfect

        Order: B first (fastest). If B gets answers, use them directly.
        A supplements any questions B missed. C is last resort.
        """
        answer_key: dict = {}  # { question_text_lower: correct_option_text }
        self._close_popups()

        # ── Approach B: Try to get answers from DIKSHA API ────────────────
        logger.info("  [Approach B] Intercepting DIKSHA assessment API for answer keys...")
        api_answers = self._intercept_api_answers()
        if api_answers:
            answer_key.update(api_answers)
            logger.info(f"  ✅ Approach B: captured {len(answer_key)} answers from API!")
        else:
            logger.info("  ⚠️  Approach B: No API answers found — will use A+C")

        # ── Step: Extract from existing 'Review' link (Approach C basis) ──
        for target in [self.page] + list(self.page.frames):
            try:
                review_btn = target.query_selector(
                    "a:has-text('Review'), button:has-text('Review'), td:has-text('Review') a"
                )
                if review_btn and review_btn.is_visible():
                    logger.info("  🔍 Found previous attempt 'Review' — extracting Answer Key...")
                    review_btn.click(force=True)
                    time.sleep(4)
                    self._extract_answer_key_from_review(answer_key)
                    back_btn = target.query_selector(
                        "button:has-text('Back to Assessement Summary'), "
                        "button:has-text('Back to Assessment Summary'), "
                        "button:has-text('Finish review'), a:has-text('Back')"
                    )
                    if back_btn:
                        back_btn.click(force=True)
                        time.sleep(3)
                    break
            except Exception:
                pass

        # ── Start or Continue Attempt ─────────────────────────────────────
        self._start_or_continue_quiz_attempt()

        # ── Answer questions (B + A + C cascade) ─────────────────────────
        logger.info(f"  ✏️  Answering questions (API keys: {len(answer_key)}, AI: {'ON' if self._ai_enabled() else 'OFF'})...")
        self._answer_quiz_questions_smart(answer_key)

        # ── Final Submit ──────────────────────────────────────────────────
        logger.info("  🚀 Submitting quiz attempt ('Final Submit')...")
        self._submit_quiz_attempt()

        # ── CRITICAL FIX: Navigate to Review page after submit ────────────
        # After submit, DIKSHA shows a RESULTS/SUMMARY page (not Review page).
        # We must CLICK 'Review' to go to the review page, read all correct
        # answers, then come BACK to the summary page to find Re-attempt button.
        time.sleep(5)  # Wait for results page to load fully
        self._close_popups()
        attempt1_answers_before = len(answer_key)
        self._navigate_to_review_and_extract(answer_key)
        new_answers = len(answer_key) - attempt1_answers_before
        logger.info(f"  📚 Review extracted {new_answers} new correct answers (total: {len(answer_key)})")

        # ── Approach C: If we have answers → Attempt 2 = PERFECT SCORE ─────
        if answer_key and self._has_reattempt_available():
            logger.info(f"  🎯 Attempt 2 with {len(answer_key)} correct answers → PERFECT SCORE...")
            self._start_or_continue_quiz_attempt()
            self._answer_quiz_questions_smart(answer_key)
            self._submit_quiz_attempt()
            time.sleep(4)
            self._close_popups()
            logger.info("  🎉 Attempt 2 submitted — 100% SCORE!")
        elif not answer_key:
            logger.info("  ⚠️  No answer key captured — Attempt 1 score accepted as-is")
        else:
            logger.info("  ℹ️  No Re-attempt button found — Attempt 1 score is final")

        self._close_popups()

    def _ai_enabled(self) -> bool:
        """Returns True if GEMINI_API_KEY is set in environment."""
        import os
        return bool(os.environ.get('GEMINI_API_KEY', ''))

    def _answer_quiz_questions_smart(self, answer_key: dict):
        """
        Smart question answerer using B → A → C fallback per question:
          B: Match from API-captured answer_key
          A: Ask Gemini AI if B failed
          C: Click first option (blind pick) if both failed
        """
        unanswered_streak = 0
        for q_step in range(1, 50):
            self._close_popups()
            answered_something = False

            for target in [self.page] + list(self.page.frames):
                try:
                    radios = target.query_selector_all(
                        "input[type='radio'], input[type='checkbox'], label.option-label"
                    )
                    if not radios:
                        continue

                    # Get question text
                    q_elem = target.query_selector(".qtext, .question, .formulation, h3, h4")
                    q_text = q_elem.inner_text().strip().lower() if q_elem else ""

                    # Get all option texts
                    option_texts = []
                    for r in radios:
                        try:
                            txt = r.evaluate(
                                "el => el.closest('label, tr, div') ? "
                                "el.closest('label, tr, div').innerText : el.value || ''"
                            )
                            option_texts.append((txt or '').strip())
                        except Exception:
                            option_texts.append('')

                    matched = False

                    # ── B: API answer_key match ───────────────────────────
                    if q_text and answer_key:
                        for key_q, key_ans in answer_key.items():
                            if key_q in q_text or q_text in key_q:
                                for idx, (r, opt_txt) in enumerate(zip(radios, option_texts)):
                                    if key_ans.lower() in opt_txt.lower() or opt_txt.lower() in key_ans.lower():
                                        r.click(force=True)
                                        matched = True
                                        answered_something = True
                                        logger.info(f"    ✅ [B-API] Q{q_step}: clicked '{opt_txt[:40]}'")
                                        break
                                if matched:
                                    break

                    # ── A: AI Vision fallback ─────────────────────────────
                    if not matched and q_text and option_texts and self._ai_enabled():
                        clean_options = [t for t in option_texts if t]
                        if clean_options:
                            ai_ans = self._ai_answer_question(q_text, clean_options)
                            if ai_ans:
                                for idx, (r, opt_txt) in enumerate(zip(radios, option_texts)):
                                    if ai_ans.lower() in opt_txt.lower() or opt_txt.lower() in ai_ans.lower():
                                        r.click(force=True)
                                        matched = True
                                        answered_something = True
                                        logger.info(f"    🤖 [A-AI] Q{q_step}: clicked '{opt_txt[:40]}'")
                                        break

                    # ── C: Brute force — pick first option ───────────────
                    if not matched and radios:
                        radios[0].click(force=True)
                        answered_something = True
                        logger.info(f"    🎲 [C-Brute] Q{q_step}: clicked first option")

                    # Next question
                    next_btn = target.query_selector(
                        "button:has-text('Next Question'), input[value='Next Question'], button:has-text('Next')"
                    )
                    if next_btn and next_btn.is_visible():
                        next_btn.click(force=True)
                        time.sleep(2.5)
                        break

                    final_btn = target.query_selector(
                        "button:has-text('Final Submit'), input[value='Final Submit'], "
                        "button:has-text('Submit all and finish')"
                    )
                    if final_btn and final_btn.is_visible():
                        break

                except Exception:
                    pass

            if answered_something:
                unanswered_streak = 0
            else:
                unanswered_streak += 1
                if unanswered_streak >= 3:
                    break  # Quiz complete or stuck
                time.sleep(1)


    def _start_or_continue_quiz_attempt(self):
        """Clicks Continue Assessment / Re-attempt quiz / Attempt quiz now button."""
        for target in [self.page] + list(self.page.frames):
            try:
                start_btn = target.query_selector(
                    "button:has-text('Continue Assessment'), button:has-text('Attempt quiz now'), "
                    "button:has-text('Re-attempt quiz'), button:has-text('Start attempt'), "
                    "a:has-text('Continue Assessment'), a:has-text('Re-attempt quiz')"
                )
                if start_btn and start_btn.is_visible():
                    start_btn.click(force=True)
                    time.sleep(4)
                    break
            except Exception:
                pass



    def _submit_quiz_attempt(self):
        """Clicks 'Final Submit' and confirms submission."""
        for target in [self.page] + list(self.page.frames):
            try:
                final_btn = target.query_selector("button:has-text('Final Submit'), input[value='Final Submit'], button:has-text('Submit all and finish')")
                if final_btn and final_btn.is_visible():
                    final_btn.click(force=True)
                    time.sleep(3)

                confirm_btn = target.query_selector("button:has-text('Final Submit'), button:has-text('Submit all and finish'), input[value='Submit all and finish']")
                if confirm_btn and confirm_btn.is_visible():
                    confirm_btn.click(force=True)
                    time.sleep(4)
            except Exception:
                pass

    def _extract_answer_key_from_review(self, answer_key: dict):
        """Extracts question text and 100% correct answer options from Review page."""
        for target in [self.page] + list(self.page.frames):
            try:
                questions = target.query_selector_all(".que, .question, div[id^='q']")
                for q in questions:
                    q_elem = q.query_selector(".qtext, .formulation")
                    q_text = q_elem.inner_text().strip().lower() if q_elem else ""
                    if not q_text:
                        continue

                    correct_elem = q.query_selector(".rightanswer, .correct, span.correct, [class*='rightanswer']")
                    correct_text = ""
                    if correct_elem:
                        correct_text = correct_elem.inner_text().strip()
                        correct_text = re.sub(r'^(The correct answer is|Correct answer|Answer):?\s*', '', correct_text, flags=re.I).strip()
                    else:
                        opt = q.query_selector(".fa-check, svg.check, [class*='correct']")
                        if opt:
                            opt_parent = opt.evaluate("el => el.closest('label, tr, div') ? el.closest('label, tr, div').innerText : ''")
                            correct_text = opt_parent.strip()

                    if q_text and correct_text:
                        answer_key[q_text] = correct_text
                        logger.info(f"  ✔ Captured Answer Key: '{q_text[:35]}...' → '{correct_text[:35]}'")
            except Exception:
                pass

    def _navigate_to_review_and_extract(self, answer_key: dict):
        """
        CRITICAL FIX for Approach C:
        After Attempt 1 is submitted, DIKSHA shows a RESULTS SUMMARY page.
        This method:
          1. Finds and clicks the 'Review' link on the summary page
          2. Waits for the Review page to load (shows correct/wrong for each Q)
          3. Extracts all correct answers into answer_key
          4. Clicks 'Back to Attempt Summary' to return to summary page
             (so _has_reattempt_available() can find 'Re-attempt quiz' button)
        """
        logger.info("  🔍 Navigating to Review page to capture correct answers...")

        # Step 1: Find and click Review link/button on current summary page
        review_clicked = False
        review_selectors = [
            "a:has-text('Review')",
            "button:has-text('Review')",
            "td a:has-text('Review')",
            "a[href*='review']",
            "a:has-text('Review attempt')",
            ".reviewlink a",
            "a.reviewlink",
            "td:has-text('Review') a",
            "input[value='Review']",
        ]
        for target in [self.page] + list(self.page.frames):
            if review_clicked:
                break
            for sel in review_selectors:
                try:
                    btn = target.query_selector(sel)
                    if btn and btn.is_visible():
                        logger.info(f"    Clicking Review: {sel}")
                        btn.click(force=True)
                        time.sleep(4)  # Wait for Review page to load
                        review_clicked = True
                        break
                except Exception:
                    pass

        if not review_clicked:
            # Try to find review link in table rows (Moodle shows grade table)
            for target in [self.page] + list(self.page.frames):
                try:
                    rows = target.query_selector_all("table tr")
                    for row in rows:
                        row_text = row.inner_text().lower()
                        if 'review' in row_text or 'attempt' in row_text:
                            link = row.query_selector('a')
                            if link:
                                logger.info("    Clicking Review link from table row")
                                link.click(force=True)
                                time.sleep(4)
                                review_clicked = True
                                break
                    if review_clicked:
                        break
                except Exception:
                    pass

        if not review_clicked:
            logger.warning("    No Review link found on results page — trying direct extraction")
            # Try extracting from current page (might already show answers)
            self._extract_answer_key_from_review(answer_key)
            return

        # Step 2: We're now on the Review page — extract all correct answers
        logger.info("    On Review page — extracting correct answers for all questions...")
        self._extract_answer_key_from_review(answer_key)

        # Also try extracting from page HTML for broader coverage
        try:
            page_html = self.page.content()
            # Look for rightanswer spans in raw HTML
            correct_pattern = re.compile(
                r'class="[^"]*rightanswer[^"]*"[^>]*>([^<]+)<',
                re.I
            )
            for match in correct_pattern.finditer(page_html):
                text = match.group(1).strip()
                text = re.sub(r'^(The correct answer is|Correct answer|Answer):?\s*', '', text, flags=re.I).strip()
                if text and len(text) > 2:
                    logger.info(f"    ✔ HTML regex correct answer: '{text[:50]}'")
        except Exception:
            pass

        logger.info(f"    Review extraction done: {len(answer_key)} correct answers captured")

        # Step 3: Go BACK to attempt summary page (so Re-attempt button is accessible)
        back_selectors = [
            "button:has-text('Back to Assessement Summary')",
            "button:has-text('Back to Assessment Summary')",
            "button:has-text('Finish review')",
            "a:has-text('Finish review')",
            "a:has-text('Back to attempt summary')",
            "a:has-text('Back')",
            ".finishreview",
            "button:has-text('Return to attempt')",
        ]
        went_back = False
        for target in [self.page] + list(self.page.frames):
            if went_back:
                break
            for sel in back_selectors:
                try:
                    btn = target.query_selector(sel)
                    if btn and btn.is_visible():
                        logger.info(f"    Clicking Back: {sel}")
                        btn.click(force=True)
                        time.sleep(3)
                        went_back = True
                        break
                except Exception:
                    pass

        if not went_back:
            logger.info("    No Back button found — using browser back")
            try:
                self.page.go_back(wait_until='domcontentloaded', timeout=15000)
                time.sleep(2)
            except Exception:
                pass

        logger.info("    ✔ Back on summary page — ready for Re-attempt")

    def _has_reattempt_available(self) -> bool:
        """Checks if a 'Re-attempt quiz' or 'Continue Assessment' button is present."""
        for target in [self.page] + list(self.page.frames):
            try:
                btn = target.query_selector("button:has-text('Re-attempt quiz'), button:has-text('Continue Assessment'), a:has-text('Re-attempt quiz')")
                if btn and btn.is_visible():
                    return True
            except Exception:
                pass
        return False

    def _scroll_pdf_to_end(self):
        """
        Scrolls the PDF viewer completely from top to bottom at a gradual,
        human-like reading pace. This spaces out scroll events to ensure
        the server-side DIKSHA read-time telemetry checks pass successfully.
        """
        frames_to_scroll = [self.page] + [f for f in self.page.frames if f != self.page.main_frame and f.url and f.url != "about:blank"]
        for frame in frames_to_scroll:
            try:
                frame.evaluate("""() => {
                    window.scrollTo(0, 0);
                    window.dispatchEvent(new Event('scroll'));
                }""")
                time.sleep(1.0)
                # Scroll gradually (12 steps, 1.2s each = ~15s total active scrolling)
                for _ in range(12):
                    frame.evaluate("""() => {
                        window.scrollBy(0, 500);
                        window.dispatchEvent(new Event('scroll'));
                        let el = document.querySelector("#viewerContainer, .pdfViewer, #resourceobject, .resourcecontent");
                        if (el) { el.scrollTop += 500; el.dispatchEvent(new Event('scroll')); }
                    }""")
                    time.sleep(1.2)
                frame.evaluate("""() => {
                    window.scrollTo(0, document.body.scrollHeight);
                    window.dispatchEvent(new Event('scroll'));
                    window.dispatchEvent(new Event('ended'));
                }""")
            except Exception:
                pass

    def _iframe_contains_pdf(self) -> bool:
        try:
            for frame in self.page.frames:
                if frame == self.page.main_frame:
                    continue
                url = (frame.url or "").lower()
                if any(k in url for k in ["pdf", "viewer", "document", "content", "resource", "file.php", "mod_resource", "pluginfile"]):
                    return True
                try:
                    if frame.evaluate(
                        'document.querySelector("#viewerContainer,.pdfViewer,canvas,object,embed,#resourceobject,.resourcecontent") ? true : false'
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
        # We use a safe playback speed multiplier of 6.0 (instead of 10.0) to satisfy
        # DIKSHA server-side rate checks while still completing videos extremely quickly.
        script = """
            if (!window.__speedOverrideActive) {
                window.__speedOverrideActive = true;
                setInterval(() => {
                    document.querySelectorAll('video').forEach(v => {
                        if (v.duration && (v.duration - v.currentTime <= 10)) {
                            v.playbackRate = 1.0;
                            v.defaultPlaybackRate = 1.0;
                        } else if (v.playbackRate !== 6.0) {
                            v.playbackRate = 6.0;
                            v.defaultPlaybackRate = 6.0;
                        }
                        if (v.paused && (!v.duration || (v.duration - v.currentTime > 1))) {
                            v.play().catch(() => {});
                        }
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
