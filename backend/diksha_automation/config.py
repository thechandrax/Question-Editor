import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

class Config:
    BASE_URL = os.getenv("DIKSHA_BASE_URL", "https://diksha.gov.in")
    LOGIN_URL = os.getenv(
        "DIKSHA_LOGIN_URL",
        os.getenv("DIKSHA_BASE_URL", "https://diksha.gov.in")
        + "/auth/realms/sunbird/protocol/openid-connect/auth"
    )
    REDIRECT_URI = os.getenv("DIKSHA_REDIRECT_URI", "https://diksha.gov.in/search/Library/1?selectedTab=all&auth_callback=1")
    CLIENT_ID = os.getenv("DIKSHA_CLIENT_ID", "portal")
    SCOPE = os.getenv("DIKSHA_SCOPE", "openid")
    RESPONSE_TYPE = os.getenv("DIKSHA_RESPONSE_TYPE", "code")
    VERSION = os.getenv("DIKSHA_VERSION", "4")
    
    USERNAME = os.getenv("DIKSHA_USERNAME", "")
    PASSWORD = os.getenv("DIKSHA_PASSWORD", "")
    HEADLESS = os.getenv("HEADLESS", "True").lower() in ("true", "1", "yes")
    SLOW_MO = int(os.getenv("SLOW_MO", "300"))
    
    STATE_FILE = Path(__file__).parent / os.getenv("STATE_FILE", "storage_state.json")
    SCREENSHOT_DIR = Path(__file__).parent / "screenshots"
    LOG_DIR = Path(__file__).parent / "logs"

    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    )

    @classmethod
    def ensure_directories(cls):
        cls.SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
