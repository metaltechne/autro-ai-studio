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
    <Card>
      <div className="text-center py-12 text-gray-500">
        {icon}
        <h3 className="mt-2 text-lg font-medium text-black">{title}</h3>
        <p className="mt-1 text-sm">{message}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </Card>
  );
};
