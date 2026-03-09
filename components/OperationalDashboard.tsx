import React, { useMemo, useState, useEffect, useRef } from 'react';
import { InventoryHook, ManufacturingHook, View, ManufacturingOrdersHook, PurchaseOrdersHook, ProductionOrdersHook, DashboardWidget, KpiWidgetConfig, ChartWidgetConfig, PromotionalCampaign } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from '../hooks/useToast';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';
import { Widget } from './Widget';
import { WidgetConfigModal } from './WidgetConfigModal';
import { Modal } from './ui/Modal';
import { CampaignCard } from './CampaignCard';

interface OperationalDashboardProps {
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  manufacturingOrdersHook: ManufacturingOrdersHook;
  purchaseOrdersHook: PurchaseOrdersHook;
  productionOrdersHook: ProductionOrdersHook;
  setCurrentView: (view: View) => void;
  setComponentFilter: (filter: { type: 'low-stock' } | null) => void;
  promotionalCampaigns: PromotionalCampaign[];
  isMobile: boolean;
}

const professionalDefaultWidgets: DashboardWidget[] = [
  { id: nanoid(), type: 'kpi', metric: 'inventoryValue', title: 'Valor do Inventário' },
  { id: nanoid(), type: 'kpi', metric: 'pendingProduction', title: 'Ordens de Produção Pendentes' },
  { id: nanoid(), type: 'kpi', metric: 'pendingManufacturing', title: 'Ordens de Fabricação Pendentes' },
  { id: nanoid(), type: 'kpi', metric: 'pendingPurchase', title: 'Ordens de Compra Pendentes' },
  { id: nanoid(), type: 'line', dimension: 'monthYear', metric: 'kitSaleValue', title: 'Faturamento Mensal (Ordens Concluídas)' },
  { id: nanoid(), type: 'pie', dimension: 'kitBrand', metric: 'kitCount', title: 'Mix de Vendas por Marca' },
  { id: nanoid(), type: 'alerts', title: 'Alertas de Estoque Baixo' },
  { id: nanoid(), type: 'topComponents', title: 'Top Componentes por Valor em Estoque' },
];


const WIDGET_LIBRARY: { name: string, type: DashboardWidget['type'], defaultCofig: Partial<DashboardWidget> }[] = [
    { name: 'Indicador (KPI)', type: 'kpi', defaultCofig: { metric: 'inventoryValue', title: 'Novo KPI' } },
    { name: 'Gráfico de Barras', type: 'bar', defaultCofig: { dimension: 'kitBrand', metric: 'kitSaleValue', title: 'Novo Gráfico de Barras' } },
    { name: 'Gráfico de Linhas', type: 'line', defaultCofig: { dimension: 'monthYear', metric: 'kitSaleValue', title: 'Novo Gráfico de Linhas' } },
    { name: 'Gráfico de Pizza', type: 'pie', defaultCofig: { dimension: 'kitBrand', metric: 'kitCount', title: 'Novo Gráfico de Pizza' } },
];


