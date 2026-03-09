
import React, { useState, useMemo, useEffect } from 'react';
import { ProductionOrdersHook, PurchaseOrdersHook, ProductionOrder, InventoryHook, Component, CustomersHook } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EmptyState } from './ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { PickingListModal } from './ui/PickingListModal';
import { getLogoBase64ForPdf, AUTRO_LOGO_URL } from '../data/assets';
import * as api from '../hooks/api';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const handlePrintOrder = (orderId: string) => {
    const orderCard = document.getElementById(orderId);
    if (!orderCard) return;
    orderCard.classList.add('printable-section');
    window.print();
    setTimeout(() => orderCard.classList.remove('printable-section'), 500);
};

export const ProductionOrdersView: React.FC<{
  productionOrdersHook: ProductionOrdersHook;
  purchaseOrdersHook: PurchaseOrdersHook;
  inventory: InventoryHook;
  createAndStockComponent: InventoryHook['createAndStockComponent'];
  customersHook: CustomersHook;
}> = ({ productionOrdersHook, purchaseOrdersHook, inventory, createAndStockComponent, customersHook }) => {
    const { productionOrders, updateProductionOrderStatus, deleteProductionOrder } = productionOrdersHook;
    const { addToast } = useToast();
    
    const [confirmingAction, setConfirmingAction] = useState<{order: ProductionOrder, action: 'concluir' | 'cancelar'} | null>(null);
    const [pickingListOrder, setPickingListOrder] = useState<ProductionOrder | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'em_montagem' | 'concluída' | 'cancelada'>('all');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<ProductionOrder | null>(null);

    const filteredOrders = useMemo(() => {
        if (!productionOrders) return [];
        return productionOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start && orderDate < start) return false;
            if (end) {
                end.setHours(23, 59, 59, 999);
                if (orderDate > end) return false;
            }
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
            return true;
        });
    }, [productionOrders, startDate, endDate, statusFilter]);
    
    const handleUpdateStatus = async (order: ProductionOrder, status: 'em_montagem' | 'concluída' | 'cancelada') => {
        await updateProductionOrderStatus(order.id, status);
        addToast(`Ordem ${order.id} foi ${status === 'concluída' ? 'concluída' : 'cancelada'}.`, 'success');
        setConfirmingAction(null);
    };

    const StatusBadge: React.FC<{status: ProductionOrder['status']}> = ({ status }) => {
        const styles = {
            pendente: 'bg-amber-50 text-amber-700 border-amber-200',
            em_montagem: 'bg-blue-50 text-blue-700 border-blue-200',
            concluída: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            cancelada: 'bg-slate-50 text-slate-500 border-slate-200',
        };
        const labels = {
            pendente: 'Na Fila',
            em_montagem: 'Em Montagem',
            concluída: 'Finalizada',
            cancelada: 'Cancelada'
        };
        return (
             <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 print-hide">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Ordens de Montagem</h2>
                    <p className="text-slate-500">Controle de fluxo de trabalho e saída de estoque.</p>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Button onClick={() => window.print()} variant="secondary">Relatório Geral</Button>
                </div>
            </div>
            
            <Card className="print-hide bg-slate-50 border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input type="date" label="De" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input type="date" label="Até" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <Select label="Situação" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="all">Ver Tudo</option>
                        <option value="pendente">Apenas na Fila</option>
                        <option value="em_montagem">Em Execução</option>
                        <option value="concluída">Concluídas</option>
                    </Select>
                </div>
            </Card>

            {filteredOrders.length === 0 ? (
                 <EmptyState
                    icon={<svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>}
                    title="Fluxo Limpo"
                    message="Nenhuma ordem pendente ou encontrada para este filtro."
                />
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order: ProductionOrder) => {
                        const isExpanded = expandedOrderId === order.id;
                        const customer = order.customerId ? customersHook.findCustomerById(order.customerId) : null;

                        return (
                            <div key={order.id} id={order.id} className="group">
                                <Card className={`p-0 overflow-hidden border-2 transition-all ${isExpanded ? 'border-slate-400 ring-4 ring-slate-100' : 'border-transparent hover:border-slate-200'}`}>
                                    <div className="p-4 cursor-pointer flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">
                                                {order.id.split('-')[1]}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{order.id}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateTime(order.createdAt)}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-grow justify-center md:justify-start px-4">
                                            {customer && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
                                                    <div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase block">Cliente</span>
                                                        <span className="text-xs font-bold text-slate-700">{customer.name}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <StatusBadge status={order.status} />
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-300 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-6 bg-slate-50 border-t border-slate-200 animate-fade-in">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Itens da Ordem</h4>
                                                    <div className="space-y-2">
                                                        {order.orderItems.map(item => {
                                                            const kit = inventory.findKitById(item.kitId);
                                                            return (
                                                                <div key={item.kitId} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-xs text-slate-600">{item.quantity}x</span>
                                                                        <span className="text-sm font-bold text-slate-800">{kit?.name}</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-mono text-slate-400">{kit?.sku}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Ações de Gestão</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Button variant="secondary" size="sm" onClick={() => setPickingListOrder(order)}>Lista Separação</Button>
                                                        <Button variant="secondary" size="sm" onClick={() => handlePrintOrder(order.id)}>Imprimir Ficha</Button>
                                                        
                                                        {order.status === 'pendente' && (
                                                            <>
                                                                <Button variant="primary" className="col-span-2" onClick={() => handleUpdateStatus(order, 'em_montagem')}>Iniciar Montagem</Button>
                                                                <Button variant="danger" className="col-span-2" onClick={() => setConfirmingAction({order, action: 'cancelar'})}>Cancelar Ordem</Button>
                                                            </>
                                                        )}
                                                        {order.status === 'em_montagem' && (
                                                            <Button variant="success" className="col-span-2" onClick={() => setConfirmingAction({order, action: 'concluir'})}>Concluir e Baixar Estoque</Button>
                                                        )}
                                                        {order.status !== 'pendente' && order.status !== 'em_montagem' && (
                                                            <div className="col-span-2 p-3 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-500 italic">
                                                                Esta ordem já foi processada.
                                                            </div>
                                                        )}
                                                         <Button variant="ghost" className="col-span-2 text-rose-500 hover:bg-rose-50" size="sm" onClick={() => setDeletingOrder(order)}>Excluir Registro</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )
                    })}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deletingOrder}
                onClose={() => setDeletingOrder(null)}
                onConfirm={async () => { await deleteProductionOrder(deletingOrder!.id); setDeletingOrder(null); addToast("Registro excluído.", "info"); }}
                title="Excluir Ordem"
            >
                <p className="text-sm font-medium">Tem certeza? Esta ação removerá o registro permanentemente.</p>
            </ConfirmationModal>

            {confirmingAction && (
                <ConfirmationModal 
                    isOpen={!!confirmingAction} 
                    onClose={() => setConfirmingAction(null)} 
                    onConfirm={() => handleUpdateStatus(confirmingAction.order, confirmingAction.action === 'concluir' ? 'concluída' : 'cancelada')} 
                    title={`${confirmingAction.action === 'concluir' ? 'Concluir' : 'Cancelar'} Ordem ${confirmingAction.order.id}`}
                    confirmText={confirmingAction.action === 'concluir' ? 'Confirmar Conclusão' : 'Confirmar Cancelamento'}
                    variant={confirmingAction.action === 'concluir' ? 'success' : 'danger'}
                >
                    <p className="text-sm text-slate-600">
                        {confirmingAction.action === 'concluir' 
                          ? 'Deseja finalizar o processo? O estoque de componentes será reduzido automaticamente de acordo com a receita do kit.' 
                          : 'Deseja cancelar o pedido? Nenhuma alteração de estoque será realizada.'}
                    </p>
                </ConfirmationModal>
            )}
            
            {pickingListOrder && (
                <PickingListModal
                    isOpen={!!pickingListOrder}
                    onClose={() => setPickingListOrder(null)}
                    order={pickingListOrder}
                    inventory={inventory}
                />
            )}
        </div>
    );
};
