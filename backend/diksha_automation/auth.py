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
        self.headless = headless if headless is not False else env_headless
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
        self.learning_sso_url = "https://learning.diksha.gov.in/diksha/course_listing.php"
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
        time.sleep(2)

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
            
            time.sleep(4)
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

        learning.diksha.gov.in runs a separate Moodle/PHP system that requires
        its own session — separate from the diksha.gov.in Keycloak session.

        Flow:
          1. Navigate to course_listing.php → likely redirected to login.php
          2. Find the SSO / OAuth2 login link on login.php
          3. Click it → redirects to Keycloak on diksha.gov.in
          4. Keycloak sees existing session cookie → auto-approves (no password needed)
          5. Redirected back to learning portal with authenticated session ✅
        """
        logger.info("--- SSO Sync: learning.diksha.gov.in ---")
        try:
            self.page.goto(self.learning_sso_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)

            current_url = self.page.url
            logger.info(f"SSO landing URL: {current_url}")

            # Already authenticated — no login.php redirect
            if "login.php" not in current_url:
                logger.info("SSO sync: already authenticated on learning portal ✓")
                return

            logger.info("SSO sync: redirected to login.php — scanning for OAuth2/SSO button...")

            # Enumerate all links + buttons on login page for debugging + clicking
            elements = self.page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a, button, input[type="submit"], [role="button"]')).map(el => ({
                    tag: el.tagName,
                    text: (el.innerText || el.value || '').trim().slice(0, 80),
                    href: (el.href || '').slice(0, 200),
                    cls: (el.className || '').slice(0, 60),
                }));
            }""")

            logger.info(f"Login page has {len(elements)} clickable elements:")
            for el in elements[:25]:
                logger.info(f"  [{el['tag']}] '{el['text']}' → {el['href'][:100]}")

            # Try clicking an OAuth2/SSO/Keycloak link
            sso_url_keywords  = ["oauth2", "keycloak", "/auth/", "openid", "sso", "token"]
            sso_text_keywords = ["login with", "sign in with", "diksha", "oauth", "continue with", "microsoft"]

            clicked_href = None
            for el in elements:
                href = (el["href"] or "").lower()
                text = (el["text"] or "").lower()
                if any(k in href for k in sso_url_keywords) or any(k in text for k in sso_text_keywords):
                    logger.info(f"  → SSO candidate: text='{el['text']}' href='{el['href'][:120]}'")
                    try:
                        if el["href"]:
                            self.page.goto(el["href"], wait_until="domcontentloaded", timeout=20000)
                        else:
                            self.page.click(f'[href="{el["href"]}"]')
                        clicked_href = el["href"]
                        time.sleep(5)
                        break
                    except Exception as ex:
                        logger.warning(f"  Click error: {ex}")

            # Fallback: try known Moodle OAuth2 URL patterns
            if not clicked_href:
                logger.info("SSO sync: no SSO link found — trying Moodle OAuth2 URL patterns...")
                for trial_url in [
                    "https://learning.diksha.gov.in/login/oauth2/login.php",
                    "https://learning.diksha.gov.in/diksha/login/oauth2/login.php?id=1",
                    "https://learning.diksha.gov.in/diksha/login/index.php",
                ]:
                    try:
                        self.page.goto(trial_url, wait_until="domcontentloaded", timeout=15000)
                        time.sleep(4)
                        if "login.php" not in self.page.url:
                            logger.info(f"  SSO via direct URL success: {trial_url}")
                            clicked_href = trial_url
                            break
                        else:
                            logger.info(f"  Still on login.php after: {trial_url}")
                    except Exception as ex:
                        logger.warning(f"  Trial URL error ({trial_url}): {ex}")

            # If Keycloak page appears → may need to fill credentials again (no session sharing)
            final_url = self.page.url
            logger.info(f"SSO sync post-click URL: {final_url}")

            if "openid-connect/auth" in final_url or "keycloak" in final_url.lower():
                logger.info("SSO sync: on Keycloak — filling credentials for learning portal auth...")
                try:
                    self.page.wait_for_selector('input[name="username"]', timeout=8000)
                    self.page.fill('input[name="username"]', self.username)
                    self.page.fill('input[name="password"]', self.password)
                    btn = (self.page.query_selector('button[type="submit"]') or
                           self.page.query_selector('button#kc-login'))
                    if btn:
                        btn.click()
                    else:
                        self.page.keyboard.press("Enter")
                    time.sleep(5)
                    logger.info(f"SSO sync: post Keycloak submit URL: {self.page.url}")
                except PlaywrightTimeoutError:
                    logger.info("SSO sync: Keycloak auto-approved (no form visible)")

            # Final check
            final_url = self.page.url
            if "login.php" in final_url:
                logger.warning(f"SSO sync: still on login.php — session NOT established. URL: {final_url}")
                # Save page HTML for debugging
                try:
                    html_preview = self.page.content()[:800]
                    logger.info(f"Login page HTML preview:\n{html_preview}")
                except Exception:
                    pass
            else:
                logger.info(f"SSO sync: session established on learning portal ✓ URL: {final_url}")

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
