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
      className="fixed inset-0 bg-gray-900/75 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
          <h3 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
  
  return ReactDOM.createPortal(modalContent, document.body);
};
