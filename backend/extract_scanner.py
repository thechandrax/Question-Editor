import re, sys

html = open('freehelpdesk_article.html', encoding='utf-8').read()

# Extract the full startV34Scanner function
match = re.search(r'startV34Scanner.*?</script>', html, re.DOTALL)
if match:
    txt = match.group()[:5000]
    with open('scanner_full.txt', 'w', encoding='utf-8') as f:
        f.write(txt)
    print('Saved scanner_full.txt - len:', len(txt))
else:
    print('scanner not found')

# Find tp-generate section with the actual link button
tp_gen = re.search(r'id=["\']tp-generate["\'].*?</div>', html, re.DOTALL)
if tp_gen:
    section = tp_gen.group()[:3000]
    with open('tp_generate.txt', 'w', encoding='utf-8') as f:
        f.write(section)
    print('Saved tp_generate.txt - len:', len(section))

# Find any Telegram bot URL
tg = re.findall(r'https://t\.me/[^\s"<>\']+', html)
print('Telegram links:', tg)

# Find IMPORTANT NOTICE section - typically contains the real link
imp = re.search(r'IMPORTANT[_\s].*?(?:href|window\.location)[^\n]{0,200}', html, re.DOTALL | re.IGNORECASE)
if imp:
    section = imp.group()[:3000]
    with open('important_section.txt', 'w', encoding='utf-8') as f:
        f.write(section)
    print('Saved important_section.txt')

# Find any /educationinsurancess/ redirect pattern
redir = re.findall(r'educationinsurancess[^\s"<>\']*', html)
print('Redirect patterns:', redir[:5])
