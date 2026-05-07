
import React, { useState, useRef } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from '../hooks/useToast';
import { useReceiving } from '../hooks/useReceiving';
import { Component, ReceivingOrder, ReceivingItem, SupplierProductMapping, ManufacturingOrdersHook, ManufacturingOrder } from '../types';
import { Search, Upload, CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Save, FileText, History, Factory, Package } from 'lucide-react';
import { Modal } from './ui/Modal';
import { nanoid } from 'nanoid';
import { parseNFeXML } from '../utils/nfeParser';

interface InspectionReceivingViewProps {
    inventory: any;
    manufacturingOrdersHook: ManufacturingOrdersHook;
}

export const InspectionReceivingView: React.FC<InspectionReceivingViewProps> = ({ inventory, manufacturingOrdersHook }) => {
    const { addToast } = useToast();
    const { receivingOrders, mappings, isLoading, addReceivingOrder, updateReceivingOrder, finalizeReceiving, saveMapping } = useReceiving(inventory);
    const { manufacturingOrders, finalizeManufacturingItemInspection, updateManufacturingOrderItemStatus } = manufacturingOrdersHook;
    
    const [activeTab, setActiveTab] = useState<'purchases' | 'fabrication'>('purchases');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ReceivingOrder | null>(null);
    
    const [importData, setImportData] = useState<{
        nfeNumber: string;
        supplierName: string;
        supplierCnpj: string;
        date: string;
        items: ReceivingItem[];
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const xmlText = e.target?.result as string;
            try {
                const parsedData = parseNFeXML(xmlText);
                
                // Apply existing mappings
                const itemsWithMappings = parsedData.items?.map(item => {
                    const mapping = mappings.find(m => 
                        m.supplierCnpj === parsedData.supplierCnpj && 
                        m.supplierProductCode === item.supplierProductCode
                    );
                    return {
                        ...item,
                        internalComponentId: mapping?.internalComponentId || ""
                    };
                }) || [];

                setImportData({
                    nfeNumber: parsedData.nfeNumber || "",
                    supplierName: parsedData.supplierName || "",
                    supplierCnpj: parsedData.supplierCnpj || "",
                    date: parsedData.date || new Date().toISOString().split('T')[0],
                    items: itemsWithMappings
                });
                setIsImportModalOpen(true);
            } catch (error) {
                console.error("Error parsing XML:", error);
                addToast("Erro ao processar XML da NFe. Verifique o arquivo.", "error");
            }
        };
        reader.readAsText(file);
        // Reset input
        if (event.target) event.target.value = '';
    };

    const handleConfirmImport = async () => {
        if (!importData) return;

        // Save mappings for items that have internalComponentId
        for (const item of importData.items) {
            if (item.internalComponentId) {
                await saveMapping({
                    supplierCnpj: importData.supplierCnpj,
                    supplierProductName: item.supplierProductName,
                    supplierProductCode: item.supplierProductCode,
                    internalComponentId: item.internalComponentId
                });
            }
        }

        await addReceivingOrder({
            ...importData,
            status: 'pendente'
        });

        setIsImportModalOpen(false);
        setImportData(null);
        addToast("Recebimento importado com sucesso!", "success");
    };

    const handleFinalize = async (orderId: string) => {
        const order = receivingOrders.find(o => o.id === orderId);
        if (!order) return;

        const allInspected = order.items.every(i => i.inspectionStatus !== 'pendente');
        if (!allInspected) {
            addToast("Todos os itens devem ser inspecionados antes de finalizar.", "warning");
            return;
        }

        await finalizeReceiving(orderId);
        addToast("Recebimento finalizado e estoque atualizado!", "success");
    };

    const updateItemStatus = (order: ReceivingOrder, itemId: string, status: 'aprovado' | 'reprovado') => {
        const updatedItems = order.items.map(item => 
            item.id === itemId ? { ...item, inspectionStatus: status } : item
        );
        updateReceivingOrder({ ...order, items: updatedItems });
    };

    const updateItemMapping = (order: ReceivingOrder, itemId: string, componentId: string) => {
        const updatedItems = order.items.map(item => 
            item.id === itemId ? { ...item, internalComponentId: componentId } : item
        );
        updateReceivingOrder({ ...order, items: updatedItems });
    };

    const [fabricationInspection, setFabricationInspection] = useState<{[key: string]: { approved: number, rejected: number }}>({});

    const handleApproveFabrication = async (orderId: string, componentId: string, totalQuantity: number) => {
        const inspection = fabricationInspection[`${orderId}-${componentId}`] || { approved: totalQuantity, rejected: 0 };
        
        if (inspection.approved + inspection.rejected !== totalQuantity) {
            addToast(`A soma das quantidades (${inspection.approved + inspection.rejected}) deve ser igual ao total produzido (${totalQuantity}).`, "warning");
            return;
        }

        try {
            await finalizeManufacturingItemInspection(orderId, componentId, inspection.approved, inspection.rejected);
            addToast(`Inspeção finalizada: ${inspection.approved} aprovados, ${inspection.rejected} reprovados.`, "success");
            
            // Clear inspection state for this item
            const newInspection = { ...fabricationInspection };
            delete newInspection[`${orderId}-${componentId}`];
            setFabricationInspection(newInspection);
        } catch (error) {
            console.error("Error approving fabrication item:", error);
            addToast("Erro ao processar inspeção do item.", "error");
        }
    };

    const handleRejectFabrication = async (orderId: string, componentId: string) => {
        try {
            await updateManufacturingOrderItemStatus(orderId, componentId, 'pendente');
            addToast("Item reprovado integralmente e retornado para produção.", "warning");
        } catch (error) {
            console.error("Error rejecting fabrication item:", error);
            addToast("Erro ao reprovar item de fabricação.", "error");
        }
    };

    const fabricationItemsAwaiting = manufacturingOrders.flatMap(order => 
        (order.orderItems || [])
            .filter(item => item.status === 'aguardando_inspecao')
            .map(item => ({ ...item, orderId: order.id, orderCreatedAt: order.createdAt }))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-black">Inspeção e Recebimento</h2>
                <div className="flex gap-3">
                    {activeTab === 'purchases' && (
                        <>
                            <Button variant="secondary" onClick={() => setIsHistoryModalOpen(true)}>
                                <History className="w-4 h-4 mr-2" /> Histórico de Mapeamento
                            </Button>
                            <Button variant="secondary" onClick={() => setIsManualModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Novo Manual
                            </Button>
                            <Button onClick={() => fileInputRef.current?.click()}>
                                <Upload className="w-4 h-4 mr-2" /> Importar XML NFe
                            </Button>
                        </>
                    )}
                    <input 
                        type="file" 
                        accept=".xml" 
                        ref={fileInputRef} 
                        onChange={handleXmlUpload} 
                        className="hidden" 
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('purchases')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
                        activeTab === 'purchases' 
                        ? 'border-autro-blue text-autro-blue' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Package className="w-4 h-4" /> Compras (NFe / Manual)
                </button>
                <button
                    onClick={() => setActiveTab('fabrication')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
                        activeTab === 'fabrication' 
                        ? 'border-autro-blue text-autro-blue' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Factory className="w-4 h-4" /> Itens de Fabricação
                    {fabricationItemsAwaiting.length > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                            {fabricationItemsAwaiting.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'purchases' ? (
                    receivingOrders.length === 0 ? (
                        <Card className="p-12 text-center">
                            <div className="flex flex-col items-center">
                                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                                <h3 className="text-xl font-semibold text-slate-600">Nenhum recebimento pendente</h3>
                                <p className="text-slate-400 mt-2">Importe um XML de NFe ou crie um recebimento manual para começar.</p>
                            </div>
                        </Card>
                    ) : (
                        receivingOrders.map(order => (
                            <Card key={order.id} className="overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-slate-900">NF: {order.nfeNumber}</h3>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            order.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {order.status === 'concluido' ? 'Concluído' : 'Pendente'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{order.supplierName} ({order.supplierCnpj}) - {order.date}</p>
                                </div>
                                {order.status !== 'concluido' && (
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => {
                                            const newItem: ReceivingItem = {
                                                id: `item-${nanoid()}`,
                                                supplierProductCode: 'MANUAL',
                                                supplierProductName: 'Novo Item Manual',
                                                quantity: 1,
                                                unit: 'un',
                                                unitPrice: 0,
                                                inspectionStatus: 'pendente',
                                                receivedQuantity: 1
                                            };
                                            updateReceivingOrder({ ...order, items: [...order.items, newItem] });
                                        }}>
                                            <Plus className="w-4 h-4 mr-1" /> Item
                                        </Button>
                                        <Button onClick={() => handleFinalize(order.id)}>Finalizar Recebimento</Button>
                                    </div>
                                )}
                            </div>
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Fornecedor</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Correlação Interna</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspeção</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map((item, idx) => (
                                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    {order.status === 'concluido' ? (
                                                        <>
                                                            <div className="font-medium text-slate-900">{item.supplierProductName}</div>
                                                            <div className="text-xs text-slate-400">Cód: {item.supplierProductCode}</div>
                                                        </>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <input 
                                                                className="w-full p-1 text-sm border-b border-transparent hover:border-slate-200 focus:border-autro-blue focus:outline-none bg-transparent"
                                                                value={item.supplierProductName}
                                                                onChange={(e) => {
                                                                    const newItems = [...order.items];
                                                                    newItems[idx].supplierProductName = e.target.value;
                                                                    updateReceivingOrder({ ...order, items: newItems });
                                                                }}
                                                            />
                                                            <input 
                                                                className="w-full p-1 text-xs text-slate-400 border-b border-transparent hover:border-slate-200 focus:border-autro-blue focus:outline-none bg-transparent"
                                                                value={item.supplierProductCode}
                                                                onChange={(e) => {
                                                                    const newItems = [...order.items];
                                                                    newItems[idx].supplierProductCode = e.target.value;
                                                                    updateReceivingOrder({ ...order, items: newItems });
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {order.status === 'concluido' ? (
                                                        <>
                                                            <div className="font-bold text-slate-900">{item.quantity} {item.unit}</div>
                                                            <div className="text-xs text-slate-400">R$ {item.unitPrice.toFixed(2)} / un</div>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number"
                                                                    className="w-16 p-1 text-sm font-bold border-b border-transparent hover:border-slate-200 focus:border-autro-blue focus:outline-none bg-transparent"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const newItems = [...order.items];
                                                                        newItems[idx].quantity = parseFloat(e.target.value) || 0;
                                                                        newItems[idx].receivedQuantity = newItems[idx].quantity;
                                                                        updateReceivingOrder({ ...order, items: newItems });
                                                                    }}
                                                                />
                                                                <span className="text-xs text-slate-400">{item.unit}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-slate-400">R$</span>
                                                                <input 
                                                                    type="number"
                                                                    className="w-20 p-1 text-xs text-slate-400 border-b border-transparent hover:border-slate-200 focus:border-autro-blue focus:outline-none bg-transparent"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => {
                                                                        const newItems = [...order.items];
                                                                        newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                                                                        updateReceivingOrder({ ...order, items: newItems });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {order.status === 'concluido' ? (
                                                        <div className="text-sm text-slate-600">
                                                            {inventory.components.find(c => c.id === item.internalComponentId)?.name || 'Não vinculado'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <select 
                                                                className="flex-1 p-2 border rounded-lg text-sm bg-white"
                                                                value={item.internalComponentId || ""}
                                                                onChange={(e) => updateItemMapping(order, item.id, e.target.value)}
                                                            >
                                                                <option value="">Selecionar Componente...</option>
                                                                {inventory.components.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
                                                                ))}
                                                            </select>
                                                            {!item.internalComponentId && (
                                                                <Button 
                                                                    variant="secondary" 
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        const newComp: Component = {
                                                                            id: `comp-${nanoid()}`,
                                                                            name: item.supplierProductName,
                                                                            sku: item.supplierProductCode,
                                                                            type: 'component',
                                                                            stock: 0,
                                                                            custoFabricacao: 0,
                                                                            custoMateriaPrima: 0,
                                                                            purchaseCost: item.unitPrice,
                                                                            purchaseUnit: item.unit,
                                                                            consumptionUnit: item.unit,
                                                                            sourcing: 'purchased'
                                                                        };
                                                                        await inventory.saveComponents([...inventory.components, newComp]);
                                                                        updateItemMapping(order, item.id, newComp.id);
                                                                        addToast(`Componente ${newComp.sku} criado com sucesso!`, 'success');
                                                                    }}
                                                                >
                                                                    Criar Novo
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {order.status === 'concluido' ? (
                                                        <div className="flex items-center gap-2">
                                                            {item.inspectionStatus === 'aprovado' ? (
                                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                                            ) : (
                                                                <XCircle className="w-5 h-5 text-red-500" />
                                                            )}
                                                            <span className="text-sm font-medium capitalize">{item.inspectionStatus}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => updateItemStatus(order, item.id, 'aprovado')}
                                                                className={`p-2 rounded-lg transition-colors ${item.inspectionStatus === 'aprovado' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 hover:bg-green-50'}`}
                                                            >
                                                                <CheckCircle className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => updateItemStatus(order, item.id, 'reprovado')}
                                                                className={`p-2 rounded-lg transition-colors ${item.inspectionStatus === 'reprovado' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400 hover:bg-red-50'}`}
                                                            >
                                                                <XCircle className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    const newItems = order.items.filter(i => i.id !== item.id);
                                                                    updateReceivingOrder({ ...order, items: newItems });
                                                                }}
                                                                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ))
                )) : (
                    /* Fabrication Tab Content */
                    fabricationItemsAwaiting.length === 0 ? (
                        <Card className="p-12 text-center">
                            <div className="flex flex-col items-center">
                                <Factory className="w-16 h-16 text-slate-300 mb-4" />
                                <h3 className="text-xl font-semibold text-slate-600">Nenhum item de fabricação aguardando inspeção</h3>
                                <p className="text-slate-400 mt-2">Os itens aparecerão aqui após a conclusão da produção no acompanhamento.</p>
                            </div>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordem / Data</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Fabricado</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantidade</th>
                                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações de Inspeção</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fabricationItemsAwaiting.map((item) => {
                                            const component = inventory.findComponentById(item.componentId) || inventory.findComponentBySku(item.componentId);
                                            return (
                                                <tr key={`${item.orderId}-${item.componentId}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-900">{item.orderId}</div>
                                                        <div className="text-xs text-slate-500">{new Date(item.orderCreatedAt).toLocaleDateString('pt-BR')}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-slate-900">{component?.name || item.componentId}</div>
                                                        <div className="text-xs text-slate-400">SKU: {component?.sku || '-'}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-500 uppercase w-16">Aprovar:</span>
                                                                <Input 
                                                                    type="number"
                                                                    className="w-20 h-8 text-sm"
                                                                    value={fabricationInspection[`${item.orderId}-${item.componentId}`]?.approved ?? item.quantity}
                                                                    max={item.quantity}
                                                                    min={0}
                                                                    onChange={(e) => {
                                                                        const approved = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                                                        const rejected = item.quantity - approved;
                                                                        setFabricationInspection(prev => ({
                                                                            ...prev,
                                                                            [`${item.orderId}-${item.componentId}`]: { approved, rejected }
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-500 uppercase w-16">Reprovar:</span>
                                                                <Input 
                                                                    type="number"
                                                                    className="w-20 h-8 text-sm"
                                                                    value={fabricationInspection[`${item.orderId}-${item.componentId}`]?.rejected ?? 0}
                                                                    max={item.quantity}
                                                                    min={0}
                                                                    onChange={(e) => {
                                                                        const rejected = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                                                        const approved = item.quantity - rejected;
                                                                        setFabricationInspection(prev => ({
                                                                            ...prev,
                                                                            [`${item.orderId}-${item.componentId}`]: { approved, rejected }
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex justify-center gap-3">
                                                            <Button 
                                                                size="sm" 
                                                                className="bg-green-600 hover:bg-green-500 flex items-center gap-2"
                                                                onClick={() => handleApproveFabrication(item.orderId, item.componentId, item.quantity)}
                                                            >
                                                                <CheckCircle className="w-4 h-4" /> Finalizar Inspeção
                                                            </Button>
                                                            <Button 
                                                                variant="danger" 
                                                                size="sm" 
                                                                className="flex items-center gap-2"
                                                                onClick={() => handleRejectFabrication(item.orderId, item.componentId)}
                                                                title="Reprovar Total"
                                                            >
                                                                <XCircle className="w-4 h-4" /> Reprovar Total
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )
                )}
            </div>

            {/* Import Modal */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Conferir Importação de XML" size="4xl">
                {importData && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</label>
                                <div className="font-bold">{importData.supplierName}</div>
                                <div className="text-xs text-slate-500">{importData.supplierCnpj}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota Fiscal / Data</label>
                                <div className="font-bold">NF: {importData.nfeNumber}</div>
                                <div className="text-xs text-slate-500">{importData.date}</div>
                            </div>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto border rounded-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10">
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item XML</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Correlação Interna</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importData.items.map((item, idx) => (
                                        <tr key={item.id} className="border-b border-slate-50">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900">{item.supplierProductName}</div>
                                                <div className="text-xs text-slate-400">Cód: {item.supplierProductCode} | {item.quantity} {item.unit}</div>
                                            </td>
                                            <td className="p-4">
                                                <select 
                                                    className="w-full p-2 border rounded-lg text-sm"
                                                    value={item.internalComponentId || ""}
                                                    onChange={(e) => {
                                                        const newItems = [...importData.items];
                                                        newItems[idx].internalComponentId = e.target.value;
                                                        setImportData({ ...importData, items: newItems });
                                                    }}
                                                >
                                                    <option value="">Selecionar Componente...</option>
                                                    {inventory.components.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-4">
                                                {item.internalComponentId ? (
                                                    <div className="flex items-center gap-2 text-green-600">
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span className="text-xs font-bold">Vinculado</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-amber-600">
                                                        <AlertTriangle className="w-4 h-4" />
                                                        <span className="text-xs font-bold">Pendente</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmImport}>Confirmar e Importar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Manual Modal */}
            <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Novo Recebimento Manual" size="3xl">
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const nfeNumber = formData.get('nfeNumber') as string;
                    const supplierName = formData.get('supplierName') as string;
                    const date = formData.get('date') as string;

                    if (!nfeNumber || !supplierName) {
                        addToast("Preencha os campos obrigatórios.", "error");
                        return;
                    }

                    await addReceivingOrder({
                        nfeNumber,
                        supplierName,
                        supplierCnpj: 'MANUAL',
                        date,
                        items: [],
                        status: 'pendente'
                    });

                    setIsManualModalOpen(false);
                    addToast("Recebimento manual criado!", "success");
                }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input name="nfeNumber" label="Número da NF / Identificador" placeholder="Ex: 12345" required />
                        <Input name="date" label="Data" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                    </div>
                    <Input name="supplierName" label="Fornecedor" placeholder="Nome do Fornecedor" required />
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="secondary" type="button" onClick={() => setIsManualModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Criar Recebimento</Button>
                    </div>
                </form>
            </Modal>

            {/* History Modal */}
            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="Histórico de Mapeamento" size="4xl">
                <div className="space-y-4">
                    <div className="max-h-[60vh] overflow-y-auto border rounded-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor (CNPJ)</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto Fornecedor</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Componente Interno</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappings.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-slate-400">Nenhum mapeamento salvo ainda.</td>
                                    </tr>
                                ) : (
                                    mappings.map(m => (
                                        <tr key={m.id} className="border-b border-slate-50">
                                            <td className="p-4 text-sm">{m.supplierCnpj}</td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium">{m.supplierProductName}</div>
                                                <div className="text-xs text-slate-400">Cód: {m.supplierProductCode}</div>
                                            </td>
                                            <td className="p-4 text-sm">
                                                {inventory.components.find(c => c.id === m.internalComponentId)?.name || 'Desconhecido'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
