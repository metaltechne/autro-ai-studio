
import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'error' | 'info' | 'warning';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'info', className = '' }) => {
    const variants = {
        success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        error: 'bg-rose-100 text-rose-700 border-rose-200',
        info: 'bg-sky-100 text-sky-700 border-sky-200',
        warning: 'bg-amber-100 text-amber-700 border-amber-200',
    };

    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
