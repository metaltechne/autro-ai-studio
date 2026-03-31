
import React, { useState, useMemo } from 'react';
import { InventoryHook, Component, CuttingOrdersHook } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from '../hooks/useToast';
// Fix: Import parseFastenerSku from shared evaluator.
import { parseFastenerSku } from '../hooks/manufacturing-evaluator';

interface FastenerCuttingViewProps {
    inventory: InventoryHook;
    cuttingOrdersHook: CuttingOrdersHook;
}

export const FastenerCuttingView: React.FC<FastenerCuttingViewProps> = ({ inventory, cuttingOrdersHook }) => {
    const { components } = inventory;
    const { addCuttingOrder } = cuttingOrdersHook;
    const { addToast } = useToast();

    const [sourceComponentId, setSourceComponentId] = useState<string | null>(null);
    const [targetComponentId, setTargetComponentId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isCreating, setIsCreating] = useState(false);

    const fastenerComponents = useMemo(() => {
        return components.filter(c => c.familiaId === 'fam-fixadores' && c.stock > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [components]);

    const sourceComponent = useMemo(() => {
        if (!sourceComponentId) return null;
        return fastenerComponents.find(c => c.id === sourceComponentId) || null;
    }, [sourceComponentId, fastenerComponents]);

    const targetComponents = useMemo(() => {
        if (!sourceComponent) return [];
        const sourceDims = parseFastenerSku(sourceComponent.sku);
        if (!sourceDims) return [];

        return components.filter(c => {
            if (c.id === sourceComponent.id) return false;
            const targetDims = parseFastenerSku(c.sku);
            return targetDims &&
                targetDims.head === sourceDims.head &&
                targetDims.bitola === sourceDims.bitola &&
                targetDims.comprimento < sourceDims.comprimento;
        }).sort((a,b) => (parseFastenerSku(b.sku)?.comprimento || 0) - (parseFastenerSku(a.sku)?.comprimento || 0));
    }, [sourceComponent, components]);
    
    const targetComponent = useMemo(() => {
        if (!targetComponentId) return null;
        return targetComponents.find(c => c.id === targetComponentId) || null;
    }, [targetComponentId, targetComponents]);

    const handleSelectSource = (id: string) => {
        setSourceComponentId(id);
        setTargetComponentId(null);
        setQuantity(1);
    };

    const handleSelectTarget = (id: string) => {
        setTargetComponentId(id);
        setQuantity(1);
    };
    
    const handleCreateOrder = async () => {
        if (!sourceComponent || !targetComponent || quantity <= 0) return;

        if (quantity > sourceComponent.stock) {
            addToast(`Quantidade excede o estoque de ${sourceComponent.stock} unidades.`, 'error');
            return;
        }

        setIsCreating(true);
        try {
            const newOrderId = await addCuttingOrder(sourceComponent.id, targetComponent.id, quantity);
            if(newOrderId) {
                addToast(`Ordem de Corte ${newOrderId} criada com sucesso.`, 'success');
                setSourceComponentId(null);
                setTargetComponentId(null);
                setQuantity(1);
            } else {
                addToast('Falha ao criar a ordem de corte.', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Ocorreu um erro ao criar a ordem.', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const sourceDims = sourceComponent ? parseFastenerSku(sourceComponent.sku) : null;
    const targetDims = targetComponent ? parseFastenerSku(targetComponent.sku) : null;
    const scrapLength = sourceDims && targetDims ? sourceDims.comprimento - targetDims.comprimento : 0;

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Criar Ordem de Corte de Fixador</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Source Column */}
                <Card className="lg:col-span-1">
                    <h3 className="text-lg font-semibold text-black mb-4">1. Selecione o Fixador de Origem</h3>
                    <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                        {fastenerComponents.map(c => (
                            <div
                                key={c.id}
                                onClick={() => handleSelectSource(c.id)}
                                className={`p-3 border rounded-md cursor-pointer transition-all ${sourceComponentId === c.id ? 'bg-autro-blue-light border-autro-blue shadow-md' : 'hover:bg-gray-50'}`}
                            >
                                <p className="font-semibold text-black">{c.name}</p>
                                <p className="text-sm text-gray-500">Estoque: {c.stock}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Target & Execution Column */}
                <Card className="lg:col-span-2">
                     <h3 className="text-lg font-semibold text-black mb-4">2. Selecione o Fixador de Destino</h3>
                     {!sourceComponent ? (
                        <div className="text-center text-gray-500 py-16 border-2 border-dashed rounded-lg">Selecione um fixador na coluna à esquerda.</div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                               {targetComponents.length > 0 ? targetComponents.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => handleSelectTarget(c.id)}
                                        className={`p-3 border rounded-md cursor-pointer transition-all ${targetComponentId === c.id ? 'bg-autro-blue-light border-autro-blue shadow-md' : 'hover:bg-gray-50'}`}
                                    >
                                        <p className="font-semibold text-black">{c.name}</p>
                                        <p className="text-sm text-gray-500">Estoque: {c.stock}</p>
                                    </div>
                                )) : (
                                    <p className="text-sm text-center text-gray-500">Nenhum fixador mais curto compatível encontrado.</p>
                                )}
                            </div>
                             {targetComponent && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-black">3. Confirmação</h3>
                                    <Input 
                                        label={`Quantidade a cortar (max: ${sourceComponent.stock})`}
                                        type="number"
                                        min="1"
                                        max={sourceComponent.stock}
                                        value={quantity}
                                        onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                                    />
                                     <div className="p-4 bg-gray-50 rounded-lg border space-y-2 text-sm">
                                        <h4 className="font-semibold text-center mb-2">Resumo da Ordem de Corte</h4>
                                        <p><strong>De:</strong> {quantity}x {sourceComponent.name}</p>
                                        <p><strong>Para:</strong> {quantity}x {targetComponent.name}</p>
                                        <p><strong>Retalho gerado:</strong> {quantity}x Retalho de {scrapLength}mm</p>
                                    </div>
                                    <Button onClick={handleCreateOrder} disabled={isCreating} className="w-full">
                                        {isCreating ? 'Criando...' : `Criar Ordem de Corte`}
                                    </Button>
                                </div>
                            )}
                        </div>
                     )}
                </Card>
            </div>
        </div>
    );
};
