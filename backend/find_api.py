import re, cloudscraper
from bs4 import BeautifulSoup

html = open('freehelpdesk_article.html', encoding='utf-8').read()

# The pattern for vplink/studyeducations type sites:
# 1. User clicks "CONTINUE" button (tp-generate section shows countdown)
# 2. After countdown, a token is generated via a POST/GET request
# 3. The token unlocks the real link via API

# Look for the API endpoint pattern - these sites use a token API
api_calls = re.findall(r'(?:fetch|ajax|XMLHttpRequest|\.get|\.post)\(["\']([^"\']+)["\']', html)
print('API calls found:', api_calls[:10])

# Look for any API token endpoint
api_endpoint = re.findall(r'https?://[^\s"<>\']*(?:api|token|link|generate|bypass)[^\s"<>\']*', html, re.IGNORECASE)
print('API endpoints:', api_endpoint[:10])

# Look for the b2a function usage - it encodes a URL
b2a_uses = re.findall(r'b2a\([^\)]+\)', html)
print('b2a uses:', b2a_uses[:5])

# The freehelpdesk links use a pattern like:
# /educationinsurancess/?key=<encoded> 
# Let's see what the page does after countdown 
# Search for the timer counter callback
counter_cb = re.search(r'timer\(\).*?(?:window|location|href)[^\n]{0,500}', html, re.DOTALL)
if counter_cb:
    print('Counter callback found:')
    print(counter_cb.group()[:2000])

# Search for the snp2 button link
soup = BeautifulSoup(html, 'html.parser')
snp2 = soup.find(id='tp-snp2')
if snp2:
    print('\nSNP2 content:')
    print(snp2)
else:
    print('snp2 not found')
    
# Check for data attributes or hidden inputs with the link
hidden = soup.find_all('input', type='hidden')
for h in hidden:
    print('HIDDEN INPUT:', h)
    
# Look for the specific Studyeducations or vplink API
vplink_api = re.findall(r'studyeducations[^\s"<>\']*', html, re.IGNORECASE)
print('Studyeducations patterns:', vplink_api[:5])
