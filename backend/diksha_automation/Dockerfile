# ── DIKSHA Automation — Railway Dockerfile ─────────────────────────────────
# Uses the official Microsoft Playwright Python image (Chromium pre-installed)

FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser + OS deps
RUN playwright install chromium --with-deps

# Copy application code
COPY . .

# Create runtime directories
RUN mkdir -p logs screenshots

# Non-root user for security
RUN useradd -m botuser && chown -R botuser:botuser /app
USER botuser

# PORT is injected by Railway at runtime
ENV PORT=8080
EXPOSE 8080

# Start FastAPI server
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT} --log-level info
