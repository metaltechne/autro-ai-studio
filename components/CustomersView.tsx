import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Customer, CustomersHook, ProductionOrdersHook, InventoryHook, ProductionOrder, Installment } from '../types';
import { CustomerEditModal } from './CustomerEditModal';
import { EmptyState } from './ui/EmptyState';
import { FinancialManagementModal } from './ui/FinancialManagementModal';

const formatDateTime = (isoString: string) => new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CustomersViewProps {
    customersHook: CustomersHook;
    productionOrdersHook: ProductionOrdersHook;
    inventory: InventoryHook;
}

const getPaymentStatus = (order: ProductionOrder): { status: 'Pago' | 'Pendente' | 'Parcelado'; color: string } => {
    if (!order.installments || order.installments.length === 0) return { status: 'Pendente', color: 'text-yellow-600' };
    const allPaid = order.installments.every(i => i.status === 'pago');
    if (allPaid) return { status: 'Pago', color: 'text-green-600' };
    const anyPaid = order.installments.some(i => i.status === 'pago');
    if (anyPaid) return { status: 'Parcelado', color: 'text-blue-600' };
    return { status: 'Pendente', color: 'text-yellow-600' };
};

export const CustomersView: React.FC<CustomersViewProps> = ({ customersHook, productionOrdersHook, inventory }) => {
    const { customers, isLoading, addCustomer, updateCustomer, deleteCustomer } = customersHook;
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [editingFinancialsOrder, setEditingFinancialsOrder] = useState<ProductionOrder | null>(null);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const lowerSearch = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(lowerSearch) ||
            (c.document && c.document.toLowerCase().includes(lowerSearch)) ||
            (c.email && c.email.toLowerCase().includes(lowerSearch))
        );
    }, [customers, searchTerm]);

    const selectedCustomer = useMemo(() => {
        return selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;
    }, [selectedCustomerId, customers]);

    const groupedCustomerOrders = useMemo(() => {
        if (!selectedCustomer) return new Map();
        const orders = productionOrdersHook.productionOrders
            .filter(o => o.customerId === selectedCustomer.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return orders.reduce((acc, order) => {
            const monthYear = new Date(order.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            if (!acc.has(monthYear)) {
                acc.set(monthYear, []);
            }
            acc.get(monthYear)!.push(order);
            return acc;
        }, new Map<string, ProductionOrder[]>());

    }, [selectedCustomer, productionOrdersHook.productionOrders]);

    const aggregatedPurchaseHistory = useMemo(() => {
        if (!selectedCustomer) return [];
        const productMap = new Map<string, { name: string; sku: string; totalQuantity: number; lastPurchase: string }>();

        const orders = productionOrdersHook.productionOrders.filter(o => o.customerId === selectedCustomer.id);
        
        for (const order of orders) {
            for (const item of order.orderItems) {
                const kit = inventory.findKitById(item.kitId);
                if (kit) {
                    const existing = productMap.get(kit.id);
                    if (existing) {
                        existing.totalQuantity += item.quantity;
                        if (new Date(order.createdAt) > new Date(existing.lastPurchase)) {
                            existing.lastPurchase = order.createdAt;
                        }
                    } else {
                        productMap.set(kit.id, {
                            name: kit.name,
                            sku: kit.sku,
                            totalQuantity: item.quantity,
                            lastPurchase: order.createdAt,
                        });
                    }
                }
            }
        }
        return Array.from(productMap.values()).sort((a,b) => new Date(b.lastPurchase).getTime() - new Date(a.lastPurchase).getTime());
    }, [selectedCustomer, productionOrdersHook.productionOrders, inventory]);

    const handleOpenModal = (customer: Customer | null = null) => {
        setEditingCustomer(customer);
        setIsEditModalOpen(true);
    };

    const handleSaveCustomer = async (customerData: Customer | Omit<Customer, 'id' | 'createdAt'>) => {
        if ('id' in customerData) {
            await updateCustomer(customerData);
        } else {
            const newCustomer = await addCustomer(customerData);
            if(newCustomer) setSelectedCustomerId(newCustomer.id);
        }
    };

    const handleDelete = async () => {
        if (deletingCustomer) {
            await deleteCustomer(deletingCustomer.id);
            if (selectedCustomerId === deletingCustomer.id) {
                setSelectedCustomerId(null);
            }
            setDeletingCustomer(null);
        }
    };

    const editingOrderWithTotal = useMemo(() => {
        if (!editingFinancialsOrder) return null;
        return { ...editingFinancialsOrder, totalValue: editingFinancialsOrder.saleDetails?.sellingPrice || 0 };
    }, [editingFinancialsOrder]);


    return (
        <div className="h-full flex flex-col">
            <h2 className="text-3xl font-bold text-black mb-6 flex-shrink-0">Clientes</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
                <Card className="lg:col-span-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-black">Lista de Clientes</h3>
                        <Button onClick={() => handleOpenModal()}>Novo Cliente</Button>
                    </div>
                    <Input placeholder="Buscar por nome, documento..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4"/>
                    <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                        {isLoading ? <p>Carregando...</p> : filteredCustomers.map(customer => (
                            <div key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}
                                className={`p-3 border-l-4 rounded cursor-pointer mb-2 transition-all ${selectedCustomerId === customer.id ? 'bg-autro-blue-light border-autro-blue' : 'border-transparent hover:bg-gray-50'}`}>
                                <p className="font-semibold text-black">{customer.name}</p>
                                <p className="text-sm text-gray-600">{customer.document || 'Documento não informado'}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="lg:col-span-2 flex flex-col">
                    <div className="flex-grow">
                        {!selectedCustomer ? (
                             <EmptyState
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                                title="Nenhum Cliente Selecionado"
                                message="Selecione um cliente da lista para ver os detalhes."
                            />
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-2xl font-bold text-black">{selectedCustomer.name}</h3>
                                        <p className="text-sm text-gray-500">Cliente desde: {formatDateTime(selectedCustomer.createdAt)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleOpenModal(selectedCustomer)} variant="secondary">Editar</Button>
                                        <Button onClick={() => setDeletingCustomer(selectedCustomer)} variant="danger">Excluir</Button>
                                    </div>
                                </div>
                                
                                <h4 className="font-semibold text-black mb-2 mt-4">Histórico de Compras</h4>
                                <div className="flex-grow overflow-y-auto -mr-3 pr-3 border-t pt-2">
                                    {aggregatedPurchaseHistory.length === 0 ? <p className="text-sm text-gray-500">Nenhum produto comprado encontrado.</p> : (
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto (Kit)</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd. Total</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Última Compra</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {aggregatedPurchaseHistory.map(item => (
                                                    <tr key={item.sku} className="border-b">
                                                        <td className="px-3 py-2">
                                                            <p className="font-medium text-black">{item.name}</p>
                                                            <p className="text-xs text-gray-500">{item.sku}</p>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-semibold text-autro-blue">{item.totalQuantity}</td>
                                                        <td className="px-3 py-2 text-right text-gray-600">{formatDateTime(item.lastPurchase)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {isEditModalOpen && (
                <CustomerEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveCustomer}
                    customerToEdit={editingCustomer}
                />
            )}
            
            {deletingCustomer && (
                <ConfirmationModal
                    isOpen={!!deletingCustomer}
                    onClose={() => setDeletingCustomer(null)}
                    onConfirm={handleDelete}
                    title={`Excluir Cliente "${deletingCustomer.name}"`}
                    confirmText="Sim, Excluir"
                >
                    <p>Tem certeza? Esta ação é irreversível.</p>
                </ConfirmationModal>
            )}
            
            <FinancialManagementModal
                order={editingOrderWithTotal}
                onClose={() => setEditingFinancialsOrder(null)}
                onSave={productionOrdersHook.updateProductionOrderInstallments}
            />
        </div>
    );
};