import os
from datetime import datetime
import re
import threading
import asyncio
import random
import logging
import fitz
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import time
import sys
from urllib.parse import urlparse, urljoin, unquote
from bs4 import BeautifulSoup
import cloudscraper
from fastapi import BackgroundTasks

sys.path.append(os.path.join(os.path.dirname(__file__), "diksha_automation"))
from orchestrator import run_automation, fetch_courses_only, fetch_course_details_only
import cloudscraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# ── DIKSHA global state ────────────────────────────────────────────────────
_diksha: dict = {
    "running": False,
    "status": "idle",   # idle | running | done | error | paused
    "step": "",
    "progress": 0,
    "logs": [],
    "started_at": None,
    "paused": False,
    "courses": [],      # list of {title, progress, status, current}
    "current_course": None,
}

# Threading primitives for pause/stop control
_pause_event = threading.Event()
_pause_event.set()   # set = NOT paused (bot runs freely)
_stop_event = threading.Event()  # set = stop requested

class _DikshaLogCapture(logging.Handler):
    """Captures log records from the automation into the global state dict."""
    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = f"[{record.levelname}] {record.getMessage()}"
            _diksha["logs"].append(msg)
            if len(_diksha["logs"]) > 400:
                _diksha["logs"] = _diksha["logs"][-300:]
            lo = msg.lower()
            raw = record.getMessage()

            # ── Step inference ──────────────────────────────────────────
            if "login" in lo or "authenticat" in lo or "keycloak" in lo:
                _diksha["step"] = "Authenticating with DIKSHA..."
                _diksha["progress"] = 10
            elif "course" in lo and ("navig" in lo or "listing" in lo or "list" in lo):
                _diksha["step"] = "Fetching course list..."
                _diksha["progress"] = 20
            elif "incomplete" in lo or "scanning" in lo:
                _diksha["step"] = "Scanning incomplete modules..."
                _diksha["progress"] = 30
            elif "opening" in lo or "→ opening" in lo:
                _diksha["step"] = "Opening course content..."
                _diksha["progress"] = max(35, min(_diksha["progress"] + 3, 85))
            elif "playing" in lo or "video" in lo:
                _diksha["step"] = "Playing module video..."
                _diksha["progress"] = max(40, min(_diksha["progress"] + 2, 85))
            elif "pdf" in lo or "scrolling" in lo:
                _diksha["step"] = "Reading PDF material..."
                _diksha["progress"] = max(50, min(_diksha["progress"] + 2, 85))
            elif "assessment" in lo or "quiz" in lo:
                _diksha["step"] = "Submitting assessment..."
                _diksha["progress"] = 90
            elif "module completed" in lo or "course completed" in lo:
                _diksha["step"] = "Module completed!"
                _diksha["progress"] = min(_diksha["progress"] + 5, 95)

            # ── Course name extraction from log lines ────────────────────
            # Pattern: [INFO] → Opening: 'Course Title'
            title_match = re.search(r"opening[:\s→]+['\"](.+?)['\"]\s*$", raw, re.IGNORECASE)
            if title_match:
                title = title_match.group(1).strip()
                courses = _diksha["courses"]
                existing_titles = [c["title"] for c in courses]
                if title and title not in existing_titles:
                    courses.append({"title": title, "progress": 0, "status": "pending", "current": False})
                # Mark as running
                _diksha["current_course"] = title
                for c in courses:
                    c["current"] = c["title"] == title
                    if c["title"] == title:
                        c["status"] = "running"

            # Update progress of current running course
            if _diksha["current_course"]:
                for c in _diksha["courses"]:
                    if c["title"] == _diksha["current_course"] and c["status"] == "running":
                        if "pdf" in lo or "video" in lo or "playing" in lo:
                            c["progress"] = min(c["progress"] + 3, 90)
                        elif "completed" in lo or "done" in lo:
                            c["progress"] = 100
                            c["status"] = "done"
                            c["current"] = False
        except Exception:
            pass

