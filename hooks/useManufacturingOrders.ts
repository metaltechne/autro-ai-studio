import { useState, useCallback, useEffect } from 'react';
import { ManufacturingOrder, ManufacturingOrdersHook, InventoryLog, ManufacturingOrderItem, ManufacturingAnalysis, Installment, ManufacturingTrackingStep, FinancialTransaction } from '../types';
import * as api from './api';
import { useActivityLog } from '../contexts/ActivityLogContext';
import { useToast } from './useToast';
import { nanoid } from 'nanoid';

interface ManufacturingOrdersHookProps {
    addMultipleInventoryLogs: (logsData: Omit<InventoryLog, 'id' | 'date'>[]) => Promise<void>;
}

export const useManufacturingOrders = ({ addMultipleInventoryLogs }: ManufacturingOrdersHookProps): ManufacturingOrdersHook => {
    const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addActivityLog } = useActivityLog();
    const { addToast } = useToast();

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
                manufacturingSteps: order.analysis?.manufacturingSteps || [],
            },
        }));
        // Fix: Property 'timestamp' does not exist on type 'ManufacturingOrder', changed to 'createdAt'
        setManufacturingOrders(sanitizedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);


    const addManufacturingOrder = useCallback(async (orderItems: ManufacturingOrderItem[], analysis: ManufacturingAnalysis, extraData?: Partial<ManufacturingOrder>): Promise<string | null> => {
        const moCounter = await api.getManufacturingOrderCounter();
        const newId = `MO-${String(moCounter).padStart(4, '0')}`;

        const defaultBatchNumber = `LOTE-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${String(moCounter).padStart(4, '0')}`;
        
        const finalExtraData = { ...extraData };
        if (!finalExtraData.batchNumber) finalExtraData.batchNumber = defaultBatchNumber;
        if (!finalExtraData.type) finalExtraData.type = 'interna';

        // Create tracking steps from analysis if available
        const trackingSteps: ManufacturingTrackingStep[] = (analysis.manufacturingSteps || analysis.detailedBreakdown || []).map((step, index) => ({
            id: `step-${index}`,
            name: step.name,
            status: 'pendente',
            predictedCost: step.cost,
            predictedTimeSeconds: step.timeSeconds || 0,
            quantity: step.quantity,
        }));

        const newOrder: ManufacturingOrder = {
            id: newId,
            createdAt: new Date().toISOString(),
            status: 'pendente',
            requirementsDeducted: false,
            orderItems: orderItems.map(item => ({
                ...item,
                status: item.status || 'pendente',
                producedQuantity: item.producedQuantity || 0
            })),
            analysis,
            predictedCost: analysis.totalCost,
            installments: [],
            trackingSteps,
            ...finalExtraData,
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
        
        // REMOVED: Automatic stock update on global status change.
        // Stock is now updated via InspectionReceivingView after approval.
        
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, status } : order
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Status da Ordem de Fabricação ${orderId} atualizado para: ${status}`, { orderId, status });
        await loadData();
    }, [addActivityLog, loadData]);

    const updateManufacturingOrderItemStatus = useCallback(async (orderId: string, componentId: string, status: ManufacturingOrderItem['status']) => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(order => {
            if (order.id === orderId) {
                const orderItems = order.orderItems.map(item => 
                    item.componentId === componentId ? { ...item, status } : item
                );
                return { ...order, orderItems };
            }
            return order;
        });
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Item ${componentId} da OF ${orderId} atualizado para: ${status}`, { orderId, componentId, status });
        await loadData();
    }, [addActivityLog, loadData]);

    const updateManufacturingOrderItems = useCallback(async (orderId: string, orderItems: ManufacturingOrderItem[]) => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, orderItems } : order
        );
        await api.saveManufacturingOrders(newOrders);
        await loadData();
    }, [loadData]);

    const finalizeManufacturingItemInspection = useCallback(async (orderId: string, componentId: string, approvedQuantity: number, rejectedQuantity: number) => {
        const currentOrders = await api.getManufacturingOrders();
        const order = currentOrders.find(o => o.id === orderId);
        if (!order) return;

        const item = order.orderItems.find(i => i.componentId === componentId);
        if (!item) return;

        const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = [];
        let currentComponents = await api.getComponents();
        let componentsUpdated = false;

        // 1. Entrada da quantidade aprovada no estoque
        if (approvedQuantity > 0) {
            let targetComponentId = item.componentId;
            if (item.componentId.startsWith('comp-virtual-')) {
                const sku = item.sku || item.componentId.replace('comp-virtual-', '');
                let realComp = currentComponents.find(c => c.sku === sku);
                if (!realComp) {
                    const newComponent = {
                        id: `comp-${sku}`,
                        name: item.name || sku,
                        sku: sku,
                        type: 'component' as 'component',
                        sourcing: 'manufactured' as 'manufactured',
                        stock: 0,
                        minStock: 0,
                        custoFabricacao: 0,
                        custoMateriaPrima: 0
                    };
                    currentComponents.push(newComponent);
                    componentsUpdated = true;
                    realComp = newComponent;
                }
                targetComponentId = realComp.id;
            }

            logsToAdd.push({
                componentId: targetComponentId,
                type: 'entrada',
                quantity: approvedQuantity,
                reason: 'fabricacao_interna',
                notes: `Fabricado via OF ${orderId} (Aprovado: ${approvedQuantity})`,
            });

            currentComponents = currentComponents.map(c => 
                c.id === targetComponentId ? { ...c, stock: (c.stock || 0) + approvedQuantity } : c
            );
            componentsUpdated = true;
        }

        // 2. Atualizar status do item na ordem
        let orderCompleted = false;
        let requirementsToDeduct: any[] = [];

        const newOrders = currentOrders.map(o => {
            if (o.id === orderId) {
                const orderItems = o.orderItems.map(i => {
                    if (i.componentId === componentId) {
                        if (rejectedQuantity > 0) {
                            // Se houve reprovação, o item volta para pendente com a quantidade reprovada
                            return { 
                                ...i, 
                                status: 'pendente' as const,
                                quantity: rejectedQuantity,
                                producedQuantity: 0
                            };
                        } else {
                            return { ...i, status: 'concluido' as const };
                        }
                    }
                    return i;
                });
                
                const allDone = orderItems.every(i => i.status === 'concluido');
                if (allDone && o.status !== 'concluída') {
                    orderCompleted = true;
                    if (!o.requirementsDeducted) {
                        requirementsToDeduct = o.analysis?.requirements || [];
                    }
                }
                return { ...o, orderItems, status: allDone ? 'concluída' as const : o.status, requirementsDeducted: allDone ? true : o.requirementsDeducted };
            }
            return o;
        });

        // 3. Baixa dos requisitos se a ordem foi concluída
        if (orderCompleted && requirementsToDeduct.length > 0) {
            requirementsToDeduct.forEach(req => {
                if ((req.type === 'materiaPrima' || req.type === 'inventoryComponent') && req.quantity > 0) {
                    logsToAdd.push({
                        componentId: req.id,
                        type: 'saída',
                        quantity: req.quantity,
                        reason: 'consumo_fabricacao',
                        notes: `Consumido para OF ${orderId}`,
                    });

                    currentComponents = currentComponents.map(c => 
                        c.id === req.id ? { ...c, stock: (c.stock || 0) - req.quantity } : c
                    );
                    componentsUpdated = true;
                }
            });
        }

        if (componentsUpdated) {
            await api.saveComponents(currentComponents);
        }

        if (logsToAdd.length > 0) {
            await addMultipleInventoryLogs(logsToAdd);
        }

        await api.saveManufacturingOrders(newOrders);

        // 4. Gerar lançamento financeiro se a ordem foi concluída
        if (orderCompleted) {
            const transactions = await api.getFinancialTransactions();
            const cost = order.actualCost ?? order.predictedCost ?? 0;
            const newTransaction: FinancialTransaction = {
                id: `trans-${nanoid()}`,
                date: new Date().toISOString(),
                description: `Custo de Fabricação - OF ${orderId}`,
                amount: cost,
                type: 'despesa',
                category: 'Produção',
                status: 'pendente',
                relatedOrderId: orderId,
                relatedOrderType: 'manufacturing'
            };
            await api.saveFinancialTransactions([...transactions, newTransaction]);
            await addActivityLog(`Lançamento financeiro de custo gerado para OF ${orderId}`, { orderId, amount: cost });
        }

        await addActivityLog(`Inspeção finalizada para OF ${orderId}: ${approvedQuantity} aprovados, ${rejectedQuantity} reprovados`, { orderId, approvedQuantity, rejectedQuantity });
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

    const updateMultipleManufacturingOrders = useCallback(async (ordersToUpdate: ManufacturingOrder[]) => {
        try {
            const currentOrders = await api.getManufacturingOrders();
            const updateMap = new Map(ordersToUpdate.map(o => [o.id, o]));
            const newOrders = currentOrders.map(o => updateMap.get(o.id) || o);
            await api.saveManufacturingOrders(newOrders);
            await addActivityLog(`Atualizou ${ordersToUpdate.length} ordens de fabricação via planilha.`);
            await loadData();
        } catch (e) {
            console.error("Failed to batch update manufacturing orders:", e);
            throw e;
        }
    }, [addActivityLog, loadData]);

    const updateManufacturingOrderAnalysis = useCallback(async (orderId: string, analysis: ManufacturingAnalysis) => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, analysis, predictedCost: analysis.totalCost } : order
        );
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Análise da Ordem de Fabricação ${orderId} atualizada.`, { orderId });
        await loadData();
    }, [addActivityLog, loadData]);

    const updateManufacturingOrderTracking = useCallback(async (orderId: string, tracking: { actualCost?: number; actualTimeSeconds?: number }) => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, ...tracking } : order
        );
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Acompanhamento da Ordem de Fabricação ${orderId} atualizado.`, { orderId, ...tracking });
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

    const updateManufacturingOrder = useCallback(async (orderId: string, updates: Partial<ManufacturingOrder>): Promise<void> => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(o => o.id === orderId ? { ...o, ...updates } : o);
        setManufacturingOrders(newOrders);
        await api.saveManufacturingOrders(newOrders);
        addToast(`Ordem ${orderId} atualizada com sucesso.`, 'success');
        await addActivityLog(`Ordem de fabricação atualizada: ${orderId}`, { orderId, updates });
    }, [addToast, addActivityLog]);

    return {
        manufacturingOrders,
        isLoading,
        addManufacturingOrder,
        updateManufacturingOrderStatus,
        updateMultipleManufacturingOrders,
        updateManufacturingOrderInstallments,
        updateManufacturingOrderAnalysis,
        updateManufacturingOrderTracking,
        updateManufacturingOrder,
        updateManufacturingOrderItemStatus,
        updateManufacturingOrderItems,
        finalizeManufacturingItemInspection,
        deleteManufacturingOrder,
    };
};