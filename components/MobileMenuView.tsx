import React, { useState } from 'react';
import { navConfig } from '../data/navConfig';
import { View } from '../types';

interface MobileMenuViewProps {
    isOpen: boolean;
    onClose: () => void;
    currentView: View;
    setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <li>
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`flex items-center py-2 px-4 text-md transition-colors duration-200 rounded-lg ${
        isActive
          ? 'bg-autro-blue-light text-autro-blue font-semibold'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="ml-4">{label}</span>
    </a>
  </li>
);

const NavGroup: React.FC<{
    title: string;
    isOpen: boolean;
    onClick: () => void;
}> = ({ title, isOpen, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 mt-4 mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:text-autro-blue transition-colors"
    >
        <span>{title}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
    </button>
);

export const MobileMenuView: React.FC<MobileMenuViewProps> = ({ isOpen, onClose, currentView, setCurrentView }) => {
    const [openGroup, setOpenGroup] = useState<string | null>(navConfig[0]?.title || null);

    if (!isOpen) return null;
    
    const mobileFriendlyViews = new Set([
        View.SECTOR_DASHBOARD,
        View.STOCK_MOVEMENT,
        View.ORDER_VERIFICATION,
        View.CUTTING_ORDERS,
        View.DOCUMENT_SCANNER,
        View.SALES_SIMULATOR,
    ]);

    const handleItemClick = (view: View) => {
        setCurrentView(view);
        onClose();
    };
    
    const handleGroupClick = (title: string) => {
        setOpenGroup(prev => (prev === title ? null : title));
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col md:hidden animate-slide-in">
             <style>{`
                @keyframes slide-in {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
            `}</style>
            <header className="p-4 bg-white border-b flex justify-between items-center flex-shrink-0">
                <h2 className="font-bold text-xl text-black">Menu Completo</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </header>
            <nav className="flex-grow overflow-y-auto p-4">
                {navConfig.map(group => {
                    const mobileItems = group.items.filter(item => mobileFriendlyViews.has(item.id));
                    if (mobileItems.length === 0) return null;

                    const isGroupOpen = openGroup === group.title;

                    return (
                        <div key={group.title} className="mb-2">
                            <NavGroup
                                title={group.title}
                                isOpen={isGroupOpen}
                                onClick={() => handleGroupClick(group.title)}
                            />
                            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isGroupOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
                                <ul className="space-y-1 mt-1 pl-2">
                                    {mobileItems.map(item => (
                                        <NavItem
                                            key={item.id}
                                            label={item.label}
                                            icon={item.icon}
                                            isActive={currentView === item.id}
                                            onClick={() => handleItemClick(item.id)}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </nav>
        </div>
    );
};