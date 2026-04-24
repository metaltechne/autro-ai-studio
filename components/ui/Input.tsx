
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`w-full px-4 h-11 border border-slate-200 bg-slate-50/30 rounded-xl shadow-sm focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 focus:bg-white transition-all duration-200 text-sm text-slate-900 placeholder:text-slate-400 ${className}`}
        {...props}
      />
    </div>
  );
});
Input.displayName = "Input";
