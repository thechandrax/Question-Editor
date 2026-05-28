import codecs

with codecs.open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update QuestionEditorBlock div to have an ID
text = text.replace(
    'return (\n    <div className="mb-12">',
    'return (\n    <div className="mb-12" id={`qeb-${index}`}>'
)

# 2. Update toggleListView logic
old_btn = '''            <button
              type="button"
              onClick={() => setIsListView(!isListView)}
              className={`px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>'''

new_btn = '''            <button
              type="button"
              onClick={() => {
                const willBeList = !isListView;
                setIsListView(willBeList);
                if (willBeList) {
                  setTimeout(() => {
                    document.getElementById(`qeb-${currentQuestionIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>'''

if old_btn in text:
    text = text.replace(old_btn, new_btn)
else:
    print("Warning: old_btn not found")

# 3. Add ID to preview card
old_preview = '<div class="question-card">\n          <div class="q-num">Q${idx + 1}</div>'
new_preview = '<div class="question-card" id="q-${idx}">\n          <div class="q-num">Q${idx + 1}</div>'
if old_preview in text:
    text = text.replace(old_preview, new_preview)
else:
    print("Warning: old_preview not found")

# 4. Scroll to preview card hash
old_open = "window.open(url, '_blank');"
new_open = "window.open(url + `#q-${currentQuestionIndex}`, '_blank');"
if old_open in text:
    text = text.replace(old_open, new_open)
else:
    print("Warning: old_open not found")

with codecs.open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
