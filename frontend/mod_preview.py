import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove isPreviewMode state
text = text.replace('const [isPreviewMode, setIsPreviewMode] = useState(false);\n', '')

# 2. Add openPreviewTab function right before return
preview_func = '''  const openPreviewTab = () => {
    if (!bulkQuestions[0].bodyHtml) {
      alert("At least one question is required.");
      return;
    }
    
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Preview Questions</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\\\[', right: '\\\\]', display: true}, {left: '\\\\(', right: '\\\\)', display: false}]});"></script>
    </head>
    <body class="bg-slate-50 font-serif p-8">
      <div class="max-w-5xl mx-auto space-y-8">
    `;
    
    bulkQuestions.forEach((q, i) => {
      if (!q.bodyHtml) return;
      htmlContent += `
        <div class="p-6 rounded-xl border border-slate-200 shadow-sm bg-white print:break-inside-avoid print:bg-white print:border-slate-300 print:shadow-none print:m-0 print:p-4">
          <div class="flex gap-4 mb-4">
            <div class="w-10 h-10 shrink-0 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-black shadow-sm border border-emerald-200">
              ${i + 1}
            </div>
            <div class="flex-1 text-lg font-medium text-slate-800 prose prose-slate max-w-none">
              ${q.bodyHtml.replace(/\\n/g, '<br/>')}
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14 mb-4">
      `;
      q.options.forEach(opt => {
        const isCorrect = q.correctOptionLabel === opt.label;
        htmlContent += `
            <div class="p-4 rounded-xl border-2 ${isCorrect ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-slate-50'}">
              <div class="flex gap-3">
                <div class="w-6 h-6 shrink-0 rounded-md flex items-center justify-center font-bold text-sm ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}">
                  ${opt.label}
                </div>
                <div class="prose prose-sm max-w-none text-slate-700">
                  ${opt.body_html.replace(/\\n/g, '<br/>')}
                </div>
              </div>
            </div>
        `;
      });
      htmlContent += `
          </div>
      `;
      if (q.solutionText) {
        htmlContent += `
          <div class="ml-14 mt-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200 shadow-inner">
            <h4 class="text-amber-700 font-bold text-sm uppercase tracking-wider mb-2">Solution / Explanation</h4>
            <div class="prose prose-sm max-w-none text-slate-700">
              ${q.solutionText.replace(/\\n/g, '<br/>')}
            </div>
          </div>
        `;
      }
      htmlContent += `
        </div>
      `;
    });
    
    htmlContent += `
      </div>
    </body>
    </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const currentQ = bulkQuestions[currentQuestionIndex];
'''
text = text.replace('  const currentQ = bulkQuestions[currentQuestionIndex];', preview_func)

# 3. Modify Preview Button to use openPreviewTab
text = text.replace('onClick={() => setIsPreviewMode(!isPreviewMode)}', 'onClick={openPreviewTab}')
text = text.replace('<Eye size={15} /> {isPreviewMode ? \'Exit Preview\' : \'Preview\'}', '<Eye size={15} /> Preview')
text = text.replace('<Eye size={18} className={isPreviewMode ? \'text-teal-200\' : \'text-white\'} /> Preview', '<Eye size={18} className="text-white" /> Preview')

# 4. Remove the inline Preview block!
# Find the start: {/* Editor Body or Preview */}
start = text.find('      {/* Editor Body or Preview */}')
# Find the end of it: the end of the `) : (` block which is just `      )}`
end = text.find('        <>\n          {isListView ? (')
if start != -1 and end != -1:
    text = text[:start] + '      {/* Editor Body */}\n' + text[end:]
    
    # Also remove the ending `</>\n      )}` that wrapped the body!
    # Because we removed the ternary `{isPreviewMode ? ... : ...}`!
    end_tag = text.find('        </>\n      )}\n\n    </div>')
    if end_tag != -1:
        text = text[:end_tag] + '        </>\n\n    </div>'

with open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Done applying Preview logic and refactoring!')
