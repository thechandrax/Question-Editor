import logging
import sys
from datetime import datetime
from config import Config

def setup_logger(name: str = "diksha_automation") -> logging.Logger:
    Config.ensure_directories()
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        # Console handler
        c_handler = logging.StreamHandler(sys.stdout)
        c_format = logging.Formatter('[%(asctime)s] [%(levelname)s] - %(message)s', '%Y-%m-%d %H:%M:%S')
        c_handler.setFormatter(c_format)
        logger.addHandler(c_handler)

        # File handler
        log_file = Config.LOG_DIR / f"automation_{datetime.now().strftime('%Y%m%d')}.log"
        f_handler = logging.FileHandler(log_file, encoding='utf-8')
        f_handler.setFormatter(c_format)
        logger.addHandler(f_handler)

    return logger

logger = setup_logger()

def take_screenshot_sync(page, name_prefix: str):
    try:
        Config.ensure_directories()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = Config.SCREENSHOT_DIR / f"{name_prefix}_{timestamp}.png"
        page.screenshot(path=str(path), full_page=True)
        logger.info(f"Screenshot saved to {path}")
        return path
    except Exception as e:
        logger.warning(f"Could not capture screenshot '{name_prefix}': {e}")
        return None
