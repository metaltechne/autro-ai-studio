import React from 'react';
import { View } from '../../types';
import { DashboardCard } from './DashboardCard';

const ClipboardListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const CogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const ClipboardCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const DocumentTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>;
const ScissorsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7.071-7.071L19 5m-7.071 7.071L5 19m7.071-7.071L5 5" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /></svg>;

interface ProductionDashboardProps {
    setCurrentView: (view: View) => void;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ setCurrentView }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
            <DashboardCard 
                title="Planejador de Montagem"
                description="Crie e analise a viabilidade de novas ordens de montagem de kits."
                icon={<ClipboardListIcon />}
                onClick={() => setCurrentView(View.PRODUCTION_PLANNER)}
                color="green"
            />
            <DashboardCard 
                title="Planejador de Fabricação"
                description="Planeje a produção de componentes fabricados internamente."
                icon={<CogIcon />}
                onClick={() => setCurrentView(View.MANUFACTURING_PLANNER)}
                color="green"
            />
            <DashboardCard 
                title="Conferência de Pedidos"
                description="Use o leitor de QR Code para conferir os itens separados para uma ordem."
                icon={<ClipboardCheckIcon />}
                onClick={() => setCurrentView(View.ORDER_VERIFICATION)}
                color="blue"
            />
            <DashboardCard 
                title="Ordens de Montagem"
                description="Acompanhe todas as ordens de montagem, da pendência à conclusão."
                icon={<DocumentTextIcon />}
                onClick={() => setCurrentView(View.PRODUCTION_ORDERS)}
                color="yellow"
            />
            <DashboardCard 
                title="Ordens de Fabricação"
                description="Visualize e gerencie as ordens para produção de componentes."
                icon={<DocumentTextIcon />}
                onClick={() => setCurrentView(View.MANUFACTURING_ORDERS)}
                color="yellow"
            />
             <DashboardCard 
                title="Ordens de Corte"
                description="Inicie, finalize e gerencie as ordens de corte de fixadores."
                icon={<ScissorsIcon />}
                onClick={() => setCurrentView(View.CUTTING_ORDERS)}
                color="yellow"
            />
        </div>
    );
};
