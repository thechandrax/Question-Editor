import React from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Type, Superscript, Subscript, Sigma, Upload } from 'lucide-react';

export const RichTextToolbar = ({ textareaRef, value, onChange, showImageUpload = false, imageFile, setImageFile, imagePosition, setImagePosition, uploadId = 'file-upload' }: any) => {
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
      <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Bold"><Bold size={16}/></button>
      <button type="button" onClick={() => insertTag('<i>', '</i>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Italic"><Italic size={16}/></button>
      <button type="button" onClick={() => insertTag('<u>', '</u>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Underline"><Underline size={16}/></button>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <button type="button" onClick={() => insertTag('<h3>', '</h3>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Heading"><Type size={16}/></button>
      <button type="button" onClick={() => insertTag('<ul>\n  <li>', '</li>\n</ul>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Bullet List"><List size={16}/></button>
      <button type="button" onClick={() => insertTag('<ol>\n  <li>', '</li>\n</ol>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Numbered List"><ListOrdered size={16}/></button>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <button type="button" onClick={() => insertTag('<sup>', '</sup>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Superscript"><Superscript size={16}/></button>
      <button type="button" onClick={() => insertTag('<sub>', '</sub>')} className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Subscript"><Subscript size={16}/></button>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <button type="button" onClick={() => insertTag('\\(', '\\)')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors font-bold text-xs flex items-center gap-1" title="Inline Math"><Sigma size={14}/> Inline</button>
      <button type="button" onClick={() => insertTag('$$', '$$')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors font-bold text-xs flex items-center gap-1" title="Block Math"><Sigma size={14}/> Block</button>
      <div className="w-px h-5 bg-slate-300 mx-1"></div>
      <button type="button" onClick={() => insertTag('<br/>\n', '')} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors font-bold text-xs" title="Line Break">↵ Br</button>
      
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
