import os
import re
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Parser Platform API")

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

def bypass_url(url, scraper, depth=0, visited=None):
    if visited is None:
        visited = set()
        
    clean_url = url.split('#')[0]
    if depth > MAX_DEPTH:
        return url
    if clean_url in visited:
        return url
        
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
            if re.search(r'\b(click here|go|continue|get link|download|open link|verify|generate key)\b', a.text.lower()):
                return bypass_url(full_url, scraper, depth + 1, visited)

        return current_url
        
    except Exception as e:
        logging.error(f"Error at depth {depth}: {e}")
        return url

import PyBypass

def full_bypass(shortlink):
    # Try the new PyBypass Github package first!
    try:
        bypassed_url = PyBypass.bypass(shortlink)
        if bypassed_url and bypassed_url != shortlink and 'http' in bypassed_url:
            return bypassed_url
    except Exception as e:
        pass # PyBypass couldn't handle it or threw an error, fallback to our custom scraper
        
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    return unquote(bypass_url(shortlink, scraper))

@app.post("/api/bypass-shortlink")
async def api_bypass_shortlink(request: ShortlinkRequest):
    try:
        final_url = full_bypass(request.url)
        return {"original": request.url, "bypassed": final_url, "success": True}
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
