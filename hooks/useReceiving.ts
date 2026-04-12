
import { useState, useEffect } from 'react';
import { ReceivingOrder, SupplierProductMapping, ReceivingItem, Component, InventoryLog } from '../types';
import * as api from './api';
import { nanoid } from 'nanoid';

export const useReceiving = (inventoryHook: any) => {
    const [receivingOrders, setReceivingOrders] = useState<ReceivingOrder[]>([]);
    const [mappings, setMappings] = useState<SupplierProductMapping[]>([]);
    const [counter, setCounter] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const [orders, mps, c] = await Promise.all([
                api.getReceivingOrders(),
                api.getSupplierProductMappings(),
                api.getReceivingCounter()
            ]);
            setReceivingOrders(orders);
            setMappings(mps);
            setCounter(c);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const saveMapping = async (mapping: Omit<SupplierProductMapping, 'id' | 'lastUpdated'>) => {
        const existing = mappings.find(m => 
            m.supplierCnpj === mapping.supplierCnpj && 
            m.supplierProductCode === mapping.supplierProductCode
        );

        let newMappings: SupplierProductMapping[];
        if (existing) {
            newMappings = mappings.map(m => 
                m.id === existing.id 
                    ? { ...m, internalComponentId: mapping.internalComponentId, lastUpdated: new Date().toISOString() }
                    : m
            );
        } else {
            const newMapping: SupplierProductMapping = {
                ...mapping,
                id: `map-${nanoid()}`,
                lastUpdated: new Date().toISOString()
            };
            newMappings = [...mappings, newMapping];
        }

        setMappings(newMappings);
        await api.saveSupplierProductMappings(newMappings);
    };

    const addReceivingOrder = async (order: Omit<ReceivingOrder, 'id'>) => {
        const newId = `REC-${String(counter).padStart(4, '0')}`;
        const newOrder: ReceivingOrder = { ...order, id: newId };
        const newOrders = [newOrder, ...receivingOrders];
        const newCounter = counter + 1;

        setReceivingOrders(newOrders);
        setCounter(newCounter);
        await api.saveReceivingOrders(newOrders, newCounter);
        return newOrder;
    };

    const updateReceivingOrder = async (updatedOrder: ReceivingOrder) => {
        const newOrders = receivingOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        setReceivingOrders(newOrders);
        await api.saveReceivingOrders(newOrders);
    };

    const finalizeReceiving = async (orderId: string) => {
        const order = receivingOrders.find(o => o.id === orderId);
        if (!order) return;

        const approvedItems = order.items.filter(item => item.inspectionStatus === 'aprovado' && item.internalComponentId);
        
        const logs: InventoryLog[] = approvedItems.map(item => ({
            id: `log-${nanoid()}`,
            componentId: item.internalComponentId!,
            type: 'entrada',
            quantity: item.receivedQuantity || item.quantity,
            date: new Date().toISOString(),
            reason: 'compra_fornecedor',
            notes: `Recebimento NFe ${order.nfeNumber} - Fornecedor: ${order.supplierName}`
        }));

        if (logs.length > 0) {
            await inventoryHook.addMultipleInventoryLogs(logs);
        }

        const updatedOrder: ReceivingOrder = { ...order, status: 'concluido' };
        await updateReceivingOrder(updatedOrder);
    };

    return {
        receivingOrders,
        mappings,
        isLoading,
        addReceivingOrder,
        updateReceivingOrder,
        finalizeReceiving,
        saveMapping
    };
};