export const OperationalDashboard: React.FC<OperationalDashboardProps> = (props) => {
  const { isMobile, promotionalCampaigns, setCurrentView } = props;
  const { addToast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const draggedItem = useRef<string | null>(null);
  
  const activeCampaigns = useMemo(() => {
    const now = new Date();
    return promotionalCampaigns.filter(c => {
      const startDate = new Date(c.startDate);
      const diffTime = now.getTime() - startDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 90; // Active for 90 days
    });
  }, [promotionalCampaigns]);


  // Load layout from localStorage
  useEffect(() => {
    try {
      const savedWidgets = localStorage.getItem('dashboardWidgets_v3');
      if (savedWidgets) {
        setWidgets(JSON.parse(savedWidgets));
      } else {
        setWidgets(professionalDefaultWidgets);
      }
    } catch (e) {
      console.error("Failed to load dashboard layout", e);
      setWidgets(professionalDefaultWidgets);
    }
  }, []);

  const saveLayout = (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboardWidgets_v3', JSON.stringify(newWidgets));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    draggedItem.current = id;
    setTimeout(() => { (e.target as HTMLDivElement).style.opacity = '0.5'; }, 0);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropId: string) => {
    e.preventDefault();
    if (draggedItem.current && draggedItem.current !== dropId) {
      const dragIndex = widgets.findIndex(w => w.id === draggedItem.current);
      const dropIndex = widgets.findIndex(w => w.id === dropId);
      const newWidgets = [...widgets];
      const [reorderedItem] = newWidgets.splice(dragIndex, 1);
      newWidgets.splice(dropIndex, 0, reorderedItem);
      saveLayout(newWidgets);
    }
    (e.currentTarget as HTMLDivElement).style.opacity = '1';
    const dragEl = document.getElementById(`widget-${draggedItem.current}`);
    if(dragEl) dragEl.style.opacity = '1';
    draggedItem.current = null;
  };
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.opacity = '1';
    draggedItem.current = null;
  };

  const handleAddWidget = (type: DashboardWidget['type'], defaultConfig: Partial<DashboardWidget>) => {
    const newWidget: DashboardWidget = {
      id: nanoid(),
      type: type,
      ...defaultConfig,
    } as DashboardWidget;
    
    if (newWidget.type === 'bar' || newWidget.type === 'line' || newWidget.type === 'pie' || newWidget.type === 'kpi') {
        setEditingWidget(newWidget);
        setIsConfigModalOpen(true);
    } else {
        saveLayout([...widgets, newWidget]);
    }
    setIsAddModalOpen(false);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setIsConfigModalOpen(true);
  };
  
  const handleDeleteWidget = (id: string) => {
    const newWidgets = widgets.filter(w => w.id !== id);
    saveLayout(newWidgets);
  };

  const handleSaveWidgetConfig = (config: KpiWidgetConfig | ChartWidgetConfig) => {
    const isNew = !widgets.some(w => w.id === config.id);
    if (isNew) {
        saveLayout([...widgets, config]);
    } else {
        const newWidgets = widgets.map(w => w.id === config.id ? config : w);
        saveLayout(newWidgets);
    }
    setEditingWidget(null);
    setIsConfigModalOpen(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-black">Visão Geral Operacional</h2>
        <div className="flex gap-2">
            <Button onClick={() => setCurrentView(View.SALES_ORDER_IMPORT)} variant="secondary">Importar Pedido (CSV)</Button>
            {isEditMode && <Button onClick={() => setIsAddModalOpen(true)} variant="primary">Adicionar Widget</Button>}
            <Button onClick={() => { setIsEditMode(!isEditMode); if(isEditMode) addToast("Layout salvo!", "success"); }} variant="secondary">
                {isEditMode ? 'Finalizar Customização' : 'Customizar'}
            </Button>
        </div>
      </div>
      
      {activeCampaigns.length > 0 && (
          <div className="space-y-4">
              <h3 className="text-2xl font-bold text-black">Campanhas de Vendas Ativas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeCampaigns.map(campaign => (
                      <CampaignCard 
                        key={campaign.id} 
                        campaign={campaign} 
                        inventory={props.inventory} 
                        productionOrdersHook={props.productionOrdersHook} 
                      />
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {widgets.map(widget => {
            const isKpi = widget.type === 'kpi';
            const colSpan = isMobile ? 'col-span-2' : (isKpi ? 'col-span-1' : 'col-span-2');

            return (
              <div
                key={widget.id}
                id={`widget-${widget.id}`}
                draggable={isEditMode && !isMobile}
                onDragStart={e => handleDragStart(e, widget.id)}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, widget.id)}
                onDragEnd={handleDragEnd}
                className={`
                  relative transition-all duration-300
                  ${colSpan}
                  ${isEditMode && !isMobile ? 'cursor-move' : ''}
                  ${isEditMode ? 'p-2 bg-blue-50/70 rounded-lg ring-2 ring-autro-blue ring-dashed' : ''}
                `}
              >
                <Widget
                  widgetConfig={widget}
                  isEditMode={isEditMode}
                  onEdit={handleEditWidget}
                  onDelete={handleDeleteWidget}
                  {...props}
                />
              </div>
            )
        })}
      </div>
      
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Adicionar Novo Widget">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WIDGET_LIBRARY.map(item => (
                  <div key={item.type} onClick={() => handleAddWidget(item.type, item.defaultCofig)} className="p-4 border rounded-lg hover:bg-autro-blue-light hover:border-autro-blue cursor-pointer transition-colors">
                      <h4 className="font-semibold text-black">{item.name}</h4>
                  </div>
              ))}
              <div onClick={() => handleAddWidget('alerts', {title: 'Alertas'})} className="p-4 border rounded-lg hover:bg-autro-blue-light hover:border-autro-blue cursor-pointer transition-colors">
                  <h4 className="font-semibold text-black">Lista de Alertas</h4>
              </div>
               <div onClick={() => handleAddWidget('topComponents', {title: 'Top Componentes'})} className="p-4 border rounded-lg hover:bg-autro-blue-light hover:border-autro-blue cursor-pointer transition-colors">
                  <h4 className="font-semibold text-black">Lista de Top Componentes</h4>
              </div>
          </div>
      </Modal>

      {isConfigModalOpen && editingWidget && (
          <WidgetConfigModal
            isOpen={isConfigModalOpen}
            onClose={() => setIsConfigModalOpen(false)}
            onSave={handleSaveWidgetConfig}
            widget={editingWidget}
          />
      )}
    </div>
  );
};
