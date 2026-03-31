

import React, { useState, useMemo } from 'react';
import { PurchaseOrdersHook, PurchaseOrder, InventoryHook } from '../types';
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
import { FinancialManagementModal } from './ui/FinancialManagementModal';
import { PurchaseOrderEditModal } from './PurchaseOrderEditModal';
import { getLogoBase64ForPdf } from '../data/assets';

interface PurchaseOrdersViewProps {
  purchaseOrdersHook: PurchaseOrdersHook;
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

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ purchaseOrdersHook, inventory }) => {
    const { purchaseOrders, updateOrderStatus, updatePurchaseOrderInstallments, savePurchaseOrder, deletePurchaseOrder } = purchaseOrdersHook;
    const { addToast } = useToast();
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [confirmingOrder, setConfirmingOrder] = useState<PurchaseOrder | null>(null);
    const [editingFinancialsOrder, setEditingFinancialsOrder] = useState<PurchaseOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'concluída'>('all');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<PurchaseOrder | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && orderDate < start) return false;
            if (end) {
                end.setHours(23, 59, 59, 999); // Include the whole end day
                if (orderDate > end) return false;
            }
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
            
            return true;
        });
    }, [purchaseOrders, startDate, endDate, statusFilter]);

    const handleUpdateStatus = async (order: PurchaseOrder, status: 'concluída') => {
        setUpdatingOrderId(order.id);
        await updateOrderStatus(order.id, status);
        addToast(`Ordem de Compra ${order.id} marcada como concluída.`, 'success');
        setUpdatingOrderId(null);
        setConfirmingOrder(null);
    };

    const handleOpenEditModal = (order: PurchaseOrder | null) => {
        setEditingOrder(order);
        setIsEditModalOpen(true);
    };

    const handleSaveOrder = async (order: PurchaseOrder) => {
        await savePurchaseOrder(order);
        addToast('Ordem de compra salva com sucesso!', 'success');
        setIsEditModalOpen(false);
    };

    const handleToggleExpand = (orderId: string) => {
        setExpandedOrderId(prev => (prev === orderId ? null : orderId));
    };

    const handleDelete = async () => {
        if (!deletingOrder) return;
        setIsConfirmingDelete(true);
        await deletePurchaseOrder(deletingOrder.id);
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
        doc.text("Relatório de Ordens de Compra", 200, 22, { align: 'right' });

        doc.setDrawColor('#002B8A');
        doc.line(14, 28, 200, 28);
        
        let startY = 35;
        filteredOrders.forEach((order, index) => {
            const requiredSpace = 20 + order.items.length * 10;
            if (index > 0 && startY + requiredSpace > doc.internal.pageSize.height - 20) {
                doc.addPage();
                startY = 20;
            }
            doc.setFontSize(14);
            doc.text(`Ordem: ${order.id} - Status: ${order.status}`, 14, startY);
            doc.setFontSize(10);
            doc.text(`Data: ${formatDateTime(order.createdAt)}`, 14, startY + 6);

            autoTable(doc, {
                head: [['Qtd.', 'Item', 'Preço Unit.', 'Subtotal']],
                body: order.items.map(item => [item.quantity, item.name, formatCurrency(item.unitPrice), formatCurrency(item.unitPrice * item.quantity)]),
                startY: startY + 10,
                theme: 'grid',
            });
            startY = (doc as any).lastAutoTable.finalY + 15;
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, 200, doc.internal.pageSize.height - 10, { align: 'right' });
        }
        
        doc.save(`relatorio_ordens_compra_${getTimestamp()}.pdf`);
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const data = filteredOrders.flatMap(order => 
            order.items.map(item => ({
                'ID da Ordem': order.id,
                'Data': formatDateTime(order.createdAt),
                'Status': order.status,
                'Fornecedor': order.supplierName || '',
                'Quantidade': item.quantity,
                'Nome do Item': item.name,
                'ID do Componente': item.id,
                'Preço Unitário (R$)': item.unitPrice,
                'Subtotal (R$)': item.unitPrice * item.quantity,
            }))
        );
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Ordens de Compra");
        XLSX.writeFile(wb, `relatorio_ordens_compra_${getTimestamp()}.xlsx`);
    };

    const StatusBadge: React.FC<{status: PurchaseOrder['status']}> = ({ status }) => {
        const styles = {
            pendente: 'bg-yellow-100 text-yellow-800',
            concluída: 'bg-green-100 text-green-800',
        };
        return (
             <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    }
    
    const editingOrderWithTotal = useMemo(() => {
        if (!editingFinancialsOrder) return null;
        const totalValue = editingFinancialsOrder.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        return { ...editingFinancialsOrder, totalValue };
    }, [editingFinancialsOrder]);


    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-black">Ordens de Compra</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button onClick={handleExportPDF} variant="secondary" disabled={filteredOrders.length === 0}>PDF</Button>
                    <Button onClick={handleExportExcel} variant="secondary" disabled={filteredOrders.length === 0}>Excel</Button>
                    <Button onClick={() => handleOpenEditModal(null)}>Nova Ordem de Compra</Button>
                </div>
            </div>

            <Card className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input type="date" label="Data de Início" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input type="date" label="Data de Fim" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="all">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="concluída">Concluída</option>
                    </Select>
                </div>
            </Card>

            {filteredOrders.length === 0 ? (
                <EmptyState
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    title="Nenhuma Ordem de Compra"
                    message="Nenhuma ordem de compra foi encontrada com os filtros atuais."
                />
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order) => {
                        const totalValue = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                        const isExpanded = expandedOrderId === order.id;
                        return (
                            <Card key={order.id} className="p-0 overflow-hidden">
                                <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleToggleExpand(order.id)}>
                                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                                        <div>
                                            <h3 className="text-xl font-semibold text-black">Ordem de Compra - <span className="text-autro-blue">{order.id}</span></h3>
                                            {order.supplierName && <p className="text-md font-medium text-gray-700">{order.supplierName}</p>}
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
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                {order.expectedDeliveryDate && (
                                                    <p className="text-sm text-gray-500 font-medium mb-2">Entrega Prevista: <span className="text-autro-blue">{new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></p>
                                                )}
                                                <p className="text-lg font-bold text-black">Valor Total: {formatCurrency(totalValue)}</p>
                                            </div>
                                            {order.notes && <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md"><strong>Notas:</strong> {order.notes}</p>}
                                        </div>

                                        <div className="mt-4 border-t pt-4">
                                            <h4 className="text-md font-semibold text-black mb-2">Itens</h4>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <tbody>
                                                        {order.items.map(item => (
                                                            <tr key={item.id}>
                                                                <td className="py-1 pr-4"><span className="font-bold">{item.quantity}x</span> {item.name}</td>
                                                                <td className="py-1 px-4 text-gray-600">({formatCurrency(item.unitPrice)}/un)</td>
                                                                <td className="py-1 pl-4 font-semibold text-right">{formatCurrency(item.unitPrice * item.quantity)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-6 border-t pt-4 flex justify-end flex-wrap gap-2">
                                            <Button onClick={(e) => { e.stopPropagation(); setDeletingOrder(order) }} variant="danger">Excluir</Button>
                                            <Button onClick={(e) => { e.stopPropagation(); setEditingFinancialsOrder(order) }} variant="secondary">Financeiro</Button>
                                            {order.status === 'pendente' && (
                                                <>
                                                    <Button variant="secondary" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(order) }}>Editar Pedido</Button>
                                                    <Button onClick={(e) => { e.stopPropagation(); setConfirmingOrder(order) }} disabled={!!updatingOrderId} variant="primary">
                                                        {updatingOrderId === order.id ? 'Atualizando...' : 'Marcar como Concluída'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )
                    })}
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

            {confirmingOrder && (
                <ConfirmationModal
                    isOpen={!!confirmingOrder}
                    onClose={() => setConfirmingOrder(null)}
                    onConfirm={() => handleUpdateStatus(confirmingOrder, 'concluída')}
                    title={`Concluir Ordem de Compra ${confirmingOrder.id}`}
                    isConfirming={!!updatingOrderId}
                    confirmText="Sim, Concluir"
                    variant="primary"
                >
                    <p className="text-sm text-gray-600">
                        Você tem certeza que deseja marcar esta ordem como concluída? Os itens listados serão adicionados ao estoque. Esta ação não pode ser desfeita.
                    </p>
                </ConfirmationModal>
            )}
            
            <FinancialManagementModal
                order={editingOrderWithTotal}
                onClose={() => setEditingFinancialsOrder(null)}
                onSave={updatePurchaseOrderInstallments}
            />

            {isEditModalOpen && (
                <PurchaseOrderEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveOrder}
                    orderToEdit={editingOrder}
                    inventory={inventory}
                />
            )}
        </div>
    );
};