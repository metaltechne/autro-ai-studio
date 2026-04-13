import React, { useState, useMemo, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { CuttingOrdersHook, InventoryHook, CuttingOrder, View } from '../types';
import { QRCodeScannerModal } from './ui/QRCodeScannerModal';
import { useToast } from '../hooks/useToast';
import { ConfirmationModal } from './ui/ConfirmationModal';
import * as api from '../hooks/api';

const formatDateTime = (isoString?: string) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const formatDuration = (seconds?: number) => {
    if (seconds === undefined) return '--';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
};


const OrderCard: React.FC<{
    order: CuttingOrder;
    inventory: InventoryHook;
    onStart: (order: CuttingOrder) => void;
    onFinish: (order: CuttingOrder) => void;
    onDelete: (order: CuttingOrder) => void;
}> = ({ order, inventory, onStart, onFinish, onDelete }) => {
    const source = inventory.findComponentById(order.sourceComponentId) || inventory.findComponentBySku(order.sourceComponentId);
    const target = inventory.findComponentById(order.targetComponentId) || inventory.findComponentBySku(order.targetComponentId);
    
    const [elapsedTime, setElapsedTime] = useState('');

    useEffect(() => {
        let interval: number | undefined;
        if (order.status === 'em_andamento' && order.startedAt) {
            const updateElapsedTime = () => {
                const start = new Date(order.startedAt!).getTime();
                const now = Date.now();
                const duration = Math.floor((now - start) / 1000);
                setElapsedTime(formatDuration(duration));
            };
            updateElapsedTime();
            interval = window.setInterval(updateElapsedTime, 1000);
        }
        return () => clearInterval(interval);
    }, [order.status, order.startedAt]);

    if (!source || !target) return null;

    return (
        <Card className="flex flex-col">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-autro-blue">{order.id}</h4>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                    {order.status === 'pendente' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(order);
                            }}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Excluir Ordem"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div className="my-2 flex-grow space-y-2 text-sm text-black">
                <p><strong>De:</strong> {order.quantity}x {source.name}</p>
                <p><strong>Para:</strong> {order.quantity}x {target.name}</p>
            </div>
             <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                {order.status === 'pendente' && <Button onClick={() => onStart(order)} className="w-full">Iniciar Corte</Button>}
                {order.status === 'em_andamento' && (
                    <div className="flex flex-col gap-2">
                        <div className="text-center font-semibold text-black">Em andamento por: {elapsedTime}</div>
                        <Button onClick={() => onFinish(order)} className="w-full">Finalizar Corte</Button>
                    </div>
                )}
                {order.status === 'concluída' && <p><strong>Duração:</strong> <span className="font-semibold text-black">{formatDuration(order.durationSeconds)}</span></p>}
            </div>
        </Card>
    );
};

const KanbanColumn: React.FC<{
    title: string;
    orders: CuttingOrder[];
    inventory: InventoryHook;
    onStartOrder: (order: CuttingOrder) => void;
    onFinishOrder: (order: CuttingOrder) => void;
    onDeleteOrder: (order: CuttingOrder) => void;
}> = ({ title, orders, inventory, onStartOrder, onFinishOrder, onDeleteOrder }) => (
    <div className="flex flex-col flex-1 bg-gray-100/80 rounded-lg">
        <h3 className="p-3 font-semibold text-black border-b">{title} ({orders.length})</h3>
        <div className="space-y-3 p-3 flex-grow overflow-y-auto">
            {orders.map(order => (
                <OrderCard key={order.id} order={order} inventory={inventory} onStart={onStartOrder} onFinish={onFinishOrder} onDelete={onDeleteOrder} />
            ))}
        </div>
    </div>
);


interface CuttingOrdersViewProps {
    cuttingOrdersHook: CuttingOrdersHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
}

