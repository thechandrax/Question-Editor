import cloudscraper, re
from bs4 import BeautifulSoup

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})

# Step 1: Fetch the gplinks page
r = scraper.get('https://gplinks.co/XZzPN59e', timeout=30, allow_redirects=True)
print('Status:', r.status_code, '| URL:', r.url)

soup = BeautifulSoup(r.text, 'html.parser')

# Check all links
for a in soup.find_all('a', href=True):
    print('LINK:', a['href'], '|', a.get_text(strip=True)[:60])

# Check scripts for redirects
for s in soup.find_all('script'):
    if s.string and ('location' in s.string or 'href' in s.string):
        print('SCRIPT:', s.string[:400])

# Save the page
with open('gplinks_page.html', 'w', encoding='utf-8') as f:
    f.write(r.text)
print('Saved. Page size:', len(r.text))
print('Page title:', soup.title.string if soup.title else 'N/A')
