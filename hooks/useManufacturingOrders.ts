import { useState, useCallback, useEffect } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryLog, ManufacturingOrderItem, ManufacturingAnalysis, Installment } from '../types';
import * as api from './api';
import { useActivityLog } from '../contexts/ActivityLogContext';

interface ManufacturingOrdersHookProps {
    addMultipleInventoryLogs: (logsData: Omit<InventoryLog, 'id' | 'date'>[]) => Promise<void>;
}

export const useManufacturingOrders = ({ addMultipleInventoryLogs }: ManufacturingOrdersHookProps): ManufacturingOrdersHook => {
    const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addActivityLog } = useActivityLog();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await api.getManufacturingOrders();
        const sanitizedData = data.map(order => ({
            ...order,
            orderItems: order.orderItems || [],
            installments: order.installments || [],
            analysis: {
                ...(order.analysis || {} as ManufacturingAnalysis),
                requirements: order.analysis?.requirements || [],
                detailedBreakdown: order.analysis?.detailedBreakdown || [],
            },
        }));
        // Fix: Property 'timestamp' does not exist on type 'ManufacturingOrder', changed to 'createdAt'
        setManufacturingOrders(sanitizedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);


    const addManufacturingOrder = useCallback(async (orderItems: ManufacturingOrderItem[], analysis: ManufacturingAnalysis): Promise<string | null> => {
        const moCounter = await api.getManufacturingOrderCounter();
        const newId = `MO-${String(moCounter).padStart(4, '0')}`;

        const newOrder: ManufacturingOrder = {
            id: newId,
            createdAt: new Date().toISOString(),
            status: 'pendente',
            orderItems,
            analysis,
            predictedCost: analysis.totalCost,
            installments: [],
        };
        
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = [newOrder, ...currentOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        await api.saveManufacturingOrders(newOrders, moCounter + 1);
        await addActivityLog(`Ordem de Fabricação criada: ${newId}`, { orderId: newId });
        await loadData();
        
        return newId;
    }, [addActivityLog, loadData]);
    
    const updateManufacturingOrderStatus = useCallback(async (orderId: string, status: ManufacturingOrder['status']) => {
        const currentOrders = await api.getManufacturingOrders();
        const orderToUpdate = currentOrders.find(o => o.id === orderId);
        
        if (!orderToUpdate) return;
        
        if (orderToUpdate.status !== 'concluída' && status === 'concluída') {
            const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = [];

            // 1. Entrada dos itens fabricados
            orderToUpdate.orderItems.forEach(item => {
                logsToAdd.push({
                    componentId: item.componentId,
                    type: 'entrada',
                    quantity: item.quantity,
                    reason: 'fabricacao_interna',
                    notes: `Fabricado via Ordem de Fabricação ${orderId}`,
                });
            });
            
            // 2. Baixa dos requisitos (Materia Prima ou Subconjuntos)
            // Agora garantimos que o req.id é o ID real do componente no estoque
            orderToUpdate.analysis.requirements.forEach(req => {
                if ((req.type === 'materiaPrima' || req.type === 'inventoryComponent') && req.quantity > 0) {
                     logsToAdd.push({
                        componentId: req.id,
                        type: 'saída',
                        quantity: req.quantity,
                        reason: 'consumo_fabricacao',
                        notes: `Consumido para Ordem de Fabricação ${orderId}`,
                    });
                }
            });

            if(logsToAdd.length > 0) {
                await addMultipleInventoryLogs(logsToAdd);
            }
        }
        
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, status } : order
        // Fix: Property 'timestamp' does not exist on type 'ManufacturingOrder', changed to 'createdAt'
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Status da Ordem de Fabricação ${orderId} atualizado para: ${status}`, { orderId, status });
        await loadData();
    }, [addMultipleInventoryLogs, addActivityLog, loadData]);

    const updateManufacturingOrderInstallments = useCallback(async (orderId: string, installments: Installment[]) => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, installments } : order
        );
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Financeiro da Ordem de Fabricação ${orderId} atualizado.`, { orderId });
        await loadData();
    }, [addActivityLog, loadData]);

    const deleteManufacturingOrder = useCallback(async (orderId: string) => {
        const currentOrders = await api.getManufacturingOrders();
        const orderToDelete = currentOrders.find(o => o.id === orderId);
        if (orderToDelete) {
            const newOrders = currentOrders.filter(o => o.id !== orderId);
            await api.saveManufacturingOrders(newOrders);
            await addActivityLog(`Ordem de Fabricação excluída: ${orderId}`, { orderId });
            await loadData();
        }
    }, [addActivityLog, loadData]);

    return {
        manufacturingOrders,
        isLoading,
        addManufacturingOrder,
        updateManufacturingOrderStatus,
        updateManufacturingOrderInstallments,
        deleteManufacturingOrder,
    };
};