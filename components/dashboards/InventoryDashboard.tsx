import React from 'react';
import { View } from '../../types';
import { DashboardCard } from './DashboardCard';

const CubeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" /></svg>;
const SwitchHorizontalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const ShoppingCartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const DocumentReportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

interface InventoryDashboardProps {
    setCurrentView: (view: View) => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ setCurrentView }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
            <DashboardCard 
                title="Planejamento de Reposição"
                description="Use a IA para analisar o que precisa ser cortado, fabricado ou comprado."
                icon={<DocumentReportIcon />}
                onClick={() => setCurrentView(View.PURCHASE_PRODUCTION_PLANNING)}
                color="green"
            />
            <DashboardCard 
                title="Movimentação de Estoque"
                description="Dê entrada ou baixa em itens do estoque de forma rápida usando QR Codes."
                icon={<SwitchHorizontalIcon />}
                onClick={() => setCurrentView(View.STOCK_MOVEMENT)}
                color="blue"
            />
            <DashboardCard 
                title="Componentes"
                description="Visualize e gerencie todos os componentes processados e comprados."
                icon={<CubeIcon />}
                onClick={() => setCurrentView(View.COMPONENTS)}
                color="blue"
            />
            <DashboardCard 
                title="Matérias-Primas"
                description="Gerencie os insumos básicos utilizados na fabricação de componentes."
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                onClick={() => setCurrentView(View.RAW_MATERIALS)}
                color="blue"
            />
            <DashboardCard 
                title="Ordens de Compra"
                description="Acompanhe o status das ordens de compra e registre o recebimento."
                icon={<ShoppingCartIcon />}
                onClick={() => setCurrentView(View.PURCHASE_ORDERS)}
                color="yellow"
            />
        </div>
    );
};
