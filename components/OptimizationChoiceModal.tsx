import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ProductionScenario, SubstitutionOption, InventoryHook, ManufacturingHook, CuttingOrdersHook, ManufacturingOrdersHook, ProductionScenarioShortage, ProductionOrdersHook, PurchaseOrdersHook } from '../types';
import { useToast } from '../hooks/useToast';

interface OptimizationChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenario: ProductionScenario;
    onCreateOrder: (scenario: ProductionScenario) => void;
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    cuttingOrdersHook: CuttingOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    productionOrdersHook: ProductionOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const ShortageItemCard: React.FC<{
    shortage: ProductionScenarioShortage;
    onCut: (shortage: ProductionScenarioShortage, subOption: SubstitutionOption) => Promise<void>;
    onManufacture: (shortage: ProductionScenarioShortage) => Promise<void>;
    onBuy: (shortage: ProductionScenarioShortage) => Promise<void>;
    isProcessing: boolean;
    resolution?: { type: 'cut' | 'manufacture' | 'buy'; orderId: string };
}> = ({ shortage, onCut, onManufacture, onBuy, isProcessing, resolution }) => {
    
    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-black">{shortage.shortage}x {shortage.componentName}</h4>
            
            {resolution ? (
                <div className="mt-4 text-center p-4 bg-green-50 text-green-700 rounded-md">
                    <p className="font-semibold">Resolvido!</p>
                    <p>Ordem {resolution.type === 'cut' ? 'de Corte' : resolution.type === 'manufacture' ? 'de Fabricação' : 'de Compra'} {resolution.orderId} criada.</p>
                </div>
            ) : (
                <>
                    {shortage.substitutionOptions && shortage.substitutionOptions.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                            <h5 className="font-semibold text-sm text-blue-800 mb-2">Sugestões de Otimização (Corte)</h5>
                            <div className="space-y-2">
                                {shortage.substitutionOptions.map((sub, index) => (
                                    <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded-md flex justify-between items-center">
                                        <div className="text-xs text-blue-900">
                                            <p><strong>Cortar de:</strong> {sub.sourceComponent.name}</p>
                                            <p>Estoque: {sub.sourceComponent.stock} | Custo Extra: {formatCurrency(sub.costOfCutting)}/un | Parado há: {sub.sourceComponentAgeDays} dias</p>
                                        </div>
                                        <Button size="sm" onClick={() => onCut(shortage, sub)} disabled={isProcessing}>
                                            Cortar
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-3 border-t pt-3">
                         <h5 className="font-semibold text-sm text-yellow-800 mb-2">Alternativas</h5>
                         <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                <p className="text-sm text-yellow-900">Fabricar este item a partir do seu processo de produção.</p>
                                <Button size="sm" onClick={() => onManufacture(shortage)} disabled={isProcessing}>
                                    Fabricar
                                </Button>
                             </div>
                             <div className="flex justify-between items-center p-2 bg-purple-50 border border-purple-200 rounded-md">
                                <p className="text-sm text-purple-900">Comprar este item de um fornecedor.</p>
                                <Button size="sm" onClick={() => onBuy(shortage)} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700">
                                    Comprar
                                </Button>
                             </div>
                         </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const OptimizationChoiceModal: React.FC<OptimizationChoiceModalProps> = ({
    isOpen, onClose, scenario, onCreateOrder, inventory, manufacturing, cuttingOrdersHook, manufacturingOrdersHook, productionOrdersHook, purchaseOrdersHook
}) => {
    const { addToast } = useToast();
    const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
    const [resolvedItems, setResolvedItems] = useState<Map<string, { type: 'cut' | 'manufacture' | 'buy'; orderId: string }>>(new Map());

    const shortagesWithOptions = scenario.shortages;

    const handleCut = async (shortage: ProductionScenarioShortage, subOption: SubstitutionOption) => {
        setProcessingItems(prev => new Set(prev).add(shortage.componentId));
        try {
            const orderId = await cuttingOrdersHook.addCuttingOrder(subOption.sourceComponent.id, shortage.componentId, shortage.shortage);
            if(orderId) {
                addToast(`Ordem de Corte ${orderId} criada.`, 'success');
                setResolvedItems(prev => new Map(prev).set(shortage.componentId, { type: 'cut', orderId }));
            }
        } catch (e) {
            addToast('Falha ao criar ordem de corte.', 'error');
        } finally {
            setProcessingItems(prev => { const s = new Set(prev); s.delete(shortage.componentId); return s; });
        }
    };
    
    const handleManufacture = async (shortage: ProductionScenarioShortage) => {
         setProcessingItems(prev => new Set(prev).add(shortage.componentId));
        try {
            let targetComponentId = shortage.componentId;
            if (targetComponentId.startsWith('unknown-')) {
                const sku = targetComponentId.replace('unknown-', '');
                const newComp = await inventory.addComponent({
                    name: shortage.componentName,
                    sku: sku,
                    type: 'component',
                    sourcing: 'manufactured',
                    custoFabricacao: 0,
                    custoMateriaPrima: 0,
                });
                if (newComp) targetComponentId = newComp.id;
            }

            const orderItems = [{ componentId: targetComponentId, quantity: shortage.shortage }];
            const analysis = manufacturing.analyzeManufacturingRun(orderItems, inventory.components);
            const orderId = await manufacturingOrdersHook.addManufacturingOrder(orderItems, analysis);
            if(orderId) {
                addToast(`Ordem de Fabricação ${orderId} criada.`, 'success');
                setResolvedItems(prev => new Map(prev).set(shortage.componentId, { type: 'manufacture', orderId }));
            }
        } catch (e) {
            addToast('Falha ao criar ordem de fabricação.', 'error');
        } finally {
            setProcessingItems(prev => { const s = new Set(prev); s.delete(shortage.componentId); return s; });
        }
    };

    const handleBuy = async (shortage: ProductionScenarioShortage) => {
        setProcessingItems(prev => new Set(prev).add(shortage.componentId));
        try {
            let targetComponentId = shortage.componentId;
            let sku = '';
            let sourcing: 'purchased' | 'manufactured' = 'purchased';
            
            const comp = inventory.findComponentById(shortage.componentId);
            if (comp) {
                sku = comp.sku;
                sourcing = comp.sourcing || 'purchased';
            } else if (targetComponentId.startsWith('unknown-')) {
                sku = targetComponentId.replace('unknown-', '');
                const newComp = await inventory.addComponent({
                    name: shortage.componentName,
                    sku: sku,
                    type: 'component',
                    sourcing: 'purchased',
                    custoFabricacao: 0,
                    custoMateriaPrima: 0,
                });
                if (newComp) {
                    targetComponentId = newComp.id;
                    sourcing = 'purchased';
                }
            }

            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 7); // Default 7 days
            const orderId = await purchaseOrdersHook.addPurchaseOrder([{
                componentId: targetComponentId,
                name: shortage.componentName,
                sku: sku,
                sourcing: sourcing,
                required: shortage.shortage,
                inStock: shortage.available,
                toOrder: shortage.shortage,
                abcClass: 'C'
            }], deliveryDate.toISOString().split('T')[0]);
            
            if(orderId) {
                addToast(`Ordem de Compra ${orderId} criada.`, 'success');
                setResolvedItems(prev => new Map(prev).set(shortage.componentId, { type: 'buy', orderId }));
            }
        } catch (e) {
            addToast('Falha ao criar ordem de compra.', 'error');
        } finally {
            setProcessingItems(prev => { const s = new Set(prev); s.delete(shortage.componentId); return s; });
        }
    };

    const handleCreateMainOrder = () => {
        onCreateOrder(scenario);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Resolver Faltas com Otimização" size="3xl">
            <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-4">
                {shortagesWithOptions.map(shortage => (
                    <ShortageItemCard 
                        key={shortage.componentId}
                        shortage={shortage}
                        onCut={handleCut}
                        onManufacture={handleManufacture}
                        onBuy={handleBuy}
                        isProcessing={processingItems.has(shortage.componentId)}
                        resolution={resolvedItems.get(shortage.componentId)}
                    />
                ))}
            </div>
            <div className="flex justify-between items-center pt-4 mt-4 border-t">
                <p className="text-sm text-gray-500">A ordem de produção principal ainda será criada com estas faltas. <br/>As ordens criadas aqui servirão para supri-las.</p>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose}>Voltar</Button>
                    <Button onClick={handleCreateMainOrder}>Concluir e Criar Ordem Principal</Button>
                </div>
            </div>
        </Modal>
    );
};