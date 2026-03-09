
import React from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

const viewTitles: Record<View, string> = {
    [View.SECTOR_DASHBOARD]: 'Dashboards',
    [View.OPERATIONAL_DASHBOARD]: 'Dashboard Operacional',
    [View.COMPONENTS]: 'Componentes',
    [View.KITS]: 'Kits',
    [View.KIT_DETAILS]: 'Detalhes do Kit',
    [View.KITS_BY_BRAND]: 'Kits por Frota',
    [View.RAW_MATERIALS]: 'Matérias-Primas',
    [View.MANUFACTURING]: 'Fluxos de Processo',
    [View.PRODUCTION_PLANNER]: 'Planejador de Montagem',
    [View.PRODUCTION_ORDERS]: 'Ordens de Montagem',
    [View.PURCHASE_ORDERS]: 'Ordens de Compra',
    [View.MANUFACTURING_PLANNER]: 'Planejador de Fabricação',
    [View.MANUFACTURING_ORDERS]: 'Ordens de Fabricação',
    [View.PRODUCTION_FINANCIAL_FLOW]: 'Fluxo de Produção',
    [View.INVENTORY_ANALYSIS]: 'Análise de Estoque',
    [View.PURCHASE_PRODUCTION_PLANNING]: 'Planejamento de Reposição',
    [View.SETTINGS]: 'Configurações',
    [View.PAYMENT_CALENDAR]: 'Calendário Financeiro',
    [View.LABEL_PRINTING]: 'Impressão de Etiquetas',
    [View.STOCK_MOVEMENT]: 'Movimentação de Estoque',
    [View.ORDER_VERIFICATION]: 'Conferência de Pedidos',
    [View.FINANCIAL_DASHBOARD]: 'Dashboard Financeiro',
    [View.SPREADSHEETS]: 'Planilhas de Edição Rápida',
    [View.AI_WORKER]: 'Trabalhador de IA',
    [View.ACTIVITY_LOG]: 'Log de Atividades',
    [View.DOCUMENT_SCANNER]: 'Entrada de Documentos',
    [View.FASTENER_CUTTING]: 'Criar Ordem de Corte',
    [View.CUTTING_ORDERS]: 'Ordens de Corte',
    [View.SALES_SIMULATOR]: 'Simulador de Vendas',
    [View.USER_MANAGEMENT]: 'Gerenciar Usuários',
    [View.SALES_ORDER_IMPORT]: 'Importar Pedido de Venda',
    [View.PRICING_SIMULATOR]: 'Simulador de Preços',
    [View.CUSTOMERS]: 'Clientes',
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
    <header className="flex items-center justify-between p-4 bg-white shadow-md print-hide">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-800 md:ml-4">{title}</h1>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-600">Olá, <span className="font-semibold capitalize">{displayName}</span></span>
        <Button onClick={handleLogout} variant="secondary" size="sm">
          Sair
        </Button>
      </div>
    </header>
  );
};
