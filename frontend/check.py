import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove comments
text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text = re.sub(r'//.*', '', text)

# Remove string literals
text = re.sub(r'\"(?:\\.|[^\\\"])*\"', '\"\"', text)
text = re.sub(r'\'(?:\\.|[^\\\'])*\'', '\'\'', text)
text = re.sub(r'\`(?:\\.|[^\\\`])*\`', '\`\`', text)

# Now we should only have JSX! Let's find opens and closes
opens = []
for m in re.finditer(r'<div\b[^>]*?(?<!/)>', text):
    opens.append(m.start())

closes = []
for m in re.finditer(r'</div\s*>', text):
    closes.append(m.start())

print(f'Total opens: {len(opens)}')
print(f'Total closes: {len(closes)}')

# Match them up to see where it breaks
stack = []
for m in re.finditer(r'<(/?div)\b[^>]*?(?<!/)>', text):
    if m.group(1) == 'div':
        stack.append(m.start())
    else:
        if stack:
            stack.pop()
        else:
            print('Unmatched close at index:', m.start())
            
print('Unmatched opens at indices:', stack)
for s in stack:
    # get line number
    line_no = text.count('\n', 0, s) + 1
    print(f'Open at line {line_no}: {text[s:s+50]}')
