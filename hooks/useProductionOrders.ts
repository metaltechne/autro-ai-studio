import { useState, useCallback, useEffect } from 'react';
import { ProductionOrder, ProductionOrdersHook, InventoryHook, ProductionScenario, Installment } from '../types';
import * as api from './api';
import { useActivityLog } from '../contexts/ActivityLogContext';

interface ProductionOrdersHookProps {
    executeProductionRun: InventoryHook['executeProductionRun'];
}

export const useProductionOrders = ({ executeProductionRun }: ProductionOrdersHookProps): ProductionOrdersHook => {
    const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addActivityLog } = useActivityLog();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await api.getProductionOrders();
        const sanitizedData = data.map(order => ({
            ...order,
            orderItems: order.orderItems || [],
            virtualComponents: order.virtualComponents || [],
            scannedItems: order.scannedItems || {},
            substitutions: order.substitutions || {},
            installments: order.installments || [],
            selectedScenario: {
                ...(order.selectedScenario || {} as ProductionScenario),
                shortages: order.selectedScenario?.shortages || [],
                detailedRequirements: order.selectedScenario?.detailedRequirements || [],
                substitutionsMade: order.selectedScenario?.substitutionsMade || [],
            }
        }));
        setProductionOrders(sanitizedData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const addProductionOrder = useCallback(async (data: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>): Promise<string | null> => {
        const prodCounter = await api.getProductionOrderCounter();
        const newId = `ORD-${String(prodCounter).padStart(4, '0')}`;

        const newOrder: ProductionOrder = {
            ...data,
            id: newId,
            createdAt: new Date().toISOString(),
            status: 'pendente',
            scannedItems: {},
            substitutions: {},
            installments: data.installments || [],
        };
        
        const currentOrders = await api.getProductionOrders();
        const newOrders = [newOrder, ...currentOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        await api.saveProductionOrders(newOrders, prodCounter + 1);
        await addActivityLog(`Ordem de Produção criada: ${newId}`, { orderId: newId, customerId: newOrder.customerId });
        await loadData();
        
        return newOrder.id;
    }, [addActivityLog, loadData]);
    
    const updateProductionOrderStatus = useCallback(async (orderId: string, status: ProductionOrder['status']) => {
        const currentOrders = await api.getProductionOrders();
        const orderToUpdate = currentOrders.find(o => o.id === orderId);
        
        if (!orderToUpdate) return;
        
        if (orderToUpdate.status !== 'concluída' && status === 'concluída') {
            await executeProductionRun(orderToUpdate);
        }
        
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, status } : order
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        await api.saveProductionOrders(newOrders);
        await addActivityLog(`Status da Ordem de Produção ${orderId} atualizado para: ${status}`, { orderId, status });
        await loadData();
    }, [executeProductionRun, addActivityLog, loadData]);

    const updateScannedItems = useCallback(async (orderId: string, scannedItems: Record<string, number>) => {
        const currentOrders = await api.getProductionOrders();
        const newOrders = currentOrders.map(order =>
            order.id === orderId ? { ...order, scannedItems } : order
        );
        await api.saveProductionOrders(newOrders);
        await loadData();
        // Do not log every single scan to avoid flooding the log
    }, [loadData]);

    const updateOrderFulfillment = useCallback(async (orderId: string, updates: { scannedItems: Record<string, number>; substitutions: Record<string, { substitutedWithId: string; quantity: number; }> }) => {
        const currentOrders = await api.getProductionOrders();
        const newOrders = currentOrders.map(order =>
            order.id === orderId ? { ...order, ...updates } : order
        );
        await api.saveProductionOrders(newOrders);
        await loadData();
    }, [loadData]);


    const updateProductionOrderTracking = useCallback(async (orderId: string, tracking: { actualCost?: number; actualTimeSeconds?: number }) => {
        const currentOrders = await api.getProductionOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, ...tracking } : order
        );
        await api.saveProductionOrders(newOrders);
        await addActivityLog(`Acompanhamento da Ordem de Produção ${orderId} atualizado.`, { orderId, ...tracking });
        await loadData();
    }, [addActivityLog, loadData]);

    const deleteProductionOrder = useCallback(async (orderId: string) => {
        const currentOrders = await api.getProductionOrders();
        const orderToDelete = currentOrders.find(o => o.id === orderId);
        if (orderToDelete) {
            const newOrders = currentOrders.filter(o => o.id !== orderId);
            await api.saveProductionOrders(newOrders);
            await addActivityLog(`Ordem de Produção excluída: ${orderId}`, { orderId });
            await loadData();
        }
    }, [addActivityLog, loadData]);
    
    const updateProductionOrderInstallments = useCallback(async (orderId: string, installments: Installment[]) => {
        const currentOrders = await api.getProductionOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, installments } : order
        );
        await api.saveProductionOrders(newOrders);
        await addActivityLog(`Financeiro da Ordem de Produção ${orderId} atualizado.`, { orderId });
        await loadData();
    }, [addActivityLog, loadData]);

    const updateMultipleProductionOrders = useCallback(async (ordersToUpdate: ProductionOrder[]) => {
        try {
            const currentOrders = await api.getProductionOrders();
            const updateMap = new Map(ordersToUpdate.map(o => [o.id, o]));
            const newOrders = currentOrders.map(o => updateMap.get(o.id) || o);
            await api.saveProductionOrders(newOrders);
            await addActivityLog(`Atualizou ${ordersToUpdate.length} ordens de produção via planilha.`);
            await loadData();
        } catch (e) {
            console.error("Failed to batch update production orders:", e);
            throw e;
        }
    }, [addActivityLog, loadData]);


    return {
        productionOrders,
        isLoading,
        addProductionOrder,
        updateProductionOrderStatus,
        updateMultipleProductionOrders,
        updateScannedItems,
        updateOrderFulfillment,
        deleteProductionOrder,
        updateProductionOrderInstallments,
        updateProductionOrderTracking,
    };
};