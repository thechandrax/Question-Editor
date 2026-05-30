import cloudscraper, re
from bs4 import BeautifulSoup

scraper = cloudscraper.create_scraper()

# Step 1: Get the vplink.in page raw
r = scraper.get('https://vplink.in/7KL5')
with open('vplink_raw.html', 'w', encoding='utf-8') as f:
    f.write(r.text)
print('vplink status:', r.status_code)
print('vplink url:', r.url)

# Step 2: Get the freehelpdesk intermediate with session cookies
r2 = scraper.get('https://freehelpdesk.in/universitesstudies/universiitessstudiess/?studiessunversietss=7KL5&uiso=20648')
with open('freehelpdesk_step2.html', 'w', encoding='utf-8') as f:
    f.write(r2.text)
print('freehelpdesk status:', r2.status_code)

# Step 3: Follow to the article page
r3 = scraper.get('https://freehelpdesk.in/universitesstudies/top-fast-track-mba-degrees-with-study-abroad-scholarships-and-elite-education-admission-study-courses-2026/')
with open('freehelpdesk_article.html', 'w', encoding='utf-8') as f:
    f.write(r3.text)
print('article status:', r3.status_code)
soup = BeautifulSoup(r3.text, 'html.parser')

# Find ALL scripts to look for the scanner / telegram bot code
print('\n--- SCRIPTS ---')
for i, s in enumerate(soup.find_all('script')):
    if s.string and len(s.string.strip()) > 10:
        print(f'Script {i}: {s.string[:600]}')
        print('---')

# Find onclick element
for el in soup.find_all(attrs={'onclick': True}):
    print('ONCLICK ELEMENT:', el.get('onclick'))
