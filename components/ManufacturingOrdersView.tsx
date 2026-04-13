import React, { useState, useMemo } from 'react';
import { ManufacturingOrdersHook, ManufacturingOrder, InventoryHook } from '../types';
import * as api from '../hooks/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EmptyState } from './ui/EmptyState';
import { PickingListModal } from './ui/PickingListModal';
import { FinancialManagementModal } from './ui/FinancialManagementModal';
import { ManufacturingOrderTrackingModal } from './ManufacturingOrderTrackingModal';
import { useToast } from '../hooks/useToast';
import { usePermissions } from '../hooks/usePermissions';
import { getLogoBase64ForPdf } from '../data/assets';

interface ManufacturingOrdersViewProps {
  manufacturingOrdersHook: ManufacturingOrdersHook;
  inventory: InventoryHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const ManufacturingOrdersView: React.FC<ManufacturingOrdersViewProps> = ({ manufacturingOrdersHook, inventory }) => {
    const { manufacturingOrders, updateManufacturingOrderStatus, updateManufacturingOrderInstallments, deleteManufacturingOrder } = manufacturingOrdersHook;
    const { addToast } = useToast();
    const { canViewCosts } = usePermissions();
    
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [confirmingAction, setConfirmingAction] = useState<{order: ManufacturingOrder, action: 'concluir' | 'cancelar'} | null>(null);
    const [pickingListOrder, setPickingListOrder] = useState<ManufacturingOrder | null>(null);
    const [editingFinancialsOrder, setEditingFinancialsOrder] = useState<ManufacturingOrder | null>(null);
    const [trackingOrder, setTrackingOrder] = useState<ManufacturingOrder | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'concluída' | 'cancelada'>('all');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<ManufacturingOrder | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

     const filteredOrders = useMemo(() => {
        return manufacturingOrders.filter(order => {
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
    }, [manufacturingOrders, startDate, endDate, statusFilter]);

    const handleUpdateStatus = async (order: ManufacturingOrder, status: ManufacturingOrder['status']) => {
        setUpdatingOrderId(order.id);
        
        if (status === 'concluída') {
            // Se o usuário tentar concluir a ordem globalmente, movemos todos os itens para inspeção
            // que ainda não foram concluídos.
            const updatedItems = order.orderItems.map(item => 
                (item.status !== 'concluido' && item.status !== 'aguardando_inspecao') 
                ? { ...item, status: 'aguardando_inspecao' as const } 
                : item
            );
            await manufacturingOrdersHook.updateManufacturingOrderItems(order.id, updatedItems);
            addToast(`Itens da ordem ${order.id} enviados para inspeção.`, 'info');
        } else {
            await updateManufacturingOrderStatus(order.id, status);
        }
        
        setUpdatingOrderId(null);
        setConfirmingAction(null);
    };

    const handleToggleExpand = (orderId: string) => {
        setExpandedOrderId(prev => (prev === orderId ? null : orderId));
    };

    const handleDelete = async () => {
        if (!deletingOrder) return;
        setIsConfirmingDelete(true);
        await deleteManufacturingOrder(deletingOrder.id);
        addToast(`Ordem ${deletingOrder.id} excluída.`, 'success');
        setDeletingOrder(null);
        setIsConfirmingDelete(false);
    };

    const getTimestamp = () => new Date().toISOString().split('T')[0];

    const handleExportPDF = async () => {
        const doc = new jsPDF();
        try {
            const logoBase64 = await getLogoBase64ForPdf();
            doc.addImage(logoBase64, 'PNG', 14, 12, 40, 10);
        } catch (error) {
            console.error("Could not load logo for PDF:", error);
            addToast('Não foi possível carregar o logo para o PDF.', 'error');
        }
        
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.setFont('helvetica', 'normal');
        doc.text("Relatório de Ordens de Fabricação", 200, 22, { align: 'right' });

        doc.setDrawColor('#002B8A');
        doc.line(14, 28, 200, 28);
        
        const head = canViewCosts 
            ? [['ID', 'Data', 'Status', 'Custo Total', 'Itens a Fabricar']]
            : [['ID', 'Data', 'Status', 'Itens a Fabricar']];

        const body = filteredOrders.map(order => {
            const row = [
                order.id,
                formatDateTime(order.createdAt),
                order.status,
            ];
            if (canViewCosts) {
                row.push(formatCurrency(order.analysis.totalCost));
            }
            row.push(order.orderItems.map(i => `${i.quantity}x ${inventory.findComponentById(i.componentId)?.name || i.componentId}`).join(', '));
            return row;
        });

        autoTable(doc, {
            head,
            body,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [0, 43, 138] },
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, 200, doc.internal.pageSize.height - 10, { align: 'right' });
        }
        
        doc.save(`relatorio_ordens_fabricacao_${getTimestamp()}.pdf`);
    };

    const handleExportExcel = () => {
        const data = filteredOrders.flatMap(order => 
            order.orderItems.map(item => {
                const component = inventory.findComponentById(item.componentId);
                const row: any = {
                    'ID da Ordem': order.id,
                    'Data': formatDateTime(order.createdAt),
                    'Status': order.status,
                };
                if (canViewCosts) {
                    row['Custo Total (R$)'] = order.analysis.totalCost;
                }
                row['Quantidade a Fabricar'] = item.quantity;
                row['Nome do Item'] = component?.name;
                row['SKU do Item'] = component?.sku;
                return row;
            })
        );
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ordens de Fabricação");
        XLSX.writeFile(wb, `relatorio_ordens_fabricacao_${getTimestamp()}.xlsx`);
    };

    const StatusBadge: React.FC<{status: ManufacturingOrder['status']}> = ({ status }) => {
        const styles = {
            pendente: 'bg-amber-100 text-amber-900',
            em_producao: 'bg-blue-100 text-blue-800',
            concluída: 'bg-green-100 text-green-800',
            cancelada: 'bg-red-100 text-red-800',
        };
        const label = status.replace('_', ' ');
        return (
             <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
            </span>
        );
    }

     const editingOrderWithTotal = useMemo(() => {
        if (!editingFinancialsOrder) return null;
        return { ...editingFinancialsOrder, totalValue: editingFinancialsOrder.predictedCost };
    }, [editingFinancialsOrder]);

    const [isSyncing, setIsSyncing] = useState(false);

    const handleSaveToFirebase = async () => {
        setIsSyncing(true);
        try {
            await api.forceUseSupabase();
            const localData = await api.getLocalData();
            await api.restoreAllData(localData);
            await api.forceUseLocalStorage();
            addToast('Dados salvos no Supabase!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            addToast('Erro ao salvar no Firebase.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-black">Ordens de Fabricação</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button onClick={handleSaveToFirebase} disabled={isSyncing} variant="primary">
                        {isSyncing ? 'Salvando...' : '💾 Salvar'}
                    </Button>
                    <Button onClick={() => window.print()} variant="secondary" disabled={filteredOrders.length === 0}>Imprimir</Button>
                    <Button onClick={handleExportPDF} variant="secondary" disabled={filteredOrders.length === 0}>PDF</Button>
                    <Button onClick={handleExportExcel} variant="secondary" disabled={filteredOrders.length === 0}>Excel</Button>
                </div>
            </div>

            <Card className="mb-6 print-hide">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input type="date" label="Data de Início" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input type="date" label="Data de Fim" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="all">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="em_producao">Em Produção</option>
                        <option value="concluída">Concluída</option>
                        <option value="cancelada">Cancelada</option>
                    </Select>
                </div>
            </Card>

            {filteredOrders.length === 0 ? (
                <EmptyState
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>}
                    title="Nenhuma Ordem de Fabricação"
                    message="Nenhuma ordem de fabricação foi encontrada com os filtros atuais."
                />
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        return (
                        <Card key={order.id} className="p-0 overflow-hidden">
                            <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleToggleExpand(order.id)}>
                                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                                    <div>
                                        <h3 className="text-xl font-semibold text-black">Ordem de Fabricação - <span className="text-autro-blue">{order.id}</span></h3>
                                        <p className="text-sm text-gray-500">Criada em: {formatDateTime(order.createdAt)}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                                                {order.type || 'interna'}
                                            </span>
                                            {order.batchNumber && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                                    Lote: {order.batchNumber}
                                                </span>
                                            )}
                                            {order.priority && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                    order.priority === 'urgente' ? 'bg-red-100 text-red-800' :
                                                    order.priority === 'alta' ? 'bg-orange-100 text-orange-800' :
                                                    order.priority === 'baixa' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {order.priority}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 flex-shrink-0">
                                        <StatusBadge status={order.status} />
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                            </div>
                            
                            {isExpanded && (
                            <div className="p-4 border-t">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Início</p>
                                        <p className="text-sm font-medium text-slate-800">{order.startDate ? new Date(order.startDate).toLocaleDateString('pt-BR') : '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Previsão</p>
                                        <p className="text-sm font-medium text-slate-800">{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR') : '-'}</p>
                                    </div>
                                    {order.type === 'externa' && (
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor</p>
                                            <p className="text-sm font-medium text-slate-800">{order.supplierName || '-'}</p>
                                        </div>
                                    )}
                                </div>
                                {order.notes && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Observações</p>
                                        <p className="text-sm text-slate-700 bg-yellow-50 p-2 rounded border border-yellow-100 whitespace-pre-wrap">{order.notes}</p>
                                    </div>
                                )}
                                {canViewCosts && (
                                    <div className="mb-4 flex gap-4">
                                        <p className="text-sm text-gray-500">Custo Total Estimado: <span className="text-black font-semibold">{formatCurrency(order.predictedCost || order.analysis.totalCost)}</span></p>
                                        {order.actualCost !== undefined && (
                                            <p className="text-sm text-gray-500">Custo Cobrado: <span className="text-emerald-600 font-semibold">{formatCurrency(order.actualCost)}</span></p>
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <h4 className="text-md font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-autro-blue rounded-full"></div>
                                            Produtos em Fabricação
                                        </h4>
                                        <div className="space-y-3">
                                            {order.orderItems.map(item => {
                                                const component = inventory.findComponentById(item.componentId) || inventory.findComponentBySku(item.componentId);
                                                const status = item.status || 'pendente';
                                                
                                                return (
                                                    <div key={item.componentId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${
                                                                status === 'pendente' ? 'bg-slate-300' :
                                                                status === 'em_producao' ? 'bg-blue-500 animate-pulse' :
                                                                status === 'aguardando_inspecao' ? 'bg-amber-500' :
                                                                'bg-green-500'
                                                            }`} />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900">{item.quantity}x {component?.name || (inventory.isLoading ? 'Carregando...' : `Item não encontrado (${item.componentId || 'ID ausente'})`)}</p>
                                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Status: {status.replace('_', ' ')}</p>
                                                            </div>
                                                        </div>
                                                                <div className="flex gap-2">
                                                                    {status === 'pendente' && (
                                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase">
                                                                            Pendente
                                                                        </span>
                                                                    )}
                                                                    {status === 'em_producao' && (
                                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase animate-pulse">
                                                                            Em Produção
                                                                        </span>
                                                                    )}
                                                                    {status === 'aguardando_inspecao' && (
                                                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase">
                                                                            Inspeção
                                                                        </span>
                                                                    )}
                                                                    {status === 'concluido' && (
                                                                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100 uppercase">
                                                                            Concluído
                                                                        </span>
                                                                    )}
                                                                </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-md font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                                            Insumos Necessários
                                        </h4>
                                         <ul className="space-y-2">
                                            {order.analysis.requirements.map(req => (
                                                <li key={`${req.type}-${req.id}`} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <span className="font-bold text-slate-900">{req.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {req.unit}</span>
                                                    <span className="text-slate-400">|</span>
                                                    <span>{req.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                
                                <div className="mt-6 border-t pt-4 flex flex-wrap gap-2 justify-end">
                                    <Button onClick={(e) => { e.stopPropagation(); setDeletingOrder(order) }} variant="danger">Excluir</Button>
                                    {canViewCosts && (
                                        <Button onClick={(e) => { e.stopPropagation(); setEditingFinancialsOrder(order) }} variant="secondary">Financeiro</Button>
                                    )}
                                    <Button onClick={(e) => { e.stopPropagation(); setTrackingOrder(order) }} variant="secondary">Acompanhamento Etapas</Button>
                                    <Button onClick={(e) => { e.stopPropagation(); setPickingListOrder(order) }} disabled={!!updatingOrderId} variant="secondary">Lista de Separação</Button>
                                    {order.status !== 'concluída' && order.status !== 'cancelada' && (
                                        <Button variant="danger" onClick={(e) => { e.stopPropagation(); setConfirmingAction({order, action: 'cancelar'}) }} disabled={!!updatingOrderId}>Cancelar Ordem</Button>
                                    )}
                                </div>
                            </div>
                            )}
                        </Card>
                    )})}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deletingOrder}
                onClose={() => setDeletingOrder(null)}
                onConfirm={handleDelete}
                title={`Excluir Ordem "${deletingOrder?.id}"`}
                isConfirming={isConfirmingDelete}
            >
                <p>Tem certeza? Esta ação é irreversível.</p>
            </ConfirmationModal>

            {confirmingAction && (
                <ConfirmationModal
                    isOpen={!!confirmingAction}
                    onClose={() => setConfirmingAction(null)}
                    onConfirm={() => {
                        if (confirmingAction) {
                            handleUpdateStatus(
                                confirmingAction.order,
                                confirmingAction.action === 'concluir' ? 'concluída' : 'cancelada'
                            );
                        }
                    }}
                    title={`${confirmingAction.action === 'concluir' ? 'Concluir' : 'Cancelar'} Ordem ${confirmingAction.order.id}`}
                    isConfirming={!!updatingOrderId}
                    confirmText={confirmingAction.action === 'concluir' ? 'Sim, Concluir' : 'Sim, Cancelar'}
                    variant={confirmingAction.action === 'concluir' ? 'primary' : 'danger'}
                >
                    <p className="text-sm text-gray-600">
                        {confirmingAction.action === 'concluir' ?
                         'Você tem certeza que deseja concluir a produção desta ordem? Os itens serão enviados para a fila de Inspeção e Recebimento para conferência antes de entrarem no estoque.'
                         : 'Você tem certeza que deseja cancelar esta ordem? Nenhuma alteração de estoque será feita.'}
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

            {trackingOrder && (
                <ManufacturingOrderTrackingModal
                    isOpen={!!trackingOrder}
                    onClose={() => setTrackingOrder(null)}
                    order={trackingOrder}
                    inventory={inventory}
                    onSave={manufacturingOrdersHook.updateManufacturingOrder}
                    onUpdateItemStatus={manufacturingOrdersHook.updateManufacturingOrderItemStatus}
                />
            )}

            <FinancialManagementModal
                order={editingOrderWithTotal}
                onClose={() => setEditingFinancialsOrder(null)}
                onSave={updateManufacturingOrderInstallments}
            />
        </div>
    );
};