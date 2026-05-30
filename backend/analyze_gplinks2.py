import re

html = open('gplinks_skip.html', encoding='utf-8').read()

# Find the CONTINUE button and surrounding area
continue_pos = html.find('CONTINUE')
if continue_pos != -1:
    print('Context around CONTINUE:')
    print(html[max(0, continue_pos-500):continue_pos+500])
    print('---')

# Find all script tags that might have the destination
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    if any(kw in s for kw in ['location', 'href', 'link', 'url', 'target', 'redirect', 'window.open', 'countdown', 'timer']):
        with open(f'gplinks_script_{i}.txt', 'w', encoding='utf-8') as f:
            f.write(s)
        print(f'Script {i} has redirect logic - saved (len: {len(s)})')
        if len(s) < 2000:
            print(s[:2000])
            print('---')

# Also search for any link that goes outside sanadegreecollege.in
import re
all_links = re.findall(r'href=["\']([^"\']+)["\']', html)
external = [l for l in all_links if l.startswith('http') and 'sanadegreecollege.in' not in l and 'gplinks' not in l]
print('External links found:', external[:10])

# Search for onclick attributes
onclicks = re.findall(r'onclick=["\']([^"\']+)["\']', html)
print('Onclick attributes:', onclicks[:10])
