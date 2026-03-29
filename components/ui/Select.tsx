
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, className = '', children, ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{label}</label>}
      <div className="relative">
        <select
          id={id}
          className={`w-full px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 bg-white rounded-xl shadow-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 text-xs sm:text-sm text-slate-900 appearance-none disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
          {...props}
        >
            {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
};
