
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { InventoryHook, ManufacturingHook, ProductionScenario, ProductionOrderItem, Kit, View, Component, ProductionOrdersHook, CuttingOrdersHook, ManufacturingOrdersHook, PurchaseOrdersHook, CustomersHook } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { AnalysisResultModal } from './AnalysisResultModal';
import { useFinancials } from '../contexts/FinancialsContext';
import { useCustomers } from '../hooks/useCustomers';

export const AssemblyView: React.FC<AssemblyViewProps> = ({ inventory, manufacturing, productionOrdersHook, cuttingOrdersHook, manufacturingOrdersHook, purchaseOrdersHook, setCurrentView }) => {
  const { kits, analyzeProductionRun, findKitById, components } = inventory;
  const { familias, getAllUniqueHeadCodes } = manufacturing;
  const { addProductionOrder } = productionOrdersHook;
  const customersHook = useCustomers();
  const { addToast } = useToast();
  const { settings: financialSettings } = useFinancials();
  
  const [order, setOrder] = useState<{ kits: ProductionOrderItem[]; miscItems: { componentId: string, quantity: number }[]; }>({ kits: [], miscItems: [] });
  const [filters, setFilters] = useState({ brand: '', model: '' });
  const [analysisModalData, setAnalysisModalData] = useState<{ scenarios: ProductionScenario[], virtualComponents: Component[] } | null>(null);
  const [selectedHeadCode, setSelectedHeadCode] = useState<string>('');
  const [libraryTab, setLibraryTab] = useState<'kits' | 'misc'>('kits');

  // Novos campos de identificação (Igual ao Importar Pedido)
  const [customerId, setCustomerId] = useState<string>('');
  const [externalOrderId, setExternalOrderId] = useState<string>('');

  const allHeadCodes = useMemo(() => getAllUniqueHeadCodes(), [getAllUniqueHeadCodes]);

  const filteredKits = useMemo(() => {
    return kits.filter(kit =>
        (!filters.brand || kit.marca === filters.brand) &&
        (!filters.model || kit.modelo === filters.model)
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [kits, filters]);

  const handleAddComponent = (kit: Kit) => {
    setOrder(prev => {
        const existing = prev.kits.find(item => item.kitId === kit.id);
        if (existing) return { ...prev, kits: prev.kits.map(i => i.kitId === kit.id ? { ...i, quantity: i.quantity + 1 } : i)};
        return { ...prev, kits: [...prev.kits, { kitId: kit.id, quantity: 1 }]};
    });
  };

  const handleCheckViability = () => {
      if (order.kits.length === 0 && order.miscItems.length === 0) return addToast("Adicione itens ao plano.", 'info');
      const result = analyzeProductionRun(order.kits, order.miscItems, familias, inventory.components, financialSettings!, selectedHeadCode || undefined);
      setAnalysisModalData(result);
  };

  const totalItemsInPlan = order.kits.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col font-sans max-w-[1600px] mx-auto">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Workshop de Montagem</h2>
                <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Planejamento de Lotes e Check de Viabilidade</p>
            </div>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setOrder({ kits: [], miscItems: [] }); setCustomerId(''); setExternalOrderId(''); }} disabled={totalItemsInPlan === 0} className="h-11 rounded-2xl uppercase font-black text-[10px]">Zerar Workshop</Button>
                <Button onClick={handleCheckViability} disabled={totalItemsInPlan === 0} className="h-11 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 border-none shadow-xl shadow-blue-500/20 uppercase font-black text-[10px]">Analisar Lote</Button>
            </div>
        </header>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
            {/* Coluna 1: Biblioteca de Seleção */}
            <Card className="lg:col-span-4 flex flex-col min-h-0 p-0 overflow-hidden border-2 border-slate-200">
                <div className="p-4 bg-slate-900 text-white flex gap-2">
                    <button onClick={() => setLibraryTab('kits')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${libraryTab === 'kits' ? 'bg-white text-slate-900' : 'text-white/40 hover:text-white'}`}>Kits Disponíveis</button>
                    <button onClick={() => setLibraryTab('misc')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${libraryTab === 'misc' ? 'bg-white text-slate-900' : 'text-white/40 hover:text-white'}`}>Insumos Avulsos</button>
                </div>
                
                <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                    <Select value={filters.brand} onChange={e => setFilters({...filters, brand: e.target.value, model: ''})} className="h-10 text-xs">
                        <option value="">Todas as Marcas</option>
                        {[...new Set(kits.map(k => k.marca))].sort().map(b => <option key={b} value={b}>{b}</option>)}
                    </Select>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-white">
                    {filteredKits.map(kit => (
                        <div key={kit.id} onClick={() => handleAddComponent(kit)} className="p-3 border border-slate-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all flex justify-between items-center group">
                            <div className="min-w-0">
                                <p className="font-black text-slate-800 text-sm truncate uppercase">{kit.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{kit.marca} / {kit.modelo}</p>
                            </div>
                            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">+</span>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Coluna 2: Workshop / Build Queue */}
            <Card className="lg:col-span-8 flex flex-col min-h-0 p-0 overflow-hidden border-4 border-slate-900 shadow-2xl relative">
                {/* Header do Workshop com Dados do Pedido */}
                <div className="p-6 bg-slate-900 text-white border-b border-white/10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex-grow w-full md:w-auto">
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Configuração do Lote</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select 
                                    label="Cliente Destinatário" 
                                    value={customerId} 
                                    onChange={e => setCustomerId(e.target.value)}
                                    className="!bg-white/10 !text-white !border-white/20 !h-11 text-xs"
                                >
                                    <option value="" className="text-slate-900">Venda Balcão / Sem Cliente</option>
                                    {customersHook.customers.map(c => (
                                        <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                                    ))}
                                </Select>
                                <Input 
                                    label="Nº do Pedido Externo" 
                                    value={externalOrderId} 
                                    onChange={e => setExternalOrderId(e.target.value)}
                                    placeholder="Ex: 450098..."
                                    className="!bg-white/10 !text-white !border-white/20 !h-11 !placeholder-white/30 font-bold"
                                />
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                             <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">Fixador Preferencial</span>
                             <Select value={selectedHeadCode} onChange={(e) => setSelectedHeadCode(e.target.value)} className="!bg-white/10 !text-white !border-white/20 !h-9 text-[10px] !py-0 w-40">
                                <option value="" className="text-slate-900">Simular Melhores</option>
                                {allHeadCodes.map(code => (<option key={code} value={code} className="text-slate-900">{code}</option>))}
                             </Select>
                        </div>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-8 space-y-4 bg-slate-50/50 shadow-inner">
                    {order.kits.length === 0 && order.miscItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                            <svg className="w-24 h-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            <p className="text-sm font-black uppercase tracking-widest">Workshop Vazio</p>
                        </div>
                    ) : (
                        order.kits.map((item) => {
                            const kit = findKitById(item.kitId);
                            return (
                                <div key={item.kitId} className="flex items-center gap-4 animate-fade-in">
                                    <div className="flex-grow p-5 bg-white rounded-3xl border-2 border-slate-200 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-slate-900 text-lg uppercase leading-tight">{kit?.name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Kit Montagem • SKU: {kit?.sku}</p>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                                <button onClick={() => {
                                                    setOrder(prev => ({...prev, kits: prev.kits.map(i => i.kitId === item.kitId ? {...i, quantity: Math.max(1, i.quantity - 1)} : i)}));
                                                }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-sm hover:bg-slate-50 transition-colors">-</button>
                                                <span className="text-xl font-black w-12 text-center text-slate-900">{item.quantity}</span>
                                                <button onClick={() => {
                                                    setOrder(prev => ({...prev, kits: prev.kits.map(i => i.kitId === item.kitId ? {...i, quantity: i.quantity + 1} : i)}));
                                                }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-sm hover:bg-slate-50 transition-colors">+</button>
                                            </div>
                                            <button onClick={() => setOrder(prev => ({...prev, kits: prev.kits.filter(i => i.kitId !== item.kitId)}))} className="text-rose-300 hover:text-rose-600 transition-colors">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
        </div>

        {analysisModalData && (
            <AnalysisResultModal 
                isOpen={!!analysisModalData}
                onClose={() => setAnalysisModalData(null)}
                scenarios={analysisModalData.scenarios}
                onCreateOrder={async (scenario) => {
                    const notes = `Criada via Workshop de Montagem.${externalOrderId ? `\nPedido Externo: ${externalOrderId}` : ''}`;
                    const newOrderId = await addProductionOrder({ 
                        orderItems: order.kits, 
                        selectedScenario: scenario, 
                        virtualComponents: analysisModalData.virtualComponents, 
                        notes: notes,
                        customerId: customerId || undefined,
                        scannedItems: {},
                        substitutions: {},
                        installments: []
                    });
                    if (newOrderId) {
                        addToast(`Ordem ${newOrderId} gerada.`, 'success');
                        setOrder({ kits: [], miscItems: [] });
                        setCustomerId('');
                        setExternalOrderId('');
                        setAnalysisModalData(null);
                    }
                }}
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

interface AssemblyViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    setCurrentView: (view: View) => void;
}
