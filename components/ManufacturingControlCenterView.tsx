import React, { useState, useMemo } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryHook, ManufacturingTrackingStep, View } from '../types';
import { ManufacturingOrderTrackingModal } from './ManufacturingOrderTrackingModal';

interface ManufacturingControlCenterViewProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
}

interface ResourceStatus {
    name: string;
    currentStep: { orderId: string; step: ManufacturingTrackingStep; order: ManufacturingOrder } | null;
    queue: { orderId: string; step: ManufacturingTrackingStep; order: ManufacturingOrder }[];
    status: 'idle' | 'running' | 'blocked';
}

export const ManufacturingControlCenterView: React.FC<ManufacturingControlCenterViewProps> = ({ manufacturingOrdersHook, inventory, setCurrentView }) => {
    const { manufacturingOrders, updateManufacturingOrder } = manufacturingOrdersHook;
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const selectedOrder = useMemo(() => manufacturingOrders.find(o => o.id === selectedOrderId) || null, [manufacturingOrders, selectedOrderId]);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Filter active orders
    const activeOrders = useMemo(() => {
        return manufacturingOrders.filter(o => o.status === 'pendente' || o.status === 'em_producao');
    }, [manufacturingOrders]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        let delayed = 0;
        let dueToday = 0;
        let blockedMachines = 0;
        let runningMachines = 0;

        activeOrders.forEach(order => {
            if (order.expectedDeliveryDate) {
                const deliveryDate = new Date(order.expectedDeliveryDate);
                deliveryDate.setHours(0, 0, 0, 0);
                if (deliveryDate < now) delayed++;
                else if (deliveryDate.getTime() === now.getTime()) dueToday++;
            }
        });

        const resourceMap = new Set<string>();
        const blockedMap = new Set<string>();

        activeOrders.forEach(order => {
            order.trackingSteps?.forEach(step => {
                const resourceName = step.assignedTo?.trim();
                if (!resourceName || resourceName === 'Não Atribuído') return;

                if (step.status === 'bloqueado') blockedMap.add(resourceName);
                else if (step.status === 'em_andamento') resourceMap.add(resourceName);
            });
        });

        blockedMachines = blockedMap.size;
        runningMachines = resourceMap.size;

        return { totalActive: activeOrders.length, delayed, dueToday, blockedMachines, runningMachines };
    }, [activeOrders, now]);

    // Sort orders for the left panel
    const sortedOrders = useMemo(() => {
        return [...activeOrders].sort((a, b) => {
            // 1. Delayed first
            const dateA = a.expectedDeliveryDate ? new Date(a.expectedDeliveryDate) : new Date(8640000000000000);
            const dateB = b.expectedDeliveryDate ? new Date(b.expectedDeliveryDate) : new Date(8640000000000000);
            dateA.setHours(0, 0, 0, 0);
            dateB.setHours(0, 0, 0, 0);
            
            const isDelayedA = dateA < now;
            const isDelayedB = dateB < now;

            if (isDelayedA && !isDelayedB) return -1;
            if (!isDelayedA && isDelayedB) return 1;

            // 2. By Priority
            const priorityWeight: Record<string, number> = { 'urgente': 4, 'alta': 3, 'normal': 2, 'baixa': 1 };
            const weightA = priorityWeight[a.priority || 'normal'] || 2;
            const weightB = priorityWeight[b.priority || 'normal'] || 2;
            
            if (weightA !== weightB) return weightB - weightA;

            // 3. By Date
            return dateA.getTime() - dateB.getTime();
        });
    }, [activeOrders, now]);

    // Extract machines for the right panel
    const resources = useMemo(() => {
        const resourceMap = new Map<string, ResourceStatus>();

        activeOrders.forEach(order => {
            order.trackingSteps?.forEach(step => {
                const resourceName = step.assignedTo?.trim() || 'Não Atribuído';
                if (resourceName === 'Não Atribuído' && step.status === 'pendente') return;

                if (!resourceMap.has(resourceName)) {
                    resourceMap.set(resourceName, { name: resourceName, currentStep: null, queue: [], status: 'idle' });
                }

                const resource = resourceMap.get(resourceName)!;

                if (step.status === 'em_andamento' || step.status === 'bloqueado') {
                    if (!resource.currentStep || step.status === 'bloqueado') {
                        resource.currentStep = { orderId: order.id, step, order };
                        resource.status = step.status === 'bloqueado' ? 'blocked' : 'running';
                    } else {
                        resource.queue.push({ orderId: order.id, step, order });
                    }
                } else if (step.status === 'pendente') {
                    resource.queue.push({ orderId: order.id, step, order });
                }
            });
        });

        resourceMap.forEach(resource => {
            resource.queue.sort((a, b) => {
                const priorityWeight: Record<string, number> = { 'urgente': 4, 'alta': 3, 'normal': 2, 'baixa': 1 };
                const weightA = priorityWeight[a.order.priority || 'normal'] || 2;
                const weightB = priorityWeight[b.order.priority || 'normal'] || 2;
                return weightB - weightA;
            });
        });

        return Array.from(resourceMap.values()).sort((a, b) => {
            const statusWeight = { 'blocked': 3, 'running': 2, 'idle': 1 };
            return statusWeight[b.status] - statusWeight[a.status];
        });
    }, [activeOrders]);

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'urgente': return 'bg-red-100 text-red-800 border-red-200';
            case 'alta': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'baixa': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getDeadlineStatus = (dateString?: string) => {
        if (!dateString) return { label: 'Sem prazo', color: 'text-slate-500 bg-slate-100' };
        const d = new Date(dateString);
        d.setHours(0, 0, 0, 0);
        
        if (d < now) return { label: 'Atrasado', color: 'text-red-700 bg-red-100 border border-red-200' };
        if (d.getTime() === now.getTime()) return { label: 'Vence Hoje', color: 'text-orange-700 bg-orange-100 border border-orange-200' };
        
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) return { label: `Em ${diffDays} dias`, color: 'text-yellow-700 bg-yellow-100 border border-yellow-200' };
        return { label: `Em ${diffDays} dias`, color: 'text-green-700 bg-green-100 border border-green-200' };
    };

    return (
        <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
            {/* Header & KPIs */}
            <div className="bg-slate-900 text-white p-4 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Centro de Controle</h2>
                    <p className="text-sm text-slate-400 font-medium">Visão unificada de ordens, prazos e máquinas</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <div className="bg-slate-800 rounded-lg px-4 py-2 border border-slate-700 flex items-center gap-3">
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Ordens Ativas</div>
                        <div className="text-xl font-black text-white">{kpis.totalActive}</div>
                    </div>
                    <div className={`rounded-lg px-4 py-2 border flex items-center gap-3 ${kpis.delayed > 0 ? 'bg-red-900/50 border-red-500/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className={`${kpis.delayed > 0 ? 'text-red-300' : 'text-slate-400'} text-xs font-bold uppercase tracking-wider`}>Atrasadas</div>
                        <div className={`text-xl font-black ${kpis.delayed > 0 ? 'text-red-400' : 'text-white'}`}>{kpis.delayed}</div>
                    </div>
                    <div className={`rounded-lg px-4 py-2 border flex items-center gap-3 ${kpis.blockedMachines > 0 ? 'bg-red-900/50 border-red-500/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className={`${kpis.blockedMachines > 0 ? 'text-red-300' : 'text-slate-400'} text-xs font-bold uppercase tracking-wider`}>Máq. Bloqueadas</div>
                        <div className={`text-xl font-black ${kpis.blockedMachines > 0 ? 'text-red-400' : 'text-white'}`}>{kpis.blockedMachines}</div>
                    </div>
                    <button 
                        onClick={() => setCurrentView(View.MANUFACTURING_PLANNER)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 ml-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nova Ordem
                    </button>
                </div>
            </div>

            {/* Main Content Split */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                
                {/* Left Panel: Orders & Deadlines */}
                <div className="w-full lg:w-3/5 flex flex-col border-r border-slate-200 bg-slate-50">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Ordens e Prazos
                        </h3>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{sortedOrders.length} ativas</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {sortedOrders.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-medium">Nenhuma ordem ativa no momento.</div>
                        ) : (
                            sortedOrders.map(order => {
                                const totalSteps = order.trackingSteps?.length || 0;
                                const completedSteps = order.trackingSteps?.filter(s => s.status === 'concluido').length || 0;
                                const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                                const deadline = getDeadlineStatus(order.expectedDeliveryDate);
                                const hasBlocked = order.trackingSteps?.some(s => s.status === 'bloqueado');

                                return (
                                    <div 
                                        key={order.id} 
                                        onClick={() => setSelectedOrderId(order.id)}
                                        className={`bg-white p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col gap-2 ${hasBlocked ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-700 uppercase">{order.id}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getPriorityColor(order.priority)}`}>
                                                    {order.priority || 'Normal'}
                                                </span>
                                                {order.batchNumber && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                        Lote: {order.batchNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${deadline.color}`}>
                                                {deadline.label}
                                            </span>
                                        </div>
                                        
                                        <div className="text-xs text-slate-600 font-medium line-clamp-1">
                                            {order.orderItems?.map(i => `${i.quantity}x ${i.name || i.componentId}`).join(', ')}
                                        </div>

                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${hasBlocked ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{progress}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Machines & Resources */}
                <div className="w-full lg:w-2/5 flex flex-col bg-slate-100">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                            Chão de Fábrica
                        </h3>
                        <div className="flex gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" title="Em Operação"></span>
                            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Bloqueada"></span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {resources.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-medium text-sm">
                                Nenhuma máquina atribuída às ordens ativas.
                            </div>
                        ) : (
                            resources.map(resource => (
                                <div key={resource.name} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                    <div className={`px-3 py-2 border-b flex justify-between items-center ${
                                        resource.status === 'blocked' ? 'bg-red-50 border-red-100' :
                                        resource.status === 'running' ? 'bg-green-50 border-green-100' :
                                        'bg-slate-50 border-slate-100'
                                    }`}>
                                        <h4 className="font-bold text-sm text-slate-800">{resource.name}</h4>
                                        <span className={`w-2 h-2 rounded-full ${
                                            resource.status === 'blocked' ? 'bg-red-500 animate-pulse' :
                                            resource.status === 'running' ? 'bg-green-500 animate-pulse' :
                                            'bg-slate-300'
                                        }`}></span>
                                    </div>
                                    
                                    <div className="p-3">
                                        {resource.currentStep ? (
                                            <div 
                                                className="cursor-pointer group"
                                                onClick={() => setSelectedOrderId(resource.currentStep!.orderId)}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase group-hover:text-indigo-600 transition-colors">{resource.currentStep.orderId}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">Qtd: {resource.currentStep.step.producedQuantity || 0}/{resource.currentStep.step.quantity || 1}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 line-clamp-1">{resource.currentStep.step.name}</p>
                                                {resource.status === 'blocked' && (
                                                    <p className="text-[10px] font-bold text-red-600 mt-1 line-clamp-1">
                                                        Bloqueio: {resource.currentStep.step.blockedReason || 'Não informado'}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic">Ociosa</div>
                                        )}

                                        {resource.queue.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-slate-100">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fila ({resource.queue.length})</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {resource.queue.slice(0, 5).map((q, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            onClick={() => setSelectedOrderId(q.orderId)}
                                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 ${
                                                                q.order.priority === 'urgente' ? 'bg-red-100 text-red-700' :
                                                                q.order.priority === 'alta' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}
                                                            title={`${q.orderId}: ${q.step.name}`}
                                                        >
                                                            {q.orderId}
                                                        </span>
                                                    ))}
                                                    {resource.queue.length > 5 && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">+{resource.queue.length - 5}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {selectedOrder && (
                <ManufacturingOrderTrackingModal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrderId(null)}
                    order={selectedOrder}
                    inventory={inventory}
                    onSave={async (id, updates) => {
                        await updateManufacturingOrder(id, updates);
                    }}
                />
            )}
        </div>
    );
};
