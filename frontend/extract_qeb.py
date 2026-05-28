import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('        {/* Question Area */}')
end = text.find('      {/* Explanation Separate Card */}')

question_block = text[start:end]

with open('src/components/QuestionEditorBlock.tsx', 'w', encoding='utf-8') as f:
    f.write('''import React, { useRef } from 'react';
import { RichTextToolbar } from './RichTextToolbar';
import { BulkEditorQuestion } from './BulkEditor';
import { BlockMath, InlineMath } from 'react-katex';

interface QuestionEditorBlockProps {
  question: BulkEditorQuestion;
  index: number;
  updateBulkQuestion: (field: keyof BulkEditorQuestion, value: string, idx?: number) => void;
  updateBulkQuestionOption: (idx: number, value: string, qIdx?: number) => void;
  handleEnterKey: (e: React.KeyboardEvent<HTMLTextAreaElement>, updateFn: (val: string) => void, currentValue: string) => void;
  renderLatex: (text: string) => (JSX.Element | null)[] | null;
}

export const QuestionEditorBlock: React.FC<QuestionEditorBlockProps> = ({
  question: currentQ,
  index,
  updateBulkQuestion,
  updateBulkQuestionOption,
  handleEnterKey,
  renderLatex
}) => {
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const solutionTextareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xl px-6 pt-5 pb-6 mb-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-sm">
          Question {index + 1}
        </span>
      </div>
''')
    
    question_block = re.sub(r"updateBulkQuestion\((['\w]+),\s*(.*?)\)", r"updateBulkQuestion(\1, \2, index)", question_block)
    question_block = re.sub(r"updateBulkQuestionOption\(([^,]+),\s*(.*?)\)", r"updateBulkQuestionOption(\1, \2, index)", question_block)
    
    f.write(question_block)
    
    f.write('''
      {/* Explanation Separate Card */}
      <div className="mt-8 shadow-sm rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/60 p-6 print:hidden">
        <h3 className="text-lg font-black text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-3">
          Explanation (Optional)
        </h3>
        <div className="border-2 border-amber-100 rounded-xl overflow-hidden focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/20 bg-white shadow-sm">
          <RichTextToolbar 
            textareaRef={solutionTextareaRef} 
            value={currentQ.solutionText} 
            onChange={(val: string) => updateBulkQuestion('solutionText', val, index)}
          />
          <textarea 
            ref={solutionTextareaRef}
            spellCheck="true"
            className="w-full min-h-[40px] px-4 py-3 text-sm outline-none resize-y bg-transparent"
            placeholder="Provide a detailed explanation here if needed..."
            value={currentQ.solutionText}
            onChange={(e) => updateBulkQuestion('solutionText', e.target.value, index)}
            onKeyDown={(e) => handleEnterKey(e, (val) => updateBulkQuestion('solutionText', val, index), currentQ.solutionText)}
          />
          {currentQ.solutionText && (
            <div className="px-4 py-3 bg-slate-100 border-t-2 border-amber-200/50 text-slate-800 prose prose-sm prose-p:m-0 max-w-none border-dashed rounded-b-xl">
              {renderLatex(currentQ.solutionText)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
''')
