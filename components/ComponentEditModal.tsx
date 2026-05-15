
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Component, FamiliaComponente } from '../types';

interface ComponentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (component: Component, stockDelta?: number) => Promise<void>;
    componentToEdit: Component | null;
    familias: FamiliaComponente[];
}

export const ComponentEditModal: React.FC<ComponentEditModalProps> = ({ isOpen, onClose, onSave, componentToEdit, familias }) => {
    const [data, setData] = useState<Partial<Component>>({});
    const [newStock, setNewStock] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && componentToEdit) {
            setData(componentToEdit);
            // Se for item comprado com fator de conversão, mostramos no Edit Modal a unidade de COMPRA (ex: Barras)
            // para facilitar para o usuário, mas salvamos em metros (unid. consumo) no DB.
            const conversionFactor = componentToEdit.purchaseQuantity || 1;
            console.log('ComponentEditModal: Loading', {
                componentName: componentToEdit.name,
                sourcing: componentToEdit.sourcing,
                stock: componentToEdit.stock,
                conversionFactor
            });
            if (componentToEdit.sourcing === 'purchased' && conversionFactor > 1) {
                setNewStock((componentToEdit.stock || 0) / conversionFactor);
            } else {
                setNewStock(componentToEdit.stock || 0);
            }
        } else {
            setData({});
            setNewStock(0);
        }
        setIsSaving(false);
    }, [isOpen, componentToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        let parsedValue: string | number | undefined = value;
        if (type === 'number') {
            parsedValue = value === '' ? undefined : parseFloat(value.replace(',', '.'));
        }

        setData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const handleStockChange = (val: string) => {
        const sanitized = val.replace(',', '.');
        if (sanitized === '' || sanitized === '-') {
            setNewStock(0);
            return;
        }
        const num = parseFloat(sanitized);
        if (!isNaN(num)) {
            setNewStock(num);
        }
    };

    const calculatedConsumptionStock = useMemo(() => {
        const factor = data.purchaseQuantity || 1;
        if (data.sourcing === 'purchased' && factor > 1) {
            return newStock * factor;
        }
        return newStock;
    }, [newStock, data.sourcing, data.purchaseQuantity]);

    const handleSave = async () => {
        if (!data.name || !data.sku) {
            alert('Por favor, preencha Nome e SKU.');
            return;
        }
        setIsSaving(true);
        
        // Convertemos de volta para Unidade de Consumo antes de salvar
        const factor = data.purchaseQuantity || 1;
        const finalStockInConsumptionUnit = (data.sourcing === 'purchased' && factor > 1) 
            ? newStock * factor 
            : newStock;
        
        console.log('ComponentEditModal: Saving', {
            componentName: data.name,
            sourcing: data.sourcing,
            factor,
            newStock,
            finalStockInConsumptionUnit,
            rawFactor: data.purchaseQuantity,
            originalStock: componentToEdit?.stock
        });

        // Cálculo do custo rateado por unidade de consumo (ex: custo por metro)
        let calculatedUnitCost = data.cost || 0;
        if (data.sourcing === 'purchased' && data.purchaseCost && factor > 0) {
            calculatedUnitCost = data.purchaseCost / factor;
        }

        // --- CÁLCULO DE CONSISTÊNCIA DO DELTA ---
        // O estoque atual no banco está em unidade de consumo.
        // O `finalStockInConsumptionUnit` é o valor convertido para unidade de consumo.
        // O delta deve ser A DIFERENÇA nessas unidades.
        const currentStockInConsumptionUnit = componentToEdit?.stock || 0;
        const stockDelta = finalStockInConsumptionUnit - currentStockInConsumptionUnit;
        
        console.log('ComponentEditModal: Saving - Delta Calculation', {
            finalStockInConsumptionUnit,
            currentStockInConsumptionUnit,
            stockDelta
        });

        const componentToSave = {
            ...data,
            stock: finalStockInConsumptionUnit, // Garante que o objeto salvo tenha o estoque em metros
            cost: calculatedUnitCost // Atualiza o custo unitário (rateado)
        } as Component;

        await onSave(componentToSave, stockDelta);
        setIsSaving(false);
        onClose();
    };

    if (!isOpen || !componentToEdit) return null;

    const resultingUnitCost = data.purchaseQuantity && data.purchaseCost ? data.purchaseCost / data.purchaseQuantity : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Componente: ${componentToEdit.name}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Nome do Componente" name="name" value={data.name || ''} onChange={handleChange} />
                    <Input label="SKU" name="sku" value={data.sku || ''} onChange={handleChange} />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <Input 
                        label={`Quantidade em Estoque (${data.purchaseUnit || 'Unid.'})`} 
                        type="number" 
                        name="stock" 
                        value={newStock} 
                        onChange={e => handleStockChange(e.target.value)} 
                        helpText={data.purchaseQuantity && data.purchaseQuantity > 1 ? 
                            `Equivale a ${calculatedConsumptionStock.toFixed(2)} ${data.consumptionUnit || 'un'}` : 
                            undefined
                        }
                    />
                </div>
                
                <Select label="Origem" name="sourcing" value={data.sourcing || 'manufactured'} onChange={handleChange}>
                    <option value="manufactured">Fabricado Internamente</option>
                    <option value="purchased">Comprado de Fornecedor</option>
                    <option value="beneficiado">Beneficiado Externamente</option>
                </Select>

                {data.sourcing === 'purchased' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Logística de Compra e Custos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Unidade de Compra (ex: Barra, Kg)" 
                                name="purchaseUnit" 
                                value={data.purchaseUnit || ''} 
                                onChange={handleChange} 
                                placeholder="Ex: Barra"
                            />
                            <Input 
                                label="Unidade de Consumo (ex: m, mm, Kg)" 
                                name="consumptionUnit" 
                                value={data.consumptionUnit || ''} 
                                onChange={handleChange} 
                                placeholder="Ex: m"
                            />
                            <Input 
                                label="Fator Conversão (comprimento da barra ou similar)" 
                                name="purchaseQuantity" 
                                type="number"
                                step="0.001"
                                value={data.purchaseQuantity || 1} 
                                onChange={handleChange} 
                                placeholder="Ex: 6 se 1 barra = 6m"
                            />
                            <Input 
                                label={`Custo por ${data.purchaseUnit || 'unid.'}`} 
                                name="purchaseCost" 
                                type="number" 
                                step="0.01"
                                value={data.purchaseCost || ''} 
                                onChange={handleChange} 
                            />
                        </div>
                        
                        {resultingUnitCost > 0 && (
                            <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded text-sm text-emerald-800">
                                <span className="font-medium">Custo por {data.consumptionUnit || 'unid.'} calculado:</span>
                                <span className="font-bold">R$ {resultingUnitCost.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end pt-4 border-t mt-4 gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
