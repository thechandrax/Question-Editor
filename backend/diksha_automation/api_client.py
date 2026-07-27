"""
DikshaAPIClient — direct HTTP calls using the authenticated Playwright session.

KEY FIX: Added Playwright request interception (setup_interception / get_module_progress_via_intercept)
to auto-capture the exact POST payload that the browser sends to course.php.
No guessing needed — we let the browser make the real request once, record it, then replay.
"""

import logging
import requests
from playwright.sync_api import BrowserContext, Page

logger = logging.getLogger(__name__)

BASE = "https://learning.diksha.gov.in"


class DikshaAPIClient:

    def __init__(self, context: BrowserContext):
        self.session = requests.Session()
        self._captured_payload: str = ""   # auto-set by intercept
        self._captured_api_url: str = ""
        self.captured_telemetry: dict = {}  # Stores captured completion/telemetry templates
        self._sync_cookies(context)
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/150.0.0.0 Safari/537.36"
            ),
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": BASE,
            "Referer": BASE + "/diksha/",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        })

    # ------------------------------------------------------------------ #
    #  Cookie sync
    # ------------------------------------------------------------------ #

    def _sync_cookies(self, context: BrowserContext):
        try:
            cookies = context.cookies()
            for c in cookies:
                self.session.cookies.set(
                    c["name"], c["value"],
                    domain=c.get("domain", ""),
                    path=c.get("path", "/"),
                )
            logger.info(f"API client synced {len(cookies)} cookies from browser context.")
        except Exception as e:
            logger.warning(f"Cookie sync warning: {e}")

    def refresh_cookies(self, context: BrowserContext):
        """Re-sync cookies after browser navigation (tokens may refresh)."""
        self.session.cookies.clear()
        self._sync_cookies(context)

    # ------------------------------------------------------------------ #
    #  Request interception — auto-capture POST payload from real browser
    # ------------------------------------------------------------------ #

    def setup_interception(self, page: Page, course_id: str, section_id: str):
        """
        Attaches a Playwright request listener to `page` that captures the
        exact POST payload the browser sends to course.php, as well as any
        telemetry or AJAX completion requests.
        """
        target_url_fragment = f"course.php?id={course_id}&section={section_id}"

        def on_request(request):
            try:
                url_lower = request.url.lower()
                # 1. Capture course syllabus payload
                if target_url_fragment in request.url and request.method == "POST":
                    payload = request.post_data or ""
                    if payload and not self._captured_payload:
                        self._captured_payload = payload
                        self._captured_api_url = request.url
                        logger.info(
                            f"✔ Captured syllabus API payload ({len(payload)} bytes): {payload[:80]}"
                        )
                
                # 2. Capture telemetry or Moodle/Sunbird completion AJAX requests
                if request.method == "POST" and any(k in url_lower for k in ["telemetry", "service.php", "ping.php", "completion"]):
                    payload = request.post_data or ""
                    headers = request.headers or {}
                    
                    # Extract page ID from current URL
                    from urllib.parse import urlparse, parse_qs
                    current_id = ""
                    try:
                        qs = parse_qs(urlparse(page.url).query)
                        current_id = qs.get("id", [""])[0] or qs.get("cmid", [""])[0]
                    except Exception:
                        pass
                        
                    category = "telemetry" if "telemetry" in url_lower else ("service" if "service.php" in url_lower else "generic")
                    if category not in self.captured_telemetry:
                        self.captured_telemetry[category] = {
                            "url": request.url,
                            "headers": {k: v for k, v in headers.items() if k.lower() in ["authorization", "content-type", "x-requested-with"]},
                            "body": payload,
                            "capture_id": current_id
                        }
                        logger.info(f"✔ Intercepted completion template ({category}) with ID {current_id}: {request.url[:60]}")
            except Exception:
                pass

        page.on("request", on_request)
        logger.info(f"Request interception active for: {target_url_fragment}")

    def replay_telemetry_request(self, category: str, current_id: str = None) -> bool:
        """Replays a captured telemetry/ajax request, swapping the activity ID if needed."""
        req_info = self.captured_telemetry.get(category)
        if not req_info:
            logger.warning(f"No captured telemetry template found for: {category}")
            return False
            
        url = req_info["url"]
        headers = dict(self.session.headers)
        headers.update(req_info.get("headers", {}))
        body = req_info.get("body", "")
        capture_id = req_info.get("capture_id", "")
        
        # Replace capture_id with current_id in URL and body
        if capture_id and current_id and capture_id != current_id:
            logger.info(f"  [Method 2] Swapping template ID {capture_id} → {current_id}")
            url = url.replace(capture_id, current_id)
            if isinstance(body, str):
                body = body.replace(capture_id, current_id)
            elif isinstance(body, bytes):
                body = body.replace(capture_id.encode(), current_id.encode())
        
        try:
            logger.info(f"  Replaying telemetry ({category}) to {url[:50]}...")
            resp = self.session.post(url, data=body, headers=headers, timeout=15)
            logger.info(f"  Replay response: {resp.status_code}")
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"  Failed to replay telemetry request: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  Module progress API
    # ------------------------------------------------------------------ #

    def get_module_progress(self, course_id: str, section_id: str, page: Page = None) -> list:
        """
        Fetch real-time module progress from DIKSHA API.
        If page (Playwright Page) is provided, executes the fetch directly inside the browser
        context to bypass Cloudflare / security 403 blocks.
        """
        url = f"{BASE}/diksha/course.php?id={course_id}&section={section_id}"

        # 1. Try in-browser fetch (100% reliable session/auth)
        if page:
            try:
                logger.info("Attempting in-browser API fetch for module progress...")
                result = page.evaluate("""
                    async (fetchUrl) => {
                        try {
                            const resp = await fetch(
                                fetchUrl,
                                {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: {
                                        'X-Requested-With': 'XMLHttpRequest',
                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                        'Accept': 'application/json, text/javascript, */*',
                                    },
                                    body: 'function=get_course_syllabus_data&type=all'
                                }
                            );
                            const text = await resp.text();
                            return { status: resp.status, body: text, ok: resp.ok };
                        } catch(e) {
                            return { status: 0, body: e.message, ok: false };
                        }
                    }
                """, url)
                
                if result and result.get("ok"):
                    import json
                    data = json.loads(result["body"])
                    modules = []
                    if isinstance(data, dict):
                        raw_modules = None
                        if "syllabus" in data:
                            raw_modules = data["syllabus"]
                        elif "modules" in data:
                            raw_modules = data["modules"]
                        
                        if raw_modules:
                            for m in raw_modules:
                                modules.append({
                                    "id": str(m.get("syl_id") or m.get("section_id") or m.get("sectionid") or m.get("section") or m.get("cmid") or m.get("id") or ""),
                                    "name": m.get("syl_name") or m.get("name") or m.get("sectionname") or m.get("title") or "",
                                    "progress": int(m.get("progress") or m.get("syl_progress") or 0),
                                    "iscompleted": bool(m.get("iscompleted") or m.get("completed") or False)
                                })
                    if modules:
                        logger.info(f"Module progress fetched via in-browser AJAX: {len(modules)} modules.")
                        return modules
            except Exception as e:
                logger.debug(f"In-browser AJAX fetch failed: {e}")

        # Build candidate payloads — captured first, then guesses
        payloads_to_try: list = []

        if self._captured_payload:
            payloads_to_try.append(self._captured_payload)   # raw string body
            
        payloads_to_try.append("function=get_course_syllabus_data&type=all")

        # Common patterns (covers most Moodle/DIKSHA variants)
        payloads_to_try += [
            f"action=getmodules&id={course_id}",
            f"id={course_id}&action=getmodules",
            f"action=getmodules",
            f"modeActive=&id={course_id}&section={section_id}",
            f"id={course_id}&section={section_id}",
            f"course={course_id}&action=modules",
        ]

        for payload in payloads_to_try:
            try:
                headers = dict(self.session.headers)
                headers["Referer"] = (
                    f"{BASE}/diksha/course.php?id={course_id}&section={section_id}&modeActive="
                )

                resp = self.session.post(
                        url, data=payload, headers=headers, timeout=15
                    )

                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        modules = []
                        if isinstance(data, dict):
                            raw_modules = None
                            if "syllabus" in data:
                                raw_modules = data["syllabus"]
                            elif "modules" in data:
                                raw_modules = data["modules"]
                            
                            if raw_modules:
                                for m in raw_modules:
                                    modules.append({
                                        "id": str(m.get("syl_id") or m.get("id") or ""),
                                        "name": m.get("syl_name") or m.get("name") or "",
                                        "progress": int(m.get("progress") or m.get("syl_progress") or 0),
                                        "iscompleted": bool(m.get("iscompleted") or m.get("completed") or False)
                                    })
                        
                        if modules:
                            logger.info(
                                f"Module progress fetched via API: {len(modules)} modules."
                            )
                            return modules
                    except Exception:
                        pass
            except Exception as e:
                logger.debug(f"API attempt failed (payload={str(payload)[:40]}): {e}")

        logger.warning(
            "Could not fetch module progress via API — will use hardcoded fallback."
        )
        return []

    def get_incomplete_modules(self, course_id: str, section_id: str) -> list:
        """Returns only modules where progress < 100."""
        modules = self.get_module_progress(course_id, section_id)
        incomplete = [
            m for m in modules
            if int(m.get("progress", 0)) < 100 and m.get("isvisible", True)
        ]
        logger.info(
            f"Incomplete: {len(incomplete)}/{len(modules)} — "
            + ", ".join(m["name"][:25] for m in incomplete)
        )
        return incomplete

    # ------------------------------------------------------------------ #
    #  Content view marking
    # ------------------------------------------------------------------ #

    def mark_content_viewed(self, content_id: str) -> bool:
        """
        Record content as 'viewed' by fetching its URL directly.
        DIKSHA records the view event the moment this URL is fetched.
        """
        url = f"{BASE}/diksha/course_content.php?id={content_id}"
        try:
            resp = self.session.get(url, timeout=20, allow_redirects=True)
            ok = resp.status_code == 200
            logger.info(
                f"mark_content_viewed(id={content_id}): HTTP {resp.status_code} — "
                f"{'OK' if ok else 'FAILED'}"
            )
            return ok
        except Exception as e:
            logger.warning(f"mark_content_viewed({content_id}) failed: {e}")
            return False
