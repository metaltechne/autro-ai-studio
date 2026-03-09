
import React, { useState } from 'react';
import { View, UserRole } from '../types';
import { navConfig } from '../data/navConfig';
import { AUTRO_LOGO_URL } from '../data/assets';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const NavItem: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
    isOpen: boolean;
}> = ({ icon, label, isActive, onClick, isOpen }) => (
  <li>
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
        isActive
          ? 'bg-autro-primary text-white shadow-md shadow-blue-500/20'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
      title={!isOpen ? label : undefined}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
        {icon}
      </span>
      {isOpen && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
    </button>
  </li>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, setIsOpen }) => {
  const { role } = useAuth();
  
  // Filter nav items based on role
  const visibleNavConfig = navConfig.map(group => ({
    ...group,
    items: group.items.filter(item => role && item.allowedRoles.includes(role))
  })).filter(group => group.items.length > 0);

  return (
    <aside 
        className={`hidden md:flex flex-col bg-white border-r border-slate-200 h-screen transition-all duration-300 ease-in-out z-20 ${isOpen ? 'w-64' : 'w-20'}`}
    >
        {/* Header / Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-100">
            <div className={`flex items-center gap-2 transition-all duration-300 ${isOpen ? 'px-4' : 'px-0'}`}>
                <img src={AUTRO_LOGO_URL} alt="Logo" className="h-8 w-auto" />
                {/* O span "AUTRO" foi removido daqui para evitar duplicidade com a imagem do logo */}
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {visibleNavConfig.map((group, idx) => (
                <div key={group.title}>
                    {isOpen && (
                        <h3 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {group.title}
                        </h3>
                    )}
                    {/* Divider for collapsed view if not first item */}
                    {!isOpen && idx > 0 && <div className="my-2 border-t border-slate-100 mx-2" />}
                    
                    <ul className="space-y-1">
                        {group.items.map(item => (
                            <NavItem
                                key={item.id}
                                label={item.label}
                                icon={item.icon}
                                isActive={currentView === item.id}
                                onClick={() => setCurrentView(item.id)}
                                isOpen={isOpen}
                            />
                        ))}
                    </ul>
                </div>
            ))}
        </nav>

        {/* Footer Toggle */}
        <div className="p-4 border-t border-slate-100">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
            </button>
        </div>
    </aside>
  );
};
