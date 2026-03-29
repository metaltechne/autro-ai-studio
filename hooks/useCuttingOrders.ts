
import { useState, useCallback, useEffect } from 'react';
import { CuttingOrder, CuttingOrdersHook, InventoryHook, InventoryLog, Component, CuttingRecommendation } from '../types';
import * as api from './api';
import { useToast } from './useToast';
import { useActivityLog } from '../contexts/ActivityLogContext';
// Fix: Import getComponentCost and parseFastenerSku from shared evaluator.
import { getComponentCost, parseFastenerSku } from './manufacturing-evaluator';
import { nanoid } from 'nanoid';

interface CuttingOrdersHookProps {
    inventoryHook: InventoryHook;
}

export const useCuttingOrders = ({ inventoryHook }: CuttingOrdersHookProps): CuttingOrdersHook => {
    const [cuttingOrders, setCuttingOrders] = useState<CuttingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const { addActivityLog } = useActivityLog();
    const { addMultipleInventoryLogs, findComponentById } = inventoryHook;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await api.getCuttingOrders();
        setCuttingOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);


    const addCuttingOrder = useCallback(async (sourceId: string, targetId: string, quantity: number): Promise<string | null> => {
        const sourceComponent = findComponentById(sourceId);
        const targetComponent = findComponentById(targetId);
        if (!sourceComponent || !targetComponent) return null;

        // --- Create Scrap Component ---
        const sourceDims = parseFastenerSku(sourceComponent.sku);
        const targetDims = parseFastenerSku(targetComponent.sku);
        if (!sourceDims || !targetDims) return null;
        
        const scrapLength = sourceDims.comprimento - targetDims.comprimento;
        const sourceCost = getComponentCost(sourceComponent);
        const costPerMm = sourceDims.comprimento > 0 ? sourceCost / sourceDims.comprimento : 0;
        const scrapCost = costPerMm * scrapLength;
        const scrapSku = `RM-CORTE-${sourceComponent.sku.replace('FIX-', '')}-${scrapLength}mm`;

        let allComponents = await api.getComponents();
        let scrapComponent = allComponents.find(c => c.sku === scrapSku);

        if (!scrapComponent) {
            const newScrapData: Omit<Component, 'id' | 'stock'> = {
                name: `Retalho de ${sourceComponent.name} (${scrapLength}mm)`,
                sku: scrapSku, type: 'raw_material', sourcing: 'beneficiado',
                purchaseCost: scrapCost, custoFabricacao: 0, custoMateriaPrima: 0,
                consumptionUnit: 'un', purchaseUnit: 'un',
            };
            const newScrapId = `comp-${newScrapData.sku}`;
            scrapComponent = { ...newScrapData, id: newScrapId, stock: 0 };
            allComponents.push(scrapComponent);
            await api.saveComponents(allComponents);
            await addActivityLog(`Novo material de retalho criado: ${scrapComponent.name}`, { componentId: scrapComponent.id, sku: scrapComponent.sku });
        }
        // --- End Scrap Component ---

        const coCounter = await api.getCoCounter();
        const newId = `CO-${String(coCounter).padStart(4, '0')}`;
        const newOrder: CuttingOrder = {
            id: newId,
            createdAt: new Date().toISOString(),
            status: 'pendente',
            sourceComponentId: sourceId,
            targetComponentId: targetId,
            scrapComponentId: scrapComponent.id,
            quantity,
        };
        const currentOrders = await api.getCuttingOrders();
        await api.saveCuttingOrders([newOrder, ...currentOrders], coCounter + 1);
        await addActivityLog(`Ordem de Corte criada: ${newId}`, { orderId: newId });
        await loadData();
        return newId;
    }, [addActivityLog, findComponentById, loadData]);
    
    const startCuttingOrder = useCallback(async (orderId: string, scannedSourceId: string): Promise<boolean> => {
        const allOrders = await api.getCuttingOrders();
        const order = allOrders.find(o => o.id === orderId);

        if (!order || order.status !== 'pendente' || order.sourceComponentId !== scannedSourceId) {
            addToast("QR Code do fixador de origem incorreto.", 'error');
            return false;
        }

        const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = [{
            componentId: order.sourceComponentId,
            type: 'saída',
            quantity: order.quantity,
            reason: 'corte_substituição',
            notes: `Início do corte para Ordem ${order.id}`
        }];

        await addMultipleInventoryLogs(logsToAdd);

        const updatedOrder = { ...order, status: 'em_andamento' as const, startedAt: new Date().toISOString() };
        await api.saveCuttingOrders(allOrders.map(o => o.id === orderId ? updatedOrder : o));
        await loadData();
        
        addToast(`Ordem de corte ${orderId} iniciada.`, 'success');
        return true;
    }, [addToast, addMultipleInventoryLogs, loadData]);
    
    const finishCuttingOrder = useCallback(async (orderId: string, scannedTargetId: string): Promise<boolean> => {
        const allOrders = await api.getCuttingOrders();
        const order = allOrders.find(o => o.id === orderId);
        
        if (!order || order.status !== 'em_andamento' || order.targetComponentId !== scannedTargetId) {
             addToast("QR Code do fixador de destino incorreto.", 'error');
            return false;
        }

        const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = [
            {
                componentId: order.targetComponentId, type: 'entrada', quantity: order.quantity,
                reason: 'corte_substituição', notes: `Produzido via Ordem de Corte ${order.id}`
            },
            {
                componentId: order.scrapComponentId, type: 'entrada', quantity: order.quantity,
                reason: 'fabricacao_interna', notes: `Retalho da Ordem de Corte ${order.id}`
            }
        ];
        
        await addMultipleInventoryLogs(logsToAdd);

        const completedAt = new Date();
        const startedAt = new Date(order.startedAt!);
        const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

        const updatedOrder = { ...order, status: 'concluída' as const, completedAt: completedAt.toISOString(), durationSeconds };
        await api.saveCuttingOrders(allOrders.map(o => o.id === orderId ? updatedOrder : o));
        await loadData();

        addToast(`Ordem de corte ${orderId} finalizada.`, 'success');
        return true;

    }, [addToast, addMultipleInventoryLogs, loadData]);

    const addMultipleCuttingOrders = useCallback(async (recommendations: CuttingRecommendation[]) => {
        if (recommendations.length === 0) return;
        
        const currentOrders = await api.getCuttingOrders();
        let coCounter = await api.getCoCounter();
        const allCurrentComponents = await api.getComponents();
        let allComponents = [...allCurrentComponents];
        const newComponentsToCreate: Component[] = [];
        const newLogs: Omit<InventoryLog, 'id' | 'date'>[] = [];
        const newOrders: CuttingOrder[] = [];

        for (const rec of recommendations) {
            const sourceComponent = findComponentById(rec.sourceComponentId);
            const targetComponent = findComponentById(rec.targetComponentId);
            if (!sourceComponent || !targetComponent) continue;

            const sourceDims = parseFastenerSku(sourceComponent.sku);
            const targetDims = parseFastenerSku(targetComponent.sku);
            if (!sourceDims || !targetDims) continue;
            
            const scrapLength = sourceDims.comprimento - targetDims.comprimento;
            if(scrapLength <= 0) continue;

            const sourceCost = getComponentCost(sourceComponent);
            const costPerMm = sourceDims.comprimento > 0 ? sourceCost / sourceDims.comprimento : 0;
            const scrapCost = costPerMm * scrapLength;
            const scrapSku = `RM-CORTE-${sourceComponent.sku.replace('FIX-', '')}-${scrapLength}mm`;

            let scrapComponent = allComponents.find(c => c.sku === scrapSku);

            if (!scrapComponent) {
                const newScrapData: Omit<Component, 'id' | 'stock'> = {
                    name: `Retalho de ${sourceComponent.name} (${scrapLength}mm)`, sku: scrapSku, 
                    type: 'raw_material', sourcing: 'beneficiado', purchaseCost: scrapCost, 
                    custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'un', purchaseUnit: 'un',
                };
                const newScrapId = `comp-${newScrapData.sku}`;
                scrapComponent = { ...newScrapData, id: newScrapId, stock: 0 };
                allComponents.push(scrapComponent);
                newComponentsToCreate.push(scrapComponent);
            }

            const newId = `CO-${String(coCounter).padStart(4, '0')}`;
            const now = new Date();
            const newOrder: CuttingOrder = {
                id: newId, createdAt: now.toISOString(), status: 'concluída',
                sourceComponentId: rec.sourceComponentId, targetComponentId: rec.targetComponentId,
                scrapComponentId: scrapComponent.id, quantity: rec.quantityToCut,
                startedAt: now.toISOString(), completedAt: now.toISOString(), durationSeconds: 0
            };
            newOrders.push(newOrder);
            
            newLogs.push({ componentId: rec.sourceComponentId, type: 'saída', quantity: rec.quantityToCut, reason: 'corte_substituição', notes: `Uso na Ordem de Corte ${newId}` });
            newLogs.push({ componentId: rec.targetComponentId, type: 'entrada', quantity: rec.quantityToCut, reason: 'corte_substituição', notes: `Produzido pela Ordem de Corte ${newId}` });
            newLogs.push({ componentId: scrapComponent.id, type: 'entrada', quantity: rec.quantityToCut, reason: 'fabricacao_interna', notes: `Retalho da Ordem de Corte ${newId}` });
            coCounter++;
        }

        if (newComponentsToCreate.length > 0) {
            await api.saveComponents([...allCurrentComponents, ...newComponentsToCreate]);
            await addActivityLog(`Criou ${newComponentsToCreate.length} novos materiais de retalho.`);
        }
        
        if (newOrders.length > 0) {
            await api.saveCuttingOrders([...currentOrders, ...newOrders], coCounter);
        }

        if (newLogs.length > 0) {
            await addMultipleInventoryLogs(newLogs);
        }
        
        if (newOrders.length > 0) {
            await addActivityLog(`Gerou e concluiu ${newOrders.length} Ordens de Corte via Planejador.`);
            addToast(`${newOrders.length} ordens de corte geradas e concluídas.`, 'success');
        }
        await loadData();

    }, [findComponentById, addActivityLog, addMultipleInventoryLogs, addToast, loadData]);
    
    const updateCuttingOrder = useCallback(async (orderId: string, updates: Partial<Pick<CuttingOrder, 'quantity'>>) => {
        const allOrders = await api.getCuttingOrders();
        const orderToUpdate = allOrders.find(o => o.id === orderId);

        if (orderToUpdate && orderToUpdate.status === 'pendente') {
            const updatedOrder = { ...orderToUpdate, ...updates };
            await api.saveCuttingOrders(allOrders.map(o => o.id === orderId ? updatedOrder : o));
            addToast(`Ordem de corte ${orderId} atualizada.`, 'success');
            await loadData();
        } else {
            addToast('Apenas ordens pendentes podem ser atualizadas.', 'error');
        }
    }, [addToast, loadData]);

    const updateMultipleCuttingOrders = useCallback(async (ordersToUpdate: CuttingOrder[]) => {
        try {
            const currentOrders = await api.getCuttingOrders();
            const updateMap = new Map(ordersToUpdate.map(o => [o.id, o]));
            const newOrders = currentOrders.map(o => updateMap.get(o.id) || o);
            await api.saveCuttingOrders(newOrders);
            await addActivityLog(`Atualizou ${ordersToUpdate.length} ordens de corte via planilha.`);
            await loadData();
        } catch (e) {
            console.error("Failed to batch update cutting orders:", e);
            throw e;
        }
    }, [addActivityLog, loadData]);

    const deleteCuttingOrder = useCallback(async (orderId: string) => {
        const currentOrders = await api.getCuttingOrders();
        const orderToDelete = currentOrders.find(o => o.id === orderId);

        if (orderToDelete) {
            if (orderToDelete.status !== 'pendente') {
                addToast('Apenas ordens com status "Pendente" podem ser excluídas.', 'error');
                return;
            }
            const newOrders = currentOrders.filter(o => o.id !== orderId);
            await api.saveCuttingOrders(newOrders);
            await addActivityLog(`Ordem de Corte excluída: ${orderId}`, { orderId });
            addToast(`Ordem de Corte ${orderId} foi excluída.`, 'success');
            await loadData();
        }
    }, [addActivityLog, addToast, loadData]);

    return {
        cuttingOrders,
        isLoading,
        addCuttingOrder,
        startCuttingOrder,
        finishCuttingOrder,
        addMultipleCuttingOrders,
        updateCuttingOrder,
        updateMultipleCuttingOrders,
        deleteCuttingOrder,
    };
};
