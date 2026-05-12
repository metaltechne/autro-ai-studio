import { useState, useCallback, useEffect, useMemo } from 'react';
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
    const [lastSync, setLastSync] = useState<number>(Date.now());
    const [remoteLastModified, setRemoteLastModified] = useState<number>(Date.now());
    const { addActivityLog } = useActivityLog();
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await api.getManufacturingOrders();
        
        // Fix: Deduplicate by ID to prevent React key errors
        const uniqueOrdersMap = new Map<string, ManufacturingOrder>();
        (data || []).forEach(order => {
            if (order && order.id) {
                uniqueOrdersMap.set(order.id, {
                    ...order,
                    orderItems: order.orderItems || [],
                    installments: order.installments || [],
                    analysis: {
                        ...(order.analysis || {} as ManufacturingAnalysis),
                        requirements: order.analysis?.requirements || [],
                        detailedBreakdown: order.analysis?.detailedBreakdown || [],
                        manufacturingSteps: order.analysis?.manufacturingSteps || [],
                    },
                });
            }
        });
        
        const sanitizedData = Array.from(uniqueOrdersMap.values());
        // Fix: Property 'timestamp' does not exist on type 'ManufacturingOrder', changed to 'createdAt'
        setManufacturingOrders(sanitizedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLastSync(Date.now());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Real-time synchronization
    useEffect(() => {
        const unsubscribe = api.subscribeToLastModified((timestamp) => {
            setRemoteLastModified(timestamp);
        }, 'inventory');
        return () => unsubscribe();
    }, []);

    const isOutdated = useMemo(() => {
        // Prevent reloading if the change was made by this client locally
        const lastLocal = api.getLastLocalUpdate('inventory');
        if (remoteLastModified === lastLocal && lastLocal > 0) return false;
        
        return remoteLastModified > lastSync + 100;
    }, [lastSync, remoteLastModified]);

    useEffect(() => {
        if (isOutdated && !isLoading) {
            console.log("[ManufacturingOrders] Detectada mudança remota. Atualizando ordens...");
            loadData();
        }
    }, [isOutdated, isLoading, loadData]);


    const addManufacturingOrder = useCallback(async (orderItems: ManufacturingOrderItem[], analysis: ManufacturingAnalysis, extraData?: Partial<ManufacturingOrder>): Promise<string | null> => {
        const moCounter = await api.getManufacturingOrderCounter();
        const newId = `MO-${String(moCounter).padStart(4, '0')}`;

        const defaultBatchNumber = `LOTE-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${String(moCounter).padStart(4, '0')}`;
        
        const finalExtraData = { ...extraData };
        if (!finalExtraData.batchNumber) finalExtraData.batchNumber = defaultBatchNumber;
        if (!finalExtraData.type) finalExtraData.type = 'interna';

        // Create tracking steps from analysis if available
        // Filter out material-only steps to show only labor/service steps as requested by user
        const rawSteps = (analysis.manufacturingSteps || analysis.detailedBreakdown || []);
        const trackingSteps: ManufacturingTrackingStep[] = rawSteps
            .filter(step => {
                if (step.type === 'material' || step.type === 'materiaPrima') return false;
                return (step.type === 'labor' || step.type === 'etapaFabricacao' || step.type === 'serviceMapping' || (step.timeSeconds && step.timeSeconds > 0));
            })
            .map((step, index) => ({
                id: `step-${index}`,
                name: step.name,
                type: step.type,
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
        
        let requirementsDeducted = orderToUpdate.requirementsDeducted;

        // Auto-update stock when moving to concluded
        if (status === 'concluída' && orderToUpdate.status !== 'concluída') {
            try {
                const currentLogs = await api.getInventoryLogs();
                const newLogs: InventoryLog[] = [];
                const now = new Date().toISOString();
                
                orderToUpdate.orderItems.forEach(item => {
                    const remainingQty = item.quantity - (item.producedQuantity || 0);
                    if (remainingQty > 0) {
                        newLogs.push({
                            id: `log-mo-in-${nanoid(8)}`,
                            componentId: item.componentId,
                            type: 'entrada',
                            quantity: remainingQty,
                            date: now,
                            reason: 'fabricacao_interna',
                            notes: `Produção concluída OF: ${orderId}`
                        });
                        item.producedQuantity = item.quantity;
                        item.status = 'concluido';
                    }
                });

                if (!requirementsDeducted) {
                    (orderToUpdate.analysis?.requirements || []).forEach(req => {
                        if (req.type === 'materiaPrima' || req.type === 'inventoryComponent') {
                            newLogs.push({
                                id: `log-mo-out-${nanoid(8)}`,
                                componentId: req.id,
                                type: 'saída',
                                quantity: req.quantity,
                                date: now,
                                reason: 'consumo_fabricacao',
                                notes: `Consumo fab. OF: ${orderId}`
                            });
                        }
                    });
                    requirementsDeducted = true;
                }

                if (newLogs.length > 0) {
                    await api.saveInventoryLogs([...currentLogs, ...newLogs]);
                }
            } catch (e) {
                console.error("Erro ao dar baixa no estoque na conclusão da OF:", e);
                addToast("Erro ao dar baixa/adicionar estoque. Verifique o inventário.", 'error');
            }
        } else if (orderToUpdate.status === 'concluída' && status !== 'concluída') {
            // Revert stock if moving OUT of concluded
            try {
                const currentLogs = await api.getInventoryLogs();
                const newLogs: InventoryLog[] = [];
                const now = new Date().toISOString();

                orderToUpdate.orderItems.forEach(item => {
                    const qty = item.producedQuantity || item.quantity;
                    if (qty > 0) {
                        newLogs.push({
                            id: `log-mo-rev-out-${nanoid(8)}`,
                            componentId: item.componentId,
                            type: 'saída',
                            quantity: qty,
                            date: now,
                            reason: 'outro',
                            notes: `Reversão estorno (movido de concluída) OF: ${orderId}`
                        });
                        item.producedQuantity = 0;
                        item.status = 'pendente'; 
                    }
                });

                if (requirementsDeducted) {
                    (orderToUpdate.analysis?.requirements || []).forEach(req => {
                        if (req.type === 'materiaPrima' || req.type === 'inventoryComponent') {
                            newLogs.push({
                                id: `log-mo-rev-in-${nanoid(8)}`,
                                componentId: req.id,
                                type: 'entrada',
                                quantity: req.quantity,
                                date: now,
                                reason: 'outro',
                                notes: `Reversão estorno consumo OF: ${orderId}`
                            });
                        }
                    });
                    requirementsDeducted = false;
                }

                if (newLogs.length > 0) {
                    await api.saveInventoryLogs([...currentLogs, ...newLogs]);
                }
            } catch (e) {
                console.error("Erro ao estornar estoque na reversão da OF:", e);
                addToast("Erro ao estornar estoque. Verifique o inventário.", 'error');
            }
        }
        
        const newOrders = currentOrders.map(order => 
            order.id === orderId ? { ...order, status, requirementsDeducted } : order
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        await api.saveManufacturingOrders(newOrders);
        await addActivityLog(`Status da Ordem de Fabricação ${orderId} atualizado para: ${status}`, { orderId, status });
        await loadData();
    }, [addActivityLog, loadData, addToast]);

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
                const sanitizedSku = sku.replace(/[.#$\[\]/]/g, '-');
                let realComp = currentComponents.find(c => c.sku === sku);
                if (!realComp) {
                    const newComponent = {
                        id: `comp-${sanitizedSku}`,
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
                const orderItems: ManufacturingOrderItem[] = o.orderItems.map(i => {
                    if (i.componentId === componentId) {
                        const newProduced = (i.producedQuantity || 0) + approvedQuantity;
                        const newRejected = (i.rejectedQuantity || 0) + rejectedQuantity;
                        const isDone = (newProduced + newRejected) >= i.quantity;
                        
                        const itemStatus: ManufacturingOrderItem['status'] = isDone ? 'concluido' : 'em_producao';

                        return { 
                            ...i, 
                            status: itemStatus,
                            producedQuantity: newProduced,
                            rejectedQuantity: newRejected
                        };
                    }
                    return i;
                });
                
                const allDone = orderItems.every(i => i.status === 'concluido');
                const orderStatus: ManufacturingOrder['status'] = allDone ? 'concluída' : o.status;

                if (allDone && o.status !== 'concluída') {
                    orderCompleted = true;
                    if (!o.requirementsDeducted) {
                        requirementsToDeduct = o.analysis?.requirements || [];
                    }
                }

                return { 
                    ...o, 
                    orderItems, 
                    status: orderStatus, 
                    requirementsDeducted: allDone ? true : o.requirementsDeducted 
                };
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
            // Fix: Use atomic updates instead of saving the whole component array to prevent overwriting other users' changes
            for (const req of (requirementsToDeduct || [])) {
                 if ((req.type === 'materiaPrima' || req.type === 'inventoryComponent') && req.quantity > 0) {
                     await api.updateStockAtomically(req.id, -req.quantity);
                 }
            }
            
            if (approvedQuantity > 0) {
                // Determine target component ID
                const item = order.orderItems.find(i => i.componentId === componentId);
                if (item) {
                    let targetId = item.componentId;
                    if (item.componentId.startsWith('comp-virtual-')) {
                        const sku = item.sku || item.componentId.replace('comp-virtual-', '');
                        const realComp = currentComponents.find(c => c.sku === sku);
                        if (realComp) targetId = realComp.id;
                        else {
                            // If it's a new component being created, we STILL need to save it.
                            // But maybe it's safer to just save the NEW component specifically.
                            const sanitizedSku = sku.replace(/[.#$\[\]/]/g, '-');
                            const newComponent = {
                                id: `comp-${sanitizedSku}`,
                                name: item.name || sku,
                                sku: sku,
                                type: 'component' as 'component',
                                sourcing: 'manufactured' as 'manufactured',
                                stock: approvedQuantity,
                                minStock: 0,
                                custoFabricacao: 0,
                                custoMateriaPrima: 0
                            };
                            await api.saveComponents([...currentComponents, newComponent]); // This is still slightly risky but only for the new one.
                            targetId = newComponent.id;
                        }
                    }
                    
                    if (!targetId.startsWith('comp-virtual-')) {
                        await api.updateStockAtomically(targetId, approvedQuantity);
                    }
                }
            }
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
        // Optimistic update
        setManufacturingOrders(prev => prev.filter(o => o.id !== orderId));
        
        try {
            const currentOrders = await api.getManufacturingOrders();
            const orderToDelete = currentOrders.find(o => o.id === orderId);
            if (orderToDelete) {
                const newOrders = currentOrders.filter(o => o.id !== orderId);
                await api.saveManufacturingOrders(newOrders);
                await addActivityLog(`Ordem de Fabricação excluída: ${orderId}`, { orderId });
            }
        } catch (error) {
            console.error("Failed to delete manufacturing order:", error);
            // Rollback if needed
            await loadData();
        }
    }, [addActivityLog, loadData]);

    const clearAllManufacturingOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            await api.saveManufacturingOrders([], 1);
            setManufacturingOrders([]);
            addToast("Todas as ordens de fabricação foram removidas.", 'success');
            await addActivityLog("Limpou todas as ordens de fabricação via manutenção em massa.");
        } catch (error) {
            console.error("Failed to clear all orders:", error);
            addToast("Erro ao remover ordens.", 'error');
        } finally {
            setIsLoading(false);
            await loadData();
        }
    }, [addActivityLog, addToast, loadData]);

    const updateManufacturingOrder = useCallback(async (orderId: string, updates: Partial<ManufacturingOrder>): Promise<void> => {
        const currentOrders = await api.getManufacturingOrders();
        const newOrders = currentOrders.map(o => o.id === orderId ? { ...o, ...updates } : o);
        setManufacturingOrders(newOrders);
        await api.saveManufacturingOrders(newOrders);
        addToast(`Ordem ${orderId} atualizada com sucesso.`, 'success');
        await addActivityLog(`Ordem de fabricação atualizada: ${orderId}`, { orderId, updates });
    }, [addToast, addActivityLog]);

    return useMemo(() => ({
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
        clearAllManufacturingOrders,
    }), [
        manufacturingOrders, isLoading, addManufacturingOrder, 
        updateManufacturingOrderStatus, updateMultipleManufacturingOrders, 
        updateManufacturingOrderInstallments, updateManufacturingOrderAnalysis, 
        updateManufacturingOrderTracking, updateManufacturingOrder, 
        updateManufacturingOrderItemStatus, updateManufacturingOrderItems, 
        finalizeManufacturingItemInspection, deleteManufacturingOrder, clearAllManufacturingOrders
    ]);
};