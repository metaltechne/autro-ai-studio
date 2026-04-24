import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, id, className = '', ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.target.closest('[role="dialog"]')) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-black mb-1">{label}</label>}
      <textarea
        ref={ref}
        id={id}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-autro-blue focus:border-autro-blue sm:text-sm text-gray-900 ${className}`}
        onFocus={handleFocus}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = "Textarea";