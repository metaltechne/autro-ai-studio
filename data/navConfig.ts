
import React from 'react';
import { View, UserRole } from '../types';

export interface NavItemConfig {
    id: View;
    label: string;
    icon: React.ReactNode;
    allowedRoles: UserRole[];
}

// --- Icon Components using React.createElement ---
const createIcon = (paths: React.ReactElement[]) => React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.5
}, ...paths);

const DashboardIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" })]);
const FinancialDashboardIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" })]);
const CubeIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" }), React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" })]);
const CollectionIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" })]);
const CogIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }), React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })]);
const DocumentTextIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" })]);
const CalendarIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" })]);
const ClipboardListIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" })]);
const ChartPieIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" }), React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" })]);
const TruckIcon = createIcon([React.createElement('path', { d: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" }), React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2H5.5" })]);
const UsersIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" })]);
const ScissorsIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M7 11a2 2 0 100-4 2 2 0 000 4zM17 11a2 2 0 100-4 2 2 0 000 4zM11 13l3 3m-3 0l3-3m-6-1l10 10m-10 0l10-10" })]);
const ShoppingCartIcon = createIcon([React.createElement('path', { d: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" })]);
const PrinterIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" })]);
const SwitchHorizontalIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" })]);
const ClipboardCheckIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" })]);
const PuzzleIcon = createIcon([React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' })]);
const NumberedListIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" })]);
const TableIcon = createIcon([React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" })]);

export const navConfig: { title: string; items: NavItemConfig[] }[] = [
    {
        title: 'Dashboard',
        items: [
            { id: View.SECTOR_DASHBOARD, label: 'Dashboard Geral', icon: DashboardIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor', 'Operador'] },
            { id: View.FINANCIAL_DASHBOARD, label: 'Dashboard Financeiro', icon: FinancialDashboardIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.AI_WORKER, label: 'Assistente de IA', icon: ChartPieIcon, allowedRoles: ['Admin', 'Gerente'] },
        ]
    },
    {
        title: 'COMERCIAL',
        items: [
            { id: View.SALES_ORDER_IMPORT, label: 'Importar Pedidos', icon: SwitchHorizontalIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor'] },
            { id: View.SALES_SIMULATOR, label: 'Simulador de Vendas', icon: SwitchHorizontalIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor'] },
            { id: View.PRICING_SIMULATOR, label: 'Simulador de Preços', icon: ChartPieIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.CUSTOMERS, label: 'Clientes', icon: UsersIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor'] },
        ]
    },
    {
        title: 'PRODUÇÃO',
        items: [
            { id: View.PRODUCTION_PLANNER, label: 'Planejador de Produção', icon: ClipboardCheckIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.MANUFACTURING_PLANNER, label: 'Planejador de Fabricação', icon: TableIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.PRODUCTION_ORDERS, label: 'Ordens de Produção', icon: NumberedListIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor', 'Operador'] },
            { id: View.MANUFACTURING_ORDERS, label: 'Ordens de Fabricação', icon: ClipboardListIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.CUTTING_ORDERS, label: 'Ordens de Corte', icon: ScissorsIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.ORDER_VERIFICATION, label: 'Conferência de Pedidos', icon: ClipboardCheckIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
        ]
    },
    {
        title: 'ESTOQUE',
        items: [
            { id: View.STOCK_MOVEMENT, label: 'Movimentação de Estoque', icon: SwitchHorizontalIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.INVENTORY_ANALYSIS, label: 'Análise de Estoque', icon: ChartPieIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.KITS_BY_BRAND, label: 'Kits por Veículo', icon: TruckIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor'] },
            { id: View.LABEL_PRINTING, label: 'Impressão de Etiquetas', icon: PrinterIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
        ]
    },
    {
        title: 'SUPRIMENTOS',
        items: [
            { id: View.PURCHASE_ORDERS, label: 'Ordens de Compra', icon: ShoppingCartIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.PURCHASE_PRODUCTION_PLANNING, label: 'Planejamento de Reposição', icon: ChartPieIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.DOCUMENT_SCANNER, label: 'Entrada de Documentos', icon: DocumentTextIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
        ]
    },
    {
        title: 'FINANCEIRO',
        items: [
            { id: View.PAYMENT_CALENDAR, label: 'Calendário Financeiro', icon: CalendarIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.PRODUCTION_FINANCIAL_FLOW, label: 'Fluxo de Produção', icon: SwitchHorizontalIcon, allowedRoles: ['Admin', 'Gerente'] },
        ]
    },
    {
        title: 'CADASTROS',
        items: [
            { id: View.COMPONENTS, label: 'Componentes', icon: CubeIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.KITS, label: 'Kits / Produtos', icon: CollectionIcon, allowedRoles: ['Admin', 'Gerente', 'Vendedor', 'Operador'] },
            { id: View.RAW_MATERIALS, label: 'Matérias-Primas', icon: CubeIcon, allowedRoles: ['Admin', 'Gerente', 'Operador'] },
            { id: View.MANUFACTURING, label: 'Fluxos de Processo', icon: PuzzleIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.MANUFACTURING_STRUCTURE, label: 'Estrutura de Produção', icon: PuzzleIcon, allowedRoles: ['Admin', 'Gerente'] },
        ]
    },
    {
        title: 'SISTEMA',
        items: [
            { id: View.SPREADSHEETS, label: 'Edição em Massa', icon: TableIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.ACTIVITY_LOG, label: 'Log de Atividades', icon: DocumentTextIcon, allowedRoles: ['Admin', 'Gerente'] },
            { id: View.SETTINGS, label: 'Configurações', icon: CogIcon, allowedRoles: ['Admin'] },
            { id: View.USER_MANAGEMENT, label: 'Usuários', icon: UsersIcon, allowedRoles: ['Admin'] },
        ]
    }
];

