
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-xl font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 select-none';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-5 py-2.5 text-xs',
    lg: 'px-8 py-4 text-sm',
    icon: 'p-2.5'
  };

  const variantClasses = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm border border-slate-800',
    secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-700',
    danger: 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
  };

  return (
    <button ref={ref} className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
});
Button.displayName = "Button";
