with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

state_code = """
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
"""

text = text.replace('  const [isListView, setIsListView] = useState(false);', state_code + '\n  const [isListView, setIsListView] = useState(false);')

text = text.replace('alert("At least one question is required.");', 'showAlert("At least one question is required.");')
text = text.replace('const deleteBulkQuestion = () => {', 'const deleteBulkQuestion = async () => {')
text = text.replace('alert("You cannot delete the only question. Just clear its content instead.");', 'showAlert("You cannot delete the only question. Just clear its content instead.");')
text = text.replace('if (confirm("Are you sure you want to delete this question?")) {', 'if (await showConfirm("Are you sure you want to delete this question?")) {')

text = text.replace('alert("Invalid question number");', 'showAlert("Invalid question number");')
text = text.replace('alert(`Image ${val} not found.`);', 'showAlert(`Image ${val} not found.`);')

text = text.replace('alert(`Successfully imported ${mappedQuestions.length} questions!`);', 'showSuccess(`Successfully imported ${mappedQuestions.length} questions!`);')
text = text.replace('alert("No questions found in document.");', 'showAlert("No questions found in document.");')
text = text.replace('alert(`Error parsing document: ${data.message || data.error}`);', 'showAlert(`Error parsing document: ${data.message || data.error}`);')
text = text.replace('alert("Error uploading document.");', 'showAlert("Error uploading document.");')

text = text.replace('alert(`Successfully imported ${mappedQuestions.length} questions from PDF with cropped images!`);', 'showSuccess(`Successfully imported ${mappedQuestions.length} questions from PDF with cropped images!`);')
text = text.replace('alert("No questions found in PDF.");', 'showAlert("No questions found in PDF.");')
text = text.replace('alert(`Error parsing PDF: ${data.message || data.error}`);', 'showAlert(`Error parsing PDF: ${data.message || data.error}`);')
text = text.replace('alert("Error uploading PDF.");', 'showAlert("Error uploading PDF.");')

text = text.replace('alert("At least one question is required to preview.");', 'showAlert("At least one question is required to preview.");')

text = text.replace('onClick={() => {\n                if (confirm("Are you sure you want to clear all QUESTIONS? This will wipe the entire editor.")) {', 'onClick={async () => {\n                if (await showConfirm("Are you sure you want to clear all QUESTIONS? This will wipe the entire editor.")) {')
text = text.replace('onClick={() => {\n                if (confirm("Are you sure you want to clear all IMAGES? Your text will be kept.")) {', 'onClick={async () => {\n                if (await showConfirm("Are you sure you want to clear all IMAGES? Your text will be kept.")) {')

ui_code = """
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
"""

text = text.replace('    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">', '    <div className="w-full px-2 sm:px-4 md:px-6 pb-12 print:max-w-full print:pb-0 font-serif">\n' + ui_code)

with open('src/components/BulkEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