_capture_handler = _DikshaLogCapture()
_capture_handler.setLevel(logging.INFO)
logging.getLogger().addHandler(_capture_handler)
# ── end DIKSHA state ────────────────────────────────────────────────────────

app = FastAPI(title="Question Editor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SHORTLINK BYPASS LOGIC ---
TIMEOUT = 30
MAX_DEPTH = 12
KNOWN_NETWORKS = ['gplinks', 'droplink', 'rocklinks', 'shrinkme', 'mahnokari', 'vplink', 'studyeducations', 'asmultiverse', 'fc-lc', 'fc.lc']

class ShortlinkRequest(BaseModel):
    url: str

def extract_base64_url(text):
    matches = re.findall(r'(aHR0c[a-zA-Z0-9+/]+={0,2})', text)
    for match in matches:
        try:
            decoded = base64.b64decode(match).decode('utf-8')
            if decoded.startswith('http') and 'mahnokari' not in decoded and 'vplink' not in decoded:
                if any(bad in decoded.lower() for bad in ['w3.org', 'schema.org', '<svg', '<path', 'xmlns']):
                    continue
                return decoded
        except:
            pass
    return None

def extract_js_urls(html, current_url):
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup.find_all('script'):
        if script.string:
            js = script.string
            urls = re.findall(r'["\'](https?:\/\/[^"\']+)["\']', js)
            for u in urls:
                clean_url = u.replace('\\/', '/')
                if clean_url == current_url or 'googletagmanager' in clean_url:
                    continue
                if any(domain in clean_url for domain in KNOWN_NETWORKS):
                    return clean_url
                if 'location.href' in js or 'window.location' in js or 'location.replace' in js:
                    return clean_url
    return None

# Ad-view lock domains - require real browser + human to view an ad before unlocking
AD_VIEW_LOCK_INDICATORS = [
    'freehelpdesk.in',         # vplink.in routes here with an ad-view cookie lock
    'studyeducations.com',     # another ad-network intermediary
    'sanadegreecollege.in',    # gplinks.co routes here with an ad-view lock
    'gplinks.co/subscription', # gplinks.co subscription wall (requires ad-view)
]

def bypass_url(url, scraper, depth=0, visited=None):
    if visited is None:
        visited = set()
        
    clean_url = url.split('#')[0]
    if depth > MAX_DEPTH:
        return url
    if clean_url in visited:
        return url

    # Detect ad-view lock - these require a human to watch an ad in a real browser
    if any(indicator in clean_url for indicator in AD_VIEW_LOCK_INDICATORS):
        logging.info(f"Ad-view lock detected at: {clean_url}")
        raise ValueError(f"AD_VIEW_LOCK:{clean_url}")
        
    visited.add(clean_url)
    
    try:
        if any(domain in clean_url for domain in ['mahnokari', 'vplink', 'olamovies']):
            time.sleep(5) 
        else:
            time.sleep(1.5)
        
        resp = scraper.get(url, timeout=TIMEOUT, allow_redirects=True)
        current_url = resp.url
        html = resp.text
        
        if current_url != url:
            if any(ext in current_url.lower() for ext in ['.zip', '.rar', '.pdf', '.mp4', 'drive.google', 'key=', 'auth=', 'file/']):
                 return current_url
                 
        soup = BeautifulSoup(html, 'html.parser')
        
        b64_url = extract_base64_url(html)
        if b64_url:
            return bypass_url(b64_url, scraper, depth + 1, visited)
            
        js_url = extract_js_urls(html, current_url)
        if js_url:
            return bypass_url(js_url, scraper, depth + 1, visited)

        for a in soup.find_all('a', href=True):
            href = a['href']
            if any(domain in href.lower() for domain in KNOWN_NETWORKS) and 'javascript' not in href:
                full_url = urljoin(current_url, href)
                return bypass_url(full_url, scraper, depth + 1, visited)
                
        for tag in soup.find_all(attrs={"onclick": True}):
            onclick_text = tag['onclick']
            urls = re.findall(r'["\'](https?:\/\/[^"\']+)["\']', onclick_text)
            for u in urls:
                clean_url = u.replace('\\/', '/')
                if any(domain in clean_url for domain in KNOWN_NETWORKS):
                    return bypass_url(clean_url, scraper, depth + 1, visited)

        for form in soup.find_all('form'):
            action = form.get('action') or current_url
            inputs = form.find_all('input')
            data = {inp.get('name'): inp.get('value', '') for inp in inputs if inp.get('name')}
            
            if data and ('_wpnonce' in data or 'token' in data or 'alias' in data or 'submit' in html.lower() or 'go' in html.lower()):
                full_action = urljoin(current_url, action)
                post_resp = scraper.post(full_action, data=data, timeout=TIMEOUT, allow_redirects=True)
                if post_resp.url != action and post_resp.url.split('#')[0] != current_url.split('#')[0]:
                    return bypass_url(post_resp.url, scraper, depth + 1, visited)
                post_b64 = extract_base64_url(post_resp.text)
                if post_b64:
                    return bypass_url(post_b64, scraper, depth + 1, visited)

        # --- gplinks / gplinks.co specific: follow the "skip_sub=1" bypass link ---
        skip_sub_link = soup.find('a', href=lambda h: h and 'skip_sub=1' in h)
        if skip_sub_link:
            skip_url = urljoin(current_url, skip_sub_link['href'])
            logging.info(f"[gplinks] Following skip_sub link: {skip_url}")
            return bypass_url(skip_url, scraper, depth + 1, visited)

        meta = soup.find('meta', attrs={'http-equiv': 'refresh'})
        if meta:
            match = re.search(r'url=([^;]+)', meta.get('content', ''), re.I)
            if match:
                refresh_url = urljoin(current_url, match.group(1).strip("'\" "))
                return bypass_url(refresh_url, scraper, depth + 1, visited)

        for a in soup.find_all('a', href=True):
            full_url = urljoin(current_url, a['href'])
            if 'javascript:' in full_url or '#' in full_url or 't.me' in full_url:
                continue 
            if re.search(r'\b(click here|go|continue|get link|download|open link|verify|generate key|continue with ads)\b', a.text.lower()):
                return bypass_url(full_url, scraper, depth + 1, visited)

        return current_url
        
    except ValueError:
        raise  # Re-raise ad-view lock errors so they propagate up
    except Exception as e:
        logging.error(f"Error at depth {depth}: {e}")
        return url

import PyBypass

def full_bypass(shortlink):
    # Try the new PyBypass Github package first!
    try:
        bypassed_url = PyBypass.bypass(shortlink)
        if bypassed_url and bypassed_url != shortlink and 'http' in bypassed_url:
            # Check if PyBypass returned an ad-view lock URL
            if any(indicator in bypassed_url for indicator in AD_VIEW_LOCK_INDICATORS):
                raise ValueError(f"AD_VIEW_LOCK:{bypassed_url}")
            return bypassed_url
    except ValueError:
        raise  # Re-raise ad-view lock errors
    except Exception:
        pass  # PyBypass couldn't handle it, fallback to our custom scraper
        
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    return unquote(bypass_url(shortlink, scraper))

@app.post("/api/bypass-shortlink")
async def api_bypass_shortlink(request: ShortlinkRequest):
    try:
        final_url = full_bypass(request.url)
        return {"original": request.url, "bypassed": final_url, "success": True}
    except ValueError as e:
        err_str = str(e)
        if err_str.startswith('AD_VIEW_LOCK:'):
            locked_url = err_str.replace('AD_VIEW_LOCK:', '')
            return {
                "original": request.url,
                "bypassed": None,
                "success": False,
                "error": "ad_view_lock",
                "message": f"This link uses an Ad-View Lock that requires you to watch a real ad in your browser. It then generates a one-time cookie to unlock the next step. Our engine cannot simulate this. Please open the link manually, wait through the ad/timer, click CONTINUE, and paste the resulting link here.",
                "intermediate_url": locked_url
            }
        raise HTTPException(status_code=500, detail=err_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# --- END SHORTLINK BYPASS LOGIC ---

def convert_math(text: str, wrapper: str) -> str:
    """Converts $...$ into \(...\) if inline_parentheses is selected."""
    if wrapper == 'inline_parentheses':
        text = re.sub(r'\$\$(.+?)\$\$', r'\\[\1\\]', text, flags=re.DOTALL)
        text = re.sub(r'(?<!\$)\$([^\$]+)\$(?!\$)', r'\\(\1\\)', text)
        return text
    return text

@app.post("/api/parse-document")
async def parse_document(
    file: UploadFile = File(...),
    math_wrapper: str = Form("single_dollar"),
    source_type: str = Form("auto")
):
    if not file.filename.lower().endswith(('.md', '.txt')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only MD and TXT are supported in this streamlined parser.")

    
    logging.info(f"--- INCOMING MD REQUEST ---")
    logging.info(f"Filename: {file.filename}")
    
    content = await file.read()
    text = content.decode('utf-8', errors='ignore')
    print(f"--- INCOMING TEXT DEBUG START ---\n{text[:500]}\n--- INCOMING TEXT DEBUG END ---", flush=True)
    
    parsed_questions = []
    current_q = None
    
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        q_match = re.match(r'^(?:Q\s*|Question\s*)?(?:\$|\\\()?\s*\(?\s*(\d+)\s*(?:\)|\.|\]|\})?\s*(?:\$|\\\))?\s*\.?\s+(.*)', line, re.IGNORECASE)
        if q_match:
            if current_q:
                parsed_questions.append(current_q)
            current_q = {
                'id': str(random.randint(10000, 99999)),
                'bodyHtml': q_match.group(2).strip(),
                'options': [
                    {'label': 'A', 'body_html': ''},
                    {'label': 'B', 'body_html': ''},
                    {'label': 'C', 'body_html': ''},
                    {'label': 'D', 'body_html': ''},
                ],
                'correctOptionLabel': 'A',
                'solutionText': '',
                'year': '',
                'source': f'Native MD Parser ({source_type})'
            }
            continue
            
        if current_q:
            opt_match = re.match(r'^(?:\$|\\\()?\s*(?:\\text\s*\{)?\s*\(?\s*([a-e])\s*(?:\)|\.|\]|\})?\s*\}?\s*(?:\$|\\\))?\s*\.?\s+(.*)', line, re.IGNORECASE)
            if opt_match:
                label = opt_match.group(1).upper()
                idx = ord(label) - 65
                if 0 <= idx < 4:
                    current_q['options'][idx]['body_html'] = opt_match.group(2).strip()
                continue
                
            ans_match = re.match(r'^Correct(?:\s*Answer)?\s*[:\-]?\s*(?:Option)?\s*(?:\$|\\\()?\s*(?:\\text\s*\{)?\s*\(?\s*([a-e])\s*(?:\)|\.|\]|\})?\s*\}?\s*(?:\$|\\\))?', line, re.IGNORECASE)
            if ans_match:
                current_q['correctOptionLabel'] = ans_match.group(1).upper()
                continue
                
            has_opts = any(opt['body_html'] != '' for opt in current_q['options'])
            if not has_opts:
                current_q['bodyHtml'] += '\n' + line
            else:
                if not line.lower().startswith('correct:'):
                    current_q['solutionText'] += line + '\n'
                    
    if current_q:
        parsed_questions.append(current_q)
        
    for q in parsed_questions:
        q['bodyHtml'] = convert_math(q['bodyHtml'].strip(), math_wrapper)
        q['solutionText'] = convert_math(q['solutionText'].strip(), math_wrapper)
        for opt in q['options']:
            opt['body_html'] = convert_math(opt['body_html'].strip(), math_wrapper)
            
    if not parsed_questions:
        return JSONResponse(status_code=200, content={
            "message": "Parser failed to extract questions. Please check formatting.",
            "questions": []
        })

    return {"questions": parsed_questions, "message": "Parsed successfully using Native Python MD Parser"}

@app.post("/api/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Must be a PDF file.")
        
    content = await file.read()
    doc = fitz.open(stream=content, filetype="pdf")
    
    parsed_questions = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        blocks = page.get_text("blocks")
        if not blocks:
            continue
            
        # Sort blocks top-to-bottom
        blocks.sort(key=lambda b: b[1])
        
        q_blocks = []
        for b in blocks:
            text = b[4].strip()
            # Enforce 'Q' or 'Question' to avoid treating options (1., 2.) as new questions
            if re.match(r'^(?:Q|Question)\s*\.?\s*\d+', text, re.IGNORECASE):
                q_blocks.append(b)
                
        if not q_blocks:
            continue
            
        for i, qb in enumerate(q_blocks):
            start_y = max(0, qb[1] - 5)
            next_q_y = q_blocks[i+1][1] - 5 if i+1 < len(q_blocks) else page.rect.y1
            
            # Find the actual bottom of the text for this question
            content_bottom_y = start_y
            for b in blocks:
                if b[1] >= start_y and b[1] < next_q_y:
                    if b[3] > content_bottom_y:
                        content_bottom_y = b[3]
                        
            # Add +25 padding to include any drawn borders, but don't exceed next_q_y
            end_y = min(next_q_y, content_bottom_y + 25)
            
            crop_rect = fitz.Rect(0, start_y, page.rect.width, end_y)
            
            # Extract image
            pix = page.get_pixmap(clip=crop_rect, matrix=fitz.Matrix(2, 2))
            img_data = pix.tobytes("png")
            b64_img = base64.b64encode(img_data).decode('utf-8')
            img_url = f"data:image/png;base64,{b64_img}"
            
            # Extract text
            raw_text = page.get_text("text", clip=crop_rect)
            
            current_q = {
                'id': str(random.randint(10000, 99999)),
                'bodyHtml': '',
                'options': [
                    {'label': 'A', 'body_html': ''},
                    {'label': 'B', 'body_html': ''},
                    {'label': 'C', 'body_html': ''},
                    {'label': 'D', 'body_html': ''},
                ],
                'correctOptionLabel': 'A',
                'solutionText': '',
                'year': '',
                'source': 'PDF Auto-Cropper',
                'originalImageUrl': img_url
            }
            
            lines = raw_text.split('\n')
            for line in lines:
                line = line.strip()
                if not line: continue
                
                line_no_ans = re.sub(r'^Ans\s*(?:X|✔|v|x)?\s*', '', line, flags=re.IGNORECASE).strip()
                
                opt_match = re.match(r'^[\(\[]?([a-d1-4])[\)\]\.]\s+(.*)', line_no_ans, re.IGNORECASE)
                if opt_match:
                    lbl = opt_match.group(1).upper()
                    if lbl == '1': lbl = 'A'
                    elif lbl == '2': lbl = 'B'
                    elif lbl == '3': lbl = 'C'
                    elif lbl == '4': lbl = 'D'
                    
                    idx = ord(lbl) - 65
                    if 0 <= idx < 4:
                        current_q['options'][idx]['body_html'] = opt_match.group(2).strip()
                        if '✔' in line or 'v ' in line.lower() or 'correct' in line.lower():
                            current_q['correctOptionLabel'] = lbl
                    continue
                
                has_opts = any(opt['body_html'] != '' for opt in current_q['options'])
                if not has_opts:
                    if current_q['bodyHtml'] == '':
                        line = re.sub(r'^(?:Q\s*|Question\s*)?\.?\s*\d+\s*[\.\)]\s*', '', line, flags=re.IGNORECASE)
                    current_q['bodyHtml'] += ('\n' if current_q['bodyHtml'] else '') + line
                else:
                    current_q['solutionText'] += ('\n' if current_q['solutionText'] else '') + line
                    
            parsed_questions.append(current_q)
            
    doc.close()
    
    if not parsed_questions:
        return JSONResponse(status_code=200, content={
            "message": "Parser failed to extract questions. Please check PDF formatting.",
            "questions": []
        })

    return {"questions": parsed_questions, "message": "Parsed successfully using Magic PDF Engine"}

class DikshaFetchRequest(BaseModel):
    username: str
    password: str

class DikshaRunRequest(BaseModel):
    username: str
    password: str
    target_course_url: str | None = None

# ── Credential Verification (no browser) ──────────────────────────────────

def _verify_credentials_sync(username: str, password: str) -> dict:
    """
    Verifies DIKSHA credentials via Keycloak form submission.
    Uses cloudscraper to bypass Cloudflare.
    Only fails when Keycloak EXPLICITLY shows an error element.
    Unknown/JS-redirect states are treated as VALID (bot will fail later if wrong).
    """
    try:
        import cloudscraper as _cs
        scraper = _cs.create_scraper(browser={"browser": "chrome", "platform": "windows", "mobile": False})
    except Exception:
        import requests as _req
        scraper = _req.Session()
        scraper.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        })

    keycloak_url = (
        "https://diksha.gov.in/auth/realms/sunbird/protocol/openid-connect/auth"
        "?client_id=portal"
        "&redirect_uri=https%3A%2F%2Fdiksha.gov.in%2Fsearch%2FLibrary%2F1%3FselectedTab%3Dall%26auth_callback%3D1"
        "&scope=openid"
        "&response_type=code"
        "&version=4"
    )

    try:
        # Step 1 — Load Keycloak login page (get CSRF token embedded in form action)
        r1 = scraper.get(keycloak_url, timeout=15, allow_redirects=True)
        logging.info(f"verify-login: login page status={r1.status_code}, url={r1.url[:80]}")

        soup1 = BeautifulSoup(r1.text, "html.parser")
        form = soup1.find("form", id="kc-form-login") or soup1.find("form", attrs={"action": True})

        if not form:
            # Keycloak page unreachable (Cloudflare block, etc.) — don't block user
            logging.warning("verify-login: login form not found in page — allowing through")
            return {"valid": True, "message": "Login accepted ✓ (verification skipped — DIKSHA page unreachable)"}

        action_url = form.get("action", "")
        if not action_url:
            logging.warning("verify-login: form has no action URL — allowing through")
            return {"valid": True, "message": "Login accepted ✓"}

        # Step 2 — POST credentials to Keycloak
        r2 = scraper.post(
            action_url,
            data={"username": username, "password": password, "credentialId": ""},
            timeout=20,
            allow_redirects=True,
        )
        final_url = r2.url
        logging.info(f"verify-login: POST status={r2.status_code}, final_url={final_url[:100]}")

        soup2 = BeautifulSoup(r2.text, "html.parser")

        # ── EXPLICIT FAILURE: Keycloak error element present ──────────────
        # This is the ONLY reliable failure signal from Keycloak
        for sel in ["#input-error", ".alert-error", ".kc-feedback-text", "[class*='alert'][class*='error']"]:
            err_el = soup2.select_one(sel)
            if err_el:
                err_text = err_el.get_text(" ", strip=True)
                logging.info(f"verify-login: INVALID — Keycloak error: {err_text[:80]}")
                return {"valid": False, "message": err_text or "Invalid username or password."}

        # ── EXPLICIT SUCCESS: redirected away from auth domain ─────────────
        if any(kw in final_url for kw in ["auth_callback=1", "diksha.gov.in/search", "diksha.gov.in/home", "diksha.gov.in/explore"]):
            logging.info("verify-login: VALID — redirect to DIKSHA confirmed")
            return {"valid": True, "message": "Login verified successfully ✓"}

        # ── AMBIGUOUS: JS redirects / Cloudflare — give benefit of doubt ──
        # DIKSHA uses window.location JS redirects after Keycloak POST,
        # which requests/cloudscraper cannot follow. So staying on the auth
        # page does NOT mean invalid credentials.
        if "openid-connect/auth" in final_url or soup2.find("form", id="kc-form-login"):
            logging.info("verify-login: AMBIGUOUS (JS redirect not followed) — allowing through")
            return {"valid": True, "message": "Login accepted ✓ (DIKSHA will confirm on next step)"}

        # Unknown redirect — assume success
        logging.info(f"verify-login: unknown final URL {final_url} — allowing through")
        return {"valid": True, "message": "Login accepted ✓"}

    except Exception as e:
        logging.error("verify-login exception: %s", e)
        # On any network error, don't block the user — the actual bot will catch bad creds
        return {"valid": True, "message": "Login accepted ✓ (verification service temporarily unavailable)"}


@app.post("/api/diksha/verify-login")
async def verify_diksha_login(req: DikshaFetchRequest):
    """
    Quickly verifies DIKSHA credentials without launching a browser.
    Used by the frontend login form to confirm credentials before opening the dashboard.
    """
    result = await asyncio.to_thread(_verify_credentials_sync, req.username, req.password)
    return result

@app.post("/api/diksha/fetch-courses")
async def fetch_diksha_courses(req: DikshaFetchRequest):
    try:
        data = await asyncio.to_thread(fetch_courses_only, username=req.username, password=req.password, headless=True)
        all_courses = data.get("all", [])
        _diksha["courses"] = all_courses
        return {
            "status": "success",
            "courses": all_courses,
            "ongoing": data.get("ongoing", []),
            "finished": data.get("finished", [])
        }
    except Exception as e:
        logging.error("Failed to fetch courses: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch courses: {str(e)}")


class DikshaCourseDetailsRequest(BaseModel):
    username: str
    password: str
    course_url: str

@app.post("/api/diksha/course-details")
async def get_course_details(req: DikshaCourseDetailsRequest):
    try:
        details = await asyncio.to_thread(
            fetch_course_details_only,
            username=req.username,
            password=req.password,
            course_url=req.course_url,
            headless=True
        )
        return details
    except Exception as e:
        logging.error("Failed to fetch course details: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch course details: {str(e)}")



def _debug_page_sync(username: str, password: str) -> dict:
    """Login and return raw page HTML + AJAX responses for debugging."""
    from auth import DikshaAuthenticator
    auth = DikshaAuthenticator(headless=True, username=username, password=password)
    try:
        page = auth.login()

        # Step 4 + 5
        try:
            page.goto("https://learning.diksha.gov.in/diksha/course_library.php",
                      wait_until="domcontentloaded", timeout=20000)
            import time as _t; _t.sleep(2)
        except Exception:
            pass

        page.goto("https://learning.diksha.gov.in/diksha/course_listing.php",
                  wait_until="networkidle", timeout=30000)
        import time as _t; _t.sleep(4)

        page_html = page.content()
        page_url  = page.url
        page_title = page.title()

        # Try AJAX payloads and collect raw responses
        ajax_results = []
        for payload in ["tab_type=ongoing", "type=ongoing", "tab=ongoing", "", "tab_type=finished"]:
            try:
                resp = page.request.post(
                    "https://learning.diksha.gov.in/diksha/course_listing.php",
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "Referer": "https://learning.diksha.gov.in/diksha/course_listing.php",
                    },
                    data=payload,
                )
                body = resp.text()
                ajax_results.append({
                    "payload": payload or "(empty)",
                    "status": resp.status,
                    "body_length": len(body),
                    "body_preview": body[:800],
                })
            except Exception as ex:
                ajax_results.append({"payload": payload or "(empty)", "error": str(ex)})

        return {
            "page_url": page_url,
            "page_title": page_title,
            "page_html_length": len(page_html),
            "page_html_preview": page_html[:2000],
            "ajax_results": ajax_results,
        }
    finally:
        auth.close()


