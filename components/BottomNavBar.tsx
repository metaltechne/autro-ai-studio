import React from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissionsContext } from '../contexts/RolePermissionsContext';

interface BottomNavBarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onOpenMenu: () => void;
}

const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>;
const StockMovementIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10m0-10l5 5m-5-5l-4 4m9 2l5-5m-5 5l4 4M15 7v10m0-10l5 5m-5-5l-4 4m9 2l5-5m-5 5l4 4m-4-5l-4 4" /></svg>;
const OrderVerificationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;


const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive = false, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative ${
                isActive ? 'text-autro-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
        >
            <div className={`p-2 rounded-xl transition-all duration-300 mb-1 ${isActive ? 'bg-autro-primary/10 scale-110 shadow-soft' : ''}`}>
                {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
            </div>
            <span className={`transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : 'opacity-70'}`}>{label}</span>
            {isActive && (
                <div className="absolute bottom-[-12px] w-8 h-1 bg-autro-primary rounded-t-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            )}
        </button>
    );
};

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, setCurrentView, onOpenMenu }) => {
    const { role } = useAuth();
    const { permissions } = useRolePermissionsContext();

    const mainViews = [
        View.SECTOR_DASHBOARD,
        View.STOCK_MOVEMENT,
        View.ORDER_VERIFICATION,
    ];
    const isOneOfMainViews = mainViews.includes(currentView);
    
    const navItems = [
        { view: View.SECTOR_DASHBOARD, label: "Início", icon: <DashboardIcon /> },
        { view: View.STOCK_MOVEMENT, label: "Estoque", icon: <StockMovementIcon /> },
        { view: View.ORDER_VERIFICATION, label: "Conferir", icon: <OrderVerificationIcon /> },
    ].filter(item => role && permissions[role]?.includes(item.view));

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200/60 z-40 print-hide shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] h-20 pb-safe">
            <div className="flex justify-around h-full items-center px-4">
                {navItems.map(item => (
                    <NavItem
                        key={item.view}
                        label={item.label}
                        icon={item.icon}
                        isActive={currentView === item.view}
                        onClick={() => setCurrentView(item.view)}
                    />
                ))}
                <NavItem
                    label="Menu"
                    icon={<MenuIcon />}
                    isActive={!isOneOfMainViews}
                    onClick={onOpenMenu}
                />
            </div>
        </nav>
    );
};