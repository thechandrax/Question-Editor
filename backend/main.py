import os
import re
import json
import random
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Parser Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    ext = file.filename.lower().split('.')[-1]
    
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
