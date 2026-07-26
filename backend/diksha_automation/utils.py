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

def log_error_diagnostic(e: Exception, context_msg: str = ""):
    """
    Formatted diagnostic logging for errors during automation.
    Categorizes errors so users and logs clearly understand the root cause.
    """
    err_str = str(e)
    import traceback
    tb_str = "".join(traceback.format_tb(e.__traceback__)) if e.__traceback__ else ""
    
    category = "UNKNOWN ERROR"
    suggestion = "Please check server logs or retry the automation."
    
    if "target crashed" in err_str.lower() or "browser closed" in err_str.lower() or "connection closed" in err_str.lower():
        category = "SERVER MEMORY / CONTAINER LIMIT EXCEEDED"
        suggestion = "Chromium RAM spike on cloud server. The bot auto-recovers on next run from the exact last incomplete module."
    elif "timeout" in err_str.lower() or "exceeded" in err_str.lower():
        category = "NETWORK / PAGE LOAD TIMEOUT"
        suggestion = "DIKSHA portal took too long to respond over network. Auto-retry will resolve it."
    elif "net::err" in err_str.lower() or "name_not_resolved" in err_str.lower():
        category = "NETWORK CONNECTION FAILURE"
        suggestion = "Check internet connection or DIKSHA server availability."
    elif "access denied" in err_str.lower() or "keycloak" in err_str.lower():
        category = "AUTHENTICATION / SSO EXPIRY"
        suggestion = "SSO session expired or login failed. Re-verify username/password."
    elif "query_selector" in err_str.lower() or "element" in err_str.lower():
        category = "DOM ELEMENT UNSELECTABLE"
        suggestion = "DIKSHA UI element was temporarily hidden or changed."

    logger.error("❌ ════════════════ AUTOMATION ERROR DIAGNOSTIC ════════════════")
    if context_msg:
        logger.error(f"❌ Context: {context_msg}")
    logger.error(f"❌ Category: [{category}]")
    logger.error(f"❌ Error Message: {err_str}")
    logger.error(f"❌ Actionable Advice: {suggestion}")
    if tb_str:
        logger.error(f"❌ Stack Trace:\n{tb_str.strip()}")
    logger.error("❌ ═══════════════════════════════════════════════════════════════")

def take_screenshot_sync(page, name_prefix: str):
    # Disabled screenshot saving per user preference
    return None
