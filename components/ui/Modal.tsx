import React from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl'; // Kept for compatibility but is now overridden by the new full-screen style.
}

/**
 * A generic modal dialog component.
 * Renders as a large, solid panel that fills the entire screen using a portal, providing an immersive, page-like experience.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size }) => {
  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full h-full flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
          <h3 id="modal-title" className="text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200" 
            aria-label="Fechar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
  
  return ReactDOM.createPortal(modalContent, document.body);
};
