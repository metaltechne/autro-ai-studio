import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Button } from './ui/Button';
import { InventoryHook, ProductionOrdersHook, Kit, ProductionOrderItem, ProductionScenario, ManufacturingHook, Component, MissingKitData, KitComposition, KitComponent, View, KitImportData, ManufacturingOrdersHook, CuttingOrdersHook, CustomersHook, PurchaseOrdersHook, ProductionScenarioShortage, PurchaseRecommendation, ManufacturingAnalysis } from '../types';
import { useToast } from '../hooks/useToast';
import { AnalysisResultModal } from './AnalysisResultModal';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useFinancials } from '../contexts/FinancialsContext';

// --- Types & Interfaces ---
type ImportStage = 'idle' | 'parsing' | 'select_order' | 'prompting_for_keys' | 'confirming_creations' | 'analyzing' | 'done' | 'error';

interface RawCsvItem {
    sku: string;
    name: string;
    quantity: number;
    composition: string;
    customer: string;
    orderId: string;
    marca: string;
    modelo: string;
    ano: string;
}

interface SalesOrderImportViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    customersHook: CustomersHook;
    setCurrentView: (view: View) => void;
}

// --- Helper Functions ---
const parseLocalizacao = (composition: string): KitComposition => {
    const fasteners: { dimension: string; quantity: number }[] = [];
    if (!composition || !composition.trim()) {
        return { components: [], requiredFasteners: fasteners };
    }

    const cleanedComposition = composition.replace(/\s*\(.*?\)\s*/g, '').trim();
    const parts = cleanedComposition.split('+');

    parts.forEach(part => {
        const trimmedPart = part.trim();
        const match = trimmedPart.match(/^(\d+)\s+(FIX|PORCA|POR)\s+M?(\d+(?:[xX]\d+)?)/i);

        if (match) {
            const quantity = parseInt(match[1], 10);
            const type = match[2].toUpperCase();
            let dimension = match[3];

            if (type === 'PORCA' || type === 'POR') {
                dimension = `${dimension}x0`;
            } 

            if (!isNaN(quantity)) {
                const finalDimension = `${dimension.toLowerCase().replace('x','x')}mm`;
                const existing = fasteners.find(f => f.dimension === finalDimension);
                if (existing) {
                    existing.quantity += quantity;
                } else {
                    fasteners.push({ dimension: finalDimension, quantity });
                }
            }
        }
    });
    return { components: [], requiredFasteners: fasteners };
};

const Spinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-8">
        <svg className="animate-spin h-10 w-10 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-600">{message}</p>
    </div>
);


