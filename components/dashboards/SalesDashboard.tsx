import React from 'react';
import { View } from '../../types';
import { DashboardCard } from './DashboardCard';

const CashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const CollectionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const TruckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2H5.5" /></svg>;
const DocumentTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>;
const DocumentAddIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>;

interface SalesDashboardProps {
    setCurrentView: (view: View) => void;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ setCurrentView }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
            <DashboardCard 
                title="Importar Pedido de Venda"
                description="Importe um pedido de venda (XML de NFe) para iniciar um novo processo de montagem."
                icon={<DocumentAddIcon />}
                onClick={() => setCurrentView(View.SALES_ORDER_IMPORT)}
                color="green"
            />
            <DashboardCard 
                title="Nova Venda / Simulação"
                description="Crie uma simulação de venda, analise custos, margens e gere um orçamento."
                icon={<CashIcon />}
                onClick={() => setCurrentView(View.SALES_SIMULATOR)}
                color="green"
            />
            <DashboardCard 
                title="Catálogo de Kits"
                description="Explore todos os kits de produtos disponíveis, visualize detalhes e custos."
                icon={<CollectionIcon />}
                onClick={() => setCurrentView(View.KITS)}
                color="blue"
            />
            <DashboardCard 
                title="Análise de Frota"
                description="Analise os componentes necessários para uma frota ou marca específica."
                icon={<TruckIcon />}
                onClick={() => setCurrentView(View.KITS_BY_BRAND)}
                color="blue"
            />
            <DashboardCard 
                title="Ordens de Montagem"
                description="Acompanhe o status das ordens de montagem que foram geradas."
                icon={<DocumentTextIcon />}
                onClick={() => setCurrentView(View.PRODUCTION_ORDERS)}
                color="yellow"
            />
        </div>
    );
};
