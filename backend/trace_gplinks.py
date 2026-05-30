import cloudscraper, re
from bs4 import BeautifulSoup

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})

# Step 1: Load original page
r1 = scraper.get('https://gplinks.co/XZzPN59e', timeout=30)
print('Step1 URL:', r1.url)

# Step 2: Follow the skip_sub link with cookies from step 1
skip_url = 'https://gplinks.co/XZzPN59e?skip_sub=1'
r2 = scraper.get(skip_url, timeout=30, allow_redirects=True)
print('Step2 Status:', r2.status_code, '| URL:', r2.url)
with open('gplinks_skip.html', 'w', encoding='utf-8') as f:
    f.write(r2.text)

soup2 = BeautifulSoup(r2.text, 'html.parser')
print('Title:', soup2.title.string if soup2.title else 'N/A')

# Check all links on the page after skip_sub
for a in soup2.find_all('a', href=True):
    print('LINK:', a['href'], '|', a.get_text(strip=True)[:60])

# Look for scripts with redirects
for s in soup2.find_all('script'):
    if s.string:
        locs = re.findall(r'(?:location|href)\s*[=:]\s*["\']([^"\']+)["\']', s.string)
        if locs:
            print('SCRIPT LOCS:', locs)

# Look for any countdown or token in the page
with open('gplinks_skip_text.txt', 'w', encoding='utf-8') as f:
    f.write(soup2.get_text())
