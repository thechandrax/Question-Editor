import re

with open('src/components/BulkEditor_return.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# The header ends right before "{/* Editor Body or Preview */}"
header_match = re.search(r'(<div className="flex items-center justify-between gap-4 mb-1 print:hidden relative.*?)(\n\s*\{\/\*\s*Editor Body or Preview\s*\*\/\})', text, re.DOTALL)
if not header_match:
    print("Could not find header")
    exit(1)

header = header_match.group(1)

# The Preview section starts at "isPreviewMode ?"
preview_match = re.search(r'\{isPreviewMode \? \(\n\s*(<div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl px-6 pt-3 pb-6 space-y-8 print:border-none print:shadow-none print:p-0">.*?)\n\s*\) : \(', text, re.DOTALL)

if not preview_match:
    print("Could not find preview mode")
    exit(1)

preview = preview_match.group(1)

# Now construct the return statement!
new_return = f'''  return (
    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">
      {{/* Header */}}
      {header}

      {{/* Editor Body or Preview */}}
      {{isPreviewMode ? (
        {preview}
      ) : (
        <>
          {{isListView ? (
            <div className="mt-6 space-y-6">
              {{bulkQuestions.map((q, idx) => (
                <QuestionEditorBlock 
                  key={{q.id}} 
                  question={{q}} 
                  index={{idx}} 
                  updateBulkQuestion={{updateBulkQuestion}} 
                  updateBulkQuestionOption={{updateBulkQuestionOption}} 
                  handleEnterKey={{handleEnterKey}} 
                />
              ))}}
            </div>
          ) : (
            <QuestionEditorBlock 
              question={{currentQ}} 
              index={{currentQuestionIndex}} 
              updateBulkQuestion={{updateBulkQuestion}} 
              updateBulkQuestionOption={{updateBulkQuestionOption}} 
              handleEnterKey={{handleEnterKey}} 
            />
          )}}
        </>
      )}}
    </div>
  );
}}
'''

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    orig = f.read()

start = orig.find('return (')
new_file = orig[:start] + new_return

with open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(new_file)

print("Rebuilt successfully!")
