import re
import os

file_path = r"C:\Users\thego\.gemini\antigravity\scratch\parser_platform\frontend\src\components\BulkEditor.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add List icon import
content = content.replace("Eye, Download, Upload } from 'lucide-react';", "Eye, Download, Upload, List } from 'lucide-react';")

# 2. Extract renderLatex
render_latex_pattern = re.compile(r"  const renderLatex = \(text: string\) => \{.*?  \};\n", re.DOTALL)
render_latex_match = render_latex_pattern.search(content)
render_latex_code = render_latex_match.group(0).replace("  const renderLatex", "const renderLatex")

content = content.replace(render_latex_match.group(0), "")

# 3. Insert renderLatex and QuestionEditorBlock before BulkEditor component
question_editor_block_code = """
interface QuestionEditorBlockProps {
  question: BulkEditorQuestion;
  index: number;
  updateBulkQuestion: (field: keyof BulkEditorQuestion, value: string, idx?: number) => void;
  updateBulkQuestionOption: (optionIndex: number, value: string, idx?: number) => void;
  handleEnterKey: (e: React.KeyboardEvent<HTMLTextAreaElement>, updateFn: (val: string) => void, currentValue: string) => void;
}

function QuestionEditorBlock({ question, index, updateBulkQuestion, updateBulkQuestionOption, handleEnterKey }: QuestionEditorBlockProps) {
  const questionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const solutionTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const currentQ = question;
  const idx = index;

  return (
    <div className="mb-12">
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xl px-6 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <span className="text-sm font-black text-slate-500 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-lg">Question {index + 1}</span>
        </div>
        {/* Question Area */}
        <div className="mb-6">
          {/* Original Snippet Section */}
          {currentQ.originalImageUrl && (
            <div className="mb-4 flex flex-col gap-2">
               <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm">
                 <div className="flex justify-between items-center px-4 py-2 bg-white border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Eye size={14}/> Original PDF Snippet</span>
                    <button onClick={() => updateBulkQuestion('originalImageUrl', '', idx)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Remove snippet">
                       <Trash2 size={16} />
                    </button>
                 </div>
                 <div className="p-4 flex justify-center bg-slate-100">
                    <img src={currentQ.originalImageUrl} alt="Original Snippet" className="max-w-full max-h-[300px] object-contain shadow-sm rounded border border-slate-200" />
                 </div>
               </div>
            </div>
          )}

          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Question Text</h3>
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 bg-slate-50/50">
            <RichTextToolbar 
              textareaRef={questionTextareaRef} 
              value={currentQ.bodyHtml} 
              onChange={(val: string) => updateBulkQuestion('bodyHtml', val, idx)}
            />
            <textarea 
              ref={questionTextareaRef}
              spellCheck="true"
              className="w-full min-h-[40px] px-4 py-3 text-base outline-none resize-y bg-transparent"
              placeholder="Question goes here..."
              value={currentQ.bodyHtml}
              onChange={(e) => updateBulkQuestion('bodyHtml', e.target.value, idx)}
              onKeyDown={(e) => handleEnterKey(e, (val) => updateBulkQuestion('bodyHtml', val, idx), currentQ.bodyHtml)}
            />
            {currentQ.bodyHtml && (
              <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 text-slate-800 prose prose-slate prose-p:m-0 max-w-none text-base font-medium">
                {renderLatex(currentQ.bodyHtml)}
              </div>
            )}
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {currentQ.options.map((opt, optIdx) => {
            const isCorrect = currentQ.correctOptionLabel === opt.label;
            return (
              <div
                key={optIdx}
                className={`relative rounded-xl border-2 ${
                  isCorrect
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                {/* Label Badge */}
                <div className={`absolute -left-4 -top-4 w-11 h-11 text-xl rounded-xl flex items-center justify-center font-black shadow-lg z-10 ${
                  isCorrect ? 'bg-green-500 text-white' : 'bg-slate-700 text-white'
                }`}>
                  {opt.label}
                </div>

                {/* Tick / Cross button */}
                <button
                  type="button"
                  title={isCorrect ? 'Correct Answer' : 'Click to set as correct answer'}
                  onClick={() => updateBulkQuestion('correctOptionLabel', opt.label, idx)}
                  className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-black shadow ${
                    isCorrect
                      ? 'bg-green-500 text-white scale-110'
                      : 'bg-red-100 text-red-500 hover:bg-red-200'
                  }`}
                >
                  {isCorrect ? '✔' : '✗'}
                </button>

                <textarea
                  spellCheck="true"
                  className="w-full min-h-[40px] py-3 pr-4 pl-12 outline-none resize-y bg-transparent rounded-t-xl text-sm"
                  placeholder={`Option ${opt.label}...`}
                  value={opt.body_html}
                  onChange={(e) => updateBulkQuestionOption(optIdx, e.target.value, idx)}
                  onKeyDown={(e) => handleEnterKey(e, (val) => updateBulkQuestionOption(optIdx, val, idx), opt.body_html)}
                />
                {opt.body_html && (
                  <div className="py-3 pr-4 pl-12 bg-slate-100 border-t-2 border-slate-200/60 text-slate-800 prose prose-sm prose-p:m-0 max-w-none rounded-b-xl border-dashed">
                    {renderLatex(opt.body_html)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation Separate Card */}
        <div className="mt-8 shadow-sm rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/60 p-6 print:hidden">
          <h3 className="text-lg font-black text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-3">
            Explanation (Optional)
          </h3>
          <div className="border-2 border-amber-100 rounded-xl overflow-hidden focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/20 bg-white shadow-sm">
            <RichTextToolbar 
              textareaRef={solutionTextareaRef} 
              value={currentQ.solutionText} 
              onChange={(val: string) => updateBulkQuestion('solutionText', val, idx)}
            />
            <textarea 
              ref={solutionTextareaRef}
              spellCheck="true"
              className="w-full min-h-[40px] px-4 py-3 text-sm outline-none resize-y bg-transparent"
              placeholder="Provide a detailed explanation here if needed..."
              value={currentQ.solutionText}
              onChange={(e) => updateBulkQuestion('solutionText', e.target.value, idx)}
              onKeyDown={(e) => handleEnterKey(e, (val) => updateBulkQuestion('solutionText', val, idx), currentQ.solutionText)}
            />
            {currentQ.solutionText && (
              <div className="px-4 py-3 bg-slate-100 border-t-2 border-amber-200/50 text-slate-800 prose prose-sm prose-p:m-0 max-w-none border-dashed rounded-b-xl">
                {renderLatex(currentQ.solutionText)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
"""

