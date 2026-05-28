import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

if 'QuestionEditorBlock' not in text:
    text = text.replace("import { RichTextToolbar } from './RichTextToolbar';", "import { RichTextToolbar } from './RichTextToolbar';\nimport { QuestionEditorBlock } from './QuestionEditorBlock';")

if 'const [isListView' not in text:
    text = text.replace('const [isPreviewMode, setIsPreviewMode] = useState(false);', 'const [isPreviewMode, setIsPreviewMode] = useState(false);\n  const [isListView, setIsListView] = useState(false);')

toggle_btn = '''
            <button
              type="button"
              onClick={() => setIsListView(!isListView)}
              className={`px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>
'''
if 'View as List' not in text:
    text = text.replace('<Eye size={15} /> {isPreviewMode ? \'Exit Preview\' : \'Preview\'}', toggle_btn.strip() + '\n              <Eye size={15} /> {isPreviewMode ? \'Exit Preview\' : \'Preview\'}')

start = text.find('      <div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl px-6 pt-5 pb-6">')
if start == -1:
    start = text.find('      <div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl p-8">')
end = text.find('      {/* Explanation Separate Card */}')
end_expl = text.find('      )}', end) + 8

new_body = '''      {isListView ? (
        <div className="mt-6 space-y-6">
          {bulkQuestions.map((q, idx) => (
            <QuestionEditorBlock 
              key={q.id}
              question={q} 
              index={idx} 
              updateBulkQuestion={updateBulkQuestion} 
              updateBulkQuestionOption={updateBulkQuestionOption} 
              handleEnterKey={handleEnterKey} 
              renderLatex={renderLatex}
            />
          ))}
        </div>
      ) : (
        <QuestionEditorBlock 
          question={currentQ} 
          index={currentQuestionIndex} 
          updateBulkQuestion={updateBulkQuestion} 
          updateBulkQuestionOption={updateBulkQuestionOption} 
          handleEnterKey={handleEnterKey} 
          renderLatex={renderLatex}
        />
      )}'''

text = text[:start] + new_body + text[end_expl:]

with open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done modifying BulkEditor.tsx!')
