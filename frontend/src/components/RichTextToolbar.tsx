import React, { useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Type, Superscript, Subscript, Sigma, Upload, Undo, Redo, Divide, X, Delete } from 'lucide-react';

interface ToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (val: string) => void;
  showImageUpload?: boolean;
  imageFile?: File | null;
  setImageFile?: (file: File | null) => void;
  imagePosition?: string;
  setImagePosition?: (pos: string) => void;
  uploadId?: string;
}

const ActionButton = ({ onClick, children, title, className = "" }: { onClick: () => void, children: React.ReactNode, title: string, className?: string }) => {
  const [active, setActive] = useState(false);
  const handleClick = () => {
    onClick();
    setActive(true);
    setTimeout(() => setActive(false), 250);
  };
  
  return (
    <button 
      type="button" 
      onClick={handleClick} 
      className={`p-1.5 rounded transition-all duration-200 font-bold text-xs flex items-center gap-1 ${className} ${active ? 'bg-indigo-500 !text-white scale-110 shadow-sm' : 'hover:scale-105'}`} 
      title={title}
    >
      {children}
    </button>
  );
};

export const RichTextToolbar = ({ textareaRef, value, onChange, showImageUpload = false, imageFile, setImageFile, imagePosition, setImagePosition, uploadId = 'file-upload' }: ToolbarProps) => {
  const insertTag = (startTag: string, endTag: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + startTag + selectedText + endTag + value.substring(end);
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + startTag.length, start + startTag.length + selectedText.length);
    }, 0);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100/50 border-b border-slate-200">
      <ActionButton onClick={() => { textareaRef.current?.focus(); document.execCommand('undo'); }} title="Undo" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Undo size={16}/></ActionButton>
      <ActionButton onClick={() => { textareaRef.current?.focus(); document.execCommand('redo'); }} title="Redo" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Redo size={16}/></ActionButton>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('<b>', '</b>')} title="Bold" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Bold size={16}/></ActionButton>
      <ActionButton onClick={() => insertTag('<i>', '</i>')} title="Italic" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Italic size={16}/></ActionButton>
      <ActionButton onClick={() => insertTag('<u>', '</u>')} title="Underline" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Underline size={16}/></ActionButton>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('<h3>', '</h3>')} title="Heading" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Type size={16}/></ActionButton>
      <ActionButton onClick={() => insertTag('<ul>\n  <li>', '</li>\n</ul>')} title="Bullet List" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><List size={16}/></ActionButton>
      <ActionButton onClick={() => insertTag('<ol>\n  <li>', '</li>\n</ol>')} title="Numbered List" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><ListOrdered size={16}/></ActionButton>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('<sup>', '</sup>')} title="Superscript" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Superscript size={16}/></ActionButton>
      <ActionButton onClick={() => insertTag('<sub>', '</sub>')} title="Subscript" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"><Subscript size={16}/></ActionButton>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('\\(', '\\)')} title="Inline Math \\( ... \\)" className="text-emerald-600 hover:bg-emerald-50"><Sigma size={14}/> Inline</ActionButton>
      <ActionButton onClick={() => insertTag('$', '$')} title="Block Math" className="text-emerald-600 hover:bg-emerald-50"><Sigma size={14}/> Block</ActionButton>
      <ActionButton onClick={() => insertTag('$', '')} title="Single Dollar" className="text-emerald-600 hover:bg-emerald-50">$</ActionButton>
      <ActionButton onClick={() => insertTag('\\(', '')} title="Open Parenthesis" className="text-emerald-600 hover:bg-emerald-50">\(</ActionButton>
      <ActionButton onClick={() => insertTag('\\)', '')} title="Close Parenthesis" className="text-emerald-600 hover:bg-emerald-50">\)</ActionButton>
      
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('\\frac{', '}{}')} title="Fraction" className="text-emerald-600 hover:bg-emerald-50">a/b</ActionButton>
      <ActionButton onClick={() => insertTag('^{2}', '')} title="Squared" className="text-emerald-600 hover:bg-emerald-50">x²</ActionButton>
      <ActionButton onClick={() => insertTag('^{\\text{th}}', '')} title="th (superscript)" className="text-emerald-600 hover:bg-emerald-50">th</ActionButton>
      <ActionButton onClick={() => insertTag('\\sqrt{', '}')} title="Square Root" className="text-emerald-600 hover:bg-emerald-50">√x</ActionButton>
      
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('\\div ', '')} title="Divide" className="text-emerald-600 hover:bg-emerald-50"><Divide size={14}/></ActionButton>
      <ActionButton onClick={() => insertTag('\\times ', '')} title="Multiply" className="text-emerald-600 hover:bg-emerald-50"><X size={14}/></ActionButton>
      <ActionButton onClick={() => insertTag('\\pm ', '')} title="Plus Minus" className="text-emerald-600 hover:bg-emerald-50">±</ActionButton>
      <ActionButton onClick={() => insertTag('\\infty ', '')} title="Infinity" className="text-emerald-600 hover:bg-emerald-50">∞</ActionButton>
      <ActionButton onClick={() => insertTag('\\approx ', '')} title="Approximately" className="text-emerald-600 hover:bg-emerald-50">≈</ActionButton>
      <ActionButton onClick={() => insertTag('\\pi ', '')} title="Pi" className="text-emerald-600 hover:bg-emerald-50">π</ActionButton>
      <ActionButton onClick={() => insertTag('\\theta ', '')} title="Theta" className="text-emerald-600 hover:bg-emerald-50">θ</ActionButton>
      
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('\\%', '')} title="Percent" className="text-emerald-600 hover:bg-emerald-50">\%</ActionButton>
      <ActionButton onClick={() => insertTag('₹', '')} title="Rupee" className="text-emerald-600 hover:bg-emerald-50">₹</ActionButton>
      <ActionButton onClick={() => insertTag('©', '')} title="Copyright" className="text-emerald-600 hover:bg-emerald-50">©</ActionButton>
      <ActionButton onClick={() => insertTag('@', '')} title="At Symbol" className="text-emerald-600 hover:bg-emerald-50">@</ActionButton>
      
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('\\( \\mathrm{C}_{2} \\)', '')} title="C2 Formula" className="text-emerald-600 hover:bg-emerald-50">C₂</ActionButton>
      <ActionButton onClick={() => insertTag('\\( \\mathrm{C}_{2} \\mathrm{H}_{4} \\)', '')} title="C2H4 Formula" className="text-emerald-600 hover:bg-emerald-50">C₂H₄</ActionButton>
      <ActionButton onClick={() => insertTag('\\( \\mathrm{C}_{2} \\mathrm{H}_{4} \\mathrm{O}_{6} \\)', '')} title="C2H4O6 Formula" className="text-emerald-600 hover:bg-emerald-50">C₂H₄O₆</ActionButton>
      
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <ActionButton onClick={() => insertTag('<br/>\n', '')} title="Line Break" className="text-slate-600 hover:bg-slate-200">↵ Br</ActionButton>
      <ActionButton onClick={() => { textareaRef.current?.focus(); document.execCommand('delete'); }} title="Backspace/Delete" className="text-red-500 hover:bg-red-50 hover:text-red-700"><Delete size={14}/> Bksp</ActionButton>
      
      {showImageUpload && setImageFile && setImagePosition && (
        <div className="flex items-center gap-2 ml-auto">
          {imageFile && (
            <select 
              className="text-xs border-slate-300 rounded shadow-sm text-slate-700 py-1.5 pl-2 pr-6 bg-white focus:ring-indigo-500"
              value={imagePosition}
              onChange={(e) => setImagePosition(e.target.value)}
            >
              <option value="bottom">Img Bottom</option>
              <option value="top">Img Top</option>
              <option value="left">Img Left</option>
              <option value="right">Img Right</option>
            </select>
          )}
          <input 
            type="file" 
            accept="image/*,.pdf" 
            className="hidden" 
            id={uploadId}
            onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
          />
          <label htmlFor={uploadId} className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <Upload size={14} className={imageFile ? 'text-emerald-500' : 'text-slate-400'} />
            {imageFile ? 'Change Image' : 'Attach Image'}
          </label>
          {imageFile && (
            <div className="text-xs bg-slate-100 text-slate-600 px-2 py-1.5 rounded border border-slate-200 truncate max-w-[120px]" title={imageFile.name}>
              {imageFile.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
