import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text_clean = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text_clean = re.sub(r'//.*', '', text_clean)
text_clean = re.sub(r'\"(?:\\.|[^\\\"])*\"', '\"\"', text_clean)
text_clean = re.sub(r'\'(?:\\.|[^\\\'])*\'', '\'\'', text_clean)
text_clean = re.sub(r'\`(?:\\.|[^\\\`])*\`', '\`\`', text_clean)

closes = []
for m in re.finditer(r'</div\s*>', text_clean):
    closes.append(m.start())

for idx in [18138, 18294, 18319, 18360, 18665, 18696, 18711, 19565]:
    start = max(0, idx - 40)
    end = min(len(text_clean), idx + 40)
    print(f'Idx {idx}: ...{text_clean[start:end]}...')
