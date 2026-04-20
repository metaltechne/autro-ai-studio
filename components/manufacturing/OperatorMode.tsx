
import React, { useState, useEffect, useMemo } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryHook, WorkStation, View } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../../hooks/useToast';

interface OperatorModeProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
    inventory: InventoryHook;
    workStations: WorkStation[];
    onClose: () => void;
}

export const OperatorMode: React.FC<OperatorModeProps> = ({ 
    manufacturingOrdersHook, 
    inventory, 
    workStations,
    onClose 
}) => {
    const { manufacturingOrders, updateManufacturingOrderStatus, updateManufacturingOrderTracking } = manufacturingOrdersHook;
    const { addToast } = useToast();
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    const activeOrders = useMemo(() => 
        manufacturingOrders.filter(o => o.status === 'pendente' || o.status === 'em_producao'),
    [manufacturingOrders]);

    useEffect(() => {
        let interval: any;
        if (activeOrderId && startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeOrderId, startTime]);

    const handleStartOrder = (order: ManufacturingOrder) => {
        if (activeOrderId) {
            addToast("Já existe uma ordem em andamento. Pause-a primeiro.", "info");
            return;
        }
        setActiveOrderId(order.id);
        setStartTime(Date.now());
        setElapsedTime(order.actualTimeSeconds || 0);
        if (order.status === 'pendente') {
            updateManufacturingOrderStatus(order.id, 'em_producao');
        }
    };

    const handlePauseOrder = async () => {
        if (!activeOrderId) return;
        await updateManufacturingOrderTracking(activeOrderId, { actualTimeSeconds: elapsedTime });
        setActiveOrderId(null);
        setStartTime(null);
        addToast("Progresso salvo.", "success");
    };

    const handleCompleteOrder = async (order: ManufacturingOrder) => {
        const finalTime = activeOrderId === order.id ? elapsedTime : (order.actualTimeSeconds || 0);
        await updateManufacturingOrderTracking(order.id, { actualTimeSeconds: finalTime });
        await updateManufacturingOrderStatus(order.id, 'concluída');
        if (activeOrderId === order.id) {
            setActiveOrderId(null);
            setStartTime(null);
        }
        addToast(`Ordem ${order.id} concluída com sucesso!`, "success");
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
            <div className="bg-autro-blue p-4 text-white flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">MODO OPERADOR</h2>
                    {activeOrderId && (
                        <div className="bg-red-500 px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full"></span>
                            <span className="font-mono font-bold">EM EXECUÇÃO: {activeOrderId} ({formatTime(elapsedTime)})</span>
                        </div>
                    )}
                </div>
                <Button variant="secondary" onClick={onClose} className="!bg-white !text-autro-blue">Sair do Modo Operador</Button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 bg-gray-100">
                <div className="max-w-4xl mx-auto space-y-6">
                    {activeOrders.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-xl">Nenhuma ordem de fabricação pendente.</p>
                        </div>
                    ) : (
                        activeOrders.map(order => (
                            <Card key={order.id} className={`border-l-8 ${activeOrderId === order.id ? 'border-red-500 ring-2 ring-red-200' : 'border-autro-blue'}`}>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-xl font-bold text-black">{order.id}</h3>
                                                <Badge variant={order.status === 'em_producao' ? 'warning' : 'info'}>
                                                    {order.status === 'em_producao' ? 'Em Produção' : 'Pendente'}
                                                </Badge>
                                            </div>
                                            <p className="text-gray-600">Criada em: {new Date(order.createdAt).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">Tempo Acumulado</p>
                                            <p className="text-2xl font-mono font-bold text-black">
                                                {activeOrderId === order.id ? formatTime(elapsedTime) : formatTime(order.actualTimeSeconds || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                        <h4 className="font-bold text-black mb-2">Itens a Fabricar:</h4>
                                        <ul className="space-y-2">
                                            {order.orderItems.map((item, idx) => {
                                                const comp = inventory.findComponentById(item.componentId);
                                                return (
                                                    <li key={idx} className="flex justify-between items-center bg-white p-2 rounded border">
                                                        <span className="font-medium">{comp?.name || item.componentId}</span>
                                                        <span className="bg-autro-blue text-white px-2 py-1 rounded font-bold">{item.quantity} un</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>

                                    <div className="flex gap-4">
                                        {activeOrderId === order.id ? (
                                            <Button 
                                                className="flex-1 py-4 text-xl" 
                                                variant="secondary" 
                                                onClick={handlePauseOrder}
                                            >
                                                Pausar Cronômetro
                                            </Button>
                                        ) : (
                                            <Button 
                                                className="flex-1 py-4 text-xl" 
                                                variant="primary" 
                                                onClick={() => handleStartOrder(order)}
                                                disabled={!!activeOrderId}
                                            >
                                                Iniciar Produção
                                            </Button>
                                        )}
                                        <Button 
                                            className="flex-1 py-4 text-xl" 
                                            variant="success" 
                                            onClick={() => handleCompleteOrder(order)}
                                        >
                                            Concluir Ordem
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
