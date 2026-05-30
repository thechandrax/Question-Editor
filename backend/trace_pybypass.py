import sys, cloudscraper, re, time
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote

# Directly trace the bypass without PyBypass
scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})

url = 'https://gplinks.co/XZzPN59e'
print('Fetching:', url)
time.sleep(1)
r = scraper.get(url, timeout=30, allow_redirects=True)
print('Status:', r.status_code, '| Final URL:', r.url)

soup = BeautifulSoup(r.text, 'html.parser')

# Check if PyBypass would handle this domain
try:
    import PyBypass
    res = PyBypass.bypass(url)
    print('PyBypass result:', res)
except Exception as e:
    print('PyBypass error:', e)
