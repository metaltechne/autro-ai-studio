
import React, { useState, useMemo } from 'react';
import { View, AllDashboardProps } from '../../types';
import { SalesDashboard } from './SalesDashboard';
import { ProductionDashboard } from './ProductionDashboard';
import { InventoryDashboard } from './InventoryDashboard';
import { EngineeringDashboard } from './EngineeringDashboard';
import { Card } from '../ui/Card';

type Sector = 'sales' | 'production' | 'inventory' | 'engineering';

const SectorTab: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    isActive: boolean; 
    onClick: () => void;
    count?: number;
    color: string;
}> = ({ title, icon, isActive, onClick, count, color }) => {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden group ${
                isActive 
                ? `bg-white border-${color}-500 shadow-lg translate-y-[-4px]` 
                : 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'
            }`}
        >
            <div className={`mb-2 p-2 rounded-lg transition-colors ${isActive ? `bg-${color}-500 text-white` : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'}`}>
                {icon}
            </div>
            <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{title}</span>
            {count !== undefined && count > 0 && (
                <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                    {count}
                </span>
            )}
        </button>
    );
};

export const SectorDashboard: React.FC<AllDashboardProps> = (props) => {
    const [activeSector, setActiveSector] = useState<Sector>('sales');

    const alerts = useMemo(() => {
        return {
            production: props.productionOrdersHook.productionOrders.filter(o => o.status === 'pendente').length,
            inventory: props.inventory.components.filter(c => c.stock < 10 && c.stock > 0).length,
            sales: 0,
            engineering: props.manufacturing.isDirty ? 1 : 0
        };
    }, [props]);

    const renderContent = () => {
        switch (activeSector) {
            case 'sales': return <SalesDashboard setCurrentView={props.setCurrentView} />;
            case 'production': return <ProductionDashboard setCurrentView={props.setCurrentView} />;
            case 'inventory': return <InventoryDashboard setCurrentView={props.setCurrentView} />;
            case 'engineering': return <EngineeringDashboard setCurrentView={props.setCurrentView} inventory={props.inventory} manufacturing={props.manufacturing} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Mission Control</h2>
                    <p className="text-slate-500 font-medium">Gestão integrada da cadeia de suprimentos e fabricação.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                    <div className="px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block leading-none mb-1">Status Global</span>
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Sistema Operacional
                        </span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SectorTab 
                    title="Vendas" 
                    color="blue"
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
                    isActive={activeSector === 'sales'} 
                    onClick={() => setActiveSector('sales')} 
                />
                <SectorTab 
                    title="Produção" 
                    color="indigo"
                    count={alerts.production}
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} 
                    isActive={activeSector === 'production'} 
                    onClick={() => setActiveSector('production')} 
                />
                <SectorTab 
                    title="Estoque" 
                    color="emerald"
                    count={alerts.inventory}
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} 
                    isActive={activeSector === 'inventory'} 
                    onClick={() => setActiveSector('inventory')} 
                />
                <SectorTab 
                    title="Engenharia" 
                    color="purple"
                    count={alerts.engineering}
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>} 
                    isActive={activeSector === 'engineering'} 
                    onClick={() => setActiveSector('engineering')} 
                />
            </div>

            <div className="bg-slate-200/30 rounded-2xl p-1 min-h-[400px]">
                {renderContent()}
            </div>
            
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};