// --- Main Component ---
export const SalesOrderImportView: React.FC<SalesOrderImportViewProps> = ({ inventory, manufacturing, productionOrdersHook, cuttingOrdersHook, manufacturingOrdersHook, purchaseOrdersHook, customersHook, setCurrentView }) => {
    const { addToast } = useToast();
    const { settings: financialSettings } = useFinancials();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [stage, setStage] = useState<ImportStage>('idle');
    const [fileName, setFileName] = useState<string | null>(null);
    const [customerInfo, setCustomerInfo] = useState({ name: '', orderId: '', customerId: '' });
    
    const [parsedOrders, setParsedOrders] = useState<Map<string, { customer: string; items: RawCsvItem[] }>>(new Map());
    const [aggregatedCsvItems, setAggregatedCsvItems] = useState<Map<string, RawCsvItem>>(new Map());
    
    const [missingKits, setMissingKits] = useState<MissingKitData[]>([]);
    const [kitsToCreate, setKitsToCreate] = useState<Map<string, KitImportData>>(new Map());

    const [finalOrderItems, setFinalOrderItems] = useState<ProductionOrderItem[]>([]);
    
    const [analysisModalData, setAnalysisModalData] = useState<{ scenarios: ProductionScenario[], virtualComponents: Component[] } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
    const [createdMoId, setCreatedMoId] = useState<string | null>(null);
    const [createdPoId, setCreatedPoId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    const [extraItems, setExtraItems] = useState<{ componentId: string, quantity: number }[]>([]);
    const [newKey, setNewKey] = useState<{ componentId: string, quantity: number }>({ componentId: '', quantity: 1 });

    const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);


    const resetState = () => {
        setStage('idle');
        setFileName(null);
        setCustomerInfo({ name: '', orderId: '', customerId: '' });
        setParsedOrders(new Map());
        setAggregatedCsvItems(new Map());
        setMissingKits([]);
        setKitsToCreate(new Map());
        setFinalOrderItems([]);
        setAnalysisModalData(null);
        setIsProcessing(false);
        setOrderCreatedId(null);
        setCreatedMoId(null);
        setCreatedPoId(null);
        setErrorMessage('');
        setExtraItems([]);
        setNewKey({ componentId: '', quantity: 1 });
        setMismatchWarning(null);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        resetState();
        setStage('parsing');
        setFileName(file.name);

        try {
            const csvText = await file.text();
            
            const lines = csvText.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("Arquivo CSV vazio ou sem dados.");
            
            const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
            const requiredHeaders = ["Código do produto", "Descrição", "Quantidade", "Localização", "Cliente", "Número do Pedido"];
            const headerIndices: Record<string, number> = {};
            requiredHeaders.forEach(h => { headerIndices[h] = header.indexOf(h) });
            
            if (Object.values(headerIndices).some(i => i === -1)) {
                throw new Error(`Cabeçalho do CSV inválido. Faltando colunas: ${requiredHeaders.filter(h => header.indexOf(h) === -1).join(', ')}`);
            }

            const rawItems: RawCsvItem[] = lines.slice(1).map(line => {
                const columns = line.split(';').map(col => col.trim().replace(/"/g, ''));
                if (columns.length < header.length) return null;
                
                const quantity = Math.ceil(parseFloat(columns[headerIndices["Quantidade"]].replace(',', '.')));
                const sku = columns[headerIndices["Código do produto"]];
                const description = columns[headerIndices["Descrição"]];
                
                const descParts = description.split(' ');
                const marca = descParts.find(p => ['VOLVO', 'SCANIA', 'MERCEDES', 'IVECO', 'DAF', 'MAN', 'VOLKSWAGEN'].includes(p.toUpperCase())) || 'Desconhecida';
                const modeloMatch = description.match(/(FH|VM|FM|NH|R450|P360|NTG|AXOR|ATEGO|ACTROS|ACCELO|HI-WAY|STRALIS|TECTOR|S-WAY|XF|CF|TGX|CONSTELLATION|METEOR|DELIVERY)\s*([\d.-]+)?/i);
                const modelo = modeloMatch ? modeloMatch[0] : 'Desconhecido';
                const anoMatch = description.match(/(\d{4})|(\d{4}\+)|(\d{4}-\d{4})/);
                const ano = anoMatch ? anoMatch[0] : 'Todos';

                if (sku && !isNaN(quantity) && quantity > 0) {
                    return {
                        sku,
                        name: description,
                        quantity,
                        composition: columns[headerIndices["Localização"]],
                        customer: columns[headerIndices["Cliente"]],
                        orderId: columns[headerIndices["Número do Pedido"]],
                        marca,
                        modelo,
                        ano,
                    };
                }
                return null;
            }).filter((item): item is RawCsvItem => item !== null);
            
            const ordersMap = new Map<string, { customer: string; items: RawCsvItem[] }>();
            rawItems.forEach(item => {
                const orderId = item.orderId || 'PEDIDO_INDEFINIDO';
                const existingOrder = ordersMap.get(orderId);
                if (existingOrder) {
                    existingOrder.items.push(item);
                } else {
                    ordersMap.set(orderId, { customer: item.customer, items: [item] });
                }
            });

            if (ordersMap.size === 0) {
                throw new Error("Nenhum item de pedido válido encontrado no arquivo.");
            }
            
            setParsedOrders(ordersMap);

            if (ordersMap.size === 1) {
                handleProcessOrder(ordersMap.keys().next().value);
            } else {
                setStage('select_order');
            }
        } catch (e: any) {
            setErrorMessage(e.message || "Erro desconhecido ao processar o arquivo.");
            setStage('error');
        }
    };
    
    const handleProcessOrder = async (orderId: string) => {
        const orderData = parsedOrders.get(orderId);
        if (!orderData) return;

        const aggregatedItems = new Map<string, RawCsvItem>();
        orderData.items.forEach(item => {
            const existing = aggregatedItems.get(item.sku);
            aggregatedItems.set(item.sku, {
                ...item,
                quantity: (existing?.quantity || 0) + item.quantity,
            });
        });
        
        // Find or create customer
        let customer = customersHook.customers.find(c => c.name.toLowerCase() === orderData.customer.toLowerCase());
        if (!customer) {
            const newCustomer = await customersHook.addCustomer({
                name: orderData.customer,
                document: '', phone: '', email: '', address: ''
            });
            if (newCustomer) {
                customer = newCustomer;
            }
        }
        
        setAggregatedCsvItems(aggregatedItems);
        setCustomerInfo({ name: orderData.customer, orderId: orderId, customerId: customer?.id || '' });

        const missing: MissingKitData[] = [];
        const orderItems: ProductionOrderItem[] = [];
        const mismatchedKitWarnings: string[] = [];

        for (const [sku, data] of aggregatedItems.entries()) {
            const existingKit = inventory.findKitBySku(sku);
            const csvComposition = parseLocalizacao(data.composition);

            if (!existingKit) {
                missing.push({ sku, name: data.name, csvComposition, marca: data.marca, modelo: data.modelo, ano: data.ano });
            } else {
                orderItems.push({ kitId: existingKit.id, quantity: data.quantity });
                const systemCompStr = JSON.stringify(existingKit.requiredFasteners.sort((a,b) => a.dimension.localeCompare(b.dimension)));
                const csvCompStr = JSON.stringify(csvComposition.requiredFasteners.sort((a,b) => a.dimension.localeCompare(b.dimension)));

                if (systemCompStr !== csvCompStr) {
                    mismatchedKitWarnings.push(`- ${existingKit.name} (SKU: ${existingKit.sku})`);
                }
            }
        }

        if (mismatchedKitWarnings.length > 0) {
            const warningHeader = "Aviso: A composição dos seguintes kits difere do arquivo importado. A composição do sistema foi utilizada. Por favor, revise os kits manualmente:";
            setMismatchWarning(`${warningHeader}\n${mismatchedKitWarnings.join('\n')}`);
        } else {
            setMismatchWarning(null);
        }
        
        setMissingKits(missing);
        setFinalOrderItems(orderItems);
        
        setStage('prompting_for_keys');
    };

    const keyComponents = useMemo(() => {
        return inventory.components
            .filter(c => c.familiaId === 'fam-chave-p' || c.familiaId === 'fam-chave-s')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [inventory.components]);

    const handleAddKey = () => {
        if (!newKey.componentId || newKey.quantity <= 0) {
            addToast("Selecione uma chave e a quantidade.", 'info');
            return;
        }
        setExtraItems(prev => {
            const existing = prev.find(i => i.componentId === newKey.componentId);
            if (existing) {
                return prev.map(i => i.componentId === newKey.componentId ? { ...i, quantity: i.quantity + newKey.quantity } : i);
            }
            return [...prev, { componentId: newKey.componentId, quantity: newKey.quantity }];
        });
        setNewKey({ componentId: '', quantity: 1 });
    };

    const handleRemoveKey = (componentId: string) => {
        setExtraItems(prev => prev.filter(i => i.componentId !== componentId));
    }

    const handleProceedFromKeys = () => {
        if (missingKits.length > 0) {
            setKitsToCreate(new Map(missingKits.map((m: MissingKitData) => [m.sku, { 'Nome do Kit': m.name, SKU: m.sku, Marca: m.marca, Modelo: m.modelo, Ano: m.ano, 'Componentes (SKU:Qtd)': '', 'Fixadores (Dimensao:Qtd)': m.csvComposition.requiredFasteners.map(f => `${f.dimension}:${f.quantity}`).join(','), 'Preco de Venda (Opcional)': undefined }])));
            setStage('confirming_creations');
        } else {
            setStage('analyzing');
            handleStartAnalysis(finalOrderItems);
        }
    }
    
    const handleCreateMissingKits = async () => {
        setIsProcessing(true);
        const kitsToCreateList = Array.from(kitsToCreate.values());
        
        if (kitsToCreateList.length > 0) {
            await inventory.addMultipleKits(kitsToCreateList);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        const newKits = await inventory.getKits();
        
        const createdOrderItems: ProductionOrderItem[] = kitsToCreateList.map((k: KitImportData) => {
            const newKit = newKits.find(nk => nk.sku === k.SKU);
            return { kitId: newKit!.id, quantity: aggregatedCsvItems.get(k.SKU)!.quantity };
        });
        
        const nextOrderItems = [...finalOrderItems, ...createdOrderItems];
        setFinalOrderItems(nextOrderItems);
        
        setStage('analyzing');
        handleStartAnalysis(nextOrderItems);
        setIsProcessing(false);
    };

    const handleStartAnalysis = (order: ProductionOrderItem[]) => {
        if (!financialSettings) {
            addToast("Configurações financeiras não carregadas. Não é possível analisar.", 'error');
            setStage('error');
            setErrorMessage("Configurações financeiras não carregadas.");
            return;
        }

        if (order.length === 0 && extraItems.length === 0) {
            setErrorMessage("Nenhum item válido para criar a ordem.");
            setStage('error');
            return;
        }
        const result = inventory.analyzeProductionRun(order, extraItems, manufacturing.familias, inventory.components, financialSettings);
        setAnalysisModalData(result);
    };
    
    const handleCreateProductionOrder = async (scenario: ProductionScenario) => {
        if (!analysisModalData) return;
        setIsProcessing(true);
        
        const extraItemsNotes = extraItems.map((item: { componentId: string; quantity: number; }) => { const comp = inventory.findComponentById(item.componentId); return `${item.quantity}x ${comp?.name || 'Item desconhecido'} (SKU: ${comp?.sku || 'N/A'})`; }).join('\n');
        
        let finalNotes = `Importado do pedido para ${customerInfo.name} (Pedido: ${customerInfo.orderId}).`;
        if (mismatchWarning) {
            finalNotes += `\n\n---\n${mismatchWarning}`;
        }
        if (extraItems.length > 0) {
            finalNotes += `\n\nItens extras:\n${extraItemsNotes}`;
        }

        const newOrderId = await productionOrdersHook.addProductionOrder({
            orderItems: finalOrderItems,
            selectedScenario: scenario,
            virtualComponents: analysisModalData?.virtualComponents || [],
            notes: finalNotes,
            customerId: customerInfo.customerId,
            scannedItems: {},
            substitutions: {},
            installments: []
        });

        if (newOrderId) {
            setOrderCreatedId(newOrderId);
            addToast(`Ordem de Montagem ${newOrderId} criada!`, 'success');

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
                         // FIXO: Se for comprado (purchased), vai direto para compra.
                         // Se for manufactured, vai para fabricação.
                        if (component.sourcing === 'purchased' || component.type === 'raw_material') {
                            directToPurchase.push(shortage);
                        } else if (component.sourcing === 'manufactured' || component.sourcing === 'beneficiado') {
                            toManufacture.push(shortage);
                        } else {
                            toManufacture.push(shortage);
                        }
                    }
                }
                
                let manufacturingOrderAnalysis: ManufacturingAnalysis | null = null;
                if (toManufacture.length > 0) {
                    const moItems = toManufacture.map(s => ({ componentId: s.componentId, quantity: s.shortage }));
                    manufacturingOrderAnalysis = manufacturing.analyzeManufacturingRun(moItems, inventory.components, analysisModalData.virtualComponents);
                    const newMoId = await manufacturingOrdersHook.addManufacturingOrder(moItems, manufacturingOrderAnalysis);
                    if (newMoId) {
                        setCreatedMoId(newMoId);
                        addToast(`Ordem de Fabricação ${newMoId} criada para suprir a falta.`, 'success');
                    }
                }

                // --- CRITICAL FIX: Consolidated Purchase Logic ---
                const purchaseMap = new Map<string, PurchaseRecommendation>();
                
                // 1. Adiciona compras diretas (Tampas, Parafusos Comprados, etc.)
                directToPurchase.forEach(s => {
                    const component = inventory.findComponentById(s.componentId)!;
                    purchaseMap.set(s.componentId, {
                        componentId: s.componentId, name: s.componentName, sku: component.sku,
                        sourcing: component.sourcing || 'purchased', required: s.required, inStock: s.available,
                        toOrder: s.shortage, abcClass: 'C',
                    });
                });
    
                // 2. Adiciona matérias-primas exigidas pela Ordem de Fabricação
                if (manufacturingOrderAnalysis) {
                    const manufacturingShortages = manufacturingOrderAnalysis.requirements
                        .filter(req => req.shortage > 0 && req.type !== 'etapaFabricacao');
                    
                    manufacturingShortages.forEach(req => {
                        const component = inventory.findComponentById(req.id)!;
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
                        setCreatedPoId(newPoId);
                        addToast(`Ordem de Compra ${newPoId} criada para suprir a falta.`, 'success');
                    }
                }
            }
            
            setStage('done');
        } else {
            setErrorMessage("Falha ao criar a ordem de produção.");
            setStage('error');
        }
        
        setIsProcessing(false);
        setAnalysisModalData(null);
    };
    
    const renderIdle = () => (
         <Card className="max-w-xl mx-auto">
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
                <h3 className="text-xl font-semibold text-black mb-2">Importar Pedido de Venda</h3>
                <p className="text-gray-600 mb-6">Selecione um arquivo CSV com os dados do pedido para criar uma Ordem de Produção.</p>
                <Button onClick={() => fileInputRef.current?.click()}>Selecionar Arquivo CSV</Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            </div>
        </Card>
    );

    const renderSelectOrder = () => (
        <Card>
            <h3 className="text-xl font-semibold text-black mb-2">Pedidos Encontrados no Arquivo</h3>
            <p className="text-sm text-gray-600 mb-4">Múltiplos pedidos foram detectados. Por favor, selecione um para processar.</p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {Array.from(parsedOrders.entries()).map(([orderId, { customer, items }]) => (
                    <div key={orderId} className="p-4 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-black">Pedido: {orderId}</p>
                            <p className="text-sm text-gray-600">Cliente: {customer}</p>
                            <p className="text-xs text-gray-500">{items.length} linha(s) de item</p>
                        </div>
                        <Button onClick={() => handleProcessOrder(orderId)}>Processar Este Pedido</Button>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
                <Button onClick={resetState} variant="secondary">Cancelar Importação</Button>
            </div>
        </Card>
    );

    const renderPromptForKeys = () => (
        <Card>
            <h3 className="text-xl font-semibold text-black mb-2">Adicionar Chaves ao Pedido</h3>
            <p className="text-sm text-gray-600 mb-4">Selecione as chaves e as quantidades que serão enviadas para este cliente junto com o pedido.</p>
            
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {extraItems.map(item => {
                    const component = inventory.findComponentById(item.componentId);
                    return (
                        <div key={item.componentId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>{item.quantity}x {component?.name}</span>
                            <Button size="sm" variant="danger" onClick={() => handleRemoveKey(item.componentId)}>Remover</Button>
                        </div>
                    )
                })}
                {extraItems.length === 0 && <p className="text-center text-sm text-gray-500 py-4">Nenhuma chave adicionada.</p>}
            </div>

            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                    <Select label="Chave" value={newKey.componentId} onChange={e => setNewKey(p => ({ ...p, componentId: e.target.value }))}>
                        <option value="">Selecione uma chave...</option>
                        {keyComponents.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </Select>
                </div>
                <div>
                    <Input label="Quantidade" type="number" min="1" value={newKey.quantity} onChange={e => setNewKey(p => ({ ...p, quantity: parseInt(e.target.value, 10) || 1}))} />
                </div>
                <div className="md:col-span-3 flex justify-end">
                    <Button onClick={handleAddKey} variant="secondary">Adicionar Chave</Button>
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <Button onClick={handleProceedFromKeys}>Continuar</Button>
            </div>
        </Card>
    );
    
    const renderCreations = () => (
        <Card>
            <h3 className="text-xl font-semibold text-black mb-2">Kits Não Encontrados</h3>
            <p className="text-sm text-gray-600 mb-4">Estes kits do seu arquivo não existem no sistema. Preencha os dados e marque os que deseja criar.</p>
             <div className="max-h-[60vh] overflow-y-auto space-y-4">
                {missingKits.map(({ sku, name, marca, modelo, ano, csvComposition }) => (
                    <div key={sku} className="p-4 border rounded-lg">
                         <label className="flex items-start gap-4 cursor-pointer">
                            <input type="checkbox" className="mt-1 h-5 w-5" checked={kitsToCreate.has(sku)} onChange={e => {
                                const newMap = new Map(kitsToCreate);
                                const itemData = aggregatedCsvItems.get(sku);
                                if (e.target.checked && itemData) {
                                    newMap.set(sku, { 'Nome do Kit': name, SKU: sku, Marca: marca, Modelo: modelo, Ano: ano, 'Componentes (SKU:Qtd)': csvComposition.components.map(c => `${c.componentSku}:${c.quantity}`).join(','), 'Fixadores (Dimensao:Qtd)': csvComposition.requiredFasteners.map(f => `${f.dimension}:${f.quantity}`).join(','), 'Preco de Venda (Opcional)': undefined });
                                } else {
                                    newMap.delete(sku);
                                }
                                setKitsToCreate(newMap);
                            }} />
                             <div>
                                <h4 className="font-bold">{name} ({sku})</h4>
                                {kitsToCreate.has(sku) && (
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <Input label="Marca" value={kitsToCreate.get(sku)?.Marca} onChange={e => setKitsToCreate(p => new Map(p).set(sku, {...p.get(sku)!, Marca: e.target.value}))} />
                                        <Input label="Modelo" value={kitsToCreate.get(sku)?.Modelo} onChange={e => setKitsToCreate(p => new Map(p).set(sku, {...p.get(sku)!, Modelo: e.target.value}))} />
                                        <Input label="Ano" value={kitsToCreate.get(sku)?.Ano} onChange={e => setKitsToCreate(p => new Map(p).set(sku, {...p.get(sku)!, Ano: e.target.value}))} />
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>
                ))}
            </div>
             <div className="flex justify-end gap-2 mt-6">
                <Button onClick={handleCreateMissingKits} disabled={isProcessing}>{isProcessing ? 'Processando...' : `Continuar e Criar ${kitsToCreate.size} Kit(s)`}</Button>
            </div>
        </Card>
    );

    const renderDone = () => (
        <Card className="text-center">
            <h3 className="text-2xl font-bold text-green-600">Processo de Importação Concluído!</h3>
            <p className="text-lg mt-2">As seguintes ordens foram geradas para o cliente {customerInfo.name}:</p>
            <ul className="my-4 text-left list-disc list-inside bg-gray-50 p-4 rounded-md inline-block">
                {orderCreatedId && <li>Ordem de Montagem: <span className="font-semibold text-autro-blue">{orderCreatedId}</span></li>}
                {createdMoId && <li>Ordem de Fabricação: <span className="font-semibold text-autro-blue">{createdMoId}</span></li>}
                {createdPoId && <li>Ordem de Compra: <span className="font-semibold text-autro-blue">{createdPoId}</span></li>}
            </ul>
            <div className="flex justify-center gap-4 mt-6">
                <Button onClick={() => setCurrentView(View.PRODUCTION_ORDERS)}>Ver Ordens de Montagem</Button>
                <Button onClick={resetState} variant="secondary">Importar Outro Pedido</Button>
            </div>
        </Card>
    );

    return (
        <div className="animate-fade-in">
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}</style>
            
            <div className="flex justify-between items-start mb-6">
                <div>
                     <h2 className="text-3xl font-bold text-black">Importar Pedido de Produção</h2>
                     {fileName && <p className="text-gray-500">Arquivo: {fileName} | Cliente: {customerInfo.name} (Pedido: {customerInfo.orderId})</p>}
                </div>
                <Button onClick={() => setCurrentView(View.SECTOR_DASHBOARD)} variant="secondary">Voltar ao Dashboard</Button>
            </div>
            
            {stage === 'idle' && renderIdle()}
            {stage === 'parsing' && <Spinner message="Analisando arquivo..." />}
            {stage === 'select_order' && renderSelectOrder()}
            {stage === 'prompting_for_keys' && renderPromptForKeys()}
            {stage === 'confirming_creations' && renderCreations()}
            {stage === 'analyzing' && <Spinner message="Analisando viabilidade de estoque..." />}
            {stage === 'done' && renderDone()}
            {stage === 'error' && (
                <Card className="text-center">
                    <h3 className="text-2xl font-bold text-red-600">Erro na Importação</h3>
                    <p className="mt-2 text-gray-700">{errorMessage}</p>
                    <Button onClick={resetState} variant="secondary" className="mt-6">Tentar Novamente</Button>
                </Card>
            )}

            {analysisModalData && (
                <AnalysisResultModal 
                    isOpen={!!analysisModalData}
                    onClose={() => { setAnalysisModalData(null); setStage(finalOrderItems.length > 0 ? 'confirming_creations' : 'prompting_for_keys'); }}
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