import React, { useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Component, InventoryHook, ManufacturingHook } from '../types';
import { evaluateProcess, parseFastenerSku } from '../hooks/manufacturing-evaluator';

interface ComponentProcessDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    component: Component;
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    onEditProcess: (familiaId: string) => void;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const getNodeTypeLabel = (type: string | undefined): string => {
    switch (type) {
        case 'etapaFabricacao': return 'Etapa de Fabricação';
        case 'materiaPrima': return 'Matéria-Prima';
        case 'inventoryComponent': return 'Componente de Estoque';
        default: return 'N/A';
    }
}

export const ComponentProcessDetailModal: React.FC<ComponentProcessDetailModalProps> = ({
    isOpen,
    onClose,
    component,
    manufacturing,
    inventory,
    onEditProcess
}) => {
    
    const evaluationResult = useMemo(() => {
        if (!component) return null;

        const familia = manufacturing.familias.find(f => f.id === component.familiaId);
        if (!familia) return null;

        const fastenerData = parseFastenerSku(component.sku);
        const variables: Record<string, number> = {};
        const stringVariables: Record<string, string> = {};

        if (fastenerData) {
            variables['bitola'] = fastenerData.bitola;
            variables['comprimento'] = fastenerData.comprimento;
            stringVariables['headCode'] = fastenerData.head;
        } else {
            // Fallback for non-fastener SKUs or different formats
            const skuParts = component.sku.split('-');
            if (skuParts.length >= 2) {
                const dimParts = skuParts[skuParts.length - 1].split('x');
                if (dimParts.length === 2) {
                    variables['bitola'] = Number(dimParts[0].replace(/\D/g, ''));
                    variables['comprimento'] = Number(dimParts[1].replace(/\D/g, ''));
                }
            }
        }
        
        const result = evaluateProcess(familia, variables, inventory.components, stringVariables, {
            workStations: manufacturing.workStations,
            operations: manufacturing.standardOperations,
            consumables: manufacturing.consumables,
            allFamilias: manufacturing.familias
        });
        
        // Filter for nodes that contribute to cost
        const costSteps = result.nodes.filter(node => 
            (node.data.type === 'etapaFabricacao' || node.data.type === 'materiaPrima' || node.data.type === 'inventoryComponent') && node.data.cost > 0
        );

        return {
            familia,
            costSteps
        };

    }, [component, manufacturing.familias, inventory.components]);

    if (!isOpen || !component || !evaluationResult) return null;

    const { familia, costSteps } = evaluationResult;
    const totalCost = component.custoMateriaPrima + component.custoFabricacao;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes do Processo: ${component.name}`} size="2xl">
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                
                {/* General Info */}
                <div>
                    <h4 className="text-md font-semibold text-black mb-2">Informações Gerais</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-3 bg-gray-50 rounded-md">
                        <div>
                            <p className="text-gray-600">SKU</p>
                            <p className="font-semibold text-black">{component.sku}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Família</p>
                            <p className="font-semibold text-black">{familia.nome}</p>
                        </div>
                         <div>
                            <p className="text-gray-600">Estoque Atual</p>
                            <p className="font-semibold text-black">{component.stock.toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Custo Total</p>
                            <p className="font-semibold text-autro-blue">{formatCurrency(totalCost)}</p>
                        </div>
                    </div>
                </div>

                {/* Process Steps Table */}
                <div>
                    <h4 className="text-md font-semibold text-black mb-2">Etapas de Fabricação e Custos</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Etapa / Material</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Custo Calculado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {costSteps.map(node => (
                                    <tr key={node.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-black">{node.data.label}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{getNodeTypeLabel(node.data.type)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-black">{formatCurrency(node.data.cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                             <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan={2} className="px-4 py-2 text-right text-black">Custo Fabricação</td>
                                    <td className="px-4 py-2 text-left text-black">{formatCurrency(component.custoFabricacao)}</td>
                                </tr>
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan={2} className="px-4 py-2 text-right text-black">Custo Mat. Prima</td>
                                    <td className="px-4 py-2 text-left text-black">{formatCurrency(component.custoMateriaPrima)}</td>
                                </tr>
                                <tr className="bg-autro-blue-light font-bold">
                                    <td colSpan={2} className="px-4 py-2 text-right text-autro-blue">Custo Total</td>
                                    <td className="px-4 py-2 text-left text-autro-blue">{formatCurrency(totalCost)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>

            <div className="flex justify-between items-center pt-6 border-t mt-4">
                <Button onClick={() => onEditProcess(familia.id)}>
                    Editar Processo de Fabricação
                </Button>
                <Button onClick={onClose} variant="secondary">Fechar</Button>
            </div>
        </Modal>
    );
};