@app.post("/api/diksha/debug-page")
async def debug_diksha_page(req: DikshaFetchRequest):
    """Debug endpoint: returns raw page HTML + AJAX responses from course_listing.php."""
    try:
        result = await asyncio.to_thread(_debug_page_sync, req.username, req.password)
        return result
    except Exception as e:
        logging.error("debug-page error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def _run_diksha_task(username: str, password: str, target_course_url: str | None = None) -> None:
    """Wrapper that tracks global state around run_automation."""
    _pause_event.set()
    _stop_event.clear()
    _diksha.update({
        "running": True,
        "status": "running",
        "step": "Starting bot on Railway...",
        "progress": 5,
        "logs": [],
        "current_course": None,
        "paused": False,
        "started_at": datetime.now().isoformat(),
    })
    try:
        run_automation(username=username, password=password, headless=True, target_course_url=target_course_url)
        if _stop_event.is_set():
            _diksha.update({"running": False, "status": "stopped", "step": "Automation stopped by user.", "progress": _diksha["progress"], "paused": False})
        else:
            _diksha.update({"running": False, "status": "done", "step": "Automation completed! 🎉", "progress": 100, "paused": False})
    except Exception as exc:
        if _stop_event.is_set():
            _diksha.update({"running": False, "status": "stopped", "step": "Automation stopped.", "progress": _diksha["progress"], "paused": False})
        else:
            _diksha.update({"running": False, "status": "error", "step": f"Error: {exc}", "progress": _diksha["progress"], "paused": False})
            logging.error("DIKSHA automation failed: %s", exc)

@app.post("/api/diksha/run")
async def run_diksha_automation(req: DikshaRunRequest, background_tasks: BackgroundTasks):
    if _diksha["running"]:
        raise HTTPException(status_code=409, detail="Automation already running. Please wait for the current session to finish.")
    background_tasks.add_task(_run_diksha_task, req.username, req.password, req.target_course_url)
    return {"status": "success", "message": "Automation started successfully in the background."}

@app.post("/api/diksha/pause")
async def pause_diksha_automation():
    if not _diksha["running"]:
        raise HTTPException(status_code=400, detail="Automation is not running.")
    if _diksha["paused"]:
        _pause_event.set()
        _diksha["paused"] = False
        _diksha["status"] = "running"
        _diksha["step"] = "Resumed automation..."
        return {"status": "success", "message": "Automation resumed."}
    else:
        _pause_event.clear()
        _diksha["paused"] = True
        _diksha["status"] = "paused"
        _diksha["step"] = "Automation paused by user."
        return {"status": "success", "message": "Automation paused."}

@app.post("/api/diksha/stop")
async def stop_diksha_automation():
    if not _diksha["running"]:
        return {"status": "success", "message": "Automation is already stopped."}
    _stop_event.set()
    _pause_event.set()
    _diksha["running"] = False
    _diksha["paused"] = False
    _diksha["status"] = "stopped"
    _diksha["step"] = "Automation stopped."
    return {"status": "success", "message": "Automation stopping..."}

@app.get("/api/diksha/status")
async def get_diksha_status():
    return {
        "running": _diksha["running"],
        "paused": _diksha.get("paused", False),
        "status": _diksha["status"],
        "step": _diksha["step"],
        "progress": _diksha["progress"],
        "started_at": _diksha["started_at"],
        "courses": _diksha.get("courses", []),
        "current_course": _diksha.get("current_course"),
        "logs": _diksha["logs"][-60:],
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
