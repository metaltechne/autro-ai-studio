
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { InventoryHook, ManufacturingHook, ProductionScenario, ProductionOrderItem, Kit, View, Component, ProductionOrdersHook, CuttingOrdersHook, ManufacturingOrdersHook, PurchaseOrdersHook, CustomersHook, ProductionScenarioShortage, ManufacturingAnalysis, PurchaseRecommendation } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { AnalysisResultModal } from './AnalysisResultModal';
import { useFinancials } from '../contexts/FinancialsContext';
import { useCustomers } from '../hooks/useCustomers';
import { UserPlus, X, Check } from 'lucide-react';

export const AssemblyView: React.FC<AssemblyViewProps> = ({ inventory, manufacturing, productionOrdersHook, cuttingOrdersHook, manufacturingOrdersHook, purchaseOrdersHook, setCurrentView }) => {
  const { kits, analyzeProductionRun, findKitById, components } = inventory;
  const { familias, getAllUniqueHeadCodes, workStations, standardOperations, consumables } = manufacturing;
  const { addProductionOrder } = productionOrdersHook;
  const customersHook = useCustomers();
  const { addToast } = useToast();
  const { settings: financialSettings } = useFinancials();
  
  const [step, setStep] = useState<'selection' | 'review'>('selection');
  const [selectedKitForDetail, setSelectedKitForDetail] = useState<Kit | null>(null);
  const [order, setOrder] = useState<{ kits: ProductionOrderItem[]; miscItems: ProductionOrderItem[]; }>({ kits: [], miscItems: [] });
  const [filters, setFilters] = useState({ brand: '', model: '', search: '' });
  const [analysisModalData, setAnalysisModalData] = useState<{ scenarios: ProductionScenario[], virtualComponents: Component[] } | null>(null);
  const [selectedHeadCode, setSelectedHeadCode] = useState<string>('');
  const [libraryTab, setLibraryTab] = useState<'kits' | 'misc' | 'keys'>('kits');

  // Novos campos de identificação (Igual ao Importar Pedido)
  const [customerId, setCustomerId] = useState<string>('');
  const [externalOrderId, setExternalOrderId] = useState<string>('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const handleSaveCustomer = async () => {
    if (!newCustomerName.trim()) return;
    const client = await customersHook.addCustomer({ 
        name: newCustomerName,
        email: '',
        phone: '',
        address: ''
    });
    if (client) {
        setCustomerId(client.id);
        setIsAddingCustomer(false);
        setNewCustomerName('');
    }
  };

  const allHeadCodes = useMemo(() => getAllUniqueHeadCodes(), [getAllUniqueHeadCodes]);

  const filteredKits = useMemo(() => {
    return kits.filter(kit => {
        const matchesBrand = !filters.brand || kit.marca === filters.brand;
        const matchesModel = !filters.model || kit.modelo === filters.model;
        const matchesSearch = !filters.search || 
            (kit.name || '').toLowerCase().includes(filters.search.toLowerCase()) || 
            (kit.sku || '').toLowerCase().includes(filters.search.toLowerCase());
        return matchesBrand && matchesModel && matchesSearch;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [kits, filters]);

  const filteredComponents = useMemo(() => {
    return components.filter(comp => {
        const matchesSearch = !filters.search || 
            (comp.name || '').toLowerCase().includes(filters.search.toLowerCase()) || 
            (comp.sku || '').toLowerCase().includes(filters.search.toLowerCase());
        return matchesSearch;
    }).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [components, filters]);

  const filteredKeys = useMemo(() => {
    return components.filter(comp => {
        const isKey = comp.familiaId?.startsWith('fam-chave') || comp.sku.startsWith('CHAVE-');
        const matchesSearch = !filters.search || 
            (comp.name || '').toLowerCase().includes(filters.search.toLowerCase()) || 
            (comp.sku || '').toLowerCase().includes(filters.search.toLowerCase());
        return isKey && matchesSearch;
    }).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [components, filters]);

  const handleAddItem = (item: Kit | Component, type: 'kit' | 'component', quantity: number = 1, variant: 'Padrão' | 'Fix-S' | 'Fix-P' = 'Padrão') => {
    const listKey = type === 'kit' ? 'kits' : 'miscItems';
    setOrder(prev => {
        const existing = prev[listKey].find(i => i.id === item.id && i.variant === variant && i.type === type);
        if (existing) return { ...prev, [listKey]: prev[listKey].map(i => (i.id === item.id && i.variant === variant && i.type === type) ? { ...i, quantity: i.quantity + quantity } : i)};
        return { ...prev, [listKey]: [...prev[listKey], { id: item.id, type, quantity, variant }]};
    });
    addToast(`${item.name} adicionado ao lote.`, 'info');
  };

  const handleCheckViability = () => {
      if (order.kits.length === 0 && order.miscItems.length === 0) return addToast("Adicione itens ao plano.", 'info');
      const miscItemsFormatted = order.miscItems.map(i => ({ componentId: i.id, quantity: i.quantity }));
      const result = analyzeProductionRun(order.kits, miscItemsFormatted, familias, inventory.components, financialSettings!, selectedHeadCode || undefined, {
          workStations,
          operations: standardOperations,
          consumables
      });
      setAnalysisModalData(result);
  };

  const totalItemsInPlan = order.kits.reduce((sum, item) => sum + item.quantity, 0) + order.miscItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col font-sans max-w-[1600px] mx-auto p-2 sm:p-4 overflow-hidden">
        <header className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div className="flex items-center gap-4">
                {step === 'review' && (
                    <button 
                        onClick={() => setStep('selection')}
                        className="p-3 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200"
                    >
                        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Workshop</h2>
                    <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em] mt-1">
                        {step === 'selection' ? 'Passo 1: Seleção de Itens' : 'Passo 2: Revisão e Dados do Pedido'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                {step === 'selection' ? (
                    <Button 
                        onClick={() => setStep('review')} 
                        disabled={totalItemsInPlan === 0}
                        className="w-full md:w-auto h-12 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl uppercase font-black text-xs flex items-center justify-center gap-2"
                    >
                        Revisar Lote ({totalItemsInPlan})
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                    </Button>
                ) : (
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="secondary" onClick={() => { setOrder({ kits: [], miscItems: [] }); setCustomerId(''); setExternalOrderId(''); setStep('selection'); }} className="flex-1 md:flex-none h-12 rounded-2xl uppercase font-black text-xs">Limpar</Button>
                        <Button onClick={handleCheckViability} className="flex-1 md:flex-none h-12 px-10 rounded-2xl bg-blue-600 hover:bg-blue-500 border-none shadow-xl shadow-blue-500/20 uppercase font-black text-xs">Analisar Viabilidade</Button>
                    </div>
                )}
            </div>
        </header>

        <div className="flex-grow min-h-0 relative">
            {step === 'selection' ? (
                <div className="h-full flex flex-col animate-fade-in">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-4 self-start">
                        <button 
                            onClick={() => setLibraryTab('kits')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${libraryTab === 'kits' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Kits
                        </button>
                        <button 
                            onClick={() => setLibraryTab('keys')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${libraryTab === 'keys' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Chaves
                        </button>
                        <button 
                            onClick={() => setLibraryTab('misc')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${libraryTab === 'misc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Componentes
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 shrink-0">
                        <div className="md:col-span-6 lg:col-span-8 relative">
                            <Input 
                                placeholder="Buscar por nome ou SKU..." 
                                value={filters.search} 
                                onChange={e => setFilters({...filters, search: e.target.value})}
                                className="h-11 text-sm pl-11 pr-10 rounded-xl border-2 border-slate-200 focus:border-blue-500"
                            />
                            <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {filters.search && (
                                <button onClick={() => setFilters({...filters, search: ''})} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="md:col-span-6 lg:col-span-4 flex gap-2">
                            <Select value={filters.brand} onChange={e => setFilters({...filters, brand: e.target.value})} className="flex-1 h-11 text-sm rounded-xl border-2 border-slate-200">
                                <option value="">Todas as Marcas</option>
                                {[...new Set(kits.map(k => k.marca))].sort().map(b => <option key={b} value={b}>{b}</option>)}
                            </Select>
                            <div className="bg-slate-100 px-4 flex items-center justify-center rounded-xl text-xs font-black text-slate-500 border-2 border-slate-200">
                                {filteredKits.length}
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        {libraryTab === 'kits' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-10">
                                {filteredKits.map(kit => {
                                    const quantityInWorkshop = order.kits.find(item => item.id === kit.id)?.quantity || 0;
                                    return (
                                        <div 
                                            key={kit.id} 
                                            className={`p-4 border-2 rounded-2xl transition-all flex flex-col justify-between group shadow-sm relative overflow-hidden min-h-[180px] ${
                                                quantityInWorkshop > 0 
                                                    ? 'border-blue-500 bg-blue-50/30 ring-4 ring-blue-500/5' 
                                                    : 'border-slate-100 bg-white hover:border-blue-300 hover:shadow-xl'
                                            }`}
                                        >
                                            {quantityInWorkshop > 0 && (
                                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl shadow-sm z-10">
                                                    {quantityInWorkshop} NO LOTE
                                                </div>
                                            )}
                                            
                                            <div className="cursor-pointer" onClick={() => setSelectedKitForDetail(kit)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-blue-200">
                                                        {kit.sku}
                                                    </span>
                                                </div>
                                                <p className="font-black text-slate-900 text-sm uppercase leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                                                    {kit.name}
                                                </p>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011-1v5m-4 0h4" />
                                                    </svg>
                                                    {kit.marca || 'Sem Marca'}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                                                <button 
                                                    onClick={() => setSelectedKitForDetail(kit)}
                                                    className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest flex items-center gap-1"
                                                >
                                                    Ver Detalhes
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleAddItem(kit, 'kit'); }}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                                        quantityInWorkshop > 0 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-slate-900 text-white hover:bg-blue-600'
                                                    }`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : libraryTab === 'keys' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-10">
                                {filteredKeys.map(comp => {
                                    const quantityInWorkshop = order.miscItems.find(item => item.id === comp.id)?.quantity || 0;
                                    return (
                                        <div 
                                            key={comp.id} 
                                            className={`p-4 border-2 rounded-2xl transition-all flex flex-col justify-between group shadow-sm relative overflow-hidden min-h-[180px] ${
                                                quantityInWorkshop > 0 
                                                    ? 'border-blue-500 bg-blue-50/30 ring-4 ring-blue-500/5' 
                                                    : 'border-slate-100 bg-white hover:border-blue-300 hover:shadow-xl'
                                            }`}
                                        >
                                            {quantityInWorkshop > 0 && (
                                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl shadow-sm z-10">
                                                    {quantityInWorkshop} NO LOTE
                                                </div>
                                            )}
                                            
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-blue-200">
                                                        {comp.sku}
                                                    </span>
                                                </div>
                                                <p className="font-black text-slate-900 text-sm uppercase leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                                                    {comp.name}
                                                </p>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                    Ferramenta / Chave
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-end mt-4 pt-3 border-t border-slate-50">
                                                <button 
                                                    onClick={() => handleAddItem(comp, 'component')}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                                        quantityInWorkshop > 0 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-slate-900 text-white hover:bg-blue-600'
                                                    }`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-10">
                                {filteredComponents.map(comp => {
                                    const quantityInWorkshop = order.miscItems.find(item => item.id === comp.id)?.quantity || 0;
                                    return (
                                        <div 
                                            key={comp.id} 
                                            className={`p-4 border-2 rounded-2xl transition-all flex flex-col justify-between group shadow-sm relative overflow-hidden min-h-[180px] ${
                                                quantityInWorkshop > 0 
                                                    ? 'border-amber-500 bg-amber-50/30 ring-4 ring-amber-500/5' 
                                                    : 'border-slate-100 bg-white hover:border-amber-300 hover:shadow-xl'
                                            }`}
                                        >
                                            {quantityInWorkshop > 0 && (
                                                <div className="absolute top-0 right-0 bg-amber-600 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl shadow-sm z-10">
                                                    {quantityInWorkshop} NO LOTE
                                                </div>
                                            )}
                                            
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-200">
                                                        {comp.sku}
                                                    </span>
                                                </div>
                                                <p className="font-black text-slate-900 text-sm uppercase leading-tight mb-2 group-hover:text-amber-600 transition-colors">
                                                    {comp.name}
                                                </p>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                    {comp.type === 'raw_material' ? 'Matéria Prima' : 'Componente'}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-end mt-4 pt-3 border-t border-slate-50">
                                                <button 
                                                    onClick={() => handleAddItem(comp, 'component')}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                                        quantityInWorkshop > 0 
                                                            ? 'bg-amber-600 text-white' 
                                                            : 'bg-slate-900 text-white hover:bg-amber-600'
                                                    }`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in overflow-hidden">
                    {/* Painel de Dados do Pedido */}
                    <div className="lg:col-span-4 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                        <Card className="p-6 border-2 border-slate-900 bg-slate-900 text-white rounded-3xl shadow-2xl">
                            <h3 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Identificação
                            </h3>
                            <div className="space-y-4">
                                {isAddingCustomer ? (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Novo Cliente</span>
                                            <button onClick={() => setIsAddingCustomer(false)} className="text-white/40 hover:text-white transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-grow">
                                                <Input 
                                                    placeholder="Nome do cliente..." 
                                                    value={newCustomerName} 
                                                    onChange={e => setNewCustomerName(e.target.value)}
                                                    className="!bg-white !text-slate-900 !border-white !h-12 font-bold text-xs"
                                                    autoFocus
                                                />
                                            </div>
                                            <Button 
                                                onClick={handleSaveCustomer}
                                                disabled={!newCustomerName.trim()}
                                                className="!bg-blue-600 hover:!bg-blue-500 !text-white h-12 w-12 p-0 flex items-center justify-center rounded-xl border-none shadow-lg shadow-blue-600/30"
                                            >
                                                <Check className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <div className="flex justify-between items-center mb-1.5 px-1">
                                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Cliente</label>
                                            <button 
                                                onClick={() => setIsAddingCustomer(true)} 
                                                className="text-[9px] font-black text-blue-400 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                                            >
                                                <UserPlus className="w-3 h-3" />
                                                Novo
                                            </button>
                                        </div>
                                        <Select 
                                            value={customerId} 
                                            onChange={e => setCustomerId(e.target.value)}
                                            className="!bg-white !text-slate-900 !border-white !h-12 text-xs font-bold"
                                        >
                                            <option value="" className="text-slate-900">Sem Cliente</option>
                                            {customersHook.customers.map(c => (
                                                <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                                <Input 
                                    label="Pedido Externo" 
                                    value={externalOrderId} 
                                    onChange={e => setExternalOrderId(e.target.value)}
                                    placeholder="Ex: 450098..."
                                    className="!bg-white !text-slate-900 !border-white !h-12 !placeholder-slate-400 font-bold text-xs"
                                />
                            </div>
                        </Card>

                        <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl">
                            <h4 className="font-black text-blue-900 uppercase text-[10px] mb-4 tracking-widest">Resumo do Lote</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase">Total de Itens</span>
                                    <span className="text-blue-900 font-black text-xl">{totalItemsInPlan}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase">Modelos Diferentes</span>
                                    <span className="text-blue-900 font-black text-xl">{order.kits.length + order.miscItems.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Itens para Revisão */}
                    <div className="lg:col-span-8 flex flex-col min-h-0">
                        <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {[...order.kits, ...order.miscItems].map((item, index) => {
                                const details = item.type === 'kit' ? findKitById(item.id) : inventory.findComponentById(item.id);
                                return (
                                    <div key={`${item.type}-${item.id}-${item.variant || ''}-${index}`} className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${item.type === 'kit' ? 'bg-blue-50 text-blue-300 border-blue-100' : 'bg-amber-50 text-amber-300 border-amber-100'}`}>
                                                {details?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-slate-900 text-sm uppercase leading-tight">{details?.name}</p>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${item.type === 'kit' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {item.type === 'kit' ? 'KIT' : 'ITEM'}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                    SKU: {details?.sku} {item.type === 'kit' && `• Variante: ${item.variant || 'Padrão'}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                                <button onClick={() => {
                                                    const listKey = item.type === 'kit' ? 'kits' : 'miscItems';
                                                    setOrder(prev => ({...prev, [listKey]: prev[listKey].map(i => (i.id === item.id && i.variant === item.variant) ? {...i, quantity: Math.max(1, i.quantity - 1)} : i)}));
                                                }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-900 font-black shadow-sm hover:bg-slate-50 transition-colors">-</button>
                                                <span className="text-lg font-black w-10 text-center text-slate-900">{item.quantity}</span>
                                                <button onClick={() => {
                                                    const listKey = item.type === 'kit' ? 'kits' : 'miscItems';
                                                    setOrder(prev => ({...prev, [listKey]: prev[listKey].map(i => (i.id === item.id && i.variant === item.variant) ? {...i, quantity: i.quantity + 1} : i)}));
                                                }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-900 font-black shadow-sm hover:bg-slate-50 transition-colors">+</button>
                                            </div>
                                            <button onClick={() => {
                                                const listKey = item.type === 'kit' ? 'kits' : 'miscItems';
                                                setOrder(prev => ({...prev, [listKey]: prev[listKey].filter(i => !(i.id === item.id && i.variant === item.variant))}));
                                            }} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Modal de Detalhes do Kit (Maximize Effect) */}
        {selectedKitForDetail && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-4xl h-full max-h-[800px] rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative">
                    <button 
                        onClick={() => setSelectedKitForDetail(null)}
                        className="absolute top-6 right-6 p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all z-10"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        <div className="p-8 md:p-12">
                            <div className="flex flex-col md:flex-row gap-10">
                                <div className="md:w-1/3">
                                    <div className="aspect-square bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200 border-2 border-slate-100">
                                        <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    </div>
                                    <div className="mt-8 space-y-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SKU</p>
                                            <p className="font-black text-slate-900">{selectedKitForDetail.sku}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Marca</p>
                                            <p className="font-black text-slate-900">{selectedKitForDetail.marca}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:w-2/3">
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-4">
                                        {selectedKitForDetail.name}
                                    </h2>
                                    <p className="text-slate-500 font-medium text-sm mb-8">
                                        {selectedKitForDetail.description || 'Sem descrição disponível para este kit.'}
                                    </p>

                                    <div className="space-y-6">
                                        <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                            <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                                            Componentes do Kit
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedKitForDetail.components.map((comp, idx) => {
                                                const componentData = components.find(c => c.sku === comp.componentSku);
                                                return (
                                                    <div key={`comp-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-100">
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{componentData?.name || 'Componente não encontrado'}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SKU: {comp.componentSku}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-lg font-black text-blue-600">
                                                            x{comp.quantity}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(selectedKitForDetail.requiredFasteners || []).map((fastener, idx) => {
                                                const isNut = fastener.dimension.endsWith('x0mm') || fastener.dimension.includes('x0');
                                                const name = isNut ? `Porca M${fastener.dimension.split('x')[0]}` : `Fixador ${fastener.dimension}`;
                                                return (
                                                    <div key={`fastener-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-100">
                                                                {selectedKitForDetail.components.length + idx + 1}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{name}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">DIMENSÃO: {fastener.dimension}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-lg font-black text-blue-600">
                                                            x{fastener.quantity}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Variante</p>
                                <select 
                                    id="detail-variant"
                                    className="h-14 px-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 bg-white text-slate-900 font-bold"
                                    defaultValue="Padrão"
                                >
                                    <option value="Padrão">Padrão</option>
                                    <option value="Fix-S">Fix-S</option>
                                    <option value="Fix-P">Fix-P</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Quantidade</p>
                                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm h-14">
                                    <button 
                                        onClick={() => {
                                            const input = document.getElementById('detail-qty') as HTMLInputElement;
                                            if (input) input.value = Math.max(1, parseInt(input.value) - 1).toString();
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-900 font-black hover:bg-slate-100 transition-colors"
                                    >-</button>
                                    <input 
                                        id="detail-qty"
                                        type="number" 
                                        defaultValue="1" 
                                        min="1"
                                        className="w-16 text-center text-2xl font-black text-slate-900 bg-transparent border-none focus:ring-0"
                                    />
                                    <button 
                                        onClick={() => {
                                            const input = document.getElementById('detail-qty') as HTMLInputElement;
                                            if (input) input.value = (parseInt(input.value) + 1).toString();
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-900 font-black hover:bg-slate-100 transition-colors"
                                    >+</button>
                                </div>
                            </div>
                        </div>
                        <Button 
                            onClick={() => {
                                const input = document.getElementById('detail-qty') as HTMLInputElement;
                                const variantInput = document.getElementById('detail-variant') as HTMLSelectElement;
                                const qty = parseInt(input?.value || '1');
                                const variant = (variantInput?.value || 'Padrão') as 'Padrão' | 'Fix-S' | 'Fix-P';
                                handleAddItem(selectedKitForDetail, 'kit', qty, variant);
                                setSelectedKitForDetail(null);
                            }}
                            className="w-full sm:w-auto h-14 px-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 uppercase font-black text-sm flex items-center justify-center gap-3"
                        >
                            Adicionar ao Lote
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {analysisModalData && (
            <AnalysisResultModal 
                isOpen={!!analysisModalData}
                onClose={() => setAnalysisModalData(null)}
                scenarios={analysisModalData.scenarios}
                onCreateOrder={async (scenario) => {
                    const notes = `Criada via Workshop de Montagem.${externalOrderId ? `\nPedido Externo: ${externalOrderId}` : ''}`;
                    
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
                        orderItems: [...order.kits, ...order.miscItems], 
                        selectedScenario: scenario, 
                        virtualComponents: analysisModalData.virtualComponents, 
                        notes: notes,
                        customerId: customerId || undefined,
                        scannedItems: {},
                        substitutions: {},
                        installments: []
                    });

                    if (newOrderId) {
                        addToast(`Ordem de Montagem ${newOrderId} gerada.`, 'success');
                        
                        // --- AUTOMATIC SHORTAGE RESOLUTION ---
                        const shortages = scenario.shortages;
                        if (shortages.length > 0) {
                            addToast('Analisando e criando ordens para itens faltantes...', 'info');
                            
                            const toManufacture: ProductionScenarioShortage[] = [];
                            const directToPurchase: ProductionScenarioShortage[] = [];

                            for (const shortage of shortages) {
                                let component = inventory.findComponentById(shortage.componentId);
                                if (!component) {
                                    component = analysisModalData?.virtualComponents.find(vc => vc.id === shortage.componentId);
                                }

                                if (component) {
                                    // Prioridade: Se tem família ou sourcing de fabricação, vai para OF.
                                    // Caso contrário (comprado, matéria-prima ou indefinido), vai para OC.
                                    const isManufactured = !!component.familiaId || component.sourcing === 'manufactured' || component.sourcing === 'beneficiado';
                                    
                                    if (isManufactured) {
                                        toManufacture.push(shortage);
                                    } else {
                                        directToPurchase.push(shortage);
                                    }
                                }
                            }
                            
                            let manufacturingOrderAnalysis: ManufacturingAnalysis | null = null;
                            if (toManufacture.length > 0) {
                                const moItems = toManufacture.map(s => {
                                    let component = inventory.findComponentById(s.componentId);
                                    if (!component && s.componentId.startsWith('comp-virtual-')) {
                                        component = analysisModalData?.virtualComponents.find(vc => vc.id === s.componentId);
                                    }
                                    return { 
                                        componentId: s.componentId, 
                                        quantity: s.shortage,
                                        name: s.componentName,
                                        sku: component?.sku || s.componentId.replace('comp-virtual-', ''),
                                        keyName: s.keyName
                                    };
                                });
                                manufacturingOrderAnalysis = manufacturing.analyzeManufacturingRun(moItems, inventory.components, analysisModalData.virtualComponents);
                                const newMoId = await manufacturingOrdersHook.addManufacturingOrder(moItems, manufacturingOrderAnalysis);
                                if (newMoId) {
                                    addToast(`Ordem de Fabricação ${newMoId} criada para suprir a falta.`, 'success');
                                }
                            }

                            const purchaseMap = new Map<string, PurchaseRecommendation>();
                            
                            // 1. Direct purchases
                            (directToPurchase || []).forEach(s => {
                                let component = inventory.findComponentById(s.componentId);
                                if (!component) {
                                    component = analysisModalData?.virtualComponents.find(vc => vc.id === s.componentId);
                                }
                                
                                if (component) {
                                    purchaseMap.set(s.componentId, {
                                        componentId: s.componentId, name: s.componentName, sku: component.sku,
                                        sourcing: component.sourcing || 'purchased', required: s.required, inStock: s.available,
                                        toOrder: s.shortage, abcClass: 'C',
                                    });
                                }
                            });
                
                            // 2. Raw materials from Manufacturing Order
                            if (manufacturingOrderAnalysis) {
                                const manufacturingShortages = (manufacturingOrderAnalysis.requirements || [])
                                    .filter(req => req.shortage > 0 && req.type !== 'etapaFabricacao');
                                
                                (manufacturingShortages || []).forEach(req => {
                                    let component = inventory.findComponentById(req.id);
                                    if (!component) {
                                        component = analysisModalData?.virtualComponents.find(vc => vc.id === req.id);
                                    }
                                    
                                    if (component) {
                                        // SÓ ADICIONA À COMPRA SE NÃO FOR UM ITEM QUE NÓS MESMOS FABRICAMOS
                                        const isManufactured = !!component.familiaId || component.sourcing === 'manufactured' || component.sourcing === 'beneficiado';
                                        if (isManufactured) return;

                                        const existingRec = purchaseMap.get(req.id);
                                        if (existingRec) {
                                            existingRec.toOrder += req.shortage;
                                            existingRec.required += req.quantity;
                                        } else {
                                            purchaseMap.set(req.id, {
                                                componentId: req.id, name: req.name, sku: component.sku,
                                                sourcing: component.sourcing || 'purchased', required: req.quantity, inStock: req.stock,
                                                toOrder: req.shortage, abcClass: 'C',
                                            });
                                        }
                                    }
                                });
                            }
                
                            const finalPurchaseRecommendations = Array.from(purchaseMap.values());
                            if (finalPurchaseRecommendations.length > 0) {
                                const leadTimes = finalPurchaseRecommendations.map(rec => inventory.findComponentById(rec.componentId)?.leadTimeDays || 0);
                                const maxLeadTime = Math.max(0, ...leadTimes);
                                const deliveryDate = new Date();
                                deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
                                
                                const newPoId = await purchaseOrdersHook.addPurchaseOrder(finalPurchaseRecommendations, deliveryDate.toISOString().split('T')[0]);
                                if (newPoId) {
                                    addToast(`Ordem de Compra ${newPoId} criada para suprir a falta.`, 'success');
                                }
                            }
                        }

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
                purchaseOrdersHook={purchaseOrdersHook}
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
    createAndStockComponent: (componentData: { sku: string; name: string; familiaId: string; }) => Promise<void>;
}