export const CuttingOrdersView: React.FC<CuttingOrdersViewProps> = ({ cuttingOrdersHook, inventory, setCurrentView }) => {
    const { cuttingOrders, startCuttingOrder, finishCuttingOrder, deleteCuttingOrder } = cuttingOrdersHook;
    const { addToast } = useToast();
    const [scanningFor, setScanningFor] = useState<{ order: CuttingOrder; action: 'start' | 'finish' } | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<CuttingOrder | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSaveToFirebase = async () => {
        setIsSyncing(true);
        try {
            await api.forceUseFirebase();
            const localData = await api.getLocalData();
            await api.restoreAllData(localData);
            await api.forceUseLocalStorage();
            addToast('Dados salvos no Firebase!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            addToast('Erro ao salvar no Firebase.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const ordersByStatus = useMemo(() => {
        return cuttingOrders.reduce((acc, order) => {
            (acc[order.status] = acc[order.status] || []).push(order);
            return acc;
        }, {} as Record<CuttingOrder['status'], CuttingOrder[]>);
    }, [cuttingOrders]);
    
    const handleScanSuccess = async (decodedText: string) => {
        if (!scanningFor) return;

        try {
            const data = JSON.parse(decodedText);
            if (!data || data.type !== 'component' || !data.id) {
                addToast("QR Code inválido.", 'error');
                return;
            }

            let success = false;
            if (scanningFor.action === 'start') {
                success = await startCuttingOrder(scanningFor.order.id, data.id);
            } else {
                success = await finishCuttingOrder(scanningFor.order.id, data.id);
            }
            
            if (success) {
                setScanningFor(null); // Close modal on success
            }

        } catch(e) {
            addToast("QR Code inválido ou não pertence a este sistema.", 'error');
        }
    };

    const handleDeleteRequest = (order: CuttingOrder) => {
        setDeletingOrder(order);
    };

    const handleConfirmDelete = async () => {
        if (!deletingOrder) return;
        setIsConfirmingDelete(true);
        await deleteCuttingOrder(deletingOrder.id);
        // Toast is handled inside the hook
        setDeletingOrder(null);
        setIsConfirmingDelete(false);
    };
    
    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-3xl font-bold text-black">Ordens de Corte</h2>
                <div className="flex gap-2">
                    <Button onClick={handleSaveToFirebase} disabled={isSyncing} variant="primary">
                        {isSyncing ? 'Salvando...' : '💾 Salvar'}
                    </Button>
                    <Button onClick={() => setCurrentView(View.FASTENER_CUTTING)}>
                        Nova Ordem de Corte
                    </Button>
                </div>
            </div>
            <div className="flex-grow min-h-0 flex flex-col md:flex-row gap-4">
                <KanbanColumn 
                    title="Pendente" 
                    orders={ordersByStatus.pendente || []} 
                    inventory={inventory}
                    onStartOrder={(order) => setScanningFor({ order, action: 'start'})}
                    onFinishOrder={() => {}}
                    onDeleteOrder={handleDeleteRequest}
                />
                 <KanbanColumn 
                    title="Em Andamento" 
                    orders={ordersByStatus.em_andamento || []} 
                    inventory={inventory}
                    onStartOrder={() => {}}
                    onFinishOrder={(order) => setScanningFor({ order, action: 'finish'})}
                    onDeleteOrder={handleDeleteRequest}
                />
                 <KanbanColumn 
                    title="Concluída" 
                    orders={ordersByStatus.concluída || []} 
                    inventory={inventory}
                    onStartOrder={() => {}}
                    onFinishOrder={() => {}}
                    onDeleteOrder={handleDeleteRequest}
                />
            </div>

            {scanningFor && (
                <QRCodeScannerModal
                    isOpen={!!scanningFor}
                    onClose={() => setScanningFor(null)}
                    onScanSuccess={handleScanSuccess}
                />
            )}

            <ConfirmationModal
                isOpen={!!deletingOrder}
                onClose={() => setDeletingOrder(null)}
                onConfirm={handleConfirmDelete}
                title={`Excluir Ordem de Corte "${deletingOrder?.id}"`}
                isConfirming={isConfirmingDelete}
            >
                <p>Tem certeza? Esta ação é irreversível e só é permitida para ordens pendentes.</p>
            </ConfirmationModal>
        </div>
    );
};