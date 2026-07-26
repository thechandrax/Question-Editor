import time
import re
import json
from bs4 import BeautifulSoup
from playwright.sync_api import Page
from config import Config
from utils import logger


# ── HTML/JSON parsing helpers ──────────────────────────────────────────────

def parse_diksha_coursedata_html(html_content: str, status: str = "ongoing") -> list:
    """
    Parses the HTML fragment returned by DIKSHA's course_listing.php AJAX endpoint.
    Handles multiple possible HTML structures DIKSHA uses.
    """
    courses = []
    if not html_content or len(html_content.strip()) < 20:
        return courses

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Scope parsing strictly to enrolled course containers to avoid recommended/popular courses
        enrolled_container = None
        enrolled_selectors = [
            '#coursedata', '.coursedata', '[id*="coursedata"]', '[class*="coursedata"]',
            '#ongoing_courses', '#ongoing', '#finished_courses', '#finished',
            '.my-courses', '#mycourses', '[data-tab="ongoing"]', '[data-tab="finished"]',
            '#region-main', '.main-content', '#maincontent', '#region-main-box'
        ]
        for selector in enrolled_selectors:
            found = soup.select_one(selector)
            if found:
                container_text = found.get_text().lower()
                # Skip if this container is explicitly for recommended/popular courses
                if not any(skip_kw in container_text[:120] for skip_kw in ['recommended courses', 'popular courses', 'featured courses', 'explore all']):
                    enrolled_container = found
                    logger.info(f"  Scoping HTML parse strictly to ENROLLED container: {selector}")
                    break
        
        parse_root = enrolled_container if enrolled_container else soup

        # Double safety: Check for explicit "No courses found" message in the main content area
        main_text = parse_root.get_text().lower()
        if "no courses found" in main_text or "no enrolled courses" in main_text:
            logger.info("  'No courses found' message detected in page HTML — returning 0 courses ✓")
            return []

        candidates = []

        # Strategy 1: elements with data-href (most common)
        candidates = parse_root.find_all(lambda tag: tag.has_attr('data-href'))

        # Strategy 2: divs / spans with card-related classes
        if not candidates:
            candidates = parse_root.find_all(
                lambda tag: tag.name in ('div', 'span') and
                any(kw in ' '.join(tag.get('class', [])) for kw in
                    ['course-library-link', 'library-card', 'new-card', 'course-card', 'card-'])
            )

        # Strategy 3: any element containing "Course Title"
        if not candidates:
            candidates = parse_root.find_all(lambda tag: 'Course Title' in (tag.get_text() or ''))

        # Strategy 4: divs containing links to course.php
        if not candidates:
            links = parse_root.find_all('a', href=re.compile(r'course\.php', re.I))
            for lnk in links:
                parent = lnk.parent
                if parent and parent not in candidates:
                    candidates.append(parent)

        seen_titles = set()
        for elem in candidates:
            try:
                # Parent hierarchy check: Skip if element is inside recommended/popular/explore section
                is_recommended = False
                curr = elem
                for _ in range(6):
                    if not curr or not hasattr(curr, 'get'):
                        break
                    cls_id = (curr.get('class', []) if isinstance(curr.get('class'), list) else []) + [curr.get('id', '')]
                    cls_id_str = ' '.join(str(x) for x in cls_id).lower()
                    if any(kw in cls_id_str for kw in ['recommended', 'popular', 'featured', 'explore', 'other-course', 'catalog', 'search-result', 'all-course']):
                        is_recommended = True
                        break
                    curr = curr.parent

                if is_recommended:
                    continue

                url = (elem.get('data-href') or '').strip()
                if not url:
                    a_tag = elem.find('a', href=True)
                    url = a_tag['href'] if a_tag else ''
                if url and not url.startswith('http'):
                    url = 'https://learning.diksha.gov.in/diksha/' + url.lstrip('/')

                img_tag = elem.find('img')
                img_url = (img_tag.get('src') or '') if img_tag else ''
                if img_url and not img_url.startswith('http'):
                    img_url = 'https://learning.diksha.gov.in/diksha/' + img_url.lstrip('/')

                # Title: try h4 > bdi > any heading > first text line
                h4 = elem.find(['h4', 'h3', 'h2', 'bdi'])
                title = ''
                if h4:
                    title = h4.get_text().replace('Course Title', '').replace(':', '').strip()
                if not title:
                    raw_text = elem.get_text('\n').strip()
                    for line in raw_text.splitlines():
                        line = line.strip()
                        if line and 'Ends on' not in line and '%' not in line:
                            title = line[:80]
                            break

                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)

                # Ends on
                ends_on = ''
                em = re.search(r'Ends on\s*:?\s*<[^>]+>(.*?)</[^>]+>', str(elem), re.I | re.S)
                if not em:
                    em = re.search(r'Ends on\s*:?\s*([^\n<]{3,40})', str(elem), re.I)
                if em:
                    ends_on = re.sub(r'<[^>]+>', '', em.group(1)).strip()

                # Progress %
                pct = 100 if status == 'finished' else 0
                pm = re.search(r'(\d{1,3})%\s*Completed', str(elem), re.I)
                if pm:
                    pct = int(pm.group(1))
                else:
                    ps = re.search(r'width:\s*(\d{1,3})%', str(elem), re.I)
                    if ps:
                        pct = int(ps.group(1))

                courses.append({
                    'title': title,
                    'ends_on': ends_on,
                    'pct': pct,
                    'progress': pct,
                    'url': url,
                    'status': status,
                    'image_url': img_url,
                })
                logger.info(f"  ✔ Parsed [{status}]: '{title[:55]}' → {pct}%")
            except Exception as ex:
                logger.debug(f'Element parse note: {ex}')
    except Exception as e:
        logger.warning(f'Error in parse_diksha_coursedata_html: {e}')

    return courses


