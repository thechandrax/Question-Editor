import time
import re
from playwright.sync_api import Page
from config import Config
from utils import logger, take_screenshot_sync

class CourseNavigator:
    """
    Handles Steps 3, 4, 5 & 6 with automatic self-healing Access Denied recovery.
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
        time.sleep(3)
        self._check_and_recover_access_denied()
        take_screenshot_sync(self.page, "step3_diksha_courses")

    def step_4_explore_courses(self):
        """Step 4: Open Explore Courses library page."""
        target = "https://learning.diksha.gov.in/diksha/course_library.php"
        logger.info("==================================================")
        logger.info(f"Step 4: Navigating to Explore Courses: {target}")
        logger.info("==================================================")
        try:
            self.page.goto(target, wait_until="domcontentloaded", timeout=25000)
            time.sleep(3)
            self._check_and_recover_access_denied()
        except Exception as e:
            logger.warning(f"Note during Step 4: {e}")
        take_screenshot_sync(self.page, "step4_explore_courses")

    def step_5_my_learning(self):
        """Step 5: Open My Learning Journey page."""
        target = "https://learning.diksha.gov.in/diksha/course_listing.php"
        logger.info("==================================================")
        logger.info(f"Step 5: Navigating to My Learning Journey: {target}")
        logger.info("==================================================")
        try:
            self.page.goto(target, wait_until="domcontentloaded", timeout=25000)
            time.sleep(3)
            self._check_and_recover_access_denied()
            
            ongoing_btn = (
                self.page.query_selector('button:has-text("Ongoing Courses")') or
                self.page.query_selector('a:has-text("Ongoing Courses")') or
                self.page.query_selector('.Ongoing') or
                self.page.query_selector('text="Ongoing Courses"')
            )
            if ongoing_btn and ongoing_btn.is_visible():
                logger.info("Clicking 'Ongoing Courses' tab...")
                ongoing_btn.click()
                time.sleep(2)
        except Exception as e:
            logger.warning(f"Note during Step 5: {e}")
        take_screenshot_sync(self.page, "step5_my_learning")

    def fetch_all_courses(self) -> dict:
        """
        Navigates through Steps 3, 4, 5 and scrapes both Ongoing Courses and Finished Courses.
        Returns {'ongoing': [...], 'finished': [...], 'all': [...]}
        """
        self.step_3_diksha_courses()
        self.step_4_explore_courses()
        self.step_5_my_learning()

        result = {'ongoing': [], 'finished': [], 'all': []}

        # 1. Scrape Ongoing Courses
        logger.info("Scraping Ongoing Courses tab...")
        try:
            ongoing_btn = (
                self.page.query_selector('button:has-text("Ongoing Courses")') or
                self.page.query_selector('a:has-text("Ongoing Courses")') or
                self.page.query_selector('.Ongoing') or
                self.page.query_selector('text="Ongoing Courses"')
            )
            if ongoing_btn and ongoing_btn.is_visible():
                ongoing_btn.click()
                time.sleep(2)
        except Exception as e:
            logger.warning(f"Note clicking Ongoing tab: {e}")

        ongoing_courses = self._scrape_cards_from_page(status="ongoing")
        result['ongoing'] = ongoing_courses

        # 2. Scrape Finished Courses
        logger.info("Scraping Finished Courses tab...")
        try:
            finished_btn = (
                self.page.query_selector('button:has-text("Finished Courses")') or
                self.page.query_selector('a:has-text("Finished Courses")') or
                self.page.query_selector('.Finished') or
                self.page.query_selector('text="Finished Courses"')
            )
            if finished_btn and finished_btn.is_visible():
                finished_btn.click()
                time.sleep(2.5)
                finished_courses = self._scrape_cards_from_page(status="finished")
                result['finished'] = finished_courses
        except Exception as e:
            logger.warning(f"Note clicking Finished tab: {e}")

        result['all'] = result['ongoing'] + result['finished']
        logger.info(f"Fetch complete: Found {len(result['ongoing'])} Ongoing and {len(result['finished'])} Finished courses.")
        return result

    def _scrape_cards_from_page(self, status: str = "ongoing") -> list:
        courses = []
        try:
            cards = self.page.query_selector_all('div[class*="card"], .card, div:has-text("Completed")')
            logger.info(f"Found {len(cards)} potential course card elements for '{status}'.")

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

                    link_el = None
                    try:
                        tag = card.evaluate('el => el.tagName.toLowerCase()')
                        if tag == 'a':
                            link_el = card
                    except Exception:
                        pass

                    if not link_el:
                        link_el = card.query_selector('a[href*="course.php"]') or card.query_selector('a')

                    url = link_el.get_attribute('href') if link_el else None
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
                    logger.info(f"  Scraped [{status}]: '{title}' ({pct}% Completed, Ends: '{ends_on}')")
                except Exception as ex:
                    logger.debug(f"Card parse note: {ex}")
        except Exception as e:
            logger.warning(f"Error scraping {status} courses: {e}")

        return courses

    def step_6_check_incomplete_courses(self) -> list:
        """
        Step 6: Scan 'Ongoing Courses' cards and filter for courses < 100% Completed.
        """
        logger.info("==================================================")
        logger.info("Step 6: Checking for Ongoing Courses < 100% Completed...")
        logger.info("==================================================")
        
        incomplete_courses = []
        try:
            cards = self.page.query_selector_all('div[class*="card"], .card, div:has-text("Completed")')
            logger.info(f"Found {len(cards)} ongoing course card elements.")

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
                        title = text_content.split('\n')[0][:50]

                    link_el = None
                    try:
                        tag = card.evaluate('el => el.tagName.toLowerCase()')
                    except Exception:
                        tag = ''
                    if tag == 'a':
                        link_el = card
                    else:
                        link_el = card.query_selector('a[href*="course.php"]') or card.query_selector('a')
                    url = link_el.get_attribute('href') if link_el else None
                    
                    if not url:
                        url = "https://learning.diksha.gov.in/diksha/course.php?id=1186&section=2486"

                    if url and not url.startswith('http'):
                        url = "https://learning.diksha.gov.in/diksha/" + url.lstrip('/')

                    percent_match = re.search(r'(\d+)%\s*Completed', text_content)
                    if percent_match:
                        pct = int(percent_match.group(1))
                        if pct < 100:
                            logger.info(f"Detected Incomplete Course: '{title}' ({pct}% Completed)")
                            incomplete_courses.append({
                                'title': title,
                                'url': url,
                                'pct': pct,
                                'element': card
                            })
                        else:
                            logger.info(f"Course '{title}' is 100% Completed. Skipping.")
                except Exception as ex:
                    logger.debug(f"Card parse note: {ex}")

            logger.info(f"Step 6 Result: Identified {len(incomplete_courses)} incomplete course(s).")
        except Exception as e:
            logger.warning(f"Error checking course progress: {e}")

        return incomplete_courses

