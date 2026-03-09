
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'flat';
}

export const Card: React.FC<CardProps> = ({ children, className = '', variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-white shadow-sm border border-slate-200/60',
    outline: 'bg-transparent border-2 border-slate-200',
    flat: 'bg-slate-50 border border-slate-100'
  };

  return (
    <div 
      className={`${variants[variant]} rounded-xl p-5 transition-all duration-200 hover:shadow-md ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};