def _do_ajax_post_in_browser(page: Page, payload: str, label: str) -> tuple[bool, list]:
    """
    Runs the AJAX POST INSIDE the browser via page.evaluate().
    This guarantees all session cookies (PHPSESSID, etc.) are included automatically.
    """
    status = 'finished' if 'finish' in payload or 'complet' in payload else 'ongoing'
    try:
        # Escape payload for JS string
        safe_payload = payload.replace("'", "\\'")
        result = page.evaluate(f"""
            async () => {{
                try {{
                    const resp = await fetch(
                        'https://learning.diksha.gov.in/diksha/course_listing.php',
                        {{
                            method: 'POST',
                            credentials: 'include',
                            headers: {{
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'Accept': 'application/json, text/html, */*',
                            }},
                            body: '{safe_payload}'
                        }}
                    );
                    const text = await resp.text();
                    return {{ status: resp.status, body: text.substring(0, 8000), ok: resp.ok }};
                }} catch(e) {{
                    return {{ status: 0, body: '', ok: false, error: String(e) }};
                }}
            }}
        """)
        body = result.get('body', '') if result else ''
        http_status = result.get('status', 0) if result else 0
        err = result.get('error', '') if result else 'null result'
        logger.info(f"  AJAX-Browser [{label}] → HTTP {http_status}, len={len(body)}, preview={body[:150].strip()!r}")
        if err:
            logger.info(f"  AJAX-Browser error: {err}")

        if not body.strip():
            return False, []

        # Try JSON
        try:
            jdata = json.loads(body)
            logger.info(f"  JSON keys: {list(jdata.keys()) if isinstance(jdata, dict) else type(jdata).__name__}")
            if isinstance(jdata, dict):
                for key in ('coursedata', 'data', 'html', 'content', 'courses'):
                    fragment = jdata.get(key, '')
                    if fragment:
                        parsed = parse_diksha_coursedata_html(str(fragment), status=status)
                        if parsed:
                            return True, parsed
            elif isinstance(jdata, list) and jdata:
                return True, _parse_json_course_list(jdata, status)
        except Exception:
            pass

        # Raw HTML response
        parsed = parse_diksha_coursedata_html(body, status=status)
        if parsed:
            return True, parsed

    except Exception as e:
        logger.info(f"  AJAX-Browser [{label}] exception: {e}")
    return False, []


