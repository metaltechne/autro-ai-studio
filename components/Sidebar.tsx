
import React, { useState } from 'react';
import { View, UserRole } from '../types';
import { navConfig, NavItemConfig } from '../data/navConfig';
import { AUTRO_LOGO_URL } from '../data/assets';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissionsContext } from '../contexts/RolePermissionsContext';

interface NavGroup {
  title: string;
  items: NavItemConfig[];
}

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
  <li className="relative">
    {isActive && (
      <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1.5 h-8 bg-autro-primary rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10" />
    )}
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 md:py-2 rounded-lg transition-all duration-300 group relative overflow-hidden ${
        isActive
          ? 'bg-white/10 text-white shadow-sm'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
      title={!isOpen ? label : undefined}
    >
      <span className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'text-autro-primary scale-105' : 'text-slate-500 group-hover:text-slate-300'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'h-3 w-3 md:h-4 md:w-4' })}
      </span>
      {isOpen && <span className={`text-[10px] md:text-[11px] font-bold whitespace-nowrap tracking-wide transition-all duration-300 ${isActive ? 'translate-x-0.5' : ''}`}>{label}</span>}
      
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-autro-primary/10 to-transparent pointer-events-none" />
      )}
    </button>
  </li>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, setIsOpen }) => {
  const { role } = useAuth();
  const { permissions } = useRolePermissionsContext();
  
  // Filter nav items based on dynamic role permissions
  const visibleNavConfig: NavGroup[] = navConfig.map(group => ({
    ...group,
    items: group.items.filter(item => role && permissions[role]?.includes(item.id))
  })).filter(group => group.items.length > 0);

  return (
    <aside 
        className={`hidden md:flex flex-col bg-[#0B1120] border-r border-white/5 h-screen transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-20 relative ${isOpen ? 'w-72' : 'w-20'}`}
    >
        {/* Decorative Background Element */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-autro-primary/5 to-transparent pointer-events-none" />

        {/* Header / Logo */}
        <div className="h-20 flex items-center justify-center border-b border-white/5 relative">
            <div className={`flex items-center transition-all duration-500 ${isOpen ? 'px-6' : 'px-0'}`}>
                <div className="p-2 bg-white rounded-xl shadow-float">
                    <img src={AUTRO_LOGO_URL} alt="Logo" className={`${isOpen ? 'h-10' : 'h-6'} w-auto`} />
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-8 custom-scrollbar relative">
            {visibleNavConfig.map((group, idx) => (
                <div key={group.title} className="space-y-3">
                    {isOpen && (
                        <h3 className="px-3 text-[9px] uppercase text-slate-600 font-black tracking-[0.25em]">
                            {group.title}
                        </h3>
                    )}
                    {/* Divider for collapsed view if not first item */}
                    {!isOpen && idx > 0 && <div className="my-6 border-t border-white/5 mx-2" />}
                    
                    <ul className="space-y-1.5">
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
        <div className="p-4 border-t border-white/5 bg-black/20">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center p-3 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white transition-all duration-300 group"
            >
                <div className={`p-1 rounded-md border border-slate-800 group-hover:border-slate-600 transition-colors ${!isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </div>
                {isOpen && <span className="ml-3 text-xs font-bold text-slate-500 group-hover:text-slate-300">Recolher Menu</span>}
            </button>
        </div>
    </aside>
  );
};
