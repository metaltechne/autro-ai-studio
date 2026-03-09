import { useState, useCallback, useEffect, useMemo } from 'react';
import { Customer, CustomersHook } from '../types';
import * as api from './api';
import { useToast } from './useToast';
import { useActivityLog } from '../contexts/ActivityLogContext';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';

export const useCustomers = (): CustomersHook => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const { addActivityLog } = useActivityLog();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getCustomers();
            setCustomers(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load customers:", error);
            addToast("Erro ao carregar clientes.", 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const customerMap = useMemo(() => {
        return new Map(customers.map(c => [c.id, c]));
    }, [customers]);

    const findCustomerById = useCallback((id: string) => {
        return customerMap.get(id);
    }, [customerMap]);

    const addCustomer = useCallback(async (customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer | null> => {
        const newCustomer: Customer = {
            id: `cust-${nanoid()}`,
            ...customerData,
            createdAt: new Date().toISOString(),
        };
        try {
            // Optimistic update
            setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));

            const currentCustomers = await api.getCustomers();
            await api.saveCustomers([...currentCustomers, newCustomer]);
            await addActivityLog(`Cliente criado: ${newCustomer.name}`, { customerId: newCustomer.id });
            addToast('Cliente adicionado com sucesso!', 'success');
            return newCustomer;
        } catch (e) {
            console.error("Failed to add customer:", e);
            addToast('Erro ao adicionar cliente.', 'error');
            // Revert optimistic update
            setCustomers(prev => prev.filter(c => c.id !== newCustomer.id));
            return null;
        }
    }, [addToast, addActivityLog]);

    const updateCustomer = useCallback(async (updatedCustomer: Customer) => {
        try {
            const currentCustomers = await api.getCustomers();
            const newCustomers = currentCustomers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
            await api.saveCustomers(newCustomers);
            await addActivityLog(`Cliente atualizado: ${updatedCustomer.name}`, { customerId: updatedCustomer.id });
            addToast('Cliente atualizado com sucesso!', 'success');
            await loadData();
        } catch (e) {
            console.error("Failed to update customer:", e);
            addToast('Erro ao atualizar cliente.', 'error');
        }
    }, [addToast, addActivityLog, loadData]);

    const deleteCustomer = useCallback(async (customerId: string) => {
        try {
            const currentCustomers = await api.getCustomers();
            const customerToDelete = currentCustomers.find(c => c.id === customerId);
            if (!customerToDelete) return;
            
            const newCustomers = currentCustomers.filter(c => c.id !== customerId);
            await api.saveCustomers(newCustomers);
            await addActivityLog(`Cliente excluído: ${customerToDelete.name}`, { customerId });
            addToast('Cliente excluído com sucesso!', 'success');
            await loadData();
        } catch (e) {
            console.error("Failed to delete customer:", e);
            addToast('Erro ao excluir cliente.', 'error');
        }
    }, [addToast, addActivityLog, loadData]);

    return {
        customers,
        isLoading,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        findCustomerById,
    };
};