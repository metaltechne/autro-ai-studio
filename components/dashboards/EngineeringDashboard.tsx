import React from 'react';
import { View, InventoryHook, ManufacturingHook } from '../../types';
import { DashboardCard } from './DashboardCard';
import { useToast } from '../../hooks/useToast';

const CogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const TableIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const PrinterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;

interface EngineeringDashboardProps {
    setCurrentView: (view: View) => void;
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
}

export const EngineeringDashboard: React.FC<EngineeringDashboardProps> = ({ setCurrentView, inventory, manufacturing }) => {
    const { addToast } = useToast();
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSyncCosts = async () => {
        if (manufacturing.isDirty) {
            addToast("Aguarde o salvamento automático antes de sincronizar.", 'info');
            return;
        }
        setIsSyncing(true);
        const report = await inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components);
        const totalChanges = report.createdComponents.length + report.updatedComponents.length + report.deletedComponents.length;
        if (totalChanges === 0) {
            addToast("Sincronização concluída. Nenhum custo foi alterado.", 'info');
        } else {
            addToast(`Sincronização concluída: ${report.createdComponents.length} criados, ${report.updatedComponents.length} atualizados, ${report.deletedComponents.length} excluídos.`, 'success');
        }
        setIsSyncing(false);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
            <DashboardCard 
                title="Processos de Fabricação"
                description="Defina, visualize e edite os fluxos de produção para cada família de componentes."
                icon={<CogIcon />}
                onClick={() => setCurrentView(View.MANUFACTURING)}
                color="purple"
            />
            <DashboardCard 
                title="Sincronizar Custos"
                description="Recalcule os custos de todos os componentes com base nos processos de fabricação atuais."
                icon={<SparklesIcon />}
                onClick={handleSyncCosts}
                color="green"
            />
            <DashboardCard 
                title="Planilhas de Edição"
                description="Edite rapidamente os dados de componentes, kits e matérias-primas em massa."
                icon={<TableIcon />}
                onClick={() => setCurrentView(View.SPREADSHEETS)}
                color="blue"
            />
            <DashboardCard 
                title="Impressão de Etiquetas"
                description="Gere e imprima etiquetas com QR Code para seus componentes e kits."
                icon={<PrinterIcon />}
                onClick={() => setCurrentView(View.LABEL_PRINTING)}
                color="blue"
            />
        </div>
    );
};
