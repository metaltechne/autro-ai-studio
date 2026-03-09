import React, { useState, useMemo } from 'react';
import { ManufacturingOrdersHook, ManufacturingOrder, InventoryHook } from '../types';
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
import { useToast } from '../hooks/useToast';
import { getLogoBase64ForPdf } from '../data/assets';

interface ManufacturingOrdersViewProps {
  manufacturingOrdersHook: ManufacturingOrdersHook;
  inventory: InventoryHook;
}

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

export const ManufacturingOrdersView: React.FC<ManufacturingOrdersViewProps> = ({ manufacturingOrdersHook, inventory }) => {
    const { manufacturingOrders, updateManufacturingOrderStatus, updateManufacturingOrderInstallments, deleteManufacturingOrder } = manufacturingOrdersHook;
    const { addToast } = useToast();
    
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [confirmingAction, setConfirmingAction] = useState<{order: ManufacturingOrder, action: 'concluir' | 'cancelar'} | null>(null);
    const [pickingListOrder, setPickingListOrder] = useState<ManufacturingOrder | null>(null);
    const [editingFinancialsOrder, setEditingFinancialsOrder] = useState<ManufacturingOrder | null>(null);
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

    const handleUpdateStatus = async (order: ManufacturingOrder, status: 'concluída' | 'cancelada') => {
        setUpdatingOrderId(order.id);
        await updateManufacturingOrderStatus(order.id, status);
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
        
        autoTable(doc, {
            head: [['ID', 'Data', 'Status', 'Custo Total', 'Itens a Fabricar']],
            body: filteredOrders.map(order => [
                order.id,
                formatDateTime(order.createdAt),
                order.status,
                formatCurrency(order.analysis.totalCost),
                order.orderItems.map(i => `${i.quantity}x ${inventory.findComponentById(i.componentId)?.name || i.componentId}`).join(', ')
            ]),
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
                return {
                    'ID da Ordem': order.id,
                    'Data': formatDateTime(order.createdAt),
                    'Status': order.status,
                    'Custo Total (R$)': order.analysis.totalCost,
                    'Quantidade a Fabricar': item.quantity,
                    'Nome do Item': component?.name,
                    'SKU do Item': component?.sku,
                };
            })
        );
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ordens de Fabricação");
        XLSX.writeFile(wb, `relatorio_ordens_fabricacao_${getTimestamp()}.xlsx`);
    };

    const StatusBadge: React.FC<{status: ManufacturingOrder['status']}> = ({ status }) => {
        const styles = {
            pendente: 'bg-yellow-100 text-yellow-800',
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

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-black">Ordens de Fabricação</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
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
                                    </div>
                                    <div className="flex items-center gap-4 flex-shrink-0">
                                        <StatusBadge status={order.status} />
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                            </div>
                            
                            {isExpanded && (
                            <div className="p-4 border-t">
                                <p className="text-sm text-gray-500 mb-4">Custo Total Estimado: <span className="text-black font-semibold">{formatCurrency(order.analysis.totalCost)}</span></p>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-md font-semibold text-black mb-2">Itens a Fabricar</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-black">
                                            {order.orderItems.map(item => {
                                                const component = inventory.findComponentById(item.componentId);
                                                return <li key={item.componentId}><span className="font-bold">{item.quantity}x</span> {component?.name || item.componentId}</li>
                                            })}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-md font-semibold text-black mb-2">Insumos Necessários</h4>
                                         <ul className="list-disc list-inside space-y-1 text-sm text-black">
                                            {order.analysis.requirements.map(req => (
                                                <li key={`${req.type}-${req.id}`}><span className="font-bold">{req.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {req.unit}</span> de {req.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                
                                <div className="mt-6 border-t pt-4 flex flex-wrap gap-2 justify-end">
                                    <Button onClick={(e) => { e.stopPropagation(); setDeletingOrder(order) }} variant="danger">Excluir</Button>
                                    <Button onClick={(e) => { e.stopPropagation(); setEditingFinancialsOrder(order) }} variant="secondary">Financeiro</Button>
                                    <Button onClick={(e) => { e.stopPropagation(); setPickingListOrder(order) }} disabled={!!updatingOrderId} variant="secondary">Lista de Separação</Button>
                                    {order.status === 'pendente' && (
                                        <>
                                            <Button variant="danger" onClick={(e) => { e.stopPropagation(); setConfirmingAction({order, action: 'cancelar'}) }} disabled={!!updatingOrderId}>Cancelar Ordem</Button>
                                            <Button onClick={(e) => { e.stopPropagation(); setConfirmingAction({order, action: 'concluir'}) }} disabled={!!updatingOrderId}>Marcar como Concluída</Button>
                                        </>
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
                         'Você tem certeza que deseja concluir esta ordem? Os insumos serão consumidos e os produtos fabricados serão adicionados ao estoque. Esta ação não pode ser desfeita.'
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

            <FinancialManagementModal
                order={editingOrderWithTotal}
                onClose={() => setEditingFinancialsOrder(null)}
                onSave={updateManufacturingOrderInstallments}
            />
        </div>
    );
};