
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { InventoryHook, ManufacturingHook, ProductionOrdersHook, ProductionOrderItem, Kit, View, ScannedQRCodeData, KitCostBreakdownItem, SaleDetails, FamiliaComponente, CuttingOrdersHook, ManufacturingOrdersHook, KitComponent, Component, ProductionScenario } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { useFinancials } from '../contexts/FinancialsContext';
import { BRAZIL_UFS } from '../contexts/FinancialsContext';
import { AnalysisResultModal } from './AnalysisResultModal';
import { evaluateProcess, getComponentCost, parseFastenerSku } from '../hooks/manufacturing-evaluator';
import { InlineQRCode } from './ui/InlineQRCode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLogoBase64ForPdf } from '../data/assets';
import { usePermissions } from '../hooks/usePermissions';
import { nanoid } from 'nanoid';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface SalesSimulatorViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    setCurrentView: (view: View) => void;
    isMobile: boolean;
}

interface ExtraItemValue {
    component: Component;
    quantity: number;
}

const LOCAL_STORAGE_KEY = 'autro_salesSimulator_v2';

export const SalesSimulatorView: React.FC<SalesSimulatorViewProps> = ({ inventory, manufacturing, productionOrdersHook, cuttingOrdersHook, manufacturingOrdersHook, setCurrentView, isMobile }) => {
    const { kits, analyzeProductionRun, findKitById, components, findComponentById, findComponentBySku } = inventory;
    const { familias, getAllUniqueHeadCodes } = manufacturing;
    const { addProductionOrder } = productionOrdersHook;
    const { addToast } = useToast();
    const { calculateSaleDetails, settings: financialSettings } = useFinancials();
    const { canViewCosts } = usePermissions();

    const [orderItems, setOrderItems] = useState<ProductionOrderItem[]>([]);
    // Fix: Explicitly type the extraItems state Map.
    const [extraItems, setExtraItems] = useState<Map<string, ExtraItemValue>>(new Map<string, ExtraItemValue>());
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
    const [filters, setFilters] = useState({ brand: '', model: '', year: '' });
    const [analysisModalData, setAnalysisModalData] = useState<{ scenarios: ProductionScenario[], virtualComponents: Component[] } | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
    const [simulationParams, setSimulationParams] = useState({
        clientType: 'final' as 'final' | 'resale' | 'use_contributor',
        destUF: financialSettings?.originUF || 'SP',
        salesChannel: 'direct' as 'direct' | 'marketplace',
        selectedMarketplaceId: '',
    });

    const [inspectedKitId, setInspectedKitId] = useState<string | null>(null);
    const [orderItemHeadCodes, setOrderItemHeadCodes] = useState<Map<string, string>>(new Map());

    const allHeadCodes = useMemo(() => getAllUniqueHeadCodes(), [getAllUniqueHeadCodes]);

    useEffect(() => {
        try {
            const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                if (parsedState.orderItems) setOrderItems(parsedState.orderItems);
                if (parsedState.customerInfo) setCustomerInfo(parsedState.customerInfo);
                if (parsedState.orderItemHeadCodes) setOrderItemHeadCodes(new Map(parsedState.orderItemHeadCodes));
                if (parsedState.extraItems) {
                    const hydrated = new Map<string, ExtraItemValue>();
                    (parsedState.extraItems as any[]).forEach(([id, { quantity }]) => {
                        const comp = findComponentById(id);
                        if (comp) hydrated.set(id, { component: comp, quantity });
                    });
                    setExtraItems(hydrated);
                }
            }
        } catch (e) {}
    }, [findComponentById]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ 
            orderItems, 
            extraItems: Array.from(extraItems.entries()).map(([k,v]) => [k, { quantity: (v as any).quantity }]),
            customerInfo, 
            orderItemHeadCodes: Array.from(orderItemHeadCodes.entries()) 
        }));
    }, [orderItems, extraItems, customerInfo, orderItemHeadCodes]);

    const filterOptions = useMemo(() => {
        const brands = [...new Set(kits.map(k => k.marca))].sort();
        const relevantKitsForModel = filters.brand ? kits.filter(k => k.marca === filters.brand) : [];
        const models = [...new Set(relevantKitsForModel.map(k => k.modelo))].sort();
        const relevantKitsForYear = filters.model ? relevantKitsForModel.filter(k => k.modelo === filters.model) : [];
        const years = [...new Set(relevantKitsForYear.map(k => k.ano))].sort();
        return { brands, models, years };
    }, [kits, filters.brand, filters.model]);

    const availableKitsForSelection = useMemo(() => {
        return kits.filter(kit =>
            (!filters.brand || kit.marca === filters.brand) &&
            (!filters.model || kit.modelo === filters.model) &&
            (!filters.year || kit.ano === filters.year)
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [kits, filters]);
    
    const keyComponents = useMemo(() => components.filter(c => c.familiaId?.startsWith('fam-chave')).sort((a,b) => a.name.localeCompare(b.name)), [components]);

    const inspectedKitDetails = useMemo(() => {
        if (!inspectedKitId) return null;
        const kit = findKitById(inspectedKitId);
        if (!kit) return null;

        const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));
        const preferredId = financialSettings?.preferredFastenerFamiliaId || 'fam-fixadores';
        let fastenerFamilia = familias.find(f => f.id === preferredId);
        if (!fastenerFamilia) {
            fastenerFamilia = familias.find(f => f.nome.toLowerCase().includes('fixador'));
        }

        let totalCost = 0;
        const structure = [
            ...kit.components.map((kc: KitComponent) => {
                const component = componentSkuMap.get(kc.componentSku);
                totalCost += (component ? getComponentCost(component) : 0) * kc.quantity;
                return { name: component?.name || kc.componentSku, quantity: kc.quantity, stock: component?.stock ?? 0, type: 'Componente' as const };
            }),
            ...kit.requiredFasteners.map((rf: { dimension: string; quantity: number }) => {
                let unitCost = 0;
                if(fastenerFamilia) {
                     const cleanDim = rf.dimension.toLowerCase().replace(/mm/g, '').replace(/m/g, '').replace(/\s+/g, '');
                     const dimParts = cleanDim.split('x');
                     const bitola = Number(dimParts[0]);
                     const comprimento = dimParts.length > 1 ? Number(dimParts[1]) : 0;
                     
                     if (!isNaN(bitola)) {
                        const result = evaluateProcess(fastenerFamilia, { bitola, comprimento }, components);
                        unitCost = result.custoFabricacao + result.custoMateriaPrima;
                     }
                }
                totalCost += unitCost * rf.quantity;
                
                const isNut = rf.dimension.includes('x0');
                const likelySku = fastenerFamilia?.nodes?.find(n => n.data.type === 'productGenerator')?.data.generationConfig?.skuTemplate
                    ?.replace('{headCode}', 'A-0002')
                    ?.replace('{dimensao}', rf.dimension.replace('mm',''));
                
                const realFastener = likelySku ? componentSkuMap.get(likelySku) : null;

                return { 
                    name: isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Parafuso ${rf.dimension}`, 
                    quantity: rf.quantity, 
                    stock: realFastener?.stock ?? 0, 
                    type: isNut ? 'Porca' as const : 'Fixador' as const 
                };
            })
        ];
        
        const saleDetails = calculateSaleDetails(totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
        return { kit, totalCost, saleDetails, structure, keyComponents };
    }, [inspectedKitId, findKitById, components, familias, calculateSaleDetails, keyComponents, financialSettings]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            if (name === 'brand') { newFilters.model = ''; newFilters.year = ''; }
            if (name === 'model') { newFilters.year = ''; }
            return newFilters;
        });
    };

    const handleRemoveItem = (kitId: string) => {
        setOrderItems(prev => prev.filter(i => i.kitId !== kitId));
    };

    const handleQuantityChange = (kitId: string, quantity: number) => {
        setOrderItems(prev => prev.map(i => i.kitId === kitId ? { ...i, quantity: Math.max(0, quantity) } : i).filter(i => i.quantity > 0));
    };

    const handleUpdateExtraItemQuantity = (componentId: string, quantity: number) => {
        setExtraItems((prev: Map<string, ExtraItemValue>) => {
            // Fix: Explicitly declare generic types when creating new Map.
            const newMap = new Map<string, ExtraItemValue>(prev);
            if (quantity <= 0) {
                newMap.delete(componentId);
            } else {
                const existing = newMap.get(componentId);
                if (existing) {
                    newMap.set(componentId, { ...existing, quantity });
                }
            }
            return newMap;
        });
    };

    const handleGenerateQuotePDF = async () => {
        if (!simulatedSaleDetails) return;
        const doc = new jsPDF();
        try {
            const logoBase64 = await getLogoBase64ForPdf();
            doc.addImage(logoBase64, 'PNG', 14, 12, 40, 10);
        } catch (error) {}
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Orçamento de Venda', 200, 22, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`Cliente: ${customerInfo.name || '---'}`, 14, 40);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 45);
        const tableData: any[] = [];
        orderItems.forEach(item => {
            const kit = findKitById(item.kitId);
            if (kit) tableData.push([item.quantity, kit.name, '---', '---']);
        });

        // Fix: Use Map.forEach to ensure val is correctly typed and avoid 'unknown' issues with Array.from.
        extraItems.forEach((val: ExtraItemValue) => {
            tableData.push([val.quantity, val.component.name, '---', '---']);
        });

        autoTable(doc, {
            startY: 55,
            head: [['Qtd', 'Descrição', 'Preço Unit.', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 43, 138] }
        });
        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(14);
        doc.text(`Valor Total: ${formatCurrency(simulatedSaleDetails.sellingPrice)}`, 200, finalY + 15, { align: 'right' });
        doc.save(`orcamento_${customerInfo.name || 'venda'}_${Date.now()}.pdf`);
    };

    const handleCreateProductionOrder = async (scenario: ProductionScenario) => {
        if (!analysisModalData) return;
        setIsProcessing(true);
        
        let extraItemsNotes = '';
        // Fix: Use Map.forEach for iterating over values with proper typing.
        extraItems.forEach((item: ExtraItemValue) => {
            extraItemsNotes += `${item.quantity}x ${item.component.name} (SKU: ${item.component.sku})\n`;
        });
            
        const notes = `Venda para ${customerInfo.name}${customerInfo.phone ? ` (${customerInfo.phone})` : ''}\n\nItens Extra:\n${extraItemsNotes}`;
        const newOrderId = await addProductionOrder({
            orderItems: orderItems.map(item => ({ ...item, fastenerHeadCode: orderItemHeadCodes.get(item.kitId) })),
            selectedScenario: scenario,
            virtualComponents: analysisModalData.virtualComponents,
            notes,
            customerId: undefined,
            scannedItems: {},
            substitutions: {},
            installments: []
        });
        if (newOrderId) {
            setOrderCreatedId(newOrderId);
            addToast(`Ordem de Montagem ${newOrderId} criada com sucesso!`, 'success');
            handleClearOrder();
        }
        setIsProcessing(false);
        setAnalysisModalData(null);
    };

    const handleAddItem = (kitId: string) => {
        setOrderItems(prev => {
            const existing = prev.find(i => i.kitId === kitId);
            if (existing) return prev.map(i => i.kitId === kitId ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { kitId, quantity: 1 }];
        });
    };

    const handleAddExtraItem = (component: Component) => {
        setExtraItems(prev => {
            // Fix: Explicitly declare generic types when creating new Map.
            const newMap = new Map<string, ExtraItemValue>(prev);
            const existing = newMap.get(component.id);
            newMap.set(component.id, { component, quantity: (existing?.quantity || 0) + 1 });
            return newMap;
        });
        addToast(`Chave/Item ${component.name} adicionado.`, 'success');
    };

    const handleClearOrder = () => {
        setOrderItems([]); setExtraItems(new Map()); setCustomerInfo({ name: '', phone: '' }); setOrderItemHeadCodes(new Map());
    };

    const totalCostValue = useMemo(() => {
        const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));
        const preferredId = financialSettings?.preferredFastenerFamiliaId || 'fam-fixadores';
        let fastenerFamilia = familias.find(f => f.id === preferredId);
        if (!fastenerFamilia) {
            fastenerFamilia = familias.find(f => f.nome.toLowerCase().includes('fixador'));
        }
        let total = 0;
        for (const orderItem of orderItems) {
            const kit = findKitById(orderItem.kitId);
            if (!kit) continue;
            let kitCost = 0;
            kit.components.forEach((kc: KitComponent) => {
                const component = componentSkuMap.get(kc.componentSku);
                if (component) kitCost += getComponentCost(component) * kc.quantity;
            });
            if (kit.requiredFasteners) {
                kit.requiredFasteners.forEach((rf: { dimension: string; quantity: number }) => {
                    let unitCost = 0;
                    if(fastenerFamilia) {
                         const cleanDim = rf.dimension.toLowerCase().replace(/mm/g, '').replace(/m/g, '').replace(/\s+/g, '');
                         const dimParts = cleanDim.split('x');
                         const bitola = Number(dimParts[0]);
                         const comprimento = dimParts.length > 1 ? Number(dimParts[1]) : 0;
                         if(!isNaN(bitola)) {
                            const result = evaluateProcess(fastenerFamilia, { bitola, comprimento }, components);
                            unitCost = result.custoFabricacao + result.custoMateriaPrima;
                         }
                    }
                    kitCost += unitCost * rf.quantity;
                });
            }
            total += kitCost * orderItem.quantity;
        }

        // Fix: Use Map.forEach for iterating over extraItems to ensure type safety.
        extraItems.forEach((item: ExtraItemValue) => {
            total += getComponentCost(item.component) * item.quantity;
        });

        return total;
    }, [orderItems, extraItems, components, familias, findKitById, financialSettings]);

    const simulatedSaleDetails = useMemo(() => {
        if (!financialSettings) return null;
        const marketplace = financialSettings.marketplaceFees?.find(m => m.id === simulationParams.selectedMarketplaceId);
        return calculateSaleDetails(totalCostValue, {
            strategy: 'markup',
            simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee }
        });
    }, [totalCostValue, simulationParams, financialSettings, calculateSaleDetails]);

    const handleCheckViability = () => {
        if (!financialSettings) {
            addToast('Configurações financeiras não carregadas.', 'error');
            return;
        }
        if (orderItems.length === 0 && extraItems.size === 0) return;
        const orderItemsWithHeadCodes = orderItems.map(item => ({ ...item, fastenerHeadCode: orderItemHeadCodes.get(item.kitId) }));
        const addItems: { componentId: string, quantity: number }[] = [];

        // Fix: Use Map.forEach for iterating over extraItems values with proper typing.
        extraItems.forEach((i: ExtraItemValue) => {
            addItems.push({ componentId: i.component.id, quantity: i.quantity });
        });

        const result = inventory.analyzeProductionRun(orderItemsWithHeadCodes, addItems, manufacturing.familias, inventory.components, financialSettings);
        setAnalysisModalData(result);
    };

    const KitInspectorPanel = () => (
        <div className="flex flex-col h-full pl-4">
            <h3 className="text-xl font-bold text-black mb-4">Inspetor de Kit</h3>
            {!inspectedKitDetails ? (
                <div className="flex-grow flex items-center justify-center text-center text-gray-400 border-2 border-dashed rounded-xl">
                    <p>Selecione um kit da lista para ver os detalhes da composição (peças e parafusos).</p>
                </div>
            ) : (
                <div key={inspectedKitId} className="flex-grow flex flex-col min-h-0 animate-fade-in">
                    <div className="flex items-start gap-4 mb-4 bg-slate-50 p-3 rounded-xl">
                        <InlineQRCode data={{ type: 'kit', id: inspectedKitDetails.kit.id }} size={60} />
                        <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-black truncate">{inspectedKitDetails.kit.name}</h4>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{inspectedKitDetails.kit.marca} / {inspectedKitDetails.kit.modelo}</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-3 mb-4">
                        <div className="space-y-1">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Composição de Peças e Fixadores</h5>
                            {inspectedKitDetails.structure.map((item, index) => {
                                const isNut = item.type === 'Porca';
                                return (
                                    <div key={index} className={`flex items-center justify-between text-xs p-2 rounded-lg ${isNut ? 'bg-amber-50/50' : (item.type === 'Fixador' ? 'bg-indigo-50/50' : 'bg-white border shadow-sm')}`}>
                                        <div className="flex items-center gap-2 flex-grow min-w-0">
                                             <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.stock >= item.quantity ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                             <div className="flex-grow truncate">
                                                 <span className="font-bold">{item.quantity}x</span> <span className={isNut ? 'text-amber-800 font-semibold' : (item.type === 'Fixador' ? 'text-indigo-800 font-semibold' : '')}>{item.name}</span>
                                             </div>
                                        </div>
                                        <span className="text-[10px] text-gray-400 ml-2 font-mono">(Est: {item.stock})</span>
                                    </div>
                                );
                            })}
                        </div>

                         <div className="space-y-1">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Adicionar Chave / Extra</h5>
                            {inspectedKitDetails.keyComponents.map((key) => (
                                 <div key={key.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50/30 border border-emerald-100/50">
                                    <div className="flex items-center gap-2 truncate">
                                         <span className={`w-2 h-2 rounded-full ${key.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                         <span className="font-medium text-slate-700">{key.name}</span>
                                    </div>
                                    <Button size="sm" variant="secondary" className="!p-1 h-6 w-6" onClick={() => handleAddExtraItem(key)}>+</Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button onClick={() => handleAddItem(inspectedKitDetails.kit.id)} className="w-full">Adicionar Kit à Venda</Button>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col font-sans">
            <header className="mb-6 flex-shrink-0"><h2 className="text-3xl font-bold text-black">Simulador de Vendas</h2><p className="text-gray-500 mt-1">Construa propostas, analise lucros e envie para produção.</p></header>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1">
                    <Card className="flex flex-col h-full">
                        <div className="flex flex-col md:flex-row h-full">
                            <div className="w-full md:w-1/2 lg:w-full xl:w-1/2 pr-4 border-r-0 md:border-r border-slate-100 flex flex-col">
                                <h3 className="text-xl font-bold text-black mb-4">Catálogo</h3>
                                <div className="space-y-3 mb-4 flex-shrink-0">
                                    <Select label="Marca" name="brand" value={filters.brand} onChange={handleFilterChange}><option value="">Todas</option>{filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}</Select>
                                    <Select label="Modelo" name="model" value={filters.model} onChange={handleFilterChange} disabled={!filters.brand}><option value="">Todos</option>{filterOptions.models.map(m => <option key={m} value={m}>{m}</option>)}</Select>
                                </div>
                                <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-2">
                                    {availableKitsForSelection.map(kit => (
                                        <div key={kit.id} onClick={() => setInspectedKitId(kit.id)} className={`p-2.5 border rounded-xl cursor-pointer flex items-center justify-between transition-all ${inspectedKitId === kit.id ? 'bg-autro-blue text-white shadow-lg ring-2 ring-autro-blue ring-offset-2' : 'bg-white hover:bg-slate-50'}`}>
                                            <div className="min-w-0 flex-grow">
                                                <p className={`font-bold text-sm truncate ${inspectedKitId === kit.id ? 'text-white' : 'text-black'}`}>{kit.name}</p>
                                                <p className={`text-[10px] uppercase font-black tracking-tighter ${inspectedKitId === kit.id ? 'text-white/70' : 'text-slate-400'}`}>{kit.modelo} ({kit.ano})</p>
                                            </div>
                                            <button className={`p-1.5 rounded-lg transition-colors ${inspectedKitId === kit.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 hover:bg-autro-blue hover:text-white'}`} onClick={(e) => {e.stopPropagation(); handleAddItem(kit.id)}}>+</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-full md:w-1/2 lg:w-full xl:w-1/2 mt-4 md:mt-0 lg:mt-4 xl:mt-0">
                                <KitInspectorPanel />
                            </div>
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-black">Carrinho Simulado</h3><Button onClick={handleClearOrder} variant="danger" size="sm" disabled={orderItems.length === 0 && extraItems.size === 0}>Limpar</Button></div>
                        <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-3">
                            {orderItems.length === 0 && extraItems.size === 0 ? <div className="text-center text-gray-400 py-20 italic">Seu carrinho está vazio.</div> :
                            <>
                                {orderItems.map(item => {
                                    const kit = findKitById(item.kitId); if (!kit) return null;
                                    return (<div key={item.kitId} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-start mb-2"><p className="text-sm font-bold text-black leading-tight truncate mr-2">{kit.name}</p><button className="text-red-400 hover:text-red-600" onClick={() => handleRemoveItem(item.kitId)}>&times;</button></div>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase text-gray-400">Qtd</span><Input type="number" value={item.quantity} onChange={e => handleQuantityChange(item.kitId, parseInt(e.target.value))} className="w-16 h-8 text-center text-sm" min="0"/></div>
                                            {kit.requiredFasteners.length > 0 && <Select value={orderItemHeadCodes.get(kit.id) || ''} onChange={(e) => setOrderItemHeadCodes(p => new Map(p).set(kit.id, e.target.value))} className="h-8 !py-0 text-[10px]">{allHeadCodes.map(code => <option key={code} value={code}>{code}</option>)}</Select>}
                                        </div>
                                    </div>);
                                })}
                                {/* Fix: Explicitly cast Array.from result or use generic for map callback to ensure type safety. */}
                                {(Array.from(extraItems.values()) as ExtraItemValue[]).map((item) => {
                                    return (
                                        <div key={item.component.id} className="p-3 bg-emerald-50/30 rounded-xl border border-emerald-100 flex justify-between items-center">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-emerald-800 truncate">{item.component.name}</p>
                                                <div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-black uppercase text-emerald-600">Extra Qtd:</span><Input type="number" value={item.quantity} onChange={e => handleUpdateExtraItemQuantity(item.component.id, parseInt(e.target.value))} className="w-16 h-7 text-center text-xs" min="0"/></div>
                                            </div>
                                            <button className="text-red-400" onClick={() => handleUpdateExtraItemQuantity(item.component.id, 0)}>&times;</button>
                                        </div>
                                    );
                                })}
                            </>}
                        </div>
                         {canViewCosts && <div className="mt-4 pt-4 border-t text-right"><p className="text-[10px] text-gray-400 font-black uppercase">Custo Total Produtos</p><p className="text-2xl font-black text-slate-900">{formatCurrency(totalCostValue)}</p></div>}
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="flex flex-col h-full bg-slate-900 text-white shadow-2xl border-none">
                        <h3 className="text-xl font-bold text-white mb-6">Finalização e Proposta</h3>
                        <div className="flex-grow overflow-y-auto space-y-6 -mr-2 pr-2">
                             <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-1">Simulador de Impostos/Margens</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Select label="Tipo Cliente" value={simulationParams.clientType} onChange={e => setSimulationParams(p => ({ ...p, clientType: e.target.value as any }))} className="!bg-slate-800 !text-white !border-slate-700 text-xs"><option value="final">Consumidor Final</option><option value="resale">Revenda</option><option value="use_contributor">Empresa (Uso/Consumo)</option></Select>
                                    <Select label="UF Destino" value={simulationParams.destUF} onChange={e => setSimulationParams(p => ({ ...p, destUF: e.target.value }))} className="!bg-slate-800 !text-white !border-slate-700 text-xs">{BRAZIL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</Select>
                                    <div className="col-span-2"><Select label="Canal Venda" value={simulationParams.salesChannel} onChange={e => setSimulationParams(p => ({ ...p, salesChannel: e.target.value as any, selectedMarketplaceId: '' }))} className="!bg-slate-800 !text-white !border-slate-700 text-xs"><option value="direct">Venda Direta</option><option value="marketplace">Marketplace</option></Select></div>
                                    {simulationParams.salesChannel === 'marketplace' && <div className="col-span-2"><Select label="Marketplace" value={simulationParams.selectedMarketplaceId} onChange={e => setSimulationParams(p => ({...p, selectedMarketplaceId: e.target.value}))} className="!bg-slate-800 !text-white !border-slate-700 text-xs"><option value="">Selecione...</option>{(financialSettings?.marketplaceFees || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.fee}%)</option>)}</Select></div>}
                                </div>
                            </div>
                            
                            {simulatedSaleDetails && (<div className="p-5 bg-white/5 rounded-2xl border border-white/10 text-center"><p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Preço Sugerido à Vista</p><p className="text-4xl font-black text-white">{formatCurrency(simulatedSaleDetails.sellingPrice)}</p><div className="flex justify-between mt-4 text-[11px] font-bold border-t border-white/10 pt-4"><span className="text-slate-400 uppercase">Lucro Líquido</span><span className="text-emerald-400">{formatCurrency(simulatedSaleDetails.profit)}</span></div></div>)}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 pb-1">Identificação Cliente</h4>
                                <Input label="Nome / Razão" value={customerInfo.name} onChange={e => setCustomerInfo(p => ({ ...p, name: e.target.value }))} className="!bg-slate-800 !text-white !border-slate-700 h-9" />
                                <Input label="Telefone" value={customerInfo.phone} onChange={e => setCustomerInfo(p => ({ ...p, phone: e.target.value }))} className="!bg-slate-800 !text-white !border-slate-700 h-9" />
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
                            <button onClick={handleCheckViability} disabled={orderItems.length === 0} className="w-full h-12 rounded-xl font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 bg-cyan-500 hover:bg-cyan-600 text-slate-900 border-none">Analisar Estoque e Produção</button>
                            <Button onClick={handleGenerateQuotePDF} disabled={(orderItems.length === 0 && extraItems.size === 0) || !simulatedSaleDetails} variant="secondary" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">Gerar PDF Orçamento</Button>
                        </div>
                    </Card>
                </div>
            </div>
            {analysisModalData && (<AnalysisResultModal isOpen={!!analysisModalData} onClose={() => setAnalysisModalData(null)} scenarios={analysisModalData.scenarios} onCreateOrder={handleCreateProductionOrder} inventory={inventory} manufacturing={manufacturing} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} productionOrdersHook={productionOrdersHook} />)}
        </div>
    );
};
