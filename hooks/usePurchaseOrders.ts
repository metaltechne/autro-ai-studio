
import { useState, useCallback, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrdersHook, PurchaseOrderItem, InventoryLog, PurchaseRecommendation, Installment, InventoryHook, Component } from '../types';
import * as api from './api';
import { useActivityLog } from '../contexts/ActivityLogContext';
// Fix: Import getComponentCost from shared evaluator.
import { getComponentCost } from './manufacturing-evaluator';

interface PurchaseOrdersHookProps {
    addMultipleInventoryLogs: (logsData: Omit<InventoryLog, 'id' | 'date'>[]) => Promise<void>;
    inventoryHook: InventoryHook;
}

export const usePurchaseOrders = ({ addMultipleInventoryLogs, inventoryHook }: PurchaseOrdersHookProps): PurchaseOrdersHook => {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addActivityLog } = useActivityLog();
    const { findComponentById } = inventoryHook;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await api.getPurchaseOrders();
        const sanitizedData = data.map(order => ({
            ...order,
            items: order.items || [],
            installments: order.installments || [],
        }));
        setPurchaseOrders(sanitizedData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const addPurchaseOrder = useCallback(async (recommendations: PurchaseRecommendation[], expectedDeliveryDate: string): Promise<string | null> => {
        const newOrderItems: PurchaseOrderItem[] = recommendations.map(rec => {
            const component = findComponentById(rec.componentId);
            const unitPrice = component ? getComponentCost(component) : 0;
            return {
                id: rec.componentId,
                name: rec.name,
                quantity: Math.ceil(rec.toOrder),
                unitPrice: unitPrice,
            };
        });

        if (newOrderItems.length === 0) return null;
        
        const poCounter = await api.getPoCounter();
        const newId = `PO-${String(poCounter).padStart(4, '0')}`;

        const newOrder: PurchaseOrder = {
            id: newId,
            createdAt: new Date().toISOString(),
            items: newOrderItems,
            status: 'pendente',
            expectedDeliveryDate: expectedDeliveryDate,
            installments: [],
        };
        
        const currentOrders = await api.getPurchaseOrders();
        const newOrders = [newOrder, ...currentOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        await api.savePurchaseOrders(newOrders, poCounter + 1);
        await addActivityLog(`Ordem de Compra criada: ${newId}`, { orderId: newId });
        await loadData();
        
        return newOrder.id;
    }, [addActivityLog, findComponentById, loadData]);

    const savePurchaseOrder = useCallback(async (order: PurchaseOrder) => {
        const currentOrders = await api.getPurchaseOrders();
        let newOrders: PurchaseOrder[];
        let poCounter: number | undefined = undefined;

        if (currentOrders.some(o => o.id === order.id)) {
            // Update existing order
            newOrders = currentOrders.map(o => o.id === order.id ? order : o);
            await addActivityLog(`Ordem de Compra atualizada: ${order.id}`, { orderId: order.id });
        } else {
            // Create new order
            const currentCounter = await api.getPoCounter();
            poCounter = currentCounter + 1;
            const newId = `PO-${String(currentCounter).padStart(4, '0')}`;

            // Defensively check for 0 prices on new manual orders
            const itemsWithPrice = order.items.map(item => {
                if (item.unitPrice === 0 || item.unitPrice === undefined) {
                    const component = findComponentById(item.id);
                    const unitPrice = component ? getComponentCost(component) : 0;
                    return { ...item, unitPrice };
                }
                return item;
            });
            
            const newOrder: PurchaseOrder = {
                ...order,
                id: newId,
                items: itemsWithPrice,
                createdAt: new Date().toISOString(),
                status: 'pendente',
            };
            newOrders = [newOrder, ...currentOrders];
            await addActivityLog(`Ordem de Compra criada manualmente: ${newId}`, { orderId: newId });
        }
        
        await api.savePurchaseOrders(newOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), poCounter);
        await loadData();
    }, [addActivityLog, findComponentById, loadData]);

    const updateOrderStatus = useCallback(async (orderId: string, status: PurchaseOrder['status']) => {
        const currentOrders = await api.getPurchaseOrders();
        const orderToUpdate = currentOrders.find(o => o.id === orderId);
        
        if (orderToUpdate && orderToUpdate.status === 'pendente' && status === 'concluída') {
            const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = orderToUpdate.items
                .filter(item => !item.id.startsWith('missing-'))
                .map(item => ({
                    componentId: item.id,
                    type: 'entrada',
                    quantity: item.quantity,
                    reason: 'compra_fornecedor',
                    notes: `Recebimento da Ordem de Compra ${orderId}`,
                }));
            
            if (logsToAdd.length > 0) {
                await addMultipleInventoryLogs(logsToAdd);
            }
        }
        
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, status } : order
        );
        await api.savePurchaseOrders(newOrders);
        await addActivityLog(`Status da Ordem de Compra ${orderId} atualizado para: ${status}`, { orderId, status });
        await loadData();
    }, [addMultipleInventoryLogs, addActivityLog, loadData]);

    const updatePurchaseOrderInstallments = useCallback(async (orderId: string, installments: Installment[]) => {
        const currentOrders = await api.getPurchaseOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, installments } : order
        );
        await api.savePurchaseOrders(newOrders);
        await addActivityLog(`Financeiro da Ordem de Compra ${orderId} atualizado.`, { orderId });
        await loadData();
    }, [addActivityLog, loadData]);

    const deletePurchaseOrder = useCallback(async (orderId: string) => {
        const currentOrders = await api.getPurchaseOrders();
        const orderToDelete = currentOrders.find(o => o.id === orderId);
        if (orderToDelete) {
            const newOrders = currentOrders.filter(o => o.id !== orderId);
            await api.savePurchaseOrders(newOrders);
            await addActivityLog(`Ordem de Compra excluída: ${orderId}`, { orderId });
            await loadData();
        }
    }, [addActivityLog, loadData]);


    return {
        purchaseOrders,
        isLoading,
        addPurchaseOrder,
        savePurchaseOrder,
        updateOrderStatus,
        updatePurchaseOrderInstallments,
        deletePurchaseOrder,
    };
};
