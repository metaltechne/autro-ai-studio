import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { InventoryHook, ManufacturingHook, ProductionScenario, ProductionOrderItem, Kit, View, Component, ProductionOrdersHook, CuttingOrdersHook, ManufacturingOrdersHook } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { AnalysisResultModal } from './AnalysisResultModal';
import { useFinancials } from '../contexts/FinancialsContext';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface FleetPlannerViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    setCurrentView: (view: View) => void;
    createAndStockComponent: InventoryHook['createAndStockComponent'];
}

type MobileView = 'plan' | 'add';
type LibraryTab = 'kits' | 'misc';

const LOCAL_STORAGE_KEY = 'autro_fleetPlanner_draftOrder';

export const FleetPlannerView: React.FC<FleetPlannerViewProps> = ({ inventory, manufacturing, productionOrdersHook, cuttingOrdersHook, manufacturingOrdersHook, setCurrentView, createAndStockComponent }) => {
  const { kits, analyzeProductionRun, findKitById, findComponentBySku, findComponentById, components } = inventory;
  const { familias, getAllUniqueHeadCodes } = manufacturing;
  const { addProductionOrder } = productionOrdersHook;
  const { addToast } = useToast();
  const { settings: financialSettings } = useFinancials();
  
  const [order, setOrder] = useState<{
      kits: ProductionOrderItem[];
      miscItems: { componentId: string, quantity: number }[];
  }>({ kits: [], miscItems: [] });

  const [filters, setFilters] = useState({ brand: '', model: '', year: '' });
  const [analysisModalData, setAnalysisModalData] = useState<{ scenarios: ProductionScenario[], virtualComponents: Component[] } | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
  const [selectedHeadCode, setSelectedHeadCode] = useState<string>('');

  const [miscItemFilter, setMiscItemFilter] = useState('');
  const [newMiscComponentId, setNewMiscComponentId] = useState('');
  const [newMiscQuantity, setNewMiscQuantity] = useState(1);


  // Mobile-specific states
  const [mobileView, setMobileView] = useState<MobileView>('plan');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('kits');
  
    // Load state from localStorage on mount
  useEffect(() => {
    try {
        const savedOrder = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedOrder) {
            const parsedOrder = JSON.parse(savedOrder);
            // Basic validation to ensure it's not malformed
            if (parsedOrder && Array.isArray(parsedOrder.kits) && Array.isArray(parsedOrder.miscItems)) {
                 setOrder(parsedOrder);
            }
        }
    } catch (error) {
        console.error("Failed to load fleet planner state from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Save state to localStorage on change
  useEffect(() => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const allHeadCodes = useMemo(() => getAllUniqueHeadCodes(), [getAllUniqueHeadCodes]);

  const filterOptions = useMemo(() => {
    const brands = new Set<string>();
    kits.forEach(k => brands.add(k.marca));

    let relevantKits = kits;
    if (filters.brand) {
        relevantKits = relevantKits.filter(k => k.marca === filters.brand);
    }
    const models = new Set(relevantKits.map(k => k.modelo));
    
    if (filters.model) {
        relevantKits = relevantKits.filter(k => k.modelo === filters.model);
    }
    const years = new Set(relevantKits.map(k => k.ano));

    return {
      brands: Array.from(brands).sort(),
      models: Array.from(models).sort(),
      years: Array.from(years).sort(),
    };
  }, [kits, filters.brand, filters.model]);

  const availableKitsForSelection = useMemo(() => {
    return kits.filter(kit =>
        (!filters.brand || kit.marca === filters.brand) &&
        (!filters.model || kit.modelo === filters.model) &&
        (!filters.year || kit.ano === filters.year)
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [kits, filters]);

  const availableMiscItems = useMemo(() => {
      const lowerFilter = miscItemFilter.toLowerCase();
      return components.filter(c =>
          !miscItemFilter ||
          (c.name || '').toLowerCase().includes(lowerFilter) ||
          (c.sku || '').toLowerCase().includes(lowerFilter)
      );
  }, [components, miscItemFilter]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => {
        const newFilters = {...prev, [name]: value};
        if(name === 'brand') { newFilters.model = ''; newFilters.year = ''; }
        if(name === 'model') { newFilters.year = ''; }
        return newFilters;
    });
  };
  
  const handleAddComponent = (kit: Kit) => {
    setOrderCreatedId(null);
    setOrder(prevOrder => {
        const existingItem = prevOrder.kits.find(item => item.kitId === kit.id);
        if (existingItem) {
            return { ...prevOrder, kits: prevOrder.kits.map(item => item.kitId === kit.id ? { ...item, quantity: item.quantity + 1 } : item)};
        }
        return { ...prevOrder, kits: [...prevOrder.kits, { kitId: kit.id, quantity: 1 }]};
    });
  };

  const handleAddAllFromFleet = useCallback(() => {
    if (availableKitsForSelection.length === 0) {
        addToast("Nenhum kit para adicionar para a seleção atual.", 'info');
        return;
    }
    setOrderCreatedId(null);
    setOrder(prevOrder => {
        const newKitsMap = new Map<string, ProductionOrderItem>();
        prevOrder.kits.forEach(item => newKitsMap.set(item.kitId, { ...item }));

        availableKitsForSelection.forEach(kitToAdd => {
            const existingItem = newKitsMap.get(kitToAdd.id);
            if (existingItem) {
                newKitsMap.set(kitToAdd.id, { ...existingItem, quantity: existingItem.quantity + 1 });
            } else {
                newKitsMap.set(kitToAdd.id, { kitId: kitToAdd.id, quantity: 1 });
            }
        });

        return { ...prevOrder, kits: Array.from(newKitsMap.values()) };
    });

    addToast(`${availableKitsForSelection.length} kits adicionados/incrementados no plano.`, 'success');
  }, [availableKitsForSelection, addToast]);
  
  const handleKitQuantityChange = (kitId: string, quantity: number) => {
    setOrderCreatedId(null);
    setOrder(prevOrder => ({
        ...prevOrder,
        kits: prevOrder.kits.map(item => 
            item.kitId === kitId ? { ...item, quantity: Math.max(1, quantity) } : item
        )
    }));
  };

  const handleRemoveKitFromOrder = (kitIdToRemove: string) => {
      setOrderCreatedId(null);
      setOrder(prevOrder => ({
          ...prevOrder,
          kits: prevOrder.kits.filter(item => item.kitId !== kitIdToRemove)
      }));
  }

  const handleAddMiscItem = () => {
      if (!newMiscComponentId || newMiscQuantity <= 0) {
          addToast("Selecione um item e a quantidade.", 'info');
          return;
      }
      setOrderCreatedId(null);
      setOrder(prev => {
          const existing = prev.miscItems.find(i => i.componentId === newMiscComponentId);
          if (existing) {
              return { ...prev, miscItems: prev.miscItems.map((i: { componentId: string; quantity: number; }) => i.componentId === newMiscComponentId ? { ...i, quantity: i.quantity + newMiscQuantity } : i) };
          }
          return { ...prev, miscItems: [...prev.miscItems, { componentId: newMiscComponentId, quantity: newMiscQuantity }] };
      });
      setNewMiscComponentId('');
      setNewMiscQuantity(1);
      setMiscItemFilter('');
  };

  const handleMiscQuantityChange = (componentId: string, quantity: number) => {
      setOrderCreatedId(null);
      setOrder(prev => ({
          ...prev,
          miscItems: prev.miscItems.map((i: { componentId: string; quantity: number; }) => i.componentId === componentId ? { ...i, quantity: Math.max(1, quantity) } : i)
      }));
  };

  const handleRemoveMiscItem = (componentId: string) => {
      setOrderCreatedId(null);
      setOrder(prev => ({
          ...prev,
          miscItems: prev.miscItems.filter(i => i.componentId !== componentId)
      }));
  };

  const handleCheckViability = () => {
      if (!financialSettings) {
        addToast("Configurações financeiras não carregadas. Não é possível analisar.", 'error');
        return;
      }
      if (order.kits.length > 0 || order.miscItems.length > 0) {
        const result = analyzeProductionRun(order.kits, order.miscItems, familias, inventory.components, financialSettings, selectedHeadCode || undefined);
        setAnalysisModalData(result);
      } else {
        addToast("Adicione itens al plano para analisar.", 'info');
      }
  };
  
  const handleCreateProductionOrder = async (scenario: ProductionScenario) => {
    if (!analysisModalData) return;
    setIsCreatingOrder(true);
    const miscItemsNotes = order.miscItems.map((item: { componentId: string; quantity: number; }) => { const comp = findComponentById(item.componentId); return `${item.quantity}x ${comp?.name || 'Item desconhecido'} (SKU: ${comp?.sku || 'N/A'})`; }).join('\n');
    
    // Create virtual components in DB if they don't exist
    for (const vc of analysisModalData.virtualComponents) {
        const existing = inventory.findComponentBySku(vc.sku);
        if (!existing) {
            await inventory.addComponent({
                name: vc.name,
                sku: vc.sku,
                type: 'component',
                sourcing: vc.sourcing || 'manufactured',
                familiaId: vc.familiaId,
                custoFabricacao: vc.custoFabricacao || 0,
                custoMateriaPrima: vc.custoMateriaPrima || 0,
            });
        }
    }

    const newOrderId = await addProductionOrder({ 
        orderItems: order.kits, 
        selectedScenario: scenario, 
        virtualComponents: analysisModalData.virtualComponents, 
        notes: miscItemsNotes,
        scannedItems: {},
        substitutions: {},
        installments: []
    });
    setIsCreatingOrder(false);
    if (newOrderId) {
        setOrderCreatedId(newOrderId);
        addToast(`Ordem de Produção ${newOrderId} criada!`, 'success');
        setOrder({ kits: [], miscItems: [] }); 
    } else { addToast("Falha ao criar a ordem de produção.", 'error'); }
    setAnalysisModalData(null);
  };

  const totalItemsInPlan = order.kits.reduce((sum, item) => sum + item.quantity, 0) + order.miscItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const LibraryPanel: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
    const KitsContent = (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-col gap-4">
                <Select label="Marca" name="brand" value={filters.brand} onChange={handleFilterChange}><option value="">Todas</option>{filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}</Select>
                <Select label="Modelo" name="model" value={filters.model} onChange={handleFilterChange} disabled={!filters.brand}><option value="">Todos</option>{filterOptions.models.map(m => <option key={m} value={m}>{m}</option>)}</Select>
                <Select label="Ano" name="year" value={filters.year} onChange={handleFilterChange} disabled={!filters.model}><option value="">Todos</option>{filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}</Select>
            </div>
            <Button onClick={handleAddAllFromFleet} disabled={!filters.brand || !filters.model} className="w-full" variant="secondary">Adicionar Todos da Frota</Button>
            <div className="flex-grow overflow-y-auto space-y-2 min-h-0">
                {availableKitsForSelection.map(kit => (
                    <div key={kit.id} className="p-2 border rounded-md bg-white hover:bg-gray-50 flex items-center justify-between gap-2 touch-pan-y">
                        <div className="flex-grow min-w-0"><p className="font-semibold text-sm text-black leading-tight">{kit.name}</p><p className="text-xs text-gray-500 mt-1">{kit.modelo} ({kit.ano})</p></div>
                        <Button size="sm" variant="secondary" className="!px-2.5 flex-shrink-0" onClick={() => handleAddComponent(kit)} title="Adicionar ao plano">+</Button>
                    </div>
                ))}
            </div>
        </div>
    );

    const MiscContent = (
         <div className="flex flex-col gap-3">
            <Input placeholder="Filtrar por nome/SKU..." value={miscItemFilter} onChange={e => setMiscItemFilter(e.target.value)} />
            <Select value={newMiscComponentId} onChange={e => setNewMiscComponentId(e.target.value)}>
                <option value="">Selecione um item...</option>
                {availableMiscItems.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>)}
            </Select>
            <div className="flex items-end gap-2">
                <Input label="Qtd." type="number" min="1" value={newMiscQuantity} onChange={e => setNewMiscQuantity(parseInt(e.target.value))} className="w-24" />
                <Button onClick={handleAddMiscItem} className="flex-grow">Adicionar Item</Button>
            </div>
        </div>
    );

    return (
        <Card className="flex flex-col overflow-hidden h-full">
            {isMobile ? (
                <>
                    <div className="flex border-b mb-4 flex-shrink-0">
                        <button onClick={() => setLibraryTab('kits')} className={`flex-1 py-2 text-center font-semibold ${libraryTab === 'kits' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500'}`}>Kits</button>
                        <button onClick={() => setLibraryTab('misc')} className={`flex-1 py-2 text-center font-semibold ${libraryTab === 'misc' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500'}`}>Itens Avulsos</button>
                    </div>
                    <div className="flex-grow overflow-hidden -mr-2 pr-2">
                        {libraryTab === 'kits' && <div className="h-full overflow-y-auto">{KitsContent}</div>}
                        {libraryTab === 'misc' && MiscContent}
                    </div>
                </>
            ) : (
                <>
                    <h3 className="text-lg font-semibold text-black mb-4 flex-shrink-0">Biblioteca</h3>
                    <div className="flex-grow overflow-y-auto -mr-2 pr-2 space-y-4">
                        <div>
                            <h4 className="font-semibold text-sm text-black mb-2 border-b pb-2">Kits</h4>
                            {KitsContent}
                        </div>
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm text-black mb-2 border-b pb-2">Acessórios Adicionais</h4>
                            {MiscContent}
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
  };

  const PlanAndAnalysisPanel = () => {
    return (
        <Card className="lg:col-span-2 flex flex-col overflow-hidden h-full">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-black">Plano de Montagem ({totalItemsInPlan} itens)</h3>
                <Button onClick={() => setOrder({ kits: [], miscItems: [] })} variant="danger" size="sm" disabled={totalItemsInPlan === 0}>Limpar Plano</Button>
            </div>
            <div className="flex-grow flex flex-col min-h-0">
                <div className="flex-grow border-2 border-dashed rounded-lg transition-colors overflow-y-auto p-4 space-y-3 mb-4 border-gray-300">
                    {order.kits.length + order.miscItems.length === 0 ? <div className="h-full flex items-center justify-center text-center text-gray-500"><p>Adicione kits ou itens para começar</p></div> : 
                    <>
                         {order.kits.map((item: ProductionOrderItem) => {
                            const kit = findKitById(item.kitId); if (!kit) return null;
                            return (<div key={item.kitId} className="p-3 bg-white rounded-md shadow-sm border flex justify-between items-center gap-4">
                                <div><p className="font-semibold text-black">{kit.name} <span className="text-xs font-normal text-gray-500">[KIT]</span></p><p className="text-sm text-gray-500">{kit.marca || 'Sem Marca'} {kit.modelo || 'N/A'}</p></div>
                                <div className="flex items-center gap-2"><Input type="number" value={item.quantity} onChange={(e) => handleKitQuantityChange(item.kitId, parseInt(e.target.value) || 1)} min="1" className="w-20 text-center" /><Button variant="danger" size="sm" onClick={() => handleRemoveKitFromOrder(item.kitId)} className="!p-2" title="Remover">X</Button></div>
                            </div>)
                        })}
                        {order.miscItems.map((item: { componentId: string, quantity: number }) => {
                            const component = findComponentById(item.componentId); if (!component) return null;
                             return (<div key={item.componentId} className="p-3 bg-white rounded-md shadow-sm border flex justify-between items-center gap-4">
                                <div><p className="font-semibold text-black">{component.name} <span className="text-xs font-normal text-gray-500">[AVULSO]</span></p><p className="text-sm text-gray-500">{component.sku}</p></div>
                                <div className="flex items-center gap-2"><Input type="number" value={item.quantity} onChange={(e) => handleMiscQuantityChange(item.componentId, parseInt(e.target.value) || 1)} min="1" className="w-20 text-center" /><Button variant="danger" size="sm" onClick={() => handleRemoveMiscItem(item.componentId)} className="!p-2" title="Remover">X</Button></div>
                            </div>)
                        })}
                    </>}
                </div>

                <div className="border-t pt-4 space-y-3 flex-shrink-0">
                    <Select label="Código de Fixador (Opcional)" value={selectedHeadCode} onChange={(e) => setSelectedHeadCode(e.target.value)}><option value="">Simular Todos</option>{allHeadCodes.map(code => (<option key={code} value={code}>{code}</option>))}</Select>
                     <Button onClick={handleCheckViability} disabled={totalItemsInPlan === 0} className="w-full">Verificar Viabilidade</Button>
                     {orderCreatedId && <div className="mt-2 text-center text-green-700 font-semibold p-3 rounded-md bg-green-50 border border-green-200">Ordem {orderCreatedId} criada!</div>}
                </div>
            </div>
        </Card>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
        <header className="mb-6 print-hide flex-shrink-0">
            <h2 className="text-3xl font-bold text-black">Planejador de Montagem</h2>
            <p className="text-gray-500 mt-1">Adicione kits e itens avulsos para analisar a viabilidade e gerar Ordens de Produção.</p>
        </header>

        <div className="hidden lg:grid flex-grow grid-cols-3 gap-6 min-h-0">
            <LibraryPanel />
            <PlanAndAnalysisPanel />
        </div>

        <div className="lg:hidden flex-grow flex flex-col min-h-0 relative">
            {mobileView === 'plan' && <div className="flex-grow min-h-0"><PlanAndAnalysisPanel /></div>}
            {mobileView === 'add' && <div className="flex-grow min-h-0"><LibraryPanel isMobile={true} /></div>}
            
            <div className="absolute bottom-24 right-4 flex flex-col items-end gap-3 z-10">
                 {mobileView === 'plan' ? (
                     <Button onClick={() => setMobileView('add')} title="Adicionar Itens" className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </Button>
                ) : (
                     <Button onClick={() => setMobileView('plan')} className="w-auto px-4 h-14 rounded-full shadow-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Ver Plano ({totalItemsInPlan})
                    </Button>
                )}
            </div>
        </div>

        {analysisModalData && (
            <AnalysisResultModal 
                isOpen={!!analysisModalData}
                onClose={() => setAnalysisModalData(null)}
                scenarios={analysisModalData.scenarios}
                onCreateOrder={handleCreateProductionOrder}
                inventory={inventory}
                manufacturing={manufacturing}
                cuttingOrdersHook={cuttingOrdersHook}
                manufacturingOrdersHook={manufacturingOrdersHook}
                productionOrdersHook={productionOrdersHook}
            />
        )}
    </div>
  );
};