def _do_ajax_post(page: Page, payload: str, label: str) -> tuple[bool, list]:
    """
    Fallback: sends AJAX POST via page.request (Playwright context).
    """
    status = 'finished' if 'finish' in payload or 'complet' in payload else 'ongoing'
    try:
        resp = page.request.post(
            'https://learning.diksha.gov.in/diksha/course_listing.php',
            headers={
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': 'https://learning.diksha.gov.in/diksha/course_listing.php',
                'Accept': 'application/json, text/html, */*',
            },
            data=payload,
        )
        body = resp.text()
        logger.info(f"  AJAX-Request [{label}] → HTTP {resp.status}, len={len(body)}, preview={body[:150].strip()!r}")
        if not resp.ok or not body.strip():
            return False, []
        try:
            jdata = resp.json()
            logger.info(f"  JSON keys: {list(jdata.keys()) if isinstance(jdata, dict) else type(jdata).__name__}")
            if isinstance(jdata, dict):
                for key in ('coursedata', 'data', 'html', 'content', 'courses'):
                    fragment = jdata.get(key, '')
                    if fragment:
                        parsed = parse_diksha_coursedata_html(str(fragment), status=status)
                        if parsed:
                            return True, parsed
            elif isinstance(jdata, list) and jdata:
                return True, _parse_json_course_list(jdata, status)
        except Exception:
            pass
        parsed = parse_diksha_coursedata_html(body, status=status)
        if parsed:
            return True, parsed
    except Exception as e:
        logger.info(f"  AJAX-Request [{label}] exception: {e}")
    return False, []


def _parse_json_course_list(items: list, status: str) -> list:
    """Handle case where AJAX returns a raw list of course dicts."""
    courses = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get('title') or item.get('name') or item.get('courseName') or ''
        if not title:
            continue
        pct = item.get('progress') or item.get('percentage') or (100 if status == 'finished' else 0)
        url = item.get('url') or item.get('link') or item.get('courseUrl') or ''
        courses.append({
            'title': title,
            'ends_on': item.get('endDate') or item.get('ends_on') or '',
            'pct': int(pct),
            'progress': int(pct),
            'url': url,
            'status': status,
            'image_url': item.get('image') or item.get('thumbnail') or '',
        })
    return courses


# ── CourseNavigator class ──────────────────────────────────────────────────

