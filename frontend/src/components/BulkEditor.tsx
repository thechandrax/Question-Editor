"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, Eye, Download, Upload } from 'lucide-react';
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
}

export default function BulkEditor() {
  // Removed metadata state variables
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [autoSaveEnabled] = useState(true);

  const [isGotoOpen, setIsGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const solutionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const gotoInputRef = useRef<HTMLInputElement>(null);

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
    if (!autoSaveEnabled) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`bulkQuestions`, JSON.stringify(bulkQuestions));
    }, 5000);
    return () => clearTimeout(timer);
  }, [bulkQuestions, autoSaveEnabled]);

  const handleDownloadJson = () => {
    if (!bulkQuestions[0].bodyHtml) {
      alert("At least one question is required.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bulkQuestions, null, 2));
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

  const updateBulkQuestion = (field: keyof BulkEditorQuestion, value: BulkEditorQuestion[keyof BulkEditorQuestion]) => {
    const newQuestions = [...bulkQuestions];
    newQuestions[currentQuestionIndex] = { ...newQuestions[currentQuestionIndex], [field]: value };
    setBulkQuestions(newQuestions);
  };

  const updateBulkQuestionOption = (optionIndex: number, value: string) => {
    const newQuestions = [...bulkQuestions];
    newQuestions[currentQuestionIndex].options[optionIndex].body_html = value;
    setBulkQuestions(newQuestions);
  };

  const handleGotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = parseInt(gotoValue) - 1;
    if (idx >= 0 && idx < bulkQuestions.length) {
      setCurrentQuestionIndex(idx);
      setIsGotoOpen(false);
      setGotoValue("");
    } else {
      alert("Invalid question number");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
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
          setBulkQuestions(mappedQuestions);
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
      setIsImporting(false);
      e.target.value = ''; // Reset input
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
      htmlContent += `      <div class="Q">${q.bodyHtml}</div>\n`;
      htmlContent += `      <div class="Y">${q.year || ''}</div>\n`;
      
      const letterMap = ['A', 'B', 'C', 'D', 'E'];
      q.options.forEach((opt, index) => {
         const letter = letterMap[index] || 'A';
         htmlContent += `      <div class="${letter}">${opt.body_html}</div>\n`;
      });
      
      htmlContent += `      <div class="Answer">${q.correctOptionLabel || ''}</div>\n`;
      htmlContent += '    </div>\n';
      htmlContent += `    <div class="roughEdits">${q.bodyHtml}</div>\n`;
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
      return <span key={index} dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br/>') }} />;
    });
  };

  const currentQ = bulkQuestions[currentQuestionIndex];

  return (
    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-6 mb-10 mt-6 print:hidden">
        <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 drop-shadow-lg transform transition-transform hover:scale-105 duration-500">
          Question Editor
        </h1>

        <div className="flex items-center gap-2 animate-bounce-slow">
          <div className="flex bg-white p-2 rounded-2xl border-2 border-emerald-200/60 shadow-xl relative h-14 items-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              accept=".md,.txt" 
              onChange={handleFileUpload}
              disabled={isImporting}
              title="Upload Markdown File"
            />
            <button 
              type="button"
              className="px-6 py-2 text-lg transition-all duration-300 flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-md hover:shadow-lg z-0 relative h-full rounded-xl"
            >
              {isImporting ? 'Importing...' : <><Upload size={22} /> Import Your File</>}
            </button>
          </div>
        </div>
      </div>

      {/* Editor Card */}
      <div className="shadow-2xl rounded-2xl bg-white border border-slate-200/60 overflow-hidden print:shadow-none print:border-none">
        {/* Top Navbar Editor */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-4 flex items-center justify-between print:hidden">
        
        {/* Left Side Group */}
        <div className="flex items-center gap-4">
          
          {/* Question Indicator & Goto */}
          <div className="bg-black/20 px-4 py-2 rounded-lg shadow-inner flex items-center gap-2 overflow-hidden transition-all duration-300">
            <span className="text-teal-50 font-medium">Question</span>
            <span className="font-bold text-lg text-white">{currentQuestionIndex + 1}</span>
            <span className="text-teal-50 font-medium">of</span>
            <span className="font-bold text-lg">{bulkQuestions.length}</span>
            
            <div className={`flex items-center transition-all duration-300 ease-out ${isGotoOpen ? 'w-[88px] opacity-100 ml-2' : 'w-0 opacity-0 overflow-hidden'}`}>
              <form onSubmit={handleGotoSubmit} className="flex items-center w-full">
                <input 
                  type="number" 
                  min="1" 
                  max={bulkQuestions.length}
                  ref={gotoInputRef}
                  value={gotoValue}
                  onChange={(e) => setGotoValue(e.target.value)}
                  className="w-[52px] px-1.5 py-1 text-sm font-bold text-slate-800 rounded-l outline-none bg-white"
                  placeholder="No."
                />
                <button type="submit" className="px-2 py-1 bg-emerald-600 text-white text-sm font-bold rounded-r shadow hover:bg-emerald-700 transition-colors">
                  Go
                </button>
              </form>
            </div>
            
            {!isGotoOpen && (
              <button 
                type="button"
                onClick={() => setIsGotoOpen(true)}
                className="ml-2 px-2 py-1 bg-white text-teal-700 rounded text-xs font-black shadow-sm hover:bg-teal-50 transition-colors uppercase tracking-wider shrink-0"
              >
                Goto
              </button>
            )}

            {isGotoOpen && (
              <button onClick={() => setIsGotoOpen(false)} className="text-teal-100 hover:text-white ml-1 shrink-0 font-bold" type="button">✕</button>
            )}
          </div>

          {/* Prev / Next */}
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 bg-black/20 hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-bold"
            >
              <ArrowLeftIcon size={18} /> Previous
            </button>
            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.min(bulkQuestions.length - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === bulkQuestions.length - 1}
              className="px-4 py-2 bg-black/20 hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-bold"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>

          {/* Preview Mode Toggle */}
          <button 
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg transition-colors flex items-center gap-2 font-bold"
            title="Toggle Preview Mode"
          >
            <Eye size={18} className={isPreviewMode ? 'text-teal-200' : 'text-white'} /> Preview
          </button>

          {/* Add New */}
          <button 
            type="button" 
            onClick={addBulkQuestion}
            className="px-4 py-2 bg-white text-teal-700 hover:bg-teal-50 rounded-lg transition-colors shadow-sm flex items-center gap-2 font-bold text-sm"
            title="Add New Question"
          >
            <Plus size={18} /> Add New
          </button>
          
          {/* Delete */}
          <button 
            type="button" 
            onClick={deleteBulkQuestion}
            className="px-4 py-2 bg-white text-red-500 hover:bg-red-50 rounded-lg transition-colors shadow-sm flex items-center gap-2 font-bold text-sm"
            title="Delete Current Question"
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to clear all questions? This cannot be undone.")) {
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
            className="px-4 py-2 bg-white hover:bg-red-50 text-red-500 rounded-lg font-black flex items-center gap-2 transition-colors shadow-sm border border-red-100"
          >
            <Trash2 size={18} /> Clear
          </button>

          <button 
            type="button"
            onClick={downloadHTML}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-black flex items-center gap-2 transition-colors shadow-md border-2 border-teal-800"
          >
            <Download size={18} /> HTML
          </button>

          <button 
            type="button"
            onClick={handleDownloadJson}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-emerald-600 rounded-lg font-black flex items-center gap-2 transition-colors shadow-md border-2 border-emerald-500"
          >
            <Download size={18} /> JSON
          </button>
        </div>
      </div>

      {/* Editor Body or Preview */}
      {isPreviewMode ? (
        <div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl p-8 space-y-8 print:border-none print:shadow-none print:p-0">
          <div className="flex items-center justify-between border-b pb-4 print:hidden">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Eye className="text-emerald-500" />
              Preview All Questions ({bulkQuestions.length})
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={downloadHTML}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md"
              >
                <Download size={18} /> Download HTML
              </button>
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md"
              >
                <Download size={18} /> Save as PDF
              </button>
            </div>
          </div>
          <div ref={previewRef} className="space-y-8">
            {bulkQuestions.map((q, i) => (
              <div key={q.id} className="p-6 rounded-xl border border-slate-200 shadow-sm bg-slate-50/50 print:break-inside-avoid print:bg-white print:border-slate-300 print:shadow-none print:m-0 print:p-4">
                <div className="flex gap-4 mb-4">
                <div className="w-10 h-10 shrink-0 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-black shadow-sm border border-emerald-200">
                  {i + 1}
                </div>
                <div className="flex-1 text-lg font-medium text-slate-800 prose prose-slate max-w-none">
                  {renderLatex(q.bodyHtml || '<span class="text-slate-400 italic">Empty Question</span>')}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14 mb-4">
                {q.options.map(opt => (
                  <div key={opt.label} className={`p-4 rounded-xl border-2 ${
                    q.correctOptionLabel === opt.label 
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' 
                      : 'border-slate-200 bg-white'
                  }`}>
                    <div className="flex gap-3">
                      <div className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center font-bold text-sm ${
                        q.correctOptionLabel === opt.label 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {opt.label}
                      </div>
                      <div className="prose prose-sm max-w-none text-slate-700">
                        {renderLatex(opt.body_html || '<span class="text-slate-400 italic">Empty Option</span>')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {q.solutionText && (
                <div className="ml-14 mt-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200 shadow-inner">
                  <h4 className="text-amber-700 font-bold text-sm uppercase tracking-wider mb-2">Solution / Explanation</h4>
                  <div className="prose prose-sm max-w-none text-slate-700">
                    {renderLatex(q.solutionText)}
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      ) : (
      <div className="bg-white border-x border-b border-slate-200/60 rounded-b-2xl shadow-xl p-8">
        
        {/* Question Area */}
        <div className="mb-8 relative">
          <div className="absolute top-0 right-0 -mt-3 -mr-3">
            <input 
              type="text" 
              placeholder="Year (Optional)" 
              value={currentQ.year}
              onChange={(e) => updateBulkQuestion('year', e.target.value)}
              className="w-32 px-3 py-1.5 text-sm font-medium border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-right bg-white shadow-sm"
            />
          </div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Question Text</h3>
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 bg-slate-50/50">
            <RichTextToolbar 
              textareaRef={questionTextareaRef} 
              value={currentQ.bodyHtml} 
              onChange={(val: string) => updateBulkQuestion('bodyHtml', val)}
            />
            <textarea 
              ref={questionTextareaRef}
              spellCheck="true"
              className="w-full min-h-[40px] px-4 py-3 text-base outline-none resize-y bg-transparent"
              placeholder="Question goes here..."
              value={currentQ.bodyHtml}
              onChange={(e) => updateBulkQuestion('bodyHtml', e.target.value)}
            />
            {currentQ.bodyHtml && (
              <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 text-slate-800 prose prose-slate prose-p:m-0 max-w-none text-base font-medium">
                {renderLatex(currentQ.bodyHtml)}
              </div>
            )}
          </div>
        </div>

        {/* Options Grid — Adda247 style tick/cross */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {currentQ.options.map((opt, idx) => {
            const isCorrect = currentQ.correctOptionLabel === opt.label;
            return (
              <div
                key={idx}
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

                {/* Tick / Cross button — clicking sets correct answer */}
                <button
                  type="button"
                  title={isCorrect ? 'Correct Answer' : 'Click to set as correct answer'}
                  onClick={() => updateBulkQuestion('correctOptionLabel', opt.label)}
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
                  className="w-full min-h-[40px] py-3 pr-4 pl-10 outline-none resize-y bg-transparent rounded-t-xl text-sm"
                  placeholder={`Option ${opt.label}...`}
                  value={opt.body_html}
                  onChange={(e) => updateBulkQuestionOption(idx, e.target.value)}
                />
                {opt.body_html && (
                  <div className="py-3 pr-4 pl-10 bg-slate-100 border-t-2 border-slate-200/60 text-slate-800 prose prose-sm prose-p:m-0 max-w-none rounded-b-xl border-dashed">
                    {renderLatex(opt.body_html)}
                  </div>
                )}
              </div>
            );
          })}
        </div>



      </div>
      )}
      </div>

      {/* Explanation Separate Card */}
      {!isPreviewMode && (
        <div className="mt-8 shadow-2xl rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200/60 p-6 md:p-8 print:hidden">
          <h3 className="text-lg font-black text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-3">
            Explanation (Optional)
          </h3>
          <div className="border-2 border-amber-100 rounded-xl overflow-hidden focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/20 bg-white shadow-sm">
            <RichTextToolbar 
              textareaRef={solutionTextareaRef} 
              value={currentQ.solutionText} 
              onChange={(val: string) => updateBulkQuestion('solutionText', val)}
            />
            <textarea 
              ref={solutionTextareaRef}
              spellCheck="true"
              className="w-full min-h-[40px] px-4 py-3 text-sm outline-none resize-y bg-transparent"
              placeholder="Provide a detailed explanation here if needed..."
              value={currentQ.solutionText}
              onChange={(e) => updateBulkQuestion('solutionText', e.target.value)}
            />
            {currentQ.solutionText && (
              <div className="px-4 py-3 bg-slate-100 border-t-2 border-amber-200/50 text-slate-800 prose prose-sm prose-p:m-0 max-w-none border-dashed rounded-b-xl">
                {renderLatex(currentQ.solutionText)}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
