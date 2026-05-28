import sys

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('return (')
if start == -1:
    sys.exit(1)

new_content = text[:start] + '''return (
    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">
      <div className="bg-white">
        Test
      </div>
    </div>
  );
}
'''
with open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
