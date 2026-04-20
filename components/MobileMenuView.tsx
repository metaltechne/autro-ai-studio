import React, { useState } from 'react';
import { navConfig } from '../data/navConfig';
import { View } from '../types';
import { AUTRO_LOGO_URL } from '../data/assets';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissionsContext } from '../contexts/RolePermissionsContext';

interface MobileMenuViewProps {
    isOpen: boolean;
    onClose: () => void;
    currentView: View;
    setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <li>
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`w-full flex items-center py-4 px-5 text-sm transition-all duration-300 rounded-2xl relative overflow-hidden group ${
        isActive
          ? 'bg-autro-primary text-white shadow-premium font-black uppercase tracking-widest text-[10px]'
          : 'text-slate-300 hover:bg-white/5'
      }`}
    >
      <div className={`transition-transform duration-300 w-5 h-5 ${isActive ? 'text-white scale-110' : 'text-slate-500 group-hover:text-slate-300'}`}>
        {icon}
      </div>
      <span className="ml-4">{label}</span>
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
      )}
    </button>
  </li>
);

const NavGroup: React.FC<{
    title: string;
    isOpen: boolean;
    onClick: () => void;
}> = ({ title, isOpen, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-5 py-4 mt-4 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] hover:text-white transition-colors bg-white/5 rounded-xl border border-white/5"
    >
        <span>{title}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform duration-500 ${isOpen ? 'rotate-90 text-autro-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
        </svg>
    </button>
);

export const MobileMenuView: React.FC<MobileMenuViewProps> = ({ isOpen, onClose, currentView, setCurrentView }) => {
    const [openGroup, setOpenGroup] = useState<string | null>(navConfig[0]?.title || null);
    const { role } = useAuth();
    const { permissions } = useRolePermissionsContext();

    if (!isOpen) return null;
    
    const mobileFriendlyViews = new Set([
        View.SECTOR_DASHBOARD,
        View.COMPONENTS,
        View.KITS,
        View.PRODUCTION_ORDERS,
        View.MANUFACTURING_ORDERS,
        View.STOCK_MOVEMENT,
        View.ORDER_VERIFICATION,
        View.CUTTING_ORDERS,
        View.INSPECTION_RECEIVING,
        View.CUSTOMERS,
    ]);

    const handleItemClick = (view: View) => {
        setCurrentView(view);
        onClose();
    };
    
    const handleGroupClick = (title: string) => {
        setOpenGroup(prev => (prev === title ? null : title));
    };

    return (
        <div className="fixed inset-0 bg-[#0B1120] z-50 flex flex-col md:hidden animate-slide-in">
             <style>{`
                @keyframes slide-in {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-in { animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
            
            {/* Decorative Background Element */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-autro-primary/10 to-transparent pointer-events-none" />

            <header className="p-6 bg-transparent flex justify-between items-center flex-shrink-0 relative">
                <div className="flex flex-col">
                    <h2 className="font-black text-2xl text-white tracking-tighter uppercase leading-none">Menu</h2>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Navegação Principal</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-3 rounded-2xl bg-white/5 border border-white/10 transition-all duration-300 active:scale-90">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </header>
            
            <nav className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar relative">
                {navConfig.map(group => {
                    const mobileItems = group.items.filter(item => 
                        mobileFriendlyViews.has(item.id) && 
                        role && 
                        permissions[role]?.includes(item.id)
                    );
                    if (mobileItems.length === 0) return null;

                    const isGroupOpen = openGroup === group.title;

                    return (
                        <div key={group.title} className="overflow-hidden">
                            <NavGroup
                                title={group.title}
                                isOpen={isGroupOpen}
                                onClick={() => handleGroupClick(group.title)}
                            />
                            <div className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isGroupOpen ? 'max-h-[600px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                                <ul className="space-y-2 px-1">
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
            
            <div className="p-6 border-t border-white/5 bg-black/20">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-1.5 bg-white rounded-lg">
                            <img src={AUTRO_LOGO_URL} alt="Logo" className="h-6 w-auto" />
                        </div>
                    </div>
                    <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest">v1.0.0</span>
                </div>
            </div>
        </div>
    );
};