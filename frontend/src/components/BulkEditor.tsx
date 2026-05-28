"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, Eye, Download, Upload, List } from 'lucide-react';
import { RichTextToolbar } from './RichTextToolbar';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

export interface BulkEditorQuestion {
  id: string;
  bodyHtml: string;
  options: { label: string; body_html: string }[];
  correctOptionLabel: string;
  solutionText: string;
  year: string;
  source: string;
  originalImageUrl?: string;
}

const renderLatex = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\)|(?<!\$)\$(?!\$)[\s\S]*?(?<!\$)\$(?!\$))/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
      return <InlineMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    }
    return <span key={index} dangerouslySetInnerHTML={{ __html: part.replace(/<br>\n/g, '\n').replace(/\n/g, '<br/>') }} />;
  });
};

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
                <div className={`absolute -left-4 -top-4 w-11 h-11 text-xl rounded-xl flex items-center justify-center font-black shadow-lg z-10 ${
                  isCorrect ? 'bg-green-500 text-white' : 'bg-slate-700 text-white'
                }`}>
                  {opt.label}
                </div>

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

        {/* Explanation */}
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

export default function BulkEditor() {
  const [isListView, setIsListView] = useState(false);
  const [autoSaveEnabled] = useState(true);

  const [isGotoOpen, setIsGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [isImgGotoOpen, setIsImgGotoOpen] = useState(false);
  const [imgGotoValue, setImgGotoValue] = useState("");
  const [isImportingMd, setIsImportingMd] = useState(false);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  
  const gotoInputRef = useRef<HTMLInputElement>(null);
  const imgGotoInputRef = useRef<HTMLInputElement>(null);

  const [bulkQuestions, setBulkQuestions] = useState<BulkEditorQuestion[]>([
    {
      id: Math.random().toString(),
      bodyHtml: '',
      options: [
        { label: 'A', body_html: '' },
        { label: 'B', body_html: '' },
        { label: 'C', body_html: '' },
        { label: 'D', body_html: '' },
      ],
      correctOptionLabel: 'A',
      solutionText: '',
      year: '',
      source: ''
    }
  ]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(`bulkQuestions`);
    if (saved) {
      try {
        setBulkQuestions(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isGotoOpen && gotoInputRef.current) {
      gotoInputRef.current.focus({ preventScroll: true });
    }
  }, [isGotoOpen]);

  useEffect(() => {
    if (isImgGotoOpen && imgGotoInputRef.current) {
      imgGotoInputRef.current.focus({ preventScroll: true });
    }
  }, [isImgGotoOpen]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`bulkQuestions`, JSON.stringify(bulkQuestions));
    }, 5000);
    return () => clearTimeout(timer);
  }, [bulkQuestions, autoSaveEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowLeft') {
        setCurrentQuestionIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentQuestionIndex(i => Math.min(bulkQuestions.length - 1, i + 1));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [bulkQuestions.length]);

  const handleDownloadJson = () => {
    if (!bulkQuestions[0].bodyHtml) {
      alert("At least one question is required.");
      return;
    }
    const exportData = bulkQuestions.map(q => ({
      ...q,
      bodyHtml: q.bodyHtml.replace(/\n/g, '<br/>'),
      options: q.options.map(o => ({ ...o, body_html: o.body_html.replace(/\n/g, '<br/>') })),
      solutionText: q.solutionText.replace(/\n/g, '<br/>')
    }));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `parsed_questions_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const addBulkQuestion = () => {
    const newQ: BulkEditorQuestion = {
      id: Math.random().toString(),
      bodyHtml: '',
      options: [
        { label: 'A', body_html: '' },
        { label: 'B', body_html: '' },
        { label: 'C', body_html: '' },
        { label: 'D', body_html: '' },
      ],
      correctOptionLabel: 'A',
      solutionText: '',
      year: '',
      source: ''
    };
    setBulkQuestions([...bulkQuestions, newQ]);
    setCurrentQuestionIndex(bulkQuestions.length);
  };

  const deleteBulkQuestion = () => {
    if (bulkQuestions.length === 1) {
      alert("You cannot delete the only question. Just clear its content instead.");
      return;
    }
    if (confirm("Are you sure you want to delete this question?")) {
      const newQuestions = bulkQuestions.filter((_, i) => i !== currentQuestionIndex);
      setBulkQuestions(newQuestions);
      if (currentQuestionIndex >= newQuestions.length) {
        setCurrentQuestionIndex(newQuestions.length - 1);
      }
    }
  };

  const updateBulkQuestion = (field: keyof BulkEditorQuestion, value: string, idx = currentQuestionIndex) => {
    const newQuestions = [...bulkQuestions];
    newQuestions[idx] = { ...newQuestions[idx], [field]: value };
    setBulkQuestions(newQuestions);
  };

  const updateBulkQuestionOption = (optionIndex: number, value: string, idx = currentQuestionIndex) => {
    const newQuestions = [...bulkQuestions];
    newQuestions[idx].options[optionIndex].body_html = value;
    setBulkQuestions(newQuestions);
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, updateFn: (val: string) => void, currentValue: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = currentValue.substring(0, start) + '<br>\n' + currentValue.substring(end);
      updateFn(newValue);
      
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 5;
      }, 0);

      setTimeout(() => {
        setBulkQuestions(currentQs => currentQs.map(q => ({
          ...q,
          bodyHtml: q.bodyHtml.replace(/<br>\n/g, '\n'),
          options: q.options.map(o => ({ ...o, body_html: o.body_html.replace(/<br>\n/g, '\n') })),
          solutionText: q.solutionText.replace(/<br>\n/g, '\n')
        })));
      }, 3000);
    }
  };

  const handleGotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(gotoValue, 10);
    if (!isNaN(val) && val > 0 && val <= bulkQuestions.length) {
      setCurrentQuestionIndex(val - 1);
      setGotoValue("");
      setIsGotoOpen(false);
    } else {
      alert("Invalid question number");
    }
  };

  const handleImgGotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(imgGotoValue, 10);
    if (!isNaN(val) && val > 0) {
      let imgCounter = 0;
      for (let i = 0; i < bulkQuestions.length; i++) {
        if (bulkQuestions[i].originalImageUrl) {
          imgCounter++;
          if (imgCounter === val) {
            setCurrentQuestionIndex(i);
            setImgGotoValue("");
            setIsImgGotoOpen(false);
            return;
          }
        }
      }
      alert(`Image ${val} not found.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingMd(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('math_wrapper', 'inline_parentheses');
    formData.append('source_type', 'auto');

    try {
      const res = await fetch(`/api/parse-document`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          const mappedQuestions = data.questions.map((q: Record<string, unknown>) => ({
            id: (q.id as string) || Math.random().toString(),
            bodyHtml: (q.bodyHtml as string) || '',
            options: (q.options as { label: string; body_html: string }[]) || [
              { label: 'A', body_html: '' },
              { label: 'B', body_html: '' },
              { label: 'C', body_html: '' },
              { label: 'D', body_html: '' },
            ],
            correctOptionLabel: (q.correctOptionLabel as string) || 'A',
            solutionText: (q.solutionText as string) || '',
            year: (q.year as string) || '',
            source: (q.source as string) || ''
          }));
          setBulkQuestions(prevQs => {
            if (prevQs.length > 1 || (prevQs[0] && prevQs[0].originalImageUrl)) {
               return mappedQuestions.map((q: Record<string, unknown>, idx: number) => ({
                 ...q,
                 originalImageUrl: prevQs[idx]?.originalImageUrl || ''
               }));
            }
            return mappedQuestions;
          });
          setCurrentQuestionIndex(0);
          alert(`Successfully imported ${mappedQuestions.length} questions!`);
        } else {
          alert("No questions found in document.");
        }
      } else {
        alert(`Error parsing document: ${data.message || data.error}`);
      }
    } catch {
      alert("Error uploading document.");
    } finally {
      setIsImportingMd(false);
      e.target.value = '';
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPdf(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/parse-pdf`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          const mappedQuestions = data.questions.map((q: Record<string, unknown>) => ({
            id: (q.id as string) || Math.random().toString(),
            bodyHtml: (q.bodyHtml as string) || '',
            options: (q.options as { label: string; body_html: string }[]) || [
              { label: 'A', body_html: '' },
              { label: 'B', body_html: '' },
              { label: 'C', body_html: '' },
              { label: 'D', body_html: '' },
            ],
            correctOptionLabel: (q.correctOptionLabel as string) || 'A',
            solutionText: (q.solutionText as string) || '',
            year: (q.year as string) || '',
            source: (q.source as string) || '',
            originalImageUrl: (q.originalImageUrl as string) || ''
          }));
          setBulkQuestions(prevQs => {
            if (prevQs.length > 1 || (prevQs[0] && prevQs[0].bodyHtml !== '')) {
               return prevQs.map((q, idx) => ({
                 ...q,
                 originalImageUrl: mappedQuestions[idx]?.originalImageUrl || q.originalImageUrl || ''
               }));
            }
            return mappedQuestions;
          });
          setCurrentQuestionIndex(0);
          alert(`Successfully imported ${mappedQuestions.length} questions from PDF with cropped images!`);
        } else {
          alert("No questions found in PDF.");
        }
      } else {
        alert(`Error parsing PDF: ${data.message || data.error}`);
      }
    } catch {
      alert("Error uploading PDF.");
    } finally {
      setIsImportingPdf(false);
      e.target.value = '';
    }
  };

  const downloadHTML = () => {
    if (!bulkQuestions[0].bodyHtml) {
      alert("At least one question is required.");
      return;
    }
    
    let htmlContent = '<head><meta charset="utf-8"></head><body>\n';
    
    bulkQuestions.forEach(q => {
      if (!q.bodyHtml) return;
      htmlContent += '  <div class="items">\n';
      htmlContent += '    <div class="furnished">\n';
      htmlContent += `      <div class="Q">${q.bodyHtml.replace(/\n/g, '<br/>')}</div>\n`;
      htmlContent += `      <div class="Y">${q.year || ''}</div>\n`;
      
      const letterMap = ['A', 'B', 'C', 'D', 'E'];
      q.options.forEach((opt, index) => {
         const letter = letterMap[index] || 'A';
         htmlContent += `      <div class="${letter}">${opt.body_html.replace(/\n/g, '<br/>')}</div>\n`;
      });
      
      htmlContent += `      <div class="Answer">${q.correctOptionLabel || ''}</div>\n`;
      htmlContent += '    </div>\n';
      htmlContent += `    <div class="roughEdits">${q.bodyHtml.replace(/\n/g, '<br/>')}</div>\n`;
      htmlContent += '  </div>\n';
    });
    
    htmlContent += '</body>\n</html>';
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parsed_questions_exact_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = () => {
    if (!bulkQuestions[0].bodyHtml) {
      alert("At least one question is required to preview.");
      return;
    }

    const letterMap = ['A', 'B', 'C', 'D', 'E'];
    const questionsHtml = bulkQuestions.map((q, idx) => {
      if (!q.bodyHtml) return '';
      const optionsHtml = q.options.map((opt, i) => `
        <div class="option ${opt.label === q.correctOptionLabel ? 'correct' : ''}">
          <span class="opt-label">${letterMap[i]}</span>
          <span>${opt.body_html.replace(/\n/g, '<br/>') || '—'}</span>
        </div>`).join('');

      const imageHtml = q.originalImageUrl
        ? `<img src="${q.originalImageUrl}" class="q-image" alt="Question Image"/>`
        : '';

      return `
        <div class="question-card">
          <div class="q-num">Q${idx + 1}</div>
          ${imageHtml}
          <div class="q-body">${q.bodyHtml.replace(/\n/g, '<br/>')}</div>
          <div class="options">${optionsHtml}</div>
          ${q.solutionText ? `<div class="solution"><strong>Solution:</strong> ${q.solutionText.replace(/\n/g, '<br/>')}</div>` : ''}
          ${q.year ? `<div class="year">Year: ${q.year}</div>` : ''}
        </div>`;
    }).join('');

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Question Preview (${bulkQuestions.length} Questions)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f1f5f9; padding: 32px 16px; color: #1e293b; }
    h1 { text-align: center; color: #0f766e; font-size: 1.6rem; margin-bottom: 28px; }
    .question-card { background: #fff; border-radius: 14px; padding: 24px 28px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); border-left: 5px solid #14b8a6; }
    .q-num { font-size: 0.75rem; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
    .q-image { max-width: 100%; border-radius: 8px; margin-bottom: 14px; border: 1px solid #e2e8f0; }
    .q-body { font-size: 1rem; line-height: 1.7; margin-bottom: 16px; font-weight: 500; }
    .options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .option { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 0.93rem; }
    .option.correct { background: #dcfce7; border-color: #86efac; }
    .opt-label { font-weight: 800; color: #0f766e; min-width: 18px; }
    .solution { margin-top: 12px; padding: 10px 14px; background: #fefce8; border-radius: 8px; border: 1px solid #fde68a; font-size: 0.9rem; color: #78350f; }
    .year { margin-top: 8px; font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
  </style>
</head>
<body>
  <h1>📋 Question Preview — ${bulkQuestions.length} Questions</h1>
  ${questionsHtml}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const currentQ = bulkQuestions[currentQuestionIndex];
  const imageCount = bulkQuestions.filter(q => q.originalImageUrl).length;
  let currentImageDisplay: string | number = "-";
  let counter = 0;
  for (let i = 0; i <= currentQuestionIndex; i++) {
    if (bulkQuestions[i].originalImageUrl) {
      counter++;
    }
  }
  if (bulkQuestions[currentQuestionIndex]?.originalImageUrl) {
    currentImageDisplay = counter;
  }

  return (
    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-1 print:hidden relative px-5 py-2.5 rounded-b-xl border-b border-x border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/90 backdrop-blur-xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/50 via-transparent to-indigo-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <h1 className="relative text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-[length:200%_auto] transform transition-transform duration-500 hover:scale-[1.02]">
          Question Editor
        </h1>

        <div className="flex items-center gap-3 relative">
          <div className="flex rounded-lg border border-emerald-200 shadow-sm relative h-10 items-center transition-all duration-300 hover:shadow-[0_8px_25px_rgba(16,185,129,0.25)] hover:scale-105 hover:border-emerald-300 overflow-hidden bg-white">
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              accept=".md,.txt" 
              onChange={handleFileUpload}
              disabled={isImportingMd || isImportingPdf}
              title="Upload Markdown File"
            />
            <button 
              type="button"
              className="px-4 py-1.5 text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold h-full w-full relative z-0 hover:from-emerald-400 hover:to-teal-400"
            >
              {isImportingMd ? 'Importing...' : <><Upload size={16} className="text-white group-hover:-translate-y-0.5 transition-transform duration-300" /> Import Markdown</>}
            </button>
          </div>

          <div className="flex rounded-lg border border-indigo-200 shadow-sm relative h-10 items-center transition-all duration-300 hover:shadow-[0_8px_25px_rgba(99,102,241,0.25)] hover:scale-105 hover:border-indigo-300 overflow-hidden bg-white">
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              accept=".pdf" 
              onChange={handlePdfUpload}
              disabled={isImportingMd || isImportingPdf}
              title="Upload PDF File"
            />
            <button 
              type="button"
              className="px-4 py-1.5 text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold h-full w-full relative z-0 hover:from-indigo-400 hover:to-purple-400"
            >
              {isImportingPdf ? 'Extracting...' : <><Upload size={16} className="text-white group-hover:-translate-y-0.5 transition-transform duration-300" /> Upload PDF</>}
            </button>
          </div>
        </div>
      </div>

      {/* Editor Card */}
      <div className="shadow-2xl rounded-2xl bg-white border border-slate-200/60 overflow-hidden print:shadow-none print:border-none">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-2 flex items-center gap-2 flex-wrap print:hidden">
          
          <div className="flex flex-col gap-1.5 shrink-0">
            
            <div className="bg-black/20 px-3 py-1 rounded-lg shadow-inner flex items-center justify-between gap-3 overflow-hidden transition-all duration-300">
              <div className="flex items-center gap-1.5">
                <span className="text-teal-50 font-medium text-sm">Question</span>
                <span className="font-bold text-base text-white leading-none">{currentQuestionIndex + 1}</span>
                <span className="text-teal-50 font-medium text-sm">of</span>
                <span className="font-bold text-base text-white leading-none">{bulkQuestions.length}</span>
              </div>
              
              <div className={`flex items-center transition-all duration-300 ease-out ${isGotoOpen ? 'w-[84px] opacity-100 ml-1' : 'w-0 opacity-0 overflow-hidden'}`}>
                <form onSubmit={handleGotoSubmit} className="flex items-center w-full">
                  <input 
                    type="number" 
                    min="1" 
                    max={bulkQuestions.length}
                    ref={gotoInputRef}
                    value={gotoValue}
                    onChange={(e) => setGotoValue(e.target.value)}
                    className="w-[48px] px-1 py-0.5 text-sm font-bold text-slate-800 rounded-l outline-none bg-white"
                    placeholder="Q#"
                  />
                  <button type="submit" className="px-2 py-0.5 bg-emerald-600 text-white text-sm font-bold rounded-r shadow hover:bg-emerald-700 transition-colors">
                    Go
                  </button>
                </form>
              </div>
              
              {!isGotoOpen && (
                <button 
                  type="button"
                  onClick={() => setIsGotoOpen(true)}
                  className="px-2 py-0.5 bg-white text-teal-700 rounded text-xs font-black shadow-sm hover:bg-teal-50 transition-colors uppercase tracking-wider shrink-0"
                >
                  Goto
                </button>
              )}
              {isGotoOpen && (
                <button onClick={() => setIsGotoOpen(false)} className="text-teal-100 hover:text-white shrink-0 font-bold ml-1" type="button">✕</button>
              )}
            </div>

            {imageCount > 0 && (
              <div className="bg-black/20 px-3 py-1 rounded-lg shadow-inner flex items-center justify-between gap-3 overflow-hidden transition-all duration-300">
                {currentImageDisplay === "-" ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/50 font-medium text-sm italic">No Image Attached</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-teal-50 font-medium text-sm">Image</span>
                    <span className="font-bold text-base text-white leading-none">{currentImageDisplay}</span>
                    <span className="text-teal-50 font-medium text-sm">of</span>
                    <span className="font-bold text-base text-white leading-none">{imageCount}</span>
                  </div>
                )}
                
                <div className={`flex items-center transition-all duration-300 ease-out ${isImgGotoOpen ? 'w-[84px] opacity-100 ml-1' : 'w-0 opacity-0 overflow-hidden'}`}>
                  <form onSubmit={handleImgGotoSubmit} className="flex items-center w-full">
                    <input 
                      type="number" 
                      min="1" 
                      max={imageCount}
                      ref={imgGotoInputRef}
                      value={imgGotoValue}
                      onChange={(e) => setImgGotoValue(e.target.value)}
                      className="w-[48px] px-1 py-0.5 text-sm font-bold text-slate-800 rounded-l outline-none bg-white"
                      placeholder="Img"
                    />
                    <button type="submit" className="px-2 py-0.5 bg-emerald-600 text-white text-sm font-bold rounded-r shadow hover:bg-emerald-700 transition-colors">
                      Go
                    </button>
                  </form>
                </div>
                
                {!isImgGotoOpen && (
                  <button 
                    type="button"
                    onClick={() => setIsImgGotoOpen(true)}
                    className="px-2 py-0.5 bg-white text-teal-700 rounded text-xs font-black shadow-sm hover:bg-teal-50 transition-colors uppercase tracking-wider shrink-0"
                  >
                    Goto
                  </button>
                )}
                {isImgGotoOpen && (
                  <button onClick={() => setIsImgGotoOpen(false)} className="text-teal-100 hover:text-white shrink-0 font-bold ml-1" type="button">✕</button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-evenly">
            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
            >
              <ArrowLeftIcon size={15} /> Previous
            </button>

            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.min(bulkQuestions.length - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === bulkQuestions.length - 1}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
            >
              Next <ArrowRight size={15} />
            </button>

            <button 
              type="button" 
              onClick={addBulkQuestion}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
              title="Add New Question"
            >
              <Plus size={15} /> Add New
            </button>
            
            <button 
              type="button" 
              onClick={deleteBulkQuestion}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
              title="Delete Current Question"
            >
              <Trash2 size={15} /> Delete
            </button>

            <button
              type="button"
              onClick={() => setIsListView(!isListView)}
              className={`px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>

            <button 
              type="button"
              onClick={handlePreview}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
              title="Preview all questions in a new tab"
            >
              <Eye size={15} /> Preview
            </button>

            <button 
              type="button"
              onClick={downloadHTML}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
            >
              <Download size={15} /> HTML
            </button>

            <button 
              type="button"
              onClick={handleDownloadJson}
              className="px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
            >
              <Download size={15} /> JSON
            </button>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0 ml-auto">
            <button 
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to clear all QUESTIONS? This will wipe the entire editor.")) {
                  setBulkQuestions([{
                    id: Math.random().toString(),
                    bodyHtml: '',
                    options: [
                      { label: 'A', body_html: '' },
                      { label: 'B', body_html: '' },
                      { label: 'C', body_html: '' },
                      { label: 'D', body_html: '' },
                    ],
                    correctOptionLabel: 'A',
                    solutionText: '',
                    year: '',
                    source: ''
                  }]);
                  setCurrentQuestionIndex(0);
                }
              }}
              className="px-3 py-1 bg-black/20 hover:bg-red-500/40 text-white rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm"
              title="Reset entire editor"
            >
              <Trash2 size={15} /> Clear Questions
            </button>

            <button 
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to clear all IMAGES? Your text will be kept.")) {
                  setBulkQuestions(qs => qs.map(q => ({
                    ...q,
                    originalImageUrl: ''
                  })));
                }
              }}
              className="px-3 py-1 bg-black/20 hover:bg-orange-500/40 text-white rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm"
              title="Remove all cropped images"
            >
              <Trash2 size={15} /> Clear Images
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <>
          {isListView ? (
            <div className="mt-6 space-y-6 px-4">
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
            <QuestionEditorBlock 
              question={currentQ} 
              index={currentQuestionIndex} 
              updateBulkQuestion={updateBulkQuestion} 
              updateBulkQuestionOption={updateBulkQuestionOption} 
              handleEnterKey={handleEnterKey} 
            />
          )}
        </>
      </div>
    </div>
  );
}
