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
        self.completed_module_ids = set()
        self.last_module_list = []

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
        Iterates through every module by navigating directly to its modeActive URL.
        This is reliable regardless of sidebar collapse state.
        """
        self._course_url = course_url
        logger.info("==========================================================")
        logger.info("=== Starting Course Completion (Direct Module Navigation) ===")
        logger.info("==========================================================")

        # ── Get module list ────────────────────────────────────────────────
        module_list = self._get_module_list()
        self.last_module_list = module_list
        logger.info(f"Total modules to process: {len(module_list)}")
        logger.info("─── Course Modules Completion Status ─────────────────")
        for m in module_list:
            pct_str = "100%" if m.get("iscompleted") or int(m.get("progress", 0)) >= 100 else f"{int(m.get('progress', 0)):3d}%"
            badge = "[✔]" if m.get("iscompleted") or int(m.get("progress", 0)) >= 100 else "[ ]"
            logger.info(f"  {badge} {pct_str}  {m.get('name', '')[:55]}")
        logger.info("──────────────────────────────────────────────────────")

        for module in module_list:
            mod_id   = str(module.get("id", ""))
            mod_name = module.get("name", mod_id)
            progress = int(module.get("progress", 0))
            is_done  = module.get("iscompleted", False)

            if is_done or progress >= 100:
                self.completed_module_ids.add(mod_id)
                logger.info("════════════════════════════════════════════════════")
                logger.info(f"  [✔] 100%  Module: '{mod_name[:55]}' — Complete! Skipping.")
                logger.info("════════════════════════════════════════════════════")
                continue

            logger.info("════════════════════════════════════════════════════")
            logger.info(f"Module: '{mod_name[:55]}' | Progress: {progress}%")
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
                logger.warning(f"Module page navigation note (proceeding anyway): {e}")
            time.sleep(5)
            take_screenshot_sync(self.page, f"module_{mod_id}_opened")

            # Process all activities inside this module
            completed_cnt = self._process_all_activities_in_module(module_url, mod_id, mod_name)
            
            # Verify if all activities in this module are actually 100% completed with checkmarks
            is_fully_done = self._verify_module_100_percent(mod_id, mod_name)
            if is_fully_done:
                self.completed_module_ids.add(mod_id)
                logger.info(f"  [✔] 100% VERIFIED COMPLETE Module: '{mod_name[:55]}'")
            else:
                logger.warning(f"  [!] Module '{mod_name[:40]}' still has uncompleted or locked activities pending — WILL NOT advance to next module.")

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

                    # Check checkmark completion status
                    is_done = False
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

                    if parent:
                        checkmark = parent.query_selector(
                            ".fa-check, .fa-check-circle, .micon-check_circle, "
                            ".check-icon, .p100, [title='100%'], [class*='check'], [class*='complete']"
                        )
                        if checkmark and checkmark.is_visible():
                            is_done = True

                    modules.append({
                        "id": mod_id,
                        "name": mod_name,
                        "progress": 100 if is_done else 0,
                        "iscompleted": is_done,
                    })
                except Exception:
                    pass

            if modules:
                completed_count = sum(1 for m in modules if m["iscompleted"])
                logger.info(f"Dynamic DOM parse found {len(modules)} module(s) ({completed_count} completed).")
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

    def _process_all_activities_in_module(self, module_url: str, mod_id: str, mod_name: str) -> int:
        """
        Finds and processes every activity inside a module section.
        After each activity, reloads the module URL to close any overlay
        and re-read the (now updated) activity list.
        Returns the number of activities completed in this run.
        """
        activity_attempts: dict = {}
        completed_count = 0
        MAX_ACTIVITIES = 20
        retry_prereq_attempts = 0

        for act_num in range(1, MAX_ACTIVITIES + 1):

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
                logger.warning(f"  DOM query note ({query_err}) — refreshing page...")
                try:
                    self.page.reload(wait_until="domcontentloaded", timeout=20000)
                    time.sleep(3)
                    scope = self._get_active_module_container(mod_id, mod_name)
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
            has_locked_prereqs = False

            for btn in view_buttons:
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

                    # Ignore locked activity prerequisite text
                    if "not available unless" in parent_text.lower():
                        has_locked_prereqs = True
                        logger.info(f"  Activity '{clean_text[:35]}' is locked by prerequisite — waiting for completion telemetry.")
                        continue

                    # Check for true completion strictly via DIKSHA DOM checkmark icons/text
                    is_completed = False
                    if parent:
                        checkmark = parent.query_selector(
                            ".fa-check, .fa-check-circle, .micon-check_circle, "
                            ".check-icon, svg.check, i.fa-check, [class*='check'], [class*='complete']"
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

                    # Only skip if DIKSHA explicitly displays a checkmark, or if we played this title 3 times
                    attempts = activity_attempts.get(clean_text, 0)
                    if is_completed or attempts >= 3:
                        if is_completed:
                            logger.info(f"  Already done: '{clean_text[:35]}' — skipping.")
                        else:
                            logger.info(f"  Played {attempts} times without checkmark: '{clean_text[:35]}' — moving next.")
                        continue

                    unlocked_btn = btn
                    item_title   = clean_text
                    break
                except Exception:
                    continue

            if not unlocked_btn:
                # If activities are locked by prerequisite telemetry right after finishing an activity, wait 10s and retry (up to 4 attempts = 40s)!
                if has_locked_prereqs and retry_prereq_attempts < 4:
                    retry_prereq_attempts += 1
                    logger.info(f"  Waiting 10s for DIKSHA server telemetry sync to unlock next activity (retry {retry_prereq_attempts}/4)...")
                    time.sleep(10)
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

            activity_attempts[item_title] = activity_attempts.get(item_title, 0) + 1
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
            while (time.time() - start) < 600:
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
        """Verifies if all visible activities inside a module have checkmarks. Returns True ONLY if 0 uncompleted remain."""
        try:
            elements = self.page.query_selector_all(
                "a[data-href], div.course-library-link, div.library-card, "
                "div.new-card, .activityinstance, .mod-indent"
            )
            if not elements:
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
                    checkmark = elem.query_selector(
                        ".fa-check, .fa-check-circle, .micon-check_circle, "
                        ".check-icon, svg.check, i.fa-check, [class*='check'], [class*='complete']"
                    )
                    has_check = checkmark is not None or "✔" in txt or "100%" in txt
                    if not has_check:
                        uncompleted_count += 1
                except Exception:
                    pass

            logger.info(f"  Module '{mod_name[:35]}' verification: {uncompleted_count} uncompleted activity(ies) remaining.")
            return uncompleted_count == 0
        except Exception:
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
        """Scrolls the PDF viewer completely from top to bottom, dispatching telemetry events."""
        frames_to_scroll = [self.page] + [f for f in self.page.frames if f != self.page.main_frame and f.url and f.url != "about:blank"]
        for frame in frames_to_scroll:
            try:
                frame.evaluate("""() => {
                    window.scrollTo(0, 0);
                    window.dispatchEvent(new Event('scroll'));
                }""")
                time.sleep(0.5)
                for _ in range(10):
                    frame.evaluate("""() => {
                        window.scrollBy(0, 800);
                        window.dispatchEvent(new Event('scroll'));
                        let el = document.querySelector("#viewerContainer, .pdfViewer, #resourceobject, .resourcecontent");
                        if (el) { el.scrollTop += 800; el.dispatchEvent(new Event('scroll')); }
                    }""")
                    time.sleep(0.4)
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
        script = """
            if (!window.__speedOverrideActive) {
                window.__speedOverrideActive = true;
                setInterval(() => {
                    document.querySelectorAll('video').forEach(v => {
                        if (v.duration && (v.duration - v.currentTime <= 10)) {
                            v.playbackRate = 1.0;
                            v.defaultPlaybackRate = 1.0;
                        } else if (v.playbackRate !== 10.0) {
                            v.playbackRate = 10.0;
                            v.defaultPlaybackRate = 10.0;
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
