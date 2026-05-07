import React, { useState, useMemo } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryHook, ManufacturingTrackingStep } from '../types';
import { ManufacturingOrderTrackingModal } from './ManufacturingOrderTrackingModal';

interface MachineDashboardViewProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
    inventory: InventoryHook;
}

interface ResourceStatus {
    name: string;
    currentStep: { orderId: string; step: ManufacturingTrackingStep; order: ManufacturingOrder } | null;
    queue: { orderId: string; step: ManufacturingTrackingStep; order: ManufacturingOrder }[];
    status: 'idle' | 'running' | 'blocked';
}

export const MachineDashboardView: React.FC<MachineDashboardViewProps> = ({ manufacturingOrdersHook, inventory }) => {
    const { manufacturingOrders, updateManufacturingOrder } = manufacturingOrdersHook;
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const selectedOrder = useMemo(() => manufacturingOrders.find(o => o.id === selectedOrderId) || null, [manufacturingOrders, selectedOrderId]);

    const resources = useMemo(() => {
        const resourceMap = new Map<string, ResourceStatus>();

        // Find all unique resources and their current status
        manufacturingOrders.forEach(order => {
            if (order.status === 'concluída' || order.status === 'cancelada') return;

            order.trackingSteps?.forEach(step => {
                const resourceName = step.assignedTo?.trim() || 'Não Atribuído';
                
                // Ignore unassigned pending steps to avoid clutter
                if (resourceName === 'Não Atribuído' && step.status === 'pendente') return;

                if (!resourceMap.has(resourceName)) {
                    resourceMap.set(resourceName, { name: resourceName, currentStep: null, queue: [], status: 'idle' });
                }

                const resource = resourceMap.get(resourceName)!;

                if (step.status === 'em_andamento' || step.status === 'bloqueado') {
                    // If multiple are running (which shouldn't happen ideally), just take the first one or the blocked one
                    if (!resource.currentStep || step.status === 'bloqueado') {
                        resource.currentStep = { orderId: order.id, step, order };
                        resource.status = step.status === 'bloqueado' ? 'blocked' : 'running';
                    } else {
                        // Push others to queue if there's already one running
                        resource.queue.push({ orderId: order.id, step, order });
                    }
                } else if (step.status === 'pendente') {
                    resource.queue.push({ orderId: order.id, step, order });
                }
            });
        });

        // Sort queue by priority for each resource
        resourceMap.forEach(resource => {
            resource.queue.sort((a, b) => {
                const priorityWeight = { 'urgente': 4, 'alta': 3, 'normal': 2, 'baixa': 1 };
                const weightA = priorityWeight[a.order.priority || 'normal'] || 2;
                const weightB = priorityWeight[b.order.priority || 'normal'] || 2;
                return weightB - weightA;
            });
        });

        // Sort resources: Blocked first, then Running, then Idle
        return Array.from(resourceMap.values()).sort((a, b) => {
            const statusWeight = { 'blocked': 3, 'running': 2, 'idle': 1 };
            return statusWeight[b.status] - statusWeight[a.status];
        });
    }, [manufacturingOrders]);

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'urgente': return 'bg-red-100 text-red-800 border-red-200';
            case 'alta': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'baixa': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-100">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Máquinas (Andon)</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Status em tempo real dos recursos e máquinas do chão de fábrica</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span> Em Produção
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Bloqueada
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <span className="w-3 h-3 rounded-full bg-slate-300"></span> Ociosa
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {resources.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Nenhuma Máquina Ativa</h3>
                        <p className="text-slate-500 mb-8">
                            Para que suas máquinas e operadores apareçam neste painel, você precisa atribuí-los às etapas das Ordens de Fabricação.
                        </p>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left w-full">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">?</span>
                                Como usar o Painel Andon:
                            </h4>
                            <ol className="space-y-4 text-sm text-slate-600">
                                <li className="flex gap-3">
                                    <span className="font-black text-slate-300">1</span>
                                    <span>Vá até o <strong>Painel de Fabricação</strong> (Kanban) ou <strong>Ordens de Fabricação</strong>.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-black text-slate-300">2</span>
                                    <span>Clique em uma ordem para abrir o modal de <strong>Acompanhamento</strong>.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-black text-slate-300">3</span>
                                    <span>No campo <strong>"Atribuído para (Operador/Máquina)"</strong>, digite ou selecione o nome do recurso (ex: Torno CNC 1).</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-black text-slate-300">4</span>
                                    <span>Volte aqui! A máquina aparecerá automaticamente e você poderá ver o que ela está produzindo em tempo real.</span>
                                </li>
                            </ol>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {resources.map(resource => (
                            <div key={resource.name} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className={`p-4 border-b flex justify-between items-center ${
                                resource.status === 'blocked' ? 'bg-red-50 border-red-100' :
                                resource.status === 'running' ? 'bg-green-50 border-green-100' :
                                'bg-slate-50 border-slate-100'
                            }`}>
                                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {resource.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">
                                        {resource.status === 'blocked' ? 'Bloqueada' : resource.status === 'running' ? 'Em Operação' : 'Ociosa'}
                                    </span>
                                    <span className={`w-3 h-3 rounded-full ${
                                        resource.status === 'blocked' ? 'bg-red-500 animate-pulse' :
                                        resource.status === 'running' ? 'bg-green-500 animate-pulse' :
                                        'bg-slate-300'
                                    }`}></span>
                                </div>
                            </div>

                            {/* Current Step */}
                            <div className="p-4 flex-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Operação Atual</h4>
                                {resource.currentStep ? (
                                    <div 
                                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                                            resource.status === 'blocked' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                                        }`}
                                        onClick={() => setSelectedOrderId(resource.currentStep!.orderId)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-black text-slate-500 uppercase">{resource.currentStep.orderId}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getPriorityColor(resource.currentStep.order.priority)}`}>
                                                {resource.currentStep.order.priority || 'Normal'}
                                            </span>
                                        </div>
                                        <h5 className="font-bold text-slate-800 text-sm mb-1">{resource.currentStep.step.name}</h5>
                                        <p className="text-xs text-slate-600 mb-3">
                                            Qtd: <span className="font-bold text-slate-800">{resource.currentStep.step.producedQuantity || 0}/{resource.currentStep.step.quantity || 1}</span>
                                        </p>

                                        {resource.status === 'blocked' && (
                                            <div className="mt-3 text-xs font-bold text-red-600 bg-red-100/50 p-2 rounded border border-red-200">
                                                Motivo: {resource.currentStep.step.blockedReason || 'Não informado'}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                                        <span className="text-sm font-bold text-slate-400">Nenhuma operação ativa</span>
                                    </div>
                                )}
                            </div>

                            {/* Queue */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
                                    <span>Fila de Espera</span>
                                    <span>{resource.queue.length} ordens</span>
                                </h4>
                                {resource.queue.length > 0 ? (
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                        {resource.queue.map((q, idx) => (
                                            <div 
                                                key={`${q.orderId}-${q.step.id}-${idx}`}
                                                className="flex justify-between items-center p-2 bg-white rounded border border-slate-200 cursor-pointer hover:border-indigo-300"
                                                onClick={() => setSelectedOrderId(q.orderId)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-500">{q.orderId}</span>
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{q.step.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-500">Qtd: {q.step.producedQuantity || 0}/{q.step.quantity || 1}</span>
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        q.order.priority === 'urgente' ? 'bg-red-500' :
                                                        q.order.priority === 'alta' ? 'bg-orange-500' :
                                                        q.order.priority === 'baixa' ? 'bg-blue-500' : 'bg-slate-300'
                                                    }`}></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400 font-medium italic text-center py-2">
                                        Fila vazia
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                )}
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