content = content.replace("export default function BulkEditor() {", render_latex_code + "\n" + question_editor_block_code + "\nexport default function BulkEditor() {")

# 4. Modify BulkEditor state
content = content.replace("const [isPreviewMode, setIsPreviewMode] = useState(false);", "const [isPreviewMode, setIsPreviewMode] = useState(false);\n  const [isListView, setIsListView] = useState(false);")

# 5. Update state modifier functions to accept idx
content = content.replace(
    "const updateBulkQuestion = (field: keyof BulkEditorQuestion, value: BulkEditorQuestion[keyof BulkEditorQuestion]) => {",
    "const updateBulkQuestion = (field: keyof BulkEditorQuestion, value: BulkEditorQuestion[keyof BulkEditorQuestion], idx = currentQuestionIndex) => {"
)
content = content.replace("newQuestions[currentQuestionIndex] = { ...newQuestions[currentQuestionIndex], [field]: value };", "newQuestions[idx] = { ...newQuestions[idx], [field]: value };")

content = content.replace(
    "const updateBulkQuestionOption = (optionIndex: number, value: string) => {",
    "const updateBulkQuestionOption = (optionIndex: number, value: string, idx = currentQuestionIndex) => {"
)
content = content.replace("newQuestions[currentQuestionIndex].options[optionIndex].body_html = value;", "newQuestions[idx].options[optionIndex].body_html = value;")

# 6. Add List View toggle button next to Preview button
preview_btn_code = """            <button 
              type="button"
              onClick={handlePreview}"""

list_view_btn_code = """            <button
              type="button"
              onClick={() => setIsListView(!isListView)}
              className={`px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>
            <button 
              type="button"
              onClick={handlePreview}"""
content = content.replace(preview_btn_code, list_view_btn_code)

# 7. Replace the Editor Body section (from <div className="bg-white border-x border-b ..."> down to </div> before Explanation)
editor_body_start = r'      <div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl px-6 pt-3 pb-6">'
editor_body_end = r'      {/* Explanation Separate Card */}'

editor_body_pattern = re.compile(re.escape(editor_body_start) + r".*?(?=" + re.escape(editor_body_end) + r")", re.DOTALL)

new_editor_body = """      {isListView ? (
        <div className="mt-6 space-y-6">
          {bulkQuestions.map((q, idx) => (
            <QuestionEditorBlock 
              key={q.id} 
              question={q} 
              index={idx} 
              updateBulkQuestion={updateBulkQuestion} 
              updateBulkQuestionOption={updateBulkQuestionOption} 
              handleEnterKey={handleEnterKey} 
            />
          ))}
        </div>
      ) : (
        <>
          <QuestionEditorBlock 
            question={currentQ} 
            index={currentQuestionIndex} 
            updateBulkQuestion={updateBulkQuestion} 
            updateBulkQuestionOption={updateBulkQuestionOption} 
            handleEnterKey={handleEnterKey} 
          />
        </>
      )}

"""

content = re.sub(editor_body_pattern, new_editor_body, content)

# 8. Clean up Explanation block which is now part of QuestionEditorBlock
explanation_block_pattern = re.compile(r'      \{\!isPreviewMode && \(\n        <div className="mt-8 shadow-2xl rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/60 p-6 md:p-8 print:hidden">.*?      \)\}', re.DOTALL)
content = re.sub(explanation_block_pattern, "", content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
