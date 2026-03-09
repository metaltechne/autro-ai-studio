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
        blue: 'bg-blue-50 text-blue-800 hover:border-blue-500 hover:bg-blue-100/80',
        green: 'bg-green-50 text-green-800 hover:border-green-500 hover:bg-green-100/80',
        yellow: 'bg-yellow-50 text-yellow-800 hover:border-yellow-500 hover:bg-yellow-100/80',
        purple: 'bg-purple-50 text-purple-800 hover:border-purple-500 hover:bg-purple-100/80',
    };
    const iconColorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
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
