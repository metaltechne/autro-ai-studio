import React from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, children }) => {
  return (
    <Card className="flex flex-col items-center justify-center py-16 px-6 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
      <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 text-slate-400">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="mt-2 text-slate-500 max-w-xs mx-auto leading-relaxed">{message}</p>
      {children && <div className="mt-8 w-full max-w-xs">{children}</div>}
    </Card>
  );
};
