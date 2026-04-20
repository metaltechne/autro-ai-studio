import React, { useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ProductionScenario, SubstitutionOption, InventoryHook, ManufacturingHook, CuttingOrdersHook, ManufacturingOrdersHook, ProductionScenarioShortage, ProductionOrdersHook, PurchaseOrdersHook } from '../types';
import { OptimizationChoiceModal } from './OptimizationChoiceModal';

interface AnalysisResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenarios: ProductionScenario[];
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

const SubstitutionSuggestion: React.FC<{ sub: SubstitutionOption }> = ({ sub }) => (
    <div className="text-xs text-blue-800 bg-blue-100 p-2 rounded-md mt-1 border border-blue-200">
        <p>
            <span className="font-semibold">Cortar de:</span> {sub.sourceComponent.name}
        </p>
        <p>
            <span className="font-semibold">Estoque:</span> {sub.sourceComponent.stock} | 
            <span className="font-semibold"> Custo Extra:</span> {formatCurrency(sub.costOfCutting)}/un | 
            <span className="font-semibold"> Parado há:</span> {sub.sourceComponentAgeDays} dias
        </p>
    </div>
);

const ScenarioCard: React.FC<{ 
    scenario: ProductionScenario; 
    isRecommended: boolean; 
    onSelect: (scenario: ProductionScenario) => void;
    isCreating: boolean;
}> = ({ scenario, isRecommended, onSelect, isCreating }) => {
    const hasShortages = scenario.shortages.length > 0;
    return (
        <div className={`p-4 border rounded-lg ${isRecommended ? 'border-autro-blue bg-autro-blue-light' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-lg text-black">
                        Cenário: <span className="text-autro-blue">{scenario.fastenerHeadCode}</span>
                        {isRecommended && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-autro-blue text-white">Recomendado</span>}
                    </h4>
                    <p className={`font-semibold ${scenario.isPossible ? 'text-green-600' : 'text-red-600'}`}>
                        {scenario.isPossible ? '✓ Produção Viável' : '✗ Estoque Insuficiente'}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-600">Custo Total</p>
                    <p className="font-bold text-xl text-black">{formatCurrency(scenario.totalCost)}</p>
                </div>
            </div>
            
            {scenario.shortages.length > 0 && (
                <div className="mt-3 border-t pt-3">
                    <h5 className="font-semibold text-sm text-black mb-2">Itens Faltantes:</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {scenario.shortages.map(shortage => (
                            <div key={shortage.componentId} className="text-sm bg-red-50 p-2 rounded-md border border-red-200">
                                <p className="text-red-800">
                                    <span className="font-bold">{shortage.shortage}x</span> {shortage.componentName}
                                </p>
                                {(shortage.substitutionOptions || []).length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-blue-900 mt-1">Sugestões de Otimização:</p>
                                        <div className="space-y-1">
                                            {shortage.substitutionOptions?.map((sub, i) => <SubstitutionSuggestion key={i} sub={sub} />)}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="mt-4 flex justify-end">
                <Button onClick={() => onSelect(scenario)} disabled={isCreating}>
                    {isCreating ? 'Criando Ordem...' : (hasShortages ? 'Resolver Faltas e Criar Ordem' : 'Criar Ordem com este Cenário')}
                </Button>
            </div>
        </div>
    );
};


export const AnalysisResultModal: React.FC<AnalysisResultModalProps> = (props) => {
    const { isOpen, onClose, scenarios, onCreateOrder } = props;
    const [isCreating, setIsCreating] = useState(false);
    const [optimizationChoice, setOptimizationChoice] = useState<ProductionScenario | null>(null);

    const recommendedScenario = useMemo(() => {
        if (scenarios.length === 0) return null;
        const possibleScenarios = scenarios.filter(r => r.isPossible);
        if (possibleScenarios.length > 0) {
            return possibleScenarios.sort((a, b) => a.totalCost - b.totalCost)[0];
        }
        return [...scenarios].sort((a, b) => a.shortageValue - b.shortageValue)[0];
    }, [scenarios]);

    const handleCreateOrder = async (scenario: ProductionScenario) => {
        setIsCreating(true);
        await onCreateOrder(scenario);
        setIsCreating(false);
    };
    
    const handleSelectScenario = (scenario: ProductionScenario) => {
        handleCreateOrder(scenario);
    };

    const handleCloseOptimization = () => {
        setOptimizationChoice(null);
    };

    return (
        <>
            <Modal isOpen={isOpen && !optimizationChoice} onClose={onClose} title="Análise de Viabilidade da Produção" size="4xl">
                <div className="max-h-[75vh] overflow-y-auto pr-2 -mr-2 space-y-4">
                    {scenarios.length > 0 ? (
                        scenarios.map(scenario => (
                            <ScenarioCard 
                                key={scenario.fastenerHeadCode}
                                scenario={scenario}
                                isRecommended={scenario.fastenerHeadCode === recommendedScenario?.fastenerHeadCode}
                                onSelect={handleSelectScenario}
                                isCreating={isCreating}
                            />
                        ))
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            <p>Não foi possível gerar cenários para este plano.</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isCreating}>Fechar</Button>
                </div>
            </Modal>
            
            {optimizationChoice && (
                <OptimizationChoiceModal
                    isOpen={!!optimizationChoice}
                    onClose={handleCloseOptimization}
                    scenario={optimizationChoice}
                    onCreateOrder={onCreateOrder}
                    inventory={props.inventory}
                    manufacturing={props.manufacturing}
                    cuttingOrdersHook={props.cuttingOrdersHook}
                    manufacturingOrdersHook={props.manufacturingOrdersHook}
                    productionOrdersHook={props.productionOrdersHook}
                    purchaseOrdersHook={props.purchaseOrdersHook}
                />
            )}
        </>
    );
};