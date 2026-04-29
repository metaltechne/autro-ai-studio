import React, { useState, useMemo } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryHook, View } from '../types';
import { ManufacturingOrderTrackingModal } from './ManufacturingOrderTrackingModal';

interface ManufacturingDashboardViewProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
}

export const ManufacturingDashboardView: React.FC<ManufacturingDashboardViewProps> = ({ manufacturingOrdersHook, inventory, setCurrentView }) => {
    const { manufacturingOrders, updateManufacturingOrder } = manufacturingOrdersHook;
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const selectedOrder = useMemo(() => manufacturingOrders.find(o => o.id === selectedOrderId) || null, [manufacturingOrders, selectedOrderId]);

    const columns = [
        { id: 'pendente', title: 'Pendente', color: 'bg-amber-50', headerColor: 'bg-amber-100 text-amber-900' },
        { id: 'em_producao', title: 'Em Produção', color: 'bg-blue-50', headerColor: 'bg-blue-200 text-blue-800' },
        { id: 'concluída', title: 'Concluída', color: 'bg-green-50', headerColor: 'bg-green-200 text-green-800' }
    ];

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'urgente': return 'bg-red-100 text-red-800 border-red-200';
            case 'alta': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'baixa': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const handleDragStart = (e: React.DragEvent, orderId: string) => {
        e.dataTransfer.setData('orderId', orderId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData('orderId');
        if (orderId && (newStatus === 'pendente' || newStatus === 'em_producao' || newStatus === 'concluída')) {
            await updateManufacturingOrder(orderId, { status: newStatus });
        }
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Fabricação</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Acompanhamento visual (Kanban) das ordens de fabricação</p>
                </div>
                <button 
                    onClick={() => setCurrentView(View.MANUFACTURING_PLANNER)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nova Ordem
                </button>
            </div>

            <div className="flex-1 overflow-x-auto p-6 bg-slate-100/50">
                <div className="flex gap-6 h-full min-w-max">
                    {columns.map(col => (
                        <div 
                            key={col.id} 
                            className={`flex flex-col w-80 rounded-xl border border-slate-200 shadow-sm overflow-hidden ${col.color}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className={`px-4 py-3 font-bold text-sm uppercase tracking-wider ${col.headerColor} flex justify-between items-center`}>
                                <span>{col.title}</span>
                                <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs">
                                    {manufacturingOrders.filter(o => o.status === col.id).length}
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {manufacturingOrders
                                    .filter(o => o.status === col.id)
                                    .sort((a, b) => {
                                        const pMap: any = { urgente: 4, alta: 3, normal: 2, baixa: 1 };
                                        const pA = pMap[a.priority || 'normal'] || 2;
                                        const pB = pMap[b.priority || 'normal'] || 2;
                                        if (pA !== pB) return pB - pA;
                                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                    })
                                    .map(order => {
                                        const totalSteps = order.trackingSteps?.length || 0;
                                        const completedSteps = order.trackingSteps?.filter(s => s.status === 'concluido').length || 0;
                                        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                                        const hasBlocked = order.trackingSteps?.some(s => s.status === 'bloqueado');

                                        return (
                                            <div 
                                                key={order.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, order.id)}
                                                onClick={() => setSelectedOrderId(order.id)}
                                                className={`bg-white p-4 rounded-lg shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${hasBlocked ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-black text-slate-500 uppercase">{order.id}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getPriorityColor(order.priority)}`}>
                                                        {order.priority || 'Normal'}
                                                    </span>
                                                </div>
                                                
                                                {order.batchNumber && (
                                                    <div className="text-sm font-bold text-indigo-700 mb-2">
                                                        Lote: {order.batchNumber}
                                                    </div>
                                                )}
                                                
                                                {order.type === 'externa' && (
                                                    <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded mb-2 border border-amber-200">
                                                        Externa: {order.supplierName || 'Fornecedor não informado'}
                                                    </div>
                                                )}

                                                <div className="text-xs text-slate-600 mb-3 line-clamp-2">
                                                    {order.orderItems?.map(i => `${i.quantity}x ${i.name || i.componentId}`).join(', ')}
                                                </div>

                                                {hasBlocked && (
                                                    <div className="mb-3 text-[10px] font-bold text-red-600 bg-red-50 p-1.5 rounded border border-red-100 flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                        PRODUÇÃO BLOQUEADA
                                                    </div>
                                                )}

                                                {totalSteps > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                            <span>Progresso</span>
                                                            <span>{completedSteps}/{totalSteps} ({progress}%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {order.expectedDeliveryDate && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                                                        <span>Previsão:</span>
                                                        <span className={new Date(order.expectedDeliveryDate) < new Date() && order.status !== 'concluída' ? 'text-red-500' : 'text-slate-700'}>
                                                            {new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedOrder && (
                <ManufacturingOrderTrackingModal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrderId(null)}
                    order={selectedOrder}
                    onSave={async (orderId, updates) => {
                        await updateManufacturingOrder(orderId, updates);
                    }}
                    onUpdateItemStatus={manufacturingOrdersHook.updateManufacturingOrderItemStatus}
                    inventory={inventory}
                />
            )}
        </div>
    );
};
