import React from 'react';

interface DashboardCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: 'blue' | 'green' | 'yellow' | 'purple';
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, description, icon, onClick, color = 'blue' }) => {
    const colorClasses = {
        blue: 'bg-white text-slate-900 border border-slate-200 hover:border-blue-500 hover:bg-slate-50',
        green: 'bg-white text-slate-900 border border-slate-200 hover:border-emerald-500 hover:bg-slate-50',
        yellow: 'bg-white text-slate-900 border border-slate-200 hover:border-amber-500 hover:bg-slate-50',
        purple: 'bg-white text-slate-900 border border-slate-200 hover:border-purple-500 hover:bg-slate-50',
    };
    const iconColorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        yellow: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
    };

    return (
        <div 
            onClick={onClick} 
            className={`p-6 rounded-lg border-2 border-transparent transition-all duration-300 cursor-pointer flex items-start gap-4 transform hover:-translate-y-1 hover:shadow-lg ${colorClasses[color || 'blue']}`}
        >
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${iconColorClasses[color || 'blue']}`}>
                {icon}
            </div>
            <div>
                <h3 className="font-bold text-lg text-black">{title}</h3>
                <p className="text-sm opacity-80 mt-1">{description}</p>
            </div>
        </div>
    );
};
