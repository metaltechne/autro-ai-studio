import React from 'react';

interface AIAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

interface AIActionBarProps {
    title: string;
    actions: AIAction[];
    isLoading: boolean;
}

export const AIActionBar: React.FC<AIActionBarProps> = ({ title, actions, isLoading }) => {
    return (
        <div className="bg-white/60 backdrop-blur-md border border-gray-200/80 rounded-lg p-4 mb-6 print-hide shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-autro-blue/10 p-2 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-autro-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-black">{title}</h3>
                        <p className="text-sm text-gray-600">Obtenha insights e sugestões rápidas.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={action.onClick}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-autro-blue bg-autro-blue-light rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {action.icon}
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};