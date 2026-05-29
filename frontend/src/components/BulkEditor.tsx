"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, Eye, Download, Upload, List, Image as ImageIcon, Undo2, Redo2 } from 'lucide-react';
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
  isListView?: boolean;
}

function QuestionEditorBlock({ question, index, updateBulkQuestion, updateBulkQuestionOption, handleEnterKey, isListView }: QuestionEditorBlockProps) {
  const [showPreviews, setShowPreviews] = React.useState(true);
  const questionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const solutionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const currentQ = question;
  const idx = index;

  return (
    <div className="mb-12" id={`qeb-${index}`}>
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xl px-4 sm:px-6 pt-5 pb-6">
        <div className="mb-4 pb-2 border-b border-slate-100">
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

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider m-0">Question Text</h3>
            <button 
              onClick={() => setShowPreviews(!showPreviews)}
              className="px-3 py-1 text-xs font-bold rounded-lg transition-colors border border-slate-200 shadow-sm flex items-center gap-1.5 bg-white text-slate-600 hover:bg-slate-50 hover:text-emerald-600"
              title={showPreviews ? "Hide Previews (Preview Up)" : "Show Previews (Preview Down)"}
            >
              <Eye size={14} className={showPreviews ? "text-emerald-500" : "text-slate-400"} /> 
              {showPreviews ? 'Preview Up' : 'Preview Down'}
            </button>
          </div>
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 bg-slate-50/50">
            {!showPreviews && (
              <>
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
              </>
            )}
            {showPreviews && (
              <div className="px-4 py-3 bg-slate-50 text-slate-800 prose prose-slate prose-p:m-0 max-w-none text-base font-medium min-h-[60px]">
                {currentQ.bodyHtml ? renderLatex(currentQ.bodyHtml) : <span className="text-slate-400 italic">Empty Question</span>}
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
                <div className={`absolute -left-2 sm:-left-4 -top-3 sm:-top-4 w-9 h-9 sm:w-11 sm:h-11 text-lg sm:text-xl rounded-xl flex items-center justify-center font-black shadow-lg z-10 ${
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

                {!showPreviews && (
                  <textarea
                    spellCheck="true"
                    className="w-full min-h-[40px] py-3 pr-4 pl-10 sm:pl-12 outline-none resize-y bg-transparent rounded-xl text-sm"
                    placeholder={`Option ${opt.label}...`}
                    value={opt.body_html}
                    onChange={(e) => updateBulkQuestionOption(optIdx, e.target.value, idx)}
                    onKeyDown={(e) => handleEnterKey(e, (val) => updateBulkQuestionOption(optIdx, val, idx), opt.body_html)}
                  />
                )}
                {showPreviews && (
                  <div className="py-3 pr-4 pl-10 sm:pl-12 bg-slate-50 text-slate-800 prose prose-sm prose-p:m-0 max-w-none rounded-xl min-h-[40px] flex items-center">
                    {opt.body_html ? renderLatex(opt.body_html) : <span className="text-slate-400 italic">Empty Option</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {(!isListView || currentQ.solutionText) && (
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
        )}
      </div>
    </div>
  );
}

export default function BulkEditor() {

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'success';
    title?: string;
    message: string;
    resolve?: (value: boolean) => void;
  }>({ isOpen: false, type: 'alert', message: '' });

  const showAlert = (message: string, title = "Notice") => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ isOpen: true, type: 'alert', title, message, resolve });
    });
  };

  const showSuccess = (message: string, title = "Success") => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ isOpen: true, type: 'success', title, message, resolve });
    });
  };

  const showConfirm = (message: string, title = "Confirm Action") => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ isOpen: true, type: 'confirm', title, message, resolve });
    });
  };

  const [isListView, setIsListView] = useState(false);
  const [autoSaveEnabled] = useState(true);

  const [isGotoOpen, setIsGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [isImgGotoOpen, setIsImgGotoOpen] = useState(false);
  const [imgGotoValue, setImgGotoValue] = useState("");
  const [isImportingMd, setIsImportingMd] = useState(false);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
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

  const [undoStack, setUndoStack] = useState<BulkEditorQuestion[][]>([]);
  const [redoStack, setRedoStack] = useState<BulkEditorQuestion[][]>([]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, bulkQuestions]);
    setBulkQuestions(previousState);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, bulkQuestions]);
    setBulkQuestions(nextState);
    setRedoStack(prev => prev.slice(0, -1));
  };

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
      showAlert("At least one question is required.");
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

  const deleteBulkQuestion = async () => {
    setIsDeleteDialogOpen(false);
    if (bulkQuestions.length === 1) {
      showAlert("You cannot delete the only question. Just clear its content instead.");
      return;
    }
    if (await showConfirm("Are you sure you want to delete this question? Note: Images will NOT be deleted and will shift to stay aligned.")) {
      setUndoStack(prev => [...prev, bulkQuestions]);
      setRedoStack([]);
      
      const imagesBefore = bulkQuestions.map(q => q.originalImageUrl);
      const newQuestions = bulkQuestions.filter((_, i) => i !== currentQuestionIndex);
      
      let finalQuestions = [...newQuestions];
      let lastImageIndex = -1;
      for (let i = imagesBefore.length - 1; i >= 0; i--) {
        if (imagesBefore[i]) {
          lastImageIndex = i;
          break;
        }
      }
      
      while (finalQuestions.length <= lastImageIndex) {
        finalQuestions.push({
          id: Math.random().toString(),
          bodyHtml: '',
          options: [{label:'A',body_html:''},{label:'B',body_html:''},{label:'C',body_html:''},{label:'D',body_html:''}],
          correctOptionLabel: 'A',
          solutionText: '',
          year: '',
          source: ''
        });
      }

      finalQuestions = finalQuestions.map((q, i) => ({
        ...q,
        originalImageUrl: imagesBefore[i] || ''
      }));

      setBulkQuestions(finalQuestions);
      if (currentQuestionIndex >= finalQuestions.length) {
        setCurrentQuestionIndex(finalQuestions.length - 1);
      }
    }
  };

  const deleteCurrentImage = async () => {
    setIsDeleteDialogOpen(false);
    if (!bulkQuestions[currentQuestionIndex]?.originalImageUrl) {
      showAlert("There is no image on this question to delete.");
      return;
    }
    if (await showConfirm("Are you sure you want to delete this image? Note: Subsequent images will shift up to take its place.")) {
      setUndoStack(prev => [...prev, bulkQuestions]);
      setRedoStack([]);

      const imagesBefore = bulkQuestions.map(q => q.originalImageUrl);
      imagesBefore.splice(currentQuestionIndex, 1);
      imagesBefore.push('');
      
      const finalQuestions = bulkQuestions.map((q, i) => ({
        ...q,
        originalImageUrl: imagesBefore[i] || ''
      }));

      setBulkQuestions(finalQuestions);
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
      showAlert("Invalid question number");
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
      showAlert(`Image ${val} not found.`);
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
          showSuccess(`Successfully imported ${mappedQuestions.length} questions!`);
        } else {
          showAlert("No questions found in document.");
        }
      } else {
        showAlert(`Error parsing document: ${data.message || data.error}`);
      }
    } catch {
      showAlert("Error uploading document.");
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
      let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
      if (backendUrl.endsWith('/')) {
        backendUrl = backendUrl.slice(0, -1);
      }
      const res = await fetch(`${backendUrl}/api/parse-pdf`, {
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
          showSuccess(`Successfully imported ${mappedQuestions.length} questions from PDF with cropped images!`);
        } else {
          showAlert("No questions found in PDF.");
        }
      } else {
        showAlert(`Error parsing PDF: ${data.message || data.error}`);
      }
    } catch {
      showAlert("Error uploading PDF.");
    } finally {
      setIsImportingPdf(false);
      e.target.value = '';
    }
  };

  const downloadHTML = () => {
    if (!bulkQuestions[0].bodyHtml) {
      showAlert("At least one question is required.");
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
      showAlert("At least one question is required to preview.");
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
        <div class="question-card" id="q-${idx}">
          <div class="q-num">Question ${idx + 1}</div>
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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\\\(', right: '\\\\)', display: false}, {left: '\\\\[', right: '\\\\]', display: true}]});"></script>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --text-light: #64748b;
      --border: #e2e8f0;
      --success-bg: #ecfdf5;
      --success-border: #a7f3d0;
      --success-text: #065f46;
      --solution-bg: #fefce8;
      --solution-border: #fde68a;
      --solution-text: #854d0e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: Georgia, 'Times New Roman', serif;
      background: var(--bg); 
      color: var(--text);
      line-height: 1.6;
      padding: 0;
    }
    .header {
      width: 100%;
      background: #10b981; /* Emerald green accent */
      padding: 15px 40px;
      color: white;
      text-align: center;
      margin-bottom: 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header p {
      color: #d1fae5;
      font-size: 0.95rem;
    }
    .container {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .question-card { 
      background: var(--card-bg);
      margin-bottom: 40px; 
      padding: 40px;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .q-num { 
      font-size: 1rem; 
      font-weight: 700; 
      color: #047857;
      margin-bottom: 16px; 
    }
    .q-image { 
      max-width: 100%; 
      margin-bottom: 20px; 
      display: block;
      border: 1px solid var(--border);
      padding: 4px;
      border-radius: 4px;
    }
    .q-body { 
      font-size: 1.15rem; 
      line-height: 1.7; 
      margin-bottom: 24px;
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 20px;
      border-radius: 8px;
    }
    .options { 
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px 30px;
      margin-top: 20px;
      margin-bottom: 24px; 
    }
    @media (max-width: 768px) {
      .options { grid-template-columns: 1fr; gap: 24px; }
    }
    .option { 
      position: relative;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      font-size: 1.1rem;
    }
    .option.correct { 
      background: var(--success-bg); 
      border-color: var(--success-border); 
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
    }
    .opt-label { 
      position: absolute;
      top: -14px;
      left: -14px;
      background: #334155;
      color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .option.correct .opt-label {
      background: #10b981;
    }
    .solution { 
      margin-top: 24px; 
      padding: 20px; 
      background: var(--solution-bg); 
      border-left: 4px solid #f59e0b;
      font-size: 1rem; 
      color: var(--solution-text);
    }
    .solution strong {
      display: block;
      margin-bottom: 8px;
      color: #92400e;
    }
    .year { 
      margin-top: 16px; 
      font-size: 0.9rem; 
      color: var(--text-light); 
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Question Preview</h1>
    <p>Showing ${bulkQuestions.length} Questions</p>
  </div>
  <div class="container">
    ${questionsHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    window.open(url + `#q-${currentQuestionIndex}`, '_blank');
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

      {/* Custom Dialog */}
      <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
          dialogState.isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => { if(dialogState.type !== 'confirm') { dialogState.resolve?.(true); setDialogState(s => ({...s, isOpen: false})); } }}
        ></div>
        
        {/* Modal Card */}
        <div 
          className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 ${
            dialogState.isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
        >
          <div className={`p-6 md:p-8 ${dialogState.type === 'success' ? 'bg-emerald-50/50' : dialogState.type === 'confirm' ? 'bg-amber-50/50' : 'bg-slate-50/50'}`}>
            <div className="flex items-start gap-4">
              {dialogState.type === 'success' && (
                <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-2xl shadow-inner">✓</div>
              )}
              {dialogState.type === 'alert' && (
                <div className="w-12 h-12 shrink-0 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-black text-2xl shadow-inner">i</div>
              )}
              {dialogState.type === 'confirm' && (
                <div className="w-12 h-12 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-2xl shadow-inner">?</div>
              )}
              
              <div>
                <h3 className={`text-xl font-black mb-2 ${dialogState.type === 'success' ? 'text-emerald-800' : dialogState.type === 'confirm' ? 'text-amber-800' : 'text-slate-800'}`}>
                  {dialogState.title}
                </h3>
                <p className="text-slate-600 font-medium leading-relaxed text-[15px]">
                  {dialogState.message}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-6 bg-white flex justify-end gap-3 border-t border-slate-100/60">
            {dialogState.type === 'confirm' && (
              <button 
                onClick={() => { dialogState.resolve?.(false); setDialogState(s => ({...s, isOpen: false})); }}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={() => { dialogState.resolve?.(true); setDialogState(s => ({...s, isOpen: false})); }}
              className={`px-8 py-2.5 text-white font-black rounded-xl shadow-md transition-all active:scale-95 ${
                dialogState.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200' :
                dialogState.type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700 hover:shadow-amber-200' :
                'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {dialogState.type === 'confirm' ? 'Confirm' : 'OK'}
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-1 print:hidden relative px-5 py-2.5 rounded-b-xl border-b border-x border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/90 backdrop-blur-xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/50 via-transparent to-indigo-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <h1 className="relative text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-[length:200%_auto] transform transition-transform duration-500 hover:scale-[1.02]">
          Question Editor
        </h1>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-start gap-3 relative">
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
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-3 md:py-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 print:hidden">
          
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 justify-between">
            
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
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsGotoOpen(true)}
                    className="px-2 py-0.5 bg-white text-teal-700 rounded text-xs font-black shadow-sm hover:bg-teal-50 transition-colors uppercase tracking-wider"
                  >
                    Goto
                  </button>
                  {undoStack.length > 0 && (
                    <button type="button" onClick={handleUndo} title="Undo Deletion" className="px-1.5 py-0.5 bg-white text-teal-700 rounded shadow-sm hover:bg-teal-50 transition-colors">
                      <Undo2 size={14} />
                    </button>
                  )}
                  {redoStack.length > 0 && (
                    <button type="button" onClick={handleRedo} title="Redo Deletion" className="px-1.5 py-0.5 bg-white text-teal-700 rounded shadow-sm hover:bg-teal-50 transition-colors">
                      <Redo2 size={14} />
                    </button>
                  )}
                </div>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsImgGotoOpen(true)}
                      className="px-2 py-0.5 bg-white text-teal-700 rounded text-xs font-black shadow-sm hover:bg-teal-50 transition-colors uppercase tracking-wider"
                    >
                      Goto
                    </button>
                    {undoStack.length > 0 && (
                      <button type="button" onClick={handleUndo} title="Undo Deletion" className="px-1.5 py-0.5 bg-white text-teal-700 rounded shadow-sm hover:bg-teal-50 transition-colors">
                        <Undo2 size={14} />
                      </button>
                    )}
                    {redoStack.length > 0 && (
                      <button type="button" onClick={handleRedo} title="Redo Deletion" className="px-1.5 py-0.5 bg-white text-teal-700 rounded shadow-sm hover:bg-teal-50 transition-colors">
                        <Redo2 size={14} />
                      </button>
                    )}
                  </div>
                )}
                {isImgGotoOpen && (
                  <button onClick={() => setIsImgGotoOpen(false)} className="text-teal-100 hover:text-white shrink-0 font-bold ml-1" type="button">✕</button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center flex-wrap gap-2">
            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
            >
              <ArrowLeftIcon size={15} /> Previous
            </button>

            <button 
              type="button"
              onClick={() => setCurrentQuestionIndex(Math.min(bulkQuestions.length - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === bulkQuestions.length - 1}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
            >
              Next <ArrowRight size={15} />
            </button>

            <button 
              type="button" 
              onClick={addBulkQuestion}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
              title="Add New Question"
            >
              <Plus size={15} /> Add New
            </button>
            
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setIsDeleteDialogOpen(true)}
              onMouseLeave={() => setIsDeleteDialogOpen(false)}
            >
              <button 
                type="button" 
                onClick={() => setIsDeleteDialogOpen(!isDeleteDialogOpen)}
                className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
                title="Delete Options"
              >
                <Trash2 size={15} /> Delete
              </button>
              
              {isDeleteDialogOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 p-1.5 flex flex-col z-[60] min-w-[120px] animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    type="button"
                    onClick={() => { deleteBulkQuestion(); }}
                    className="text-left px-3 py-2.5 text-sm text-red-600 font-bold hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 size={15}/> Question
                  </button>
                  <button 
                    type="button"
                    onClick={() => { deleteCurrentImage(); }}
                    disabled={!bulkQuestions[currentQuestionIndex]?.originalImageUrl}
                    className="text-left px-3 py-2.5 text-sm text-orange-600 font-bold hover:bg-orange-50 hover:text-orange-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg flex items-center gap-2.5 transition-colors mt-0.5"
                  >
                    <ImageIcon size={15}/> Image
                  </button>
                </div>
              )}
            </div>

            <button
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
              className={`whitespace-nowrap shrink-0 px-3 py-1 rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm ${isListView ? 'bg-emerald-500/40 text-emerald-900' : 'bg-black/20 hover:bg-black/30 text-white'}`}
              title="Toggle List View"
            >
              <List size={15} /> {isListView ? 'View as Editor' : 'View as List'}
            </button>

            <button 
              type="button"
              onClick={handlePreview}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm text-white"
              title="Preview all questions in a new tab"
            >
              <Eye size={15} /> Preview
            </button>

            <button 
              type="button"
              onClick={downloadHTML}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
            >
              <Download size={15} /> HTML
            </button>

            <button 
              type="button"
              onClick={handleDownloadJson}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-black/40 text-white rounded-lg shadow-inner transition-all flex items-center gap-1.5 font-bold text-sm"
            >
              <Download size={15} /> JSON
            </button>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 md:ml-auto justify-center">
            <button 
              type="button"
              onClick={async () => {
                if (await showConfirm("Are you sure you want to clear all QUESTIONS? This will wipe the entire editor.")) {
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
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-red-500/40 text-white rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm"
              title="Reset entire editor"
            >
              <Trash2 size={15} /> Clear Questions
            </button>

            <button 
              type="button"
              onClick={async () => {
                if (await showConfirm("Are you sure you want to clear all IMAGES? Your text will be kept.")) {
                  setBulkQuestions(qs => qs.map(q => ({
                    ...q,
                    originalImageUrl: ''
                  })));
                }
              }}
              className="whitespace-nowrap shrink-0 px-3 py-1 bg-black/20 hover:bg-orange-500/40 text-white rounded-lg shadow-inner transition-all flex items-center justify-center gap-1.5 font-bold text-sm"
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
                  isListView={isListView}
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
