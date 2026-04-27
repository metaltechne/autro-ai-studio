
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InventoryHook, Component, Kit, KitComponent, ManufacturingHook, FamiliaComponente, View, CustomersHook, PurchaseOrdersHook, ProductionOrdersHook, ManufacturingOrdersHook, CuttingOrdersHook, Customer, PurchaseOrder, ProductionOrder, ManufacturingOrder, CuttingOrder } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from '../hooks/useToast';
import { Input } from './ui/Input';

type ActiveTab = 'components' | 'raw_materials' | 'kits' | 'manufacturing' | 'customers' | 'purchase_orders' | 'production_orders' | 'manufacturing_orders' | 'cutting_orders';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface EditableCellProps {
    value: string | number;
    onSave: (newValue: string | number) => void;
    type?: 'text' | 'number' | 'textarea';
    className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, type = 'text', className = '' }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.select();
            }
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (currentValue !== value) {
            onSave(type === 'number' ? parseFloat(String(currentValue).replace(',', '.')) || 0 : currentValue);
        }
    };

    if (isEditing) {
        if (type === 'textarea') {
            return (
                 <td className="p-0 align-top">
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={currentValue}
                        onChange={e => setCurrentValue(e.target.value)}
                        onBlur={handleSave}
                        className="w-full h-24 text-sm rounded-none border-2 border-autro-blue p-2"
                        autoFocus
                    />
                </td>
            );
        }
        return (
            <td className="p-0">
                <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type={type}
                    value={currentValue}
                    onChange={e => setCurrentValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="w-full h-full text-sm rounded-none border-2 border-autro-blue"
                    autoFocus
                />
            </td>
        );
    }

    return (
        <td onDoubleClick={() => setIsEditing(true)} className={`px-4 py-3 whitespace-nowrap text-sm text-black cursor-pointer ${className}`}>
            {type === 'number' ? (typeof value === 'number' ? formatCurrency(value) : value) : String(value)}
        </td>
    );
};


