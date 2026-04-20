
import React from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

const viewTitles: Record<View, string> = {
    [View.SECTOR_DASHBOARD]: 'Dashboard Geral',
    [View.OPERATIONAL_DASHBOARD]: 'Dashboard Operacional',
    [View.COMPONENTS]: 'Componentes',
    [View.KITS]: 'Kits / Produtos',
    [View.KIT_DETAILS]: 'Detalhes do Kit',
    [View.KITS_BY_BRAND]: 'Kits por Veículo',
    [View.RAW_MATERIALS]: 'Matérias-Primas',
    [View.MANUFACTURING]: 'Fluxos de Processo',
    [View.PRODUCTION_PLANNER]: 'Planejador de Produção',
    [View.PRODUCTION_ORDERS]: 'Ordens de Produção',
    [View.PURCHASE_ORDERS]: 'Ordens de Compra',
    [View.MANUFACTURING_PLANNER]: 'Planejador de Fabricação',
    [View.MANUFACTURING_ORDERS]: 'Ordens de Fabricação',
    [View.MANUFACTURING_DASHBOARD]: 'Painel de Fabricação',
    [View.MACHINE_DASHBOARD]: 'Painel de Máquinas (Andon)',
    [View.MANUFACTURING_CONTROL_CENTER]: 'Centro de Controle de Fabricação',
    [View.MANUFACTURING_CALENDAR]: 'Calendário de Produção',
    [View.PRODUCTION_FINANCIAL_FLOW]: 'Fluxo de Produção',
    [View.INVENTORY_ANALYSIS]: 'Análise de Estoque',
    [View.PURCHASE_PRODUCTION_PLANNING]: 'Planejamento de Reposição',
    [View.SETTINGS]: 'Configurações',
    [View.PAYMENT_CALENDAR]: 'Calendário Financeiro',
    [View.LABEL_PRINTING]: 'Impressão de Etiquetas',
    [View.STOCK_MOVEMENT]: 'Movimentação de Estoque',
    [View.ORDER_VERIFICATION]: 'Conferência de Pedidos',
    [View.FINANCIAL_DASHBOARD]: 'Dashboard Financeiro',
    [View.SPREADSHEETS]: 'Edição em Massa',
    [View.AI_WORKER]: 'Assistente de IA',
    [View.ACTIVITY_LOG]: 'Log de Atividades',
    [View.INSPECTION_RECEIVING]: 'Inspeção e Recebimento',
    [View.FASTENER_CUTTING]: 'Criar Ordem de Corte',
    [View.CUTTING_ORDERS]: 'Ordens de Corte',
    [View.USER_MANAGEMENT]: 'Usuários',
    [View.SALES_ORDER_IMPORT]: 'Importar Pedidos',
    [View.CUSTOMERS]: 'Clientes',
    [View.MANUFACTURING_STRUCTURE]: 'Estrutura de Produção',
    [View.SALES_FUNNEL]: 'Funil de Vendas',
    [View.WHATSAPP_CRM]: 'WhatsApp CRM',
    [View.CALLS_CRM]: 'CRM de Ligações',
    [View.CUSTOMER_SERVICE_DASHBOARD]: 'Dashboard de Atendimento',
    [View.KIT_ENGINEERING]: 'Engenharia de Kits',
    [View.TASKS]: 'Tarefas',
};

interface HeaderProps {
  currentView: View;
}

export const Header: React.FC<HeaderProps> = ({ currentView }) => {
  const { user, logout } = useAuth();
  const title = viewTitles[currentView] || 'Dashboard';

  const handleLogout = async () => {
    try {
        await logout();
    } catch (error) {
        console.error("Failed to log out", error);
    }
  };

  const displayName = user?.email ? user.email.split('@')[0] : 'Usuário';

  return (
    <header className="flex items-center justify-between h-20 px-8 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10 print-hide">
      <div className="flex items-center gap-4">
        <div className="w-1 h-6 bg-autro-primary rounded-full hidden md:block" />
        <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">{title}</h1>
      </div>
      <div className="flex items-center space-x-8">
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Operador</span>
            <span className="text-sm text-slate-900 font-bold capitalize">{displayName}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-black text-xs shadow-soft">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
        <button 
          onClick={handleLogout}
          className="group flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 border border-transparent hover:border-rose-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>
    </header>
  );
};
