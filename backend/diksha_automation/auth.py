import os
import time
import uuid
import logging
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class DikshaAuthenticator:
    """
    Handles authentication with cross-subdomain SSO session synchronization 
    between diksha.gov.in and learning.diksha.gov.in to eliminate 'Access denied' errors.
    """
    
    def __init__(self, headless: bool = False, username: str = None, password: str = None):
        env_headless = os.getenv("HEADLESS", "False").lower() == "true"
        self.headless = headless  # Use exactly what caller passed (True/False)
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.session_cookies = {}
        self.auth_code = None
        
        self.username = username or os.getenv("DIKSHA_USERNAME")
        self.password = password or os.getenv("DIKSHA_PASSWORD")
        if not self.username or not self.password:
            raise ValueError("DIKSHA_USERNAME and DIKSHA_PASSWORD must be provided or set in .env file")
        
        self.home_url = "https://diksha.gov.in/index.html"
        # Real post-login order: course_library.php first, then course_listing.php
        self.course_library_url = "https://learning.diksha.gov.in/diksha/course_library.php"
        self.learning_sso_url   = "https://learning.diksha.gov.in/diksha/course_listing.php"
        # Direct Keycloak login URL — includes state UUID (OAuth2 PKCE) to match real browser flow
        _state = str(uuid.uuid4())
        self.keycloak_login_url = (
            f"https://diksha.gov.in/auth/realms/sunbird/protocol/openid-connect/auth?"
            f"client_id=portal"
            f"&state={_state}"
            f"&redirect_uri=https%3A%2F%2Fdiksha.gov.in%2Fsearch%2FLibrary%2F1%3FselectedTab%3Dall%26auth_callback%3D1"
            f"&scope=openid"
            f"&response_type=code"
            f"&version=4"
        )
        logger.info(f"Keycloak login URL state={_state}")


    def login(self) -> Page:
        """
        Execute login flow and synchronize SSO cookies across subdomains.
        """
        logger.info(f"Starting DIKSHA authentication & SSO Sync (Headless Mode: {self.headless})...")
        
        self.playwright = sync_playwright().start()
        
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            slow_mo=300,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--start-maximized'
            ]
        )
        
        self.context = self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
            viewport={'width': 1366, 'height': 768},
            locale='en-US',
            timezone_id='Asia/Kolkata'
        )
        
        self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        """)
        
        self.page = self.context.new_page()
        
        # Step 1: Go directly to Keycloak login page (faster than homepage → click Login)
        logger.info(f"Step 1: Navigating directly to Keycloak login: {self.keycloak_login_url[:60]}...")
        self.page.goto(self.keycloak_login_url, wait_until='domcontentloaded', timeout=30000)
        time.sleep(1)

        # Step 3: Enter credentials
        try:
            self.page.wait_for_selector('input[name="username"], input#username, input[type="text"]', state='visible', timeout=10000)
            logger.info(f"Entering credentials for user: {self.username[:3]}***")
            
            username_input = (
                self.page.query_selector('input[name="username"]') or
                self.page.query_selector('input#username') or
                self.page.query_selector('input[type="text"]')
            )
            if username_input:
                username_input.fill(self.username)
            
            password_input = (
                self.page.query_selector('input[name="password"]') or
                self.page.query_selector('input#password') or
                self.page.query_selector('input[type="password"]')
            )
            if password_input:
                password_input.fill(self.password)
            
            submit_btn = (
                self.page.query_selector('button[type="submit"]') or
                self.page.query_selector('button#kc-login') or
                self.page.query_selector('button:has-text("LOGIN")')
            )
            if submit_btn:
                submit_btn.click()
                logger.info("Clicked LOGIN button.")
            else:
                if password_input:
                    password_input.press("Enter")
            
            time.sleep(2)  # Keycloak redirects quickly
        except PlaywrightTimeoutError:
            logger.info("Keycloak form completed or session active.")

        # Step 4: Synchronize SSO session with learning.diksha.gov.in
        self._sync_learning_portal()

        self.session_cookies = self.context.cookies()
        logger.info(f"Authentication & SSO Synchronization completed. Captured {len(self.session_cookies)} cookies.")
        return self.page

    def _sync_learning_portal(self):
        """
        Establishes an authenticated PHP session on learning.diksha.gov.in.

        DIKSHA SSO flow:
          1. learning.diksha.gov.in/login.php has 'LOGIN with DIKSHA' → diksha.gov.in/resources?lms=diksha2
          2. diksha.gov.in/resources generates an SSO token, puts URL in page title:
             "Loading https://learning.diksha.gov.in/diksha/diksha_sso.php?token=..."
          3. JavaScript redirects browser to diksha_sso.php?token=...
          4. diksha_sso.php validates token → sets PHPSESSID → redirects to course_listing.php

        Fix: use networkidle so JS can run; if JS redirect missed, extract URL from page title.
        """
        import re
        import html as _html

        logger.info("--- SSO Sync: learning.diksha.gov.in ---")
        try:
            # Real DIKSHA post-login order:
            # 1. course_library.php (Explore Courses) — loads first after SSO
            # 2. course_listing.php (My Learning)     — navigated to after
            logger.info("SSO Sync Step 1: navigating to course_library.php (Explore Courses)...")
            self.page.goto(self.course_library_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(1)

            current_url = self.page.url
            logger.info(f"SSO landing URL: {current_url}")

            if "login.php" not in current_url:
                logger.info("SSO sync: authenticated on course_library.php ✓")
                # Now navigate to course_listing.php (My Learning) — the actual target
                logger.info("SSO Sync Step 2: navigating to course_listing.php (My Learning)...")
                self.page.goto(self.learning_sso_url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(1)
                logger.info(f"course_listing.php URL: {self.page.url}")
                return

            # ── Find SSO login link on login.php ────────────────────────────
            logger.info("SSO sync: on login.php — scanning for SSO link...")
            links = self.page.evaluate("""() =>
                Array.from(document.querySelectorAll('a')).map(e => ({
                    text: (e.innerText || '').trim(),
                    href: e.href || ''
                }))
            """)

            sso_link = None
            for link in links:
                logger.info(f"  Link: '{link['text'][:60]}' → {link['href'][:100]}")
                href = (link['href'] or '').lower()
                text = (link['text'] or '').lower()
                if 'resources' in href or 'lms=diksha' in href or 'oauth2' in href or 'diksha' in text:
                    sso_link = link['href']
                    logger.info(f"  → SSO link found: {sso_link[:100]}")
                    break

            if not sso_link:
                logger.warning("SSO sync: no SSO link found on login.php — skipping")
                return

            # ── Navigate to SSO link with networkidle so JS redirect runs ───
            # diksha.gov.in/resources?lms=diksha2 will JS-redirect to diksha_sso.php?token=...
            logger.info(f"Navigating to SSO: {sso_link}")
            try:
                self.page.goto(sso_link, wait_until='networkidle', timeout=30000)
                time.sleep(2)
            except Exception as e:
                logger.info(f"networkidle note (timeout ok): {e}")
                time.sleep(2)

            url_now   = self.page.url
            title_now = self.page.title()
            logger.info(f"After SSO nav — URL: {url_now}")
            logger.info(f"After SSO nav — Title: {title_now[:200]}")

            # ── SUCCESS: JS redirect took us to learning portal ──────────────
            if 'learning.diksha.gov.in' in url_now and 'login.php' not in url_now:
                logger.info("SSO sync: ✓ session established on learning portal!")
                return

            # ── FALLBACK: Extract diksha_sso.php?token= from page title ──────
            # diksha.gov.in/resources sets the title to "Loading https://...diksha_sso.php?token=..."
            # If networkidle missed the JS redirect, we extract and navigate manually.
            if 'diksha_sso.php' in title_now or 'diksha_sso.php' in url_now:
                sso_token_url = url_now if 'diksha_sso.php' in url_now else None
                if not sso_token_url:
                    m = re.search(r'(https://\S+diksha_sso\.php[^\s"\'<>]*)', title_now)
                    if m:
                        sso_token_url = _html.unescape(m.group(1))

                if sso_token_url:
                    logger.info(f"Navigating to SSO token URL: {sso_token_url[:120]}...")
                    try:
                        self.page.goto(sso_token_url, wait_until='networkidle', timeout=25000)
                        time.sleep(3)
                    except Exception as e:
                        logger.info(f"SSO token nav note: {e}")
                        time.sleep(3)

                    url_after = self.page.url
                    logger.info(f"After token nav: {url_after}")
                    if 'learning.diksha.gov.in' in url_after and 'login.php' not in url_after:
                        logger.info("SSO sync: ✓ session established via SSO token!")
                        return
                    # Navigate to course listing now that PHPSESSID should be set
                    logger.info("SSO token processed — navigating to course_listing.php...")
                    self.page.goto(self.learning_sso_url, wait_until='domcontentloaded', timeout=20000)
                    time.sleep(1)
                    logger.info(f"course_listing URL: {self.page.url}")
                    return

            # ── FALLBACK 2: Keycloak re-appeared (no shared session) ─────────
            if 'openid-connect/auth' in url_now:
                logger.info("SSO sync: on Keycloak — re-entering credentials for learning portal...")
                try:
                    self.page.wait_for_selector('input[name="username"]', timeout=6000)
                    self.page.fill('input[name="username"]', self.username)
                    self.page.fill('input[name="password"]', self.password)
                    btn = (self.page.query_selector('button[type="submit"]') or
                           self.page.query_selector('button#kc-login'))
                    if btn:
                        btn.click()
                    else:
                        self.page.keyboard.press('Enter')
                    time.sleep(4)
                    logger.info(f"After Keycloak re-auth: {self.page.url}")
                except PlaywrightTimeoutError:
                    logger.info("SSO sync: Keycloak auto-approved (no form visible)")

            # ── FALLBACK 3: SSO landed on "explore" page (no token generated) ─
            # This happens when diksha.gov.in/resources?lms=diksha2 loads the
            # DIKSHA explore portal but does NOT generate an SSO token redirect.
            # Title will be "explore" and URL stays on diksha.gov.in — 18 cookies
            # are captured but NONE of them are Moodle PHPSESSID cookies.
            # Fix: navigate directly to learning.diksha.gov.in/diksha/login.php
            # and click the SSO link again to force token generation.
            title_lower = title_now.lower()
            url_lower   = url_now.lower()
            is_explore_fail = (
                'explore' in title_lower or
                ('diksha.gov.in/resources' in url_lower and 'learning.diksha.gov.in' not in url_lower)
            )
            if is_explore_fail:
                logger.warning(
                    "SSO sync: landed on 'explore' (no Moodle token generated) — "
                    "retrying via direct Moodle login page..."
                )
                try:
                    # Go directly to Moodle login page
                    self.page.goto(
                        'https://learning.diksha.gov.in/diksha/login.php',
                        wait_until='domcontentloaded', timeout=25000
                    )
                    time.sleep(2)
                    # Find and click the SSO link again
                    sso_retry_links = self.page.evaluate("""() =>
                        Array.from(document.querySelectorAll('a')).map(e => ({
                            text: (e.innerText || '').trim(),
                            href: e.href || ''
                        }))
                    """)
                    for lnk in sso_retry_links:
                        href = (lnk['href'] or '').lower()
                        if 'resources' in href or 'lms=diksha' in href:
                            logger.info(f"  Retry SSO link: {lnk['href'][:100]}")
                            try:
                                self.page.goto(lnk['href'], wait_until='networkidle', timeout=30000)
                                time.sleep(3)
                            except Exception as e2:
                                logger.info(f"  Retry SSO nav note: {e2}")
                                time.sleep(3)
                            # Check if token redirect happened
                            retry_url   = self.page.url
                            retry_title = self.page.title()
                            logger.info(f"  After retry SSO — URL: {retry_url}")
                            logger.info(f"  After retry SSO — Title: {retry_title[:150]}")
                            if 'learning.diksha.gov.in' in retry_url and 'login.php' not in retry_url:
                                logger.info("SSO sync: ✓ session established via retry!")
                                return
                            # Extract token from title
                            if 'diksha_sso.php' in retry_title or 'diksha_sso.php' in retry_url:
                                token_m = re.search(
                                    r'(https://\S+diksha_sso\.php[^\s"\'<>]*)', retry_title
                                )
                                if token_m:
                                    token_url = _html.unescape(token_m.group(1))
                                    logger.info(f"  Navigating to retry token: {token_url[:100]}...")
                                    try:
                                        self.page.goto(token_url, wait_until='networkidle', timeout=25000)
                                        time.sleep(3)
                                    except Exception as e3:
                                        logger.info(f"  Token nav note: {e3}")
                                    logger.info(f"  After retry token: {self.page.url}")
                                    if 'learning.diksha.gov.in' in self.page.url:
                                        logger.info("SSO sync: ✓ session established via retry token!")
                                        return
                            break
                except Exception as e_retry:
                    logger.warning(f"SSO retry failed: {e_retry}")

            logger.info(f"SSO sync final URL: {self.page.url}")

        except Exception as e:
            logger.error(f"SSO sync error: {e}", exc_info=True)

    def is_access_denied(self) -> bool:
        """Check if current page body contains 'Access denied' error text."""
        try:
            body_text = self.page.inner_text("body").lower()
            return "access denied" in body_text
        except Exception:
            return False

    def close(self):
        try:
            if self.page: self.page.close()
            if self.context: self.context.close()
            if self.browser: self.browser.close()
            if self.playwright: self.playwright.stop()
            logger.info("Browser closed.")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
