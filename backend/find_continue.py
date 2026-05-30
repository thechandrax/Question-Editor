import re

html = open('freehelpdesk_article.html', encoding='utf-8').read()

# Search for the CONTINUE button and nearby links - this is the real destination
# Look for snp2 section
snp2 = re.search(r'id=["\']tp-snp2["\'].*?(?:</div>){1,5}', html, re.DOTALL)
if snp2:
    section = snp2.group()[:3000]
    with open('snp2_section.txt', 'w', encoding='utf-8') as f:
        f.write(section)

# Look for CONTINUE link specifically
continue_matches = re.findall(r'CONTINUE.*?(?:href|location)[^\n]{0,300}', html, re.DOTALL | re.IGNORECASE)
for m in continue_matches[:3]:
    with open('continue_match.txt', 'a', encoding='utf-8') as f:
        f.write(m[:1000] + '\n---\n')

# Look for the actual link that vplink resolves to - search for /educationinsurancess/
edu_redirect = re.search(r'educationinsurancess[/\w?=&]+', html)
print('Edu redirect:', edu_redirect.group() if edu_redirect else 'not found')

# Look for window.location in the last 20000 chars (end of article where real link is)
end_html = html[-20000:]
loc_matches = re.findall(r'(?:window\.location|location\.href|href)\s*[=:]\s*["\']([^"\']+)["\']', end_html)
with open('end_links.txt', 'w', encoding='utf-8') as f:
    for l in loc_matches:
        f.write(l + '\n')
print('Links in last 20k chars:', loc_matches[:10])
