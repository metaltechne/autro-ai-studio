
import React, { useState, useMemo } from 'react';
import { View, AllDashboardProps } from '../../types';
import { ProductionDashboard } from './ProductionDashboard';
import { InventoryDashboard } from './InventoryDashboard';
import { EngineeringDashboard } from './EngineeringDashboard';
import { Card } from '../ui/Card';

type Sector = 'production' | 'inventory' | 'engineering';

const SectorTab: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    isActive: boolean; 
    onClick: () => void;
    count?: number;
    color: 'blue' | 'indigo' | 'emerald' | 'purple';
}> = ({ title, icon, isActive, onClick, count, color }) => {
    const colorMap = {
        blue: { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-500' },
        indigo: { border: 'border-indigo-500', bg: 'bg-indigo-500', text: 'text-indigo-500' },
        emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-500' },
        purple: { border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-500' }
    };

    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group hover-lift ${
                isActive 
                ? `bg-white ${colorMap[color].border} shadow-premium` 
                : 'bg-white/50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200'
            }`}
        >
            <div className={`mb-3 p-2.5 rounded-xl transition-all duration-300 ${isActive ? `${colorMap[color].bg} text-white scale-110` : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500'}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{title}</span>
            {count !== undefined && count > 0 && (
                <span className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    {count}
                </span>
            )}
        </button>
    );
};

export const SectorDashboard: React.FC<AllDashboardProps> = (props) => {
    const [activeSector, setActiveSector] = useState<Sector>('production');

    const alerts = useMemo(() => {
        return {
            production: props.productionOrdersHook.productionOrders.filter(o => o.status === 'pendente').length,
            inventory: props.inventory.components.filter(c => {
                const available = c.stock - (c.reservedStock || 0);
                return available < 10 && available > 0;
            }).length,
            engineering: props.manufacturing.isDirty ? 1 : 0
        };
    }, [props]);

    const renderContent = () => {
        switch (activeSector) {
            case 'production': return <ProductionDashboard setCurrentView={props.setCurrentView} />;
            case 'inventory': return <InventoryDashboard setCurrentView={props.setCurrentView} />;
            case 'engineering': return <EngineeringDashboard setCurrentView={props.setCurrentView} inventory={props.inventory} manufacturing={props.manufacturing} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto animate-fade-in pb-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-autro-primary/10 text-autro-primary text-[10px] font-black uppercase rounded-md tracking-wider">Sistema Ativo</span>
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Painel de Controle</h2>
                    <p className="text-slate-500 font-medium text-lg">Visão estratégica e operacional da AUTRO.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-soft">
                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase block leading-none mb-1.5 tracking-widest">Status Global</span>
                        <span className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            Operacional
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectorTab 
                    title="Produção" 
                    color="indigo"
                    count={alerts.production}
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} 
                    isActive={activeSector === 'production'} 
                    onClick={() => setActiveSector('production')} 
                />
                <SectorTab 
                    title="Estoque" 
                    color="emerald"
                    count={alerts.inventory}
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} 
                    isActive={activeSector === 'inventory'} 
                    onClick={() => setActiveSector('inventory')} 
                />
                <SectorTab 
                    title="Engenharia" 
                    color="purple"
                    count={alerts.engineering}
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>} 
                    isActive={activeSector === 'engineering'} 
                    onClick={() => setActiveSector('engineering')} 
                />
            </div>

            <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-2 min-h-[500px] border border-white/60 shadow-soft">
                <div className="bg-white rounded-[22px] h-full shadow-sm overflow-hidden">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
