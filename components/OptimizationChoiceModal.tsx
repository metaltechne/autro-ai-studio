import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ProductionScenario, SubstitutionOption, InventoryHook, ManufacturingHook, CuttingOrdersHook, ManufacturingOrdersHook, ProductionScenarioShortage, ProductionOrdersHook } from '../types';
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
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const ShortageItemCard: React.FC<{
    shortage: ProductionScenarioShortage;
    onCut: (shortage: ProductionScenarioShortage, subOption: SubstitutionOption) => Promise<void>;
    onManufacture: (shortage: ProductionScenarioShortage) => Promise<void>;
    isProcessing: boolean;
    resolution?: { type: 'cut' | 'manufacture'; orderId: string };
}> = ({ shortage, onCut, onManufacture, isProcessing, resolution }) => {
    
    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-black">{shortage.shortage}x {shortage.componentName}</h4>
            
            {resolution ? (
                <div className="mt-4 text-center p-4 bg-green-50 text-green-700 rounded-md">
                    <p className="font-semibold">Resolvido!</p>
                    <p>Ordem {resolution.type === 'cut' ? 'de Corte' : 'de Fabricação'} {resolution.orderId} criada.</p>
                </div>
            ) : (
                <>
                    <div className="mt-3 border-t pt-3">
                        <h5 className="font-semibold text-sm text-blue-800 mb-2">Sugestões de Otimização (Corte)</h5>
                        <div className="space-y-2">
                            {shortage.substitutionOptions?.map((sub, index) => (
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
                    <div className="mt-3 border-t pt-3">
                         <h5 className="font-semibold text-sm text-yellow-800 mb-2">Alternativa</h5>
                         <div className="flex justify-between items-center p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-sm text-yellow-900">Fabricar este item a partir do seu processo de produção.</p>
                            <Button size="sm" onClick={() => onManufacture(shortage)} disabled={isProcessing}>
                                Fabricar
                            </Button>
                         </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const OptimizationChoiceModal: React.FC<OptimizationChoiceModalProps> = ({
    isOpen, onClose, scenario, onCreateOrder, inventory, manufacturing, cuttingOrdersHook, manufacturingOrdersHook, productionOrdersHook
}) => {
    const { addToast } = useToast();
    const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
    const [resolvedItems, setResolvedItems] = useState<Map<string, { type: 'cut' | 'manufacture'; orderId: string }>>(new Map());

    const shortagesWithOptions = scenario.shortages.filter(s => s.substitutionOptions && s.substitutionOptions.length > 0);

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
            const orderItems = [{ componentId: shortage.componentId, quantity: shortage.shortage }];
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