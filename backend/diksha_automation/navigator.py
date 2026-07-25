import time
import re
from bs4 import BeautifulSoup
from playwright.sync_api import Page
from config import Config
from utils import logger


def parse_diksha_coursedata_html(html_content: str, status: str = "ongoing") -> list:
    """
    Parses the JSON 'coursedata' HTML string returned by DIKSHA's course_listing.php AJAX endpoint.
    """
    courses = []
    if not html_content:
        return courses

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        # Find spans/cards with data-href or class course-library-link
        spans = soup.find_all('span', class_=re.compile(r'course-library-link|library-card'))
        if not spans:
            spans = soup.find_all(lambda tag: tag.has_attr('data-href') or (tag.name == 'div' and ('library-card' in tag.get('class', []) or 'new-card' in tag.get('class', []))))

        if not spans:
            # Fallback: search all divs or spans containing "Course Title"
            spans = soup.find_all(lambda tag: 'Course Title' in tag.get_text())

        seen_titles = set()
        for span in spans:
            try:
                url = span.get('data-href') or ""
                if not url:
                    a_tag = span.find('a', href=True)
                    url = a_tag['href'] if a_tag else ""

                if url and not url.startswith('http'):
                    url = "https://learning.diksha.gov.in/diksha/" + url.lstrip('/')

                img_tag = span.find('img')
                img_url = img_tag['src'] if img_tag and img_tag.has_attr('src') else ""
                if img_url and not img_url.startswith('http'):
                    img_url = "https://learning.diksha.gov.in/diksha/" + img_url.lstrip('/')

                h4_tag = span.find('h4') or span.find('bdi')
                title = ""
                if h4_tag:
                    title = h4_tag.get_text().replace("Course Title", "").replace(":", "").strip()
                if not title:
                    title = span.get_text().split("\n")[0].strip()[:60]

                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)

                ends_on = ""
                ends_match = re.search(r'Ends on\s*:\s*<span>(.*?)</span>', str(span), re.IGNORECASE)
                if not ends_match:
                    ends_match = re.search(r'Ends on\s*:\s*([^\n<]+)', str(span), re.IGNORECASE)
                if ends_match:
                    ends_on = ends_match.group(1).strip()

                pct = 100 if status == "finished" else 0
                pct_match = re.search(r'(\d+)%\s*Completed', str(span), re.IGNORECASE)
                if pct_match:
                    pct = int(pct_match.group(1))
                else:
                    pct_style = re.search(r'width:\s*(\d+)%', str(span), re.IGNORECASE)
                    if pct_style:
                        pct = int(pct_style.group(1))

                courses.append({
                    'title': title,
                    'ends_on': ends_on,
                    'pct': pct,
                    'progress': pct,
                    'url': url,
                    'status': status,
                    'image_url': img_url
                })
                logger.info(f"  Parsed DIKSHA HTML [{status}]: '{title}' ({pct}% Completed, Ends: '{ends_on}')")
            except Exception as ex:
                logger.debug(f"Span parse note: {ex}")
    except Exception as e:
        logger.warning(f"Error parsing coursedata HTML: {e}")

    return courses


class CourseNavigator:
    """
    Handles navigation & scraping of DIKSHA Courses.
    """

    def __init__(self, page: Page):
        self.page = page

    def _check_and_recover_access_denied(self):
        """Self-healing helper: detects Access Denied and auto-recovers SSO session."""
        try:
            body_text = self.page.inner_text("body").lower()
            if "access denied" in body_text:
                logger.warning("Self-Healing: 'Access Denied' detected! Auto-refreshing SSO session tokens...")
                self.page.goto("https://diksha.gov.in/search/Library/1?selectedTab=all&auth_callback=1", wait_until="domcontentloaded")
                time.sleep(3)
                self.page.reload(wait_until="domcontentloaded")
                time.sleep(2)
        except Exception:
            pass

    def step_3_diksha_courses(self):
        """Step 3: Open DIKSHA Courses search page."""
        target = "https://diksha.gov.in/search/Library/1?selectedTab=all"
        logger.info("==================================================")
        logger.info(f"Step 3: Navigating to DIKSHA Courses: {target}")
        logger.info("==================================================")
        self.page.goto(target, wait_until="domcontentloaded")
        time.sleep(2)
        self._check_and_recover_access_denied()

    def step_4_explore_courses(self):
        """Step 4: Open Explore Courses library page."""
        target = "https://learning.diksha.gov.in/diksha/course_library.php"
        logger.info("==================================================")
        logger.info(f"Step 4: Navigating to Explore Courses: {target}")
        logger.info("==================================================")
        try:
            self.page.goto(target, wait_until="domcontentloaded", timeout=25000)
            time.sleep(2)
            self._check_and_recover_access_denied()
        except Exception as e:
            logger.warning(f"Note during Step 4: {e}")

    def step_5_my_learning(self):
        """Step 5: Open My Learning Journey page."""
        target = "https://learning.diksha.gov.in/diksha/course_listing.php"
        logger.info("==================================================")
        logger.info(f"Step 5: Navigating to My Learning Journey: {target}")
        logger.info("==================================================")
        try:
            self.page.goto(target, wait_until="domcontentloaded", timeout=25000)
            time.sleep(2)
            self._check_and_recover_access_denied()
        except Exception as e:
            logger.warning(f"Note during Step 5: {e}")

    def fetch_all_courses(self) -> dict:
        """
        Navigates through Steps 3, 4, 5 and fetches both Ongoing Courses and Finished Courses
        using direct AJAX POST requests to course_listing.php & HTML parsing.
        """
        self.step_3_diksha_courses()
        self.step_4_explore_courses()
        self.step_5_my_learning()

        result = {'ongoing': [], 'finished': [], 'all': []}

        # 1. Fetch Ongoing Courses via AJAX POST
        logger.info("Fetching Ongoing Courses via course_listing.php AJAX POST...")
        try:
            post_payloads = ["tab_type=ongoing", "type=ongoing", "tab=ongoing", ""]
            for payload in post_payloads:
                resp = self.page.request.post(
                    "https://learning.diksha.gov.in/diksha/course_listing.php",
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    data=payload
                )
                if resp.ok:
                    try:
                        res_json = resp.json()
                        coursedata_html = res_json.get("coursedata", "")
                        if coursedata_html:
                            parsed = parse_diksha_coursedata_html(coursedata_html, status="ongoing")
                            if parsed:
                                result['ongoing'] = parsed
                                logger.info(f"Successfully fetched {len(parsed)} ongoing course(s) via AJAX POST.")
                                break
                    except Exception as json_err:
                        logger.debug(f"JSON decode note: {json_err}")
        except Exception as e:
            logger.warning(f"AJAX POST for ongoing courses failed: {e}")

        # If AJAX POST yielded 0, fallback to page DOM element evaluation
        if not result['ongoing']:
            logger.info("Fallback: Scraping Ongoing Courses from page DOM...")
            result['ongoing'] = self._scrape_cards_from_page(status="ongoing")

        # 2. Fetch Finished Courses via AJAX POST
        logger.info("Fetching Finished Courses via course_listing.php AJAX POST...")
        try:
            post_payloads = ["tab_type=finished", "tab_type=completed", "type=finished"]
            for payload in post_payloads:
                resp = self.page.request.post(
                    "https://learning.diksha.gov.in/diksha/course_listing.php",
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    data=payload
                )
                if resp.ok:
                    try:
                        res_json = resp.json()
                        coursedata_html = res_json.get("coursedata", "")
                        if coursedata_html:
                            parsed = parse_diksha_coursedata_html(coursedata_html, status="finished")
                            if parsed:
                                result['finished'] = parsed
                                logger.info(f"Successfully fetched {len(parsed)} finished course(s) via AJAX POST.")
                                break
                    except Exception as json_err:
                        logger.debug(f"JSON decode note: {json_err}")
        except Exception as e:
            logger.warning(f"AJAX POST for finished courses failed: {e}")

        result['all'] = result['ongoing'] + result['finished']
        logger.info(f"Fetch Summary: Found {len(result['ongoing'])} Ongoing and {len(result['finished'])} Finished courses.")
        return result

    def _scrape_cards_from_page(self, status: str = "ongoing") -> list:
        courses = []
        try:
            cards = self.page.query_selector_all('div[class*="card"], .card, .library-card, span[data-href]')
            logger.info(f"DOM Fallback: Found {len(cards)} card elements for '{status}'.")

            seen_titles = set()
            for card in cards:
                try:
                    text_content = card.inner_text().strip()
                    if not text_content or ("Course Title" not in text_content and "Completed" not in text_content):
                        continue

                    title = "Course"
                    title_match = re.search(r'Course Title\s*:\s*(.+)', text_content)
                    if title_match:
                        title = title_match.group(1).split('\n')[0].strip()
                    else:
                        title = text_content.split('\n')[0][:60].strip()

                    if title in seen_titles:
                        continue
                    seen_titles.add(title)

                    ends_on = ""
                    ends_match = re.search(r'Ends on\s*:\s*(.+)', text_content)
                    if ends_match:
                        ends_on = ends_match.group(1).split('\n')[0].strip()

                    pct = 100 if status == "finished" else 0
                    percent_match = re.search(r'(\d+)%\s*Completed', text_content)
                    if percent_match:
                        pct = int(percent_match.group(1))

                    link_el = card if card.evaluate('el => el.hasAttribute("data-href") or el.tagName.toLowerCase() == "a"') else card.query_selector('span[data-href], a[href*="course.php"]')
                    url = link_el.get_attribute('data-href') if link_el and link_el.has_attribute('data-href') else (link_el.get_attribute('href') if link_el else None)

                    if url and not url.startswith('http'):
                        url = "https://learning.diksha.gov.in/diksha/" + url.lstrip('/')
                    if not url:
                        url = "https://learning.diksha.gov.in/diksha/course_listing.php"

                    img_el = card.query_selector('img')
                    img_url = img_el.get_attribute('src') if img_el else None
                    if img_url and not img_url.startswith('http'):
                        img_url = "https://learning.diksha.gov.in/diksha/" + img_url.lstrip('/')

                    courses.append({
                        'title': title,
                        'ends_on': ends_on,
                        'pct': pct,
                        'progress': pct,
                        'url': url,
                        'status': status,
                        'image_url': img_url
                    })
                except Exception as ex:
                    logger.debug(f"Card parse note: {ex}")
        except Exception as e:
            logger.warning(f"Error scraping DOM {status} courses: {e}")

        return courses

    def step_6_check_incomplete_courses(self) -> list:
        """
        Step 6: Scan 'Ongoing Courses' cards and filter for courses < 100% Completed.
        """
        logger.info("==================================================")
        logger.info("Step 6: Checking for Ongoing Courses < 100% Completed...")
        logger.info("==================================================")

        all_data = self.fetch_all_courses()
        incomplete = [c for c in all_data.get('ongoing', []) if (c.get('pct', 0) < 100 or c.get('progress', 0) < 100)]
        logger.info(f"Step 6 Result: Identified {len(incomplete)} incomplete course(s).")
        return incomplete
