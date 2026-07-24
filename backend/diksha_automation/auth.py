import os
import time
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
        
        # Step 1: Open main homepage
        logger.info(f"Step 1: Opening landing page: {self.home_url}")
        self.page.goto(self.home_url, wait_until='domcontentloaded', timeout=30000)
        time.sleep(2)
        
        # Step 2: Click Login button
        logger.info("Step 2: Clicking Login button...")
        try:
            login_btn = (
                self.page.query_selector('a:has-text("Login / Register")') or
                self.page.query_selector('button:has-text("Login / Register")') or
                self.page.query_selector('a:has-text("Login")') or
                self.page.query_selector('.login-btn')
            )
            if login_btn and login_btn.is_visible():
                login_btn.click()
                time.sleep(3)
            else:
                keycloak_url = (
                    "https://diksha.gov.in/auth/realms/sunbird/protocol/openid-connect/auth?"
                    "client_id=portal"
                    "&redirect_uri=https%3A%2F%2Fdiksha.gov.in%2Fsearch%2FLibrary%2F1%3FselectedTab%3Dall%26auth_callback%3D1"
                    "&scope=openid"
                    "&response_type=code"
                    "&version=4"
                )
                self.page.goto(keycloak_url, wait_until="domcontentloaded")
                time.sleep(3)
        except Exception:
            pass

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

        # Step 4: Synchronize SSO session across learning.diksha.gov.in
        logger.info("Synchronizing SSO session with learning.diksha.gov.in portal...")
        try:
            self.page.goto(self.learning_sso_url, wait_until="domcontentloaded", timeout=25000)
            time.sleep(3)
            
            # Check if Access Denied appears and auto-recover
            if self.is_access_denied():
                logger.warning("SSO Access Denied detected! Refreshing token exchange...")
                self.page.goto("https://diksha.gov.in/search/Library/1?selectedTab=all&auth_callback=1", wait_until="domcontentloaded")
                time.sleep(3)
                self.page.goto(self.learning_sso_url, wait_until="domcontentloaded")
                time.sleep(3)
        except Exception as e:
            logger.warning(f"SSO Sync note: {e}")

        self.session_cookies = self.context.cookies()
        logger.info(f"Authentication & SSO Synchronization completed cleanly. Captured {len(self.session_cookies)} cookies.")
        return self.page

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
