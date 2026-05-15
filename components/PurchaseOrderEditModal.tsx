import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { PurchaseOrder, PurchaseOrderItem, InventoryHook, Component, ManufacturingHook } from '../types';

interface PurchaseOrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: PurchaseOrder) => Promise<void>;
  orderToEdit: PurchaseOrder | null;
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getComponentCost = (component: Component): number => {
    return component.purchaseCost ?? (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0);
};

export const PurchaseOrderEditModal: React.FC<PurchaseOrderEditModalProps> = ({ isOpen, onClose, onSave, orderToEdit, inventory, manufacturing }) => {
  const [draftOrder, setDraftOrder] = useState<Partial<PurchaseOrder>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [newItem, setNewItem] = useState<{ componentId: string, quantity: number }>({ componentId: '', quantity: 1 });
  const [componentSearch, setComponentSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
        setDraftOrder(orderToEdit || { items: [], installments: [] });
    }
  }, [isOpen, orderToEdit]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDraftOrder(prev => ({ ...prev, [name]: value }));
  };
  
  const handleItemChange = (itemId: string, field: 'quantity' | 'unitPrice', value: number) => {
    setDraftOrder(prev => ({
        ...prev,
        items: prev.items?.map(item => item.id === itemId ? { ...item, [field]: value } : item)
    }));
  };

  const handleAddItem = () => {
    if ((!newItem.componentId && !componentSearch) || newItem.quantity <= 0) return;
    
    let newItemData: PurchaseOrderItem;

    if (newItem.componentId.startsWith('avulso-')) {
        // It's an ad-hoc custom item
        const name = newItem.componentId.replace('avulso-', '');
        const id = `avulso-${Date.now()}`;
        newItemData = {
            id: id,
            name: name,
            quantity: newItem.quantity,
            unitPrice: 0,
        };
    } else if (newItem.componentId) {
        // Existing component or consumable
        let itemType: 'component' | 'consumable' | null = null;
        let foundItem: any = null;

        const component = inventory.components.find(c => c.id === newItem.componentId);
        if (component) {
            itemType = 'component';
            foundItem = component;
        } else {
            const consumable = manufacturing.consumables.find(c => c.id === newItem.componentId);
            if (consumable) {
                itemType = 'consumable';
                foundItem = consumable;
            }
        }

        if (!foundItem) return;

        if (draftOrder.items?.some(item => item.id === foundItem.id)) {
            alert("Este item já está na ordem de compra.");
            return;
        }

        newItemData = {
            id: foundItem.id,
            name: foundItem.name,
            quantity: newItem.quantity,
            unitPrice: itemType === 'component' 
                ? (foundItem.purchaseUnit ? (foundItem.purchaseCost || 0) : getComponentCost(foundItem)) 
                : (foundItem.purchasePrice || 0),
            purchaseUnit: itemType === 'component' ? (foundItem.purchaseUnit || foundItem.consumptionUnit) : undefined
        };
    } else {
        return;
    }
    
    setDraftOrder(prev => ({ ...prev, items: [...(prev.items || []), newItemData] }));
    setNewItem({ componentId: '', quantity: 1 });
    setComponentSearch('');
  };
  
  const handleRemoveItem = (itemId: string) => {
    setDraftOrder(prev => ({
        ...prev,
        items: prev.items?.filter(item => item.id !== itemId)
    }));
  };

  const handleSave = async () => {
    if (!draftOrder.items || draftOrder.items.length === 0) {
        alert("A ordem de compra deve ter pelo menos um item.");
        return;
    }
    setIsSaving(true);
    await onSave(draftOrder as PurchaseOrder);
    setIsSaving(false);
    onClose();
  };
  
  const availableItems = useMemo(() => {
    // Combine components and consumables
    const combined = [
        ...inventory.components.map(c => ({ id: c.id, name: c.name, sku: c.sku, type: 'Compon.' })),
        ...manufacturing.consumables.map(c => ({ id: c.id, name: c.name, sku: 'INSUMO', type: 'Insumo' }))
    ];

    if (!componentSearch) return combined.slice(0, 200); // Limit initial list for performance
    const lowerSearch = componentSearch.toLowerCase();
    
    return combined.filter(c => 
        (c.name || '').toLowerCase().includes(lowerSearch) || 
        (c.sku || '').toLowerCase().includes(lowerSearch)
    );
  }, [componentSearch, inventory.components, manufacturing.consumables]);

  const totalValue = draftOrder.items?.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={orderToEdit ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'} size="4xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome do Fornecedor" name="supplierName" value={draftOrder.supplierName || ''} onChange={handleInputChange} />
            <Input label="Data de Entrega Prevista" name="expectedDeliveryDate" type="date" value={draftOrder.expectedDeliveryDate || ''} onChange={handleInputChange} />
        </div>
        <Textarea label="Notas Adicionais" name="notes" value={draftOrder.notes || ''} onChange={handleInputChange} rows={2} />

        <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-black mb-2">Itens da Ordem</h3>
            <div className="space-y-2">
                {draftOrder.items?.map(item => {
                    const originalComponent = inventory.findComponentById(item.id);
                    const originalCost = originalComponent ? getComponentCost(originalComponent) : 0;
                    const isPriceEdited = Math.abs(item.unitPrice - originalCost) > 0.001;

                    return (
                        <div key={item.id} className="grid grid-cols-12 gap-3 items-center p-2 bg-gray-50 rounded-md">
                            <div className="col-span-12 md:col-span-5 font-medium text-black text-sm">
                                {item.name}
                                {item.purchaseUnit && <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-bold uppercase tracking-tighter">{item.purchaseUnit}</span>}
                            </div>
                            <div className="col-span-4 md:col-span-2">
                                <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 1)} min="1" className="text-sm" />
                            </div>
                            <div className="col-span-4 md:col-span-2" title={isPriceEdited ? `Preço de cadastro: ${formatCurrency(originalCost)}` : ''}>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    min="0"
                                    className={`text-sm ${isPriceEdited ? 'bg-yellow-100 border-yellow-400 focus:border-yellow-500 focus:ring-yellow-500' : ''}`}
                                />
                            </div>
                            <div className="col-span-4 md:col-span-2 text-sm font-semibold text-right text-black">{formatCurrency(item.unitPrice * item.quantity)}</div>
                            <div className="col-span-12 md:col-span-1 text-right">
                                <Button size="sm" variant="danger" onClick={() => handleRemoveItem(item.id)} className="!p-1.5" title="Remover Item">&times;</Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-black mb-2">Adicionar Novo Item</h3>
            <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 md:col-span-6">
                    <Input 
                        label="Buscar Componente ou Insumo (Autocompletar)" 
                        placeholder="Nome, SKU ou peça avulsa..." 
                        list="available-items-list"
                        value={componentSearch} 
                        onChange={e => {
                            const val = e.target.value;
                            setComponentSearch(val);
                            
                            // Try to find if the user selected a full match from the datalist
                            const combined = [
                                ...inventory.components.map(c => ({ id: c.id, name: c.name, sku: c.sku, type: 'Compon.' })),
                                ...manufacturing.consumables.map(c => ({ id: c.id, name: c.name, sku: 'INSUMO', type: 'Insumo' }))
                            ];
                            
                            const exactMatch = combined.find(c => `[${c.type}] ${c.name} (${c.sku})` === val || c.name === val);
                            
                            if (exactMatch) {
                                setNewItem(prev => ({ ...prev, componentId: exactMatch.id }));
                            } else if (val.trim()) {
                                setNewItem(prev => ({ ...prev, componentId: `avulso-${val.trim()}` }));
                            } else {
                                setNewItem(prev => ({ ...prev, componentId: '' }));
                            }
                        }}
                    />
                    <datalist id="available-items-list">
                        {availableItems.map(c => <option key={c.id} value={`[${c.type}] ${c.name} (${c.sku})`} />)}
                    </datalist>
                </div>
                <div className="col-span-6 md:col-span-3">
                    <Input label="Quantidade" type="number" min="1" value={newItem.quantity} onChange={e => setNewItem(prev => ({...prev, quantity: parseInt(e.target.value) || 1}))} />
                </div>
                <div className="col-span-6 md:col-span-3">
                    <Button onClick={handleAddItem} variant="secondary" className="w-full">Adicionar</Button>
                </div>
            </div>
        </div>

        <div className="border-t pt-4 text-right">
            <span className="text-xl font-bold text-black">Total: {formatCurrency(totalValue)}</span>
        </div>
      </div>
      <div className="flex justify-end pt-6 mt-4 border-t gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Ordem de Compra'}
        </Button>
      </div>
    </Modal>
  );
};