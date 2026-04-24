import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ManufacturingOrdersHook, ManufacturingOrder, InventoryHook, Installment, ManufacturingHook } from '../types';
import { FinancialManagementModal } from './ui/FinancialManagementModal';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const statusMap: Record<ManufacturingOrder['status'], string> = {
    pendente: 'Pendente',
    em_producao: 'Em Produção',
    concluída: 'Concluída',
    cancelada: 'Cancelada',
};


// --- Order Card ---
const OrderCard: React.FC<{ order: ManufacturingOrder, inventory: InventoryHook, onEdit: (order: ManufacturingOrder) => void }> = ({ order, inventory, onEdit }) => {
    const totalToPay = order.installments.reduce((sum, inst) => sum + (inst.status === 'pendente' ? inst.value : 0), 0);
    return (
        <div 
            draggable 
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', order.id);
                if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '0.5';
                }
            }}
            onDragEnd={(e) => {
                if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '1';
                }
            }}
            className="p-3 bg-white rounded-lg border shadow-sm cursor-pointer active:cursor-grabbing hover:shadow-md hover:border-autro-blue transition-all flex flex-col"
            onClick={() => onEdit(order)}
        >
            <h4 className="font-bold text-autro-blue">{order.id}</h4>
            <div className="my-2 flex-grow overflow-hidden">
                <ul className="text-sm text-black space-y-1 max-h-24 overflow-y-auto pr-2 scrollbar-thin">
                    {order.orderItems.map(item => {
                        const component = inventory.findComponentById(item.componentId);
                        return <li key={item.componentId} className="truncate" title={component?.name}><strong>{item.quantity}x</strong> {component?.name || 'Item desconhecido'}</li>;
                    })}
                </ul>
            </div>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 mt-2 flex-shrink-0">
                <div className="text-gray-600">Custo Previsto:</div><div className="font-semibold text-right">{formatCurrency(order.predictedCost)}</div>
                <div className="text-gray-600">Total a Pagar:</div><div className="font-semibold text-right text-red-600">{formatCurrency(totalToPay)}</div>
            </div>
            {order.analysis.detailedBreakdown && order.analysis.detailedBreakdown.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Breakdown de Custos:</p>
                    <div className="space-y-1">
                        {order.analysis.detailedBreakdown.slice(0, 3).map((step, i) => (
                            <div key={i} className="flex justify-between text-[9px] text-slate-500">
                                <span className="truncate pr-2">{step.name}</span>
                                <span className="font-bold">{formatCurrency(step.cost)}</span>
                            </div>
                        ))}
                        {order.analysis.detailedBreakdown.length > 3 && (
                            <p className="text-[8px] text-slate-400 italic">...e mais {order.analysis.detailedBreakdown.length - 3} itens</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Kanban Column ---
const KanbanColumn: React.FC<{
    title: string;
    status: ManufacturingOrder['status'];
    orders: ManufacturingOrder[];
    inventory: InventoryHook;
    onEditOrder: (order: ManufacturingOrder) => void;
    onDrop: (status: ManufacturingOrder['status']) => void;
    totalPredictedCost: number;
    totalPendingPayment: number;
}> = ({ title, status, orders, inventory, onEditOrder, onDrop, totalPredictedCost, totalPendingPayment }) => {
    const [isOver, setIsOver] = useState(false);
    return (
        <div 
            onDrop={(e) => { e.preventDefault(); onDrop(status); setIsOver(false); }}
            onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            className={`flex flex-col flex-1 bg-gray-100/80 rounded-lg transition-colors ${isOver ? 'bg-autro-blue-light' : ''}`}
        >
            <div className="p-3 flex-shrink-0 border-b">
                <h3 className="font-semibold text-black mb-1">{title} ({orders.length})</h3>
                <div className="text-xs text-gray-600">
                    <p>Custo Previsto: <span className="font-semibold text-black">{formatCurrency(totalPredictedCost)}</span></p>
                    <p>A Pagar: <span className="font-semibold text-red-600">{formatCurrency(totalPendingPayment)}</span></p>
                </div>
            </div>
            <div className="space-y-3 p-3 flex-grow overflow-y-auto">
                {orders.map(order => <OrderCard key={order.id} order={order} inventory={inventory} onEdit={onEditOrder} />)}
            </div>
        </div>
    );
};


export const ProductionFinancialFlowView: React.FC<{ manufacturingOrdersHook: ManufacturingOrdersHook; inventory: InventoryHook; manufacturing: ManufacturingHook; }> = ({ manufacturingOrdersHook, inventory, manufacturing }) => {
    const { manufacturingOrders, updateManufacturingOrderStatus, updateManufacturingOrderInstallments, updateManufacturingOrderAnalysis } = manufacturingOrdersHook;
    const [editingOrder, setEditingOrder] = useState<ManufacturingOrder | null>(null);

    const orderedOrders = useMemo(() => {
        return [...manufacturingOrders].sort((a, b) => {
            const nextDueDateA = a.installments.filter(i => i.status === 'pendente').map(i => new Date(i.dueDate).getTime()).sort()[0] || Infinity;
            const nextDueDateB = b.installments.filter(i => i.status === 'pendente').map(i => new Date(i.dueDate).getTime()).sort()[0] || Infinity;
            return nextDueDateA - nextDueDateB;
        });
    }, [manufacturingOrders]);

    const { ordersByStatus, summaryByStatus } = useMemo(() => {
        const byStatus = orderedOrders.reduce((acc, order) => {
            if (order.status !== 'cancelada') {
                (acc[order.status] = acc[order.status] || []).push(order);
            }
            return acc;
        }, {} as Record<ManufacturingOrder['status'], ManufacturingOrder[]>);

        const summary: Record<string, { totalPredictedCost: number; totalPendingPayment: number }> = {};
        Object.entries(byStatus).forEach(([status, orders]: [string, ManufacturingOrder[]]) => {
            summary[status] = orders.reduce((acc, order) => {
                acc.totalPredictedCost += order.predictedCost;
                acc.totalPendingPayment += order.installments.reduce((sum, inst) => sum + (inst.status === 'pendente' ? inst.value : 0), 0);
                return acc;
            }, { totalPredictedCost: 0, totalPendingPayment: 0 });
        });

        return { ordersByStatus: byStatus, summaryByStatus: summary };
    }, [orderedOrders]);

    const summary = useMemo(() => {
        const now = new Date();
        const todayStart = now.setHours(0, 0, 0, 0);
        
        const next7Days = new Date(todayStart);
        next7Days.setDate(next7Days.getDate() + 7);
        
        const next30Days = new Date(todayStart);
        next30Days.setDate(next30Days.getDate() + 30);

        return manufacturingOrders.reduce((acc, order) => {
             if (order.status === 'em_producao') {
                acc.inProductionCount++;
            }
            order.installments?.forEach(inst => {
                if (inst.status === 'pendente') {
                    const paymentDate = new Date(inst.dueDate).getTime() + (new Date().getTimezoneOffset() * 60 * 1000); // Adjust for UTC
                    if (paymentDate >= todayStart && paymentDate < next7Days.getTime()) {
                        acc.dueNext7Days += inst.value;
                    }
                    if (paymentDate >= todayStart && paymentDate < next30Days.getTime()) {
                        acc.dueNext30Days += inst.value;
                    }
                }
            });
            return acc;
        }, { dueNext7Days: 0, dueNext30Days: 0, inProductionCount: 0 });
    }, [manufacturingOrders]);

    const handleDrop = (targetStatus: ManufacturingOrder['status']) => {
        const orderId = (window.event as DragEvent).dataTransfer?.getData('text/plain');
        if (!orderId) return;
        
        const order = manufacturingOrders.find(o => o.id === orderId);
        if (!order || order.status === targetStatus) return;

        updateManufacturingOrderStatus(orderId, targetStatus);
    };

    const handleReanalyze = async (orderId: string) => {
        const order = manufacturingOrders.find(o => o.id === orderId);
        if (!order) return;
        
        const analysis = manufacturing.analyzeManufacturingRun(order.orderItems, inventory.components);
        await updateManufacturingOrderAnalysis(orderId, analysis);
        setEditingOrder(prev => prev?.id === orderId ? { ...prev, analysis, predictedCost: analysis.totalCost } : prev);
    };

    const editingOrderWithTotal = useMemo(() => {
        if (!editingOrder) return null;
        return { ...editingOrder, totalValue: editingOrder.predictedCost };
    }, [editingOrder]);

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <h2 className="text-3xl font-bold text-black mb-1">Fluxo de Produção e Financeiro</h2>
            
            <Card className="my-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm text-gray-600">A Pagar (Próx. 7 Dias)</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.dueNext7Days)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">A Pagar (Próx. 30 Dias)</p>
                        <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.dueNext30Days)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Ordens em Produção</p>
                        <p className="text-2xl font-bold text-blue-600">{summary.inProductionCount}</p>
                    </div>
                </div>
            </Card>

            <div className="flex-grow min-h-0 flex gap-4">
                <KanbanColumn
                    title="Pendente"
                    status="pendente"
                    orders={ordersByStatus.pendente || []}
                    inventory={inventory}
                    onEditOrder={setEditingOrder}
                    onDrop={handleDrop}
                    totalPredictedCost={summaryByStatus.pendente?.totalPredictedCost || 0}
                    totalPendingPayment={summaryByStatus.pendente?.totalPendingPayment || 0}
                />
                <KanbanColumn
                    title="Em Produção"
                    status="em_producao"
                    orders={ordersByStatus.em_producao || []}
                    inventory={inventory}
                    onEditOrder={setEditingOrder}
                    onDrop={handleDrop}
                    totalPredictedCost={summaryByStatus.em_producao?.totalPredictedCost || 0}
                    totalPendingPayment={summaryByStatus.em_producao?.totalPendingPayment || 0}
                />
                <KanbanColumn
                    title="Concluída"
                    status="concluída"
                    orders={ordersByStatus.concluída || []}
                    inventory={inventory}
                    onEditOrder={setEditingOrder}
                    onDrop={handleDrop}
                    totalPredictedCost={summaryByStatus.concluída?.totalPredictedCost || 0}
                    totalPendingPayment={summaryByStatus.concluída?.totalPendingPayment || 0}
                />
            </div>
            
            <FinancialManagementModal
                order={editingOrderWithTotal}
                onClose={() => setEditingOrder(null)}
                onSave={updateManufacturingOrderInstallments}
                onReanalyze={handleReanalyze}
            />
        </div>
    );
};
