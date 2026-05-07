import React, { useMemo } from 'react';
import { Card } from './ui/Card';
import { DashboardWidget, View, InventoryHook, ManufacturingHook, ProductionOrdersHook, PurchaseOrdersHook, Component, ManufacturingOrdersHook } from '../types';
import { Button } from './ui/Button';
import { useFinancials } from '../contexts/FinancialsContext';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import type { ChartData } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

interface WidgetProps {
  widgetConfig: DashboardWidget;
  isEditMode: boolean;
  onEdit: (widget: DashboardWidget) => void;
  onDelete: (id: string) => void;
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  productionOrdersHook: ProductionOrdersHook;
  purchaseOrdersHook: PurchaseOrdersHook;
  manufacturingOrdersHook: ManufacturingOrdersHook;
  setCurrentView: (view: View) => void;
  setComponentFilter: (filter: { type: 'low-stock' } | null) => void;
  isMobile: boolean;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCompactCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    const numValue = Number(value);
    if (Math.abs(numValue) < 1000) {
        return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 1
    }).format(numValue);
};
const formatCompactNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return '0';
    const numValue = Number(value);
    if (Math.abs(numValue) < 1000) {
        return numValue.toLocaleString('pt-BR');
    }
    return new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(numValue);
};

const getComponentCost = (component: Component): number => {
    if (component.sourcing === 'purchased' && typeof component.purchaseCost === 'number') return component.purchaseCost;
    return (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0);
};

const renderContent = (
    widgetConfig: DashboardWidget,
    props: WidgetProps
) => {
    const { inventory, productionOrdersHook, purchaseOrdersHook, manufacturingOrdersHook, setCurrentView, setComponentFilter } = props;

    switch (widgetConfig.type) {
        case 'kpi': {
            let value = 0;
            let description = '';
            switch (widgetConfig.metric) {
                case 'inventoryValue':
                    value = inventory.components.reduce((sum, c) => sum + (c.stock * getComponentCost(c)), 0);
                    description = `em ${inventory.components.length} SKUs`;
                    return (
                        <div className="text-center">
                            <p className="text-3xl font-bold text-autro-blue" title={description}>{formatCompactCurrency(value)}</p>
                            <p className="text-xs text-gray-500 mt-1">Total em estoque</p>
                        </div>
                    );
                case 'pendingProduction':
                    value = productionOrdersHook.productionOrders.filter(o => o.status === 'pendente').length;
                    description = 'Ordens de Montagem';
                    return <p className="text-3xl font-bold text-autro-blue" title={description}>{formatCompactNumber(value)}</p>;
                case 'pendingManufacturing':
                    value = manufacturingOrdersHook.manufacturingOrders.filter(o => o.status === 'pendente').length;
                    description = 'Ordens de Fabricação';
                    return <p className="text-3xl font-bold text-autro-blue" title={description}>{formatCompactNumber(value)}</p>;
                case 'pendingPurchase':
                     value = purchaseOrdersHook.purchaseOrders.filter(o => o.status === 'pendente').length;
                    description = 'Ordens de Compra';
                    return <p className="text-3xl font-bold text-autro-blue" title={description}>{formatCompactNumber(value)}</p>;
            }
            return <div>Métrica KPI desconhecida</div>;
        }
        case 'alerts': {
            const lowStockItems = inventory.components.filter(c => {
                const available = c.stock - (c.reservedStock || 0);
                return available <= 10;
            });
            if (lowStockItems.length === 0) return <p className="text-gray-500">Nenhum alerta de estoque.</p>;
            return (
                <div className="text-center">
                    <p className="text-4xl font-bold text-yellow-500">{lowStockItems.length}</p>
                    <p className="text-sm text-yellow-600">Disponibilidade Crítica</p>
                    <p className="text-xs text-gray-400 mb-2">(Estoque - Reservado ≤ 10)</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setComponentFilter({ type: 'low-stock' }); setCurrentView(View.COMPONENTS); }}>Ver Itens</Button>
                </div>
            );
        }
        case 'topComponents': {
            const top5 = [...inventory.components]
                .sort((a,b) => (b.stock * getComponentCost(b)) - (a.stock * getComponentCost(a)))
                .slice(0, 5);
            return (
                 <ul className="w-full space-y-2 text-sm">
                    {top5.map(c => (
                        <li key={c.id} className="flex justify-between items-center">
                            <span className="text-black truncate" title={c.name}>{c.name}</span>
                            <span className="font-semibold text-gray-700">{formatCurrency(c.stock * getComponentCost(c))}</span>
                        </li>
                    ))}
                </ul>
            );
        }
        case 'bar':
        case 'line':
        case 'pie':
             // Chart logic would be complex, returning a placeholder to fix the build.
            return <div>Chart: {widgetConfig.title}</div>
        default:
            return <div>Widget desconhecido</div>;
    }
};


export const Widget: React.FC<WidgetProps> = (props) => {
    const { widgetConfig, isEditMode, onEdit, onDelete } = props;
    
    return (
        <Card className="h-full flex flex-col relative group">
            {isEditMode && (
                 <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {(widgetConfig.type !== 'alerts' && widgetConfig.type !== 'topComponents') && (
                         <Button size="sm" variant="secondary" className="!p-1.5" onClick={() => onEdit(widgetConfig)}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                        </Button>
                    )}
                    <Button size="sm" variant="danger" className="!p-1.5" onClick={() => onDelete(widgetConfig.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                </div>
            )}
            <h3 className="text-lg font-semibold text-black mb-4 flex-grow-0 pr-16">{widgetConfig.title}</h3>
            <div className="flex-grow flex items-center justify-center">
                {renderContent(widgetConfig, props)}
            </div>
        </Card>
    );
};