interface SpreadsheetViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    customersHook: CustomersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    productionOrdersHook: ProductionOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    setCurrentView: (view: View) => void;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ 
    inventory, 
    manufacturing, 
    customersHook,
    purchaseOrdersHook,
    productionOrdersHook,
    manufacturingOrdersHook,
    cuttingOrdersHook,
    setCurrentView 
}) => {
    const { components, kits, updateMultipleComponents, updateMultipleKits } = inventory;
    const { familias, saveMultipleFamilias, setActiveFamiliaId } = manufacturing;
    const { customers, updateMultipleCustomers } = customersHook;
    const { purchaseOrders, updateMultiplePurchaseOrders } = purchaseOrdersHook;
    const { productionOrders, updateMultipleProductionOrders } = productionOrdersHook;
    const { manufacturingOrders, updateMultipleManufacturingOrders } = manufacturingOrdersHook;
    const { cuttingOrders, updateMultipleCuttingOrders } = cuttingOrdersHook;
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<ActiveTab>('components');
    const [draftComponents, setDraftComponents] = useState<Component[]>([]);
    const [draftRawMaterials, setDraftRawMaterials] = useState<Component[]>([]);
    const [draftKits, setDraftKits] = useState<Kit[]>([]);
    const [draftFamilias, setDraftFamilias] = useState<FamiliaComponente[]>([]);
    const [draftCustomers, setDraftCustomers] = useState<Customer[]>([]);
    const [draftPurchaseOrders, setDraftPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [draftProductionOrders, setDraftProductionOrders] = useState<ProductionOrder[]>([]);
    const [draftManufacturingOrders, setDraftManufacturingOrders] = useState<ManufacturingOrder[]>([]);
    const [draftCuttingOrders, setDraftCuttingOrders] = useState<CuttingOrder[]>([]);
    
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const allComponentSkus = useMemo(() => new Set(components.map(c => c.sku.toLowerCase())), [components]);

    useEffect(() => {
        setDraftComponents(components.filter(c => c.type === 'component'));
        setDraftRawMaterials(components.filter(c => c.type === 'raw_material'));
        setDraftKits(kits);
        setDraftFamilias(familias);
        setDraftCustomers(customers);
        setDraftPurchaseOrders(purchaseOrders);
        setDraftProductionOrders(productionOrders);
        setDraftManufacturingOrders(manufacturingOrders);
        setDraftCuttingOrders(cuttingOrders);
        setIsDirty(false);
    }, [components, kits, familias, customers, purchaseOrders, productionOrders, manufacturingOrders, cuttingOrders]);
    
    const formatKitComponents = (components: KitComponent[]): string => components.map(c => `${c.componentSku}:${c.quantity}`).join(', ');
    const formatKitFasteners = (fasteners: { dimension: string; quantity: number }[]): string => fasteners.map(f => `${f.dimension}:${f.quantity}`).join(', ');

    const parseKitComposition = (str: string, isFastener: boolean): { success: boolean, data: any[], error?: string } => {
        if (!str?.trim()) return { success: true, data: [] };
        const parts = str.split(',');
        const resultData = [];
        for (const part of parts) {
            const [key, qtyStr] = part.split(':').map(s => s.trim());
            const quantity = parseInt(qtyStr, 10);
            if (!key || isNaN(quantity) || quantity <= 0) {
                return { success: false, data: [], error: `Formato inválido: '${part}'. Use SKU:QTD.` };
            }
            if (!isFastener) {
                if (!allComponentSkus.has(key.toLowerCase())) {
                    return { success: false, data: [], error: `SKU de componente '${key}' não encontrado.` };
                }
                resultData.push({ componentSku: key, quantity });
            } else {
                 if (!key.match(/^\d+x\d+(mm)?$/)) {
                    return { success: false, data: [], error: `Formato de dimensão inválido: '${key}'. Use '8x40' ou '8x40mm'.` };
                }
                const finalKey = key.endsWith('mm') ? key : `${key}mm`;
                resultData.push({ dimension: finalKey, quantity });
            }
        }
        return { success: true, data: resultData };
    };

    const handleUpdate = <T extends { id: string }>(id: string, field: keyof T | string, value: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        if (activeTab === 'kits' && (field === 'components' || field === 'requiredFasteners')) {
            const isFastener = field === 'requiredFasteners';
            const result = parseKitComposition(value, isFastener);
            if (result.success) {
                setter(prev => prev.map(item => (item.id === id ? { ...item, [field]: result.data } : item)));
                setIsDirty(true);
            } else {
                addToast(result.error || 'Erro de validação.', 'error');
            }
        } else {
            setter(prev => prev.map(item => (item.id === id ? { ...item, [field as keyof T]: value } : item)));
            setIsDirty(true);
        }
    };
    
     const handleFamiliaUpdate = (familiaId: string, nodeId: string, field: 'cost' | 'consumption', value: any) => {
        setDraftFamilias(prev => prev.map(familia => {
            if (familia.id !== familiaId) return familia;
            const newNodes = (familia.nodes || []).map(node => {
                if (node.id !== nodeId) return node;
                return { ...node, data: { ...node.data, [field]: value } };
            });
            return { ...familia, nodes: newNodes };
        }));
        setIsDirty(true);
    };


    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                updateMultipleComponents([...draftComponents, ...draftRawMaterials]),
                updateMultipleKits(draftKits),
                saveMultipleFamilias(draftFamilias),
                updateMultipleCustomers(draftCustomers),
                updateMultiplePurchaseOrders(draftPurchaseOrders),
                updateMultipleProductionOrders(draftProductionOrders),
                updateMultipleManufacturingOrders(draftManufacturingOrders),
                updateMultipleCuttingOrders(draftCuttingOrders),
            ]);
            setIsDirty(false);
            addToast('Alterações salvas com sucesso!', 'success');
        } catch (error) {
            addToast('Falha ao salvar alterações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: ActiveTab; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-autro-blue text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            {children}
        </button>
    );

    const renderTable = (data: any[], columns: { key: string; label: string; type?: 'text' | 'number' | 'textarea', format?: (val: any) => any }[], setter: any) => {
        if (!data || data.length === 0) return <p className="text-center text-gray-500 py-8">Nenhum dado para exibir.</p>;

        return (
             <div className="overflow-auto h-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            {columns.map(col => <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map(item => (
                            <tr key={item.id}>
                                {columns.map(col => {
                                    const value = col.format ? col.format(item[col.key]) : item[col.key];
                                    return (
                                        <EditableCell
                                            key={col.key}
                                            value={value}
                                            type={col.type || 'text'}
                                            onSave={(newValue) => handleUpdate(item.id, col.key, newValue, setter)}
                                            className={col.type === 'textarea' ? 'whitespace-pre-wrap' : ''}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderManufacturingTable = () => {
        if (draftFamilias.length === 0) return <p className="text-center text-gray-500 py-8">Nenhum processo encontrado.</p>;

        return (
            <div className="overflow-auto h-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome do Processo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo Etapa</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumo Matéria-Prima</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {draftFamilias.map(familia => {
                            const isGenerator = familia.nodes?.some(n => n.data.type === 'productGenerator');
                            const firstFabNode = familia.nodes?.find(n => n.data.type === 'etapaFabricacao');
                            const firstMaterialNode = familia.nodes?.find(n => n.data.type === 'materiaPrima');
                            
                            return (
                                <tr key={familia.id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-black font-medium">{familia.nome}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{isGenerator ? 'Gerador' : 'Simples'}</td>
                                    {isGenerator || !firstFabNode ? (
                                        <td className="px-4 py-3 text-sm text-gray-400">{isGenerator ? 'N/A (Gerador)' : 'N/A'}</td>
                                    ) : (
                                        <EditableCell value={firstFabNode.data.cost} type="number" onSave={val => handleFamiliaUpdate(familia.id, firstFabNode.id, 'cost', val)} />
                                    )}
                                    {isGenerator || !firstMaterialNode ? (
                                        <td className="px-4 py-3 text-sm text-gray-400">{isGenerator ? 'N/A (Gerador)' : 'N/A'}</td>
                                    ) : (
                                        <EditableCell value={firstMaterialNode.data.consumption || 0} type="number" onSave={val => handleFamiliaUpdate(familia.id, firstMaterialNode.id, 'consumption', val)} />
                                    )}
                                    <td className="px-4 py-3">
                                        {isGenerator && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                    setActiveFamiliaId(familia.id);
                                                    setCurrentView(View.MANUFACTURING);
                                                }}
                                            >
                                                Editar no Fluxo
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }
    
    const componentCols = [ { key: 'name', label: 'Nome' }, { key: 'sku', label: 'SKU' }, { key: 'custoMateriaPrima', label: 'Custo Mat. Prima', type: 'number' as const }, { key: 'custoFabricacao', label: 'Custo Fabricação', type: 'number' as const }, ];
    const rawMaterialCols = [ { key: 'name', label: 'Nome' }, { key: 'sku', label: 'SKU' }, { key: 'purchaseCost', label: 'Custo Compra', type: 'number' as const }, ];
    const kitCols = [ { key: 'name', label: 'Nome' }, { key: 'sku', label: 'SKU' }, { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'ano', label: 'Ano' }, { key: 'components', label: 'Componentes (SKU:Qtd)', type: 'textarea' as const, format: formatKitComponents }, { key: 'requiredFasteners', label: 'Fixadores (Dimensao:Qtd)', type: 'textarea' as const, format: formatKitFasteners }, ];
    const customerCols = [ { key: 'name', label: 'Nome' }, { key: 'document', label: 'Documento' }, { key: 'phone', label: 'Telefone' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Endereço' }, ];
    const purchaseOrderCols = [ { key: 'id', label: 'ID' }, { key: 'supplierName', label: 'Fornecedor' }, { key: 'expectedDeliveryDate', label: 'Entrega Prevista' }, { key: 'status', label: 'Status' }, { key: 'notes', label: 'Notas', type: 'textarea' as const }, ];
    const productionOrderCols = [ { key: 'id', label: 'ID' }, { key: 'status', label: 'Status' }, { key: 'notes', label: 'Notas', type: 'textarea' as const }, ];
    const manufacturingOrderCols = [ { key: 'id', label: 'ID' }, { key: 'status', label: 'Status' }, { key: 'predictedCost', label: 'Custo Previsto', type: 'number' as const }, ];
    const cuttingOrderCols = [ { key: 'id', label: 'ID' }, { key: 'status', label: 'Status' }, { key: 'quantity', label: 'Quantidade', type: 'number' as const }, ];

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex gap-2 flex-wrap">
                    <TabButton tabId="components">Componentes</TabButton>
                    <TabButton tabId="raw_materials">Matérias-Primas</TabButton>
                    <TabButton tabId="kits">Kits</TabButton>
                    <TabButton tabId="manufacturing">Processos</TabButton>
                    <TabButton tabId="customers">Clientes</TabButton>
                    <TabButton tabId="purchase_orders">O. Compra</TabButton>
                    <TabButton tabId="production_orders">O. Produção</TabButton>
                    <TabButton tabId="manufacturing_orders">O. Fabricação</TabButton>
                    <TabButton tabId="cutting_orders">O. Corte</TabButton>
                </div>
                <div className="flex items-center gap-4">
                    {isDirty && <span className="text-sm text-yellow-600 font-semibold">Alterações não salvas</span>}
                    <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
            <Card className="flex-grow overflow-hidden">
                 {activeTab === 'components' && renderTable(draftComponents, componentCols, setDraftComponents)}
                 {activeTab === 'raw_materials' && renderTable(draftRawMaterials, rawMaterialCols, setDraftRawMaterials)}
                 {activeTab === 'kits' && renderTable(draftKits, kitCols, setDraftKits)}
                 {activeTab === 'manufacturing' && renderManufacturingTable()}
                 {activeTab === 'customers' && renderTable(draftCustomers, customerCols, setDraftCustomers)}
                 {activeTab === 'purchase_orders' && renderTable(draftPurchaseOrders, purchaseOrderCols, setDraftPurchaseOrders)}
                 {activeTab === 'production_orders' && renderTable(draftProductionOrders, productionOrderCols, setDraftProductionOrders)}
                 {activeTab === 'manufacturing_orders' && renderTable(draftManufacturingOrders, manufacturingOrderCols, setDraftManufacturingOrders)}
                 {activeTab === 'cutting_orders' && renderTable(draftCuttingOrders, cuttingOrderCols, setDraftCuttingOrders)}
            </Card>
        </div>
    );
};
