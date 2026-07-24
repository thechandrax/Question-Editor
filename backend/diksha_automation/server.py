"""
DIKSHA Automation Server — FastAPI backend for Railway deployment.

Endpoints:
  GET  /              → Dashboard HTML
  POST /api/run       → Start automation in headless background thread
  POST /api/stop      → Stop running automation
  GET  /api/status    → Current status + last 30 log lines
  GET  /api/logs      → Full log history (with offset param)
  GET  /api/logs/stream → Server-Sent Events for real-time log streaming
  GET  /health        → Health check for Railway
"""

import asyncio
import json
import os
import queue
import threading
import logging
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse


# ── Global automation state ────────────────────────────────────────────────────
class AutomationState:
    def __init__(self):
        self.running:        bool       = False
        self.status:         str        = "idle"   # idle | running | done | error
        self.progress:       int        = 0
        self.current_module: str        = ""
        self.modules_done:   int        = 0
        self.modules_total:  int        = 9
        self.logs:           list[str]  = []
        self.log_queue:      queue.Queue = queue.Queue(maxsize=500)

state = AutomationState()


# ── Web log handler — pipes Python logging into the SSE stream ─────────────────
class WebLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord):
        msg = self.format(record)
        state.logs.append(msg)
        if len(state.logs) > 2000:          # keep last 2 k lines in memory
            state.logs = state.logs[-1000:]
        try:
            state.log_queue.put_nowait(msg)
        except queue.Full:
            pass


def _install_web_handler():
    handler = WebLogHandler()
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s",
                          datefmt="%H:%M:%S")
    )
    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


_install_web_handler()


# ── Background automation runner ───────────────────────────────────────────────
def _automation_worker(course_url: str):
    state.running        = True
    state.status         = "running"
    state.progress       = 0
    state.modules_done   = 0
    state.current_module = ""
    state.logs.clear()

    try:
        # Force headless on the server
        os.environ["HEADLESS"] = "True"
        os.environ["SLOW_MO"]  = "0"
        if course_url:
            os.environ["COURSE_URL"] = course_url

        # Import fresh (avoids stale module state across runs)
        import importlib
        import orchestrator as _orch
        importlib.reload(_orch)
        _orch.run_automation()

        state.status   = "done"
        state.progress = 100
        logging.info("✔ Automation completed successfully!")

    except Exception as e:
        state.status = "error"
        logging.error(f"Automation failed: {e}", exc_info=True)
    finally:
        state.running = False


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="DIKSHA Automation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    html_path = Path(__file__).parent / "templates" / "index.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "<h1>DIKSHA Automation</h1><p>templates/index.html missing.</p>"


@app.post("/api/run")
async def start_run(request: Request):
    if state.running:
        return JSONResponse(
            {"error": "Already running. Stop first.", "status": state.status},
            status_code=409,
        )
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    course_url = body.get(
        "course_url",
        os.getenv("COURSE_URL",
                  "https://learning.diksha.gov.in/diksha/course.php?id=1186&section=2486"),
    )

    threading.Thread(
        target=_automation_worker,
        args=(course_url,),
        daemon=True,
        name="diksha-bot",
    ).start()

    return {"status": "started", "course_url": course_url}


@app.post("/api/stop")
async def stop_run():
    state.running = False
    state.status  = "idle"
    return {"status": "stopped"}


@app.get("/api/status")
async def get_status():
    return {
        "running":        state.running,
        "status":         state.status,
        "progress":       state.progress,
        "current_module": state.current_module,
        "modules_done":   state.modules_done,
        "modules_total":  state.modules_total,
        "log_count":      len(state.logs),
        "last_logs":      state.logs[-30:],
    }


@app.get("/api/logs")
async def get_logs(offset: int = 0):
    return {
        "logs":   state.logs[offset:],
        "total":  len(state.logs),
        "status": state.status,
    }


@app.get("/api/logs/stream")
async def stream_logs(request: Request):
    """Server-Sent Events — live log streaming."""

    async def _gen():
        # Send backlog first
        for line in state.logs[-300:]:
            yield f"data: {json.dumps({'log': line, 'status': state.status})}\n\n"

        while True:
            if await request.is_disconnected():
                break

            batch: list[str] = []
            try:
                while len(batch) < 20:
                    batch.append(state.log_queue.get_nowait())
            except queue.Empty:
                pass

            if batch:
                for line in batch:
                    yield f"data: {json.dumps({'log': line, 'status': state.status})}\n\n"
            else:
                # Heartbeat — keeps the connection alive & updates status badge
                yield (
                    f"data: {json.dumps({'ping': True, 'status': state.status, 'progress': state.progress})}\n\n"
                )

            await asyncio.sleep(0.4)

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/health")
async def health():
    return {"ok": True, "status": state.status, "version": "2.0.0"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False, log_level="info")