class CourseNavigator:
    """
    Handles navigation & scraping of DIKSHA Courses.
    """

    def __init__(self, page: Page):
        self.page = page

    def _ensure_on_course_listing(self):
        """
        Navigates directly to course_listing.php if not already there.
        auth.login() already lands here after SSO sync, so this is usually a no-op.
        """
        target = 'https://learning.diksha.gov.in/diksha/course_listing.php'
        current = self.page.url or ''
        if 'course_listing.php' in current:
            logger.info(f'Already on course_listing.php — reloading to ensure fresh data...')
            try:
                self.page.reload(wait_until='networkidle', timeout=30000)
                time.sleep(2)
            except Exception as e:
                logger.warning(f'Reload note: {e}')
        else:
            logger.info(f'Navigating directly to: {target}')
            try:
                self.page.goto(target, wait_until='networkidle', timeout=35000)
                time.sleep(2)
            except Exception as e:
                logger.warning(f'Navigation note: {e}')
        self._check_and_recover_access_denied()
        logger.info(f'  URL: {self.page.url}')
        logger.info(f'  Title: {self.page.title()}')
        # Wait for JS-rendered course cards
        for sel in ['span[data-href]', 'div[data-href]', '.library-card', '[class*="card"]', 'h4', 'bdi']:
            try:
                self.page.wait_for_selector(sel, timeout=6000)
                count = len(self.page.query_selector_all(sel))
                if count > 0:
                    logger.info(f'  Ready: {count} elements matching "{sel}"')
                    break
            except Exception:
                pass
        time.sleep(1)

    def fetch_from_course_listing(self) -> dict:
        """
        Direct fetch: goes straight to course_listing.php and reads courses.
        Used by fetch_courses_only() since auth.login() already lands there.
        Saves ~20-30s vs fetch_all_courses() which does Steps 3, 4, 5.
        """
        logger.info('=== Direct Fetch: course_listing.php ===')
        self._ensure_on_course_listing()
        return self._run_fetch_strategies()


    def _check_and_recover_access_denied(self):
        """Self-healing helper: detects Access Denied and auto-recovers SSO session."""
        try:
            body_text = self.page.inner_text('body').lower()
            if 'access denied' in body_text:
                logger.warning("Self-Healing: 'Access Denied' detected! Auto-refreshing SSO tokens...")
                self.page.goto('https://diksha.gov.in/search/Library/1?selectedTab=all&auth_callback=1',
                               wait_until='domcontentloaded')
                time.sleep(3)
                self.page.reload(wait_until='domcontentloaded')
                time.sleep(2)
        except Exception:
            pass

    def step_3_diksha_courses(self):
        target = 'https://diksha.gov.in/search/Library/1?selectedTab=all'
        logger.info('==================================================')
        logger.info(f'Step 3: Navigating to DIKSHA Courses: {target}')
        logger.info('==================================================')
        self.page.goto(target, wait_until='domcontentloaded')
        time.sleep(2)
        self._check_and_recover_access_denied()

    def step_4_explore_courses(self):
        target = 'https://learning.diksha.gov.in/diksha/course_library.php'
        logger.info('==================================================')
        logger.info(f'Step 4: Navigating to Explore Courses: {target}')
        logger.info('==================================================')
        try:
            self.page.goto(target, wait_until='domcontentloaded', timeout=25000)
            time.sleep(2)
            self._check_and_recover_access_denied()
        except Exception as e:
            logger.warning(f'Note during Step 4: {e}')

    def step_5_my_learning(self):
        target = 'https://learning.diksha.gov.in/diksha/course_listing.php'
        logger.info('==================================================')
        logger.info(f'Step 5: Navigating to My Learning Journey: {target}')
        logger.info('==================================================')
        try:
            self.page.goto(target, wait_until='networkidle', timeout=35000)
            time.sleep(2)
            self._check_and_recover_access_denied()
            logger.info(f'  Page URL after load: {self.page.url}')
            logger.info(f'  Page title: {self.page.title()}')
            # Wait for JS-rendered course cards to appear
            card_selectors = [
                'span[data-href]', 'div[data-href]',
                '.library-card', '.course-card', '[class*="card"]',
                'h4', 'bdi',  # course title elements
            ]
            for sel in card_selectors:
                try:
                    self.page.wait_for_selector(sel, timeout=6000)
                    count = len(self.page.query_selector_all(sel))
                    logger.info(f'  Found {count} elements matching "{sel}" after page load')
                    if count > 0:
                        break
                except Exception:
                    pass
            time.sleep(1)
        except Exception as e:
            logger.warning(f'Note during Step 5: {e}')

    # ── Shared fetch strategy engine ─────────────────────────────────────

    def _run_fetch_strategies(self) -> dict:
        """
        Tries 4 strategies in order to extract ongoing + finished courses
        from the current page (assumed to be course_listing.php).
        Shared by fetch_from_course_listing() and fetch_all_courses().
        """
        result = {'ongoing': [], 'finished': [], 'all': []}

        ongoing_payloads = [
            ('tab_type=ongoing', 'tab_type=ongoing'),
            ('tab_type=1',       'tab_type=1'),
            ('type=ongoing',     'type=ongoing'),
            ('tab=ongoing',      'tab=ongoing'),
            ('',                 'empty-body'),
        ]
        finished_payloads = [
            ('tab_type=finished',   'tab_type=finished'),
            ('tab_type=2',          'tab_type=2'),
            ('tab_type=completed',  'tab_type=completed'),
            ('type=finished',       'type=finished'),
            ('tab=finished',        'tab=finished'),
        ]

        # ── Strategy B: Parse full rendered page HTML (FASTEST — try first) ─
        # HTML parse directly reads the DOM — no AJAX needed, no extra roundtrips.
        logger.info('=== Strategy B: Full page HTML parse ===')
        try:
            page_html = self.page.content()
            logger.info(f'  HTML length: {len(page_html)} | preview: {page_html[:200].strip()!r}')
            parsed = parse_diksha_coursedata_html(page_html, status='ongoing')
            if parsed:
                result['ongoing'] = parsed
                logger.info(f'  ✔ Page HTML parse → {len(parsed)} ongoing courses')
            else:
                if 'login' in page_html.lower() or 'sign in' in page_html.lower():
                    logger.warning('  ⚠ Page shows login prompt — session may have expired!')
        except Exception as e:
            logger.warning(f'  Strategy B error: {e}')

        # ── Strategy A: In-browser fetch() AJAX — only if HTML parse failed ─
        # These typically return [] but kept as fallback for API-first portals.
        if not result['ongoing']:
            logger.info('=== Strategy A: In-browser fetch() AJAX POST ===')
            for payload, label in ongoing_payloads:
                ok, courses = _do_ajax_post_in_browser(self.page, payload, label)
                if ok and courses:
                    result['ongoing'] = courses
                    logger.info(f'  ✔ In-browser AJAX ongoing [{label}] → {len(courses)} courses')
                    break

        if not result['ongoing']:
            logger.info('=== Strategy A2: page.request AJAX fallback ===')
            for payload, label in ongoing_payloads:
                ok, courses = _do_ajax_post(self.page, payload, label)
                if ok and courses:
                    result['ongoing'] = courses
                    logger.info(f'  ✔ page.request AJAX ongoing [{label}] → {len(courses)} courses')
                    break

        # AJAX for finished (only if Strategy B didn't already find them)
        if not result['finished']:
            for payload, label in finished_payloads:
                ok, courses = _do_ajax_post_in_browser(self.page, payload, label)
                if ok and courses:
                    result['finished'] = courses
                    logger.info(f'  ✔ In-browser AJAX finished [{label}] → {len(courses)} courses')
                    break

        if not result['finished']:
            for payload, label in finished_payloads:
                ok, courses = _do_ajax_post(self.page, payload, label)
                if ok and courses:
                    result['finished'] = courses
                    logger.info(f'  ✔ page.request AJAX finished [{label}] → {len(courses)} courses')
                    break

        # ── Strategy C: Click Ongoing tab then re-parse ──────────────────
        if not result['ongoing']:
            logger.info('=== Strategy C: Click tab + re-parse ===')
            try:
                for sel in ['a[href*="ongoing"]', 'button[data-tab="ongoing"]',
                            '.nav-link:has-text("Ongoing")', 'a:has-text("Ongoing")',
                            '[data-type="ongoing"]', '#ongoing-tab', '.tab-ongoing']:
                    try:
                        el = self.page.query_selector(sel)
                        if el:
                            el.click(); time.sleep(2)
                            page_html = self.page.content()
                            parsed = parse_diksha_coursedata_html(page_html, status='ongoing')
                            if parsed:
                                result['ongoing'] = parsed
                                logger.info(f'  ✔ After tab click [{sel}] → {len(parsed)} courses')
                            break
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f'  Strategy C error: {e}')

        # ── Strategy D: DOM card scraping for ONGOING (last resort) ─────────
        if not result['ongoing']:
            logger.info('=== Strategy D: DOM scraping for ONGOING (last resort) ===')
            result['ongoing'] = self._scrape_cards_from_page(status='ongoing')

        # ── Strategy D: HTML parse for FINISHED (clicking tab first) ─────
        if not result['finished']:
            logger.info('=== Strategy D: HTML parse for FINISHED (clicking tab first) ===')
            # Click Finished tab → then HTML parse (same reliable method as Strategy B for ongoing)
            # DOM scraping is NOT used here — it picks up wrong course cards from other page sections
            finished_tab_clicked = False
            for sel in [
                'a[href*="finished"]', 'button[data-tab="finished"]',
                'a:has-text("Finished")', 'li:has-text("Finished") a',
                '[data-type="finished"]', '#finished-tab', '.tab-finished',
                'a[onclick*="finished"]', '[data-target*="finished"]',
            ]:
                try:
                    el = self.page.query_selector(sel)
                    if el:
                        el.click()
                        time.sleep(2)
                        finished_tab_clicked = True
                        logger.info(f'  Clicked Finished tab: {sel}')
                        break
                except Exception:
                    pass

            if not finished_tab_clicked:
                logger.info('  No Finished tab found — 0 finished courses')
            else:
                # Parse the Finished tab HTML (not DOM scrape — avoids false positives)
                try:
                    finished_html = self.page.content()
                    parsed_finished = parse_diksha_coursedata_html(finished_html, status='finished')
                    if parsed_finished:
                        result['finished'] = parsed_finished
                        logger.info(f'  ✔ Finished tab HTML parse → {len(parsed_finished)} course(s)')
                    else:
                        logger.info('  Finished tab HTML parse → 0 courses (matches DIKSHA "No Courses Found")')
                except Exception as e:
                    logger.warning(f'  Finished HTML parse error: {e}')

        # ── Safety deduplication ──────────────────────────────────────────
        ongoing_titles = {c.get('title', '').strip().lower() for c in result['ongoing'] if c.get('title')}
        before = len(result['finished'])
        result['finished'] = [
            c for c in result['finished']
            if c.get('title', '').strip().lower() not in ongoing_titles
        ]
        removed = before - len(result['finished'])
        if removed:
            logger.info(f'  Deduplication removed {removed} false duplicate(s) from finished list')

        result['all'] = result['ongoing'] + result['finished']
        logger.info(f'Fetch Summary: {len(result["ongoing"])} Ongoing, {len(result["finished"])} Finished courses.')
        return result


    # ── Full navigation fetcher (used by automation flow) ────────────────

    def fetch_all_courses(self) -> dict:
        """
        Full flow: Steps 3→4→5 then fetch.
        Used by run_automation(). For scan-only use fetch_from_course_listing().
        """
        self.step_3_diksha_courses()
        self.step_4_explore_courses()
        self.step_5_my_learning()
        return self._run_fetch_strategies()

    def _scrape_cards_from_page(self, status: str = 'ongoing') -> list:
        """DOM-level card scraping fallback."""
        courses = []
        try:
            selectors = [
                'span[data-href]', 'div[data-href]',
                '.card', '.library-card', '.course-card',
                'div[class*="card"]', 'span[class*="card"]',
            ]
            cards = []
            for sel in selectors:
                found = self.page.query_selector_all(sel)
                if found:
                    cards = found
                    logger.info(f'  DOM Fallback [{sel}]: {len(found)} elements found')
                    break

            seen_titles: set = set()
            for card in cards:
                try:
                    text_content = card.inner_text().strip()
                    if not text_content:
                        continue

                    title = ''
                    title_match = re.search(r'Course Title\s*:\s*(.+)', text_content)
                    if title_match:
                        title = title_match.group(1).split('\n')[0].strip()
                    if not title:
                        lines = [l.strip() for l in text_content.splitlines() if l.strip()]
                        title = lines[0][:80] if lines else ''

                    if not title or title in seen_titles:
                        continue
                    seen_titles.add(title)

                    ends_on = ''
                    em = re.search(r'Ends on\s*:\s*(.+)', text_content)
                    if em:
                        ends_on = em.group(1).split('\n')[0].strip()

                    pct = 100 if status == 'finished' else 0
                    pm = re.search(r'(\d{1,3})%\s*Completed', text_content)
                    if pm:
                        pct = int(pm.group(1))

                    # URL
                    url = card.get_attribute('data-href') or ''
                    if not url:
                        a_el = card.query_selector('a[href*="course.php"]')
                        if a_el:
                            url = a_el.get_attribute('href') or ''
                    if url and not url.startswith('http'):
                        url = 'https://learning.diksha.gov.in/diksha/' + url.lstrip('/')
                    if not url:
                        url = 'https://learning.diksha.gov.in/diksha/course_listing.php'

                    img_el = card.query_selector('img')
                    img_url = (img_el.get_attribute('src') or '') if img_el else ''
                    if img_url and not img_url.startswith('http'):
                        img_url = 'https://learning.diksha.gov.in/diksha/' + img_url.lstrip('/')

                    courses.append({
                        'title': title,
                        'ends_on': ends_on,
                        'pct': pct,
                        'progress': pct,
                        'url': url,
                        'status': status,
                        'image_url': img_url,
                    })
                    logger.info(f'  DOM card [{status}]: {title[:55]} → {pct}%')
                except Exception as ex:
                    logger.debug(f'Card parse note: {ex}')
        except Exception as e:
            logger.warning(f'Error scraping DOM {status} courses: {e}')
        return courses

    def step_6_check_incomplete_courses(self) -> list:
        """Step 6: Scan 'Ongoing Courses' cards and filter for courses < 100%."""
        logger.info('==================================================')
        logger.info('Step 6: Checking for Ongoing Courses < 100% Completed...')
        logger.info('==================================================')
        all_data = self.fetch_all_courses()
        incomplete = [
            c for c in all_data.get('ongoing', [])
            if (c.get('pct', 0) < 100 or c.get('progress', 0) < 100)
        ]
        logger.info(f'Step 6 Result: Identified {len(incomplete)} incomplete course(s).')
        return incomplete
