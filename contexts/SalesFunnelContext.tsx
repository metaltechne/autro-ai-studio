import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Lead, Deal, DealStage, DealActivity, Task, TaskStatus, ServiceStrategy } from '../types';
import { nanoid } from 'nanoid';

// Default strategies for automatic task generation
const DEFAULT_STRATEGIES: ServiceStrategy[] = [
    {
        id: 'strat-1',
        name: 'Boas-vindas Novo Lead',
        triggerEvent: 'NEW_LEAD',
        delayDays: 0, // Same day
        taskTitle: 'Enviar mensagem de boas-vindas',
        taskDescription: 'Apresentar a empresa e entender a necessidade inicial do cliente.',
        isActive: true
    },
    {
        id: 'strat-2',
        name: 'Follow-up de Proposta',
        triggerEvent: 'DEAL_STAGE_CHANGED',
        targetStage: 'Proposta Enviada',
        delayDays: 3,
        taskTitle: 'Follow-up: Proposta Enviada',
        taskDescription: 'Entrar em contato para saber se o cliente tem dúvidas sobre a proposta enviada.',
        isActive: true
    },
    {
        id: 'strat-3',
        name: 'Pós-venda (Ganho)',
        triggerEvent: 'DEAL_STAGE_CHANGED',
        targetStage: 'Ganho',
        delayDays: 7,
        taskTitle: 'Pesquisa de Satisfação (Pós-venda)',
        taskDescription: 'Verificar se o produto foi entregue corretamente e se o cliente está satisfeito.',
        isActive: true
    }
];

interface SalesFunnelContextType {
    leads: Lead[];
    deals: Deal[];
    tasks: Task[];
    strategies: ServiceStrategy[];
    addLead: (leadData: Omit<Lead, 'id' | 'createdAt'>) => Promise<Lead>;
    updateLead: (updatedLead: Lead) => Promise<void>;
    registerInteraction: (leadId: string) => Promise<void>;
    checkWindows: () => void;
    addDeal: (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Deal>;
    updateDeal: (updatedDeal: Deal) => Promise<void>;
    updateDealStage: (dealId: string, newStage: DealStage) => Promise<void>;
    addDealActivity: (dealId: string, activityData: Omit<DealActivity, 'id' | 'date'>) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Task;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    toggleStrategy: (id: string) => void;
    triggerNewLeadTasks: (leadId: string) => void;
    triggerDealStageTasks: (dealId: string, newStage: DealStage) => void;
}

const SalesFunnelContext = createContext<SalesFunnelContextType | undefined>(undefined);

export const SalesFunnelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [leads, setLeads] = usePersistentState<Lead[]>('autro_leads', []);
    const [deals, setDeals] = usePersistentState<Deal[]>('autro_deals', []);
    const [tasks, setTasks] = usePersistentState<Task[]>('autro_crm_tasks', []);
    const [strategies, setStrategies] = usePersistentState<ServiceStrategy[]>('autro_crm_strategies', DEFAULT_STRATEGIES);

    // Update overdue tasks automatically
    useEffect(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let hasChanges = false;
        const updatedTasks = tasks.map(task => {
            if (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) {
                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                if (dueDate < now) {
                    hasChanges = true;
                    return { ...task, status: TaskStatus.OVERDUE };
                }
            }
            return task;
        });

        if (hasChanges) {
            setTasks(updatedTasks);
        }
    }, [tasks]);

    const addTask = (task: Omit<Task, 'id' | 'createdAt'>) => {
        const newTask: Task = {
            ...task,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        };
        setTasks(prev => [...prev, newTask]);
        return newTask;
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => {
            if (t.id === id) {
                const updated = { ...t, ...updates };
                if (updates.status === TaskStatus.COMPLETED && t.status !== TaskStatus.COMPLETED) {
                    updated.completedAt = new Date().toISOString();
                }
                return updated;
            }
            return t;
        }));
    };

    const deleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const toggleStrategy = (id: string) => {
        setStrategies(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    };

    const triggerNewLeadTasks = (leadId: string) => {
        const activeStrategies = strategies.filter(s => s.isActive && s.triggerEvent === 'NEW_LEAD');
        activeStrategies.forEach(strategy => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + strategy.delayDays);
            addTask({
                title: strategy.taskTitle,
                description: strategy.taskDescription,
                dueDate: dueDate.toISOString(),
                status: TaskStatus.PENDING,
                relatedLeadId: leadId
            });
        });
    };

    const triggerDealStageTasks = (dealId: string, newStage: DealStage) => {
        const deal = deals.find(d => d.id === dealId);
        if (!deal) return;
        const activeStrategies = strategies.filter(s => s.isActive && s.triggerEvent === 'DEAL_STAGE_CHANGED' && s.targetStage === newStage);
        activeStrategies.forEach(strategy => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + strategy.delayDays);
            addTask({
                title: strategy.taskTitle,
                description: strategy.taskDescription,
                dueDate: dueDate.toISOString(),
                status: TaskStatus.PENDING,
                relatedLeadId: deal.leadId,
                relatedDealId: deal.id
            });
        });
    };

    const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt'>) => {
        const newLead: Lead = {
            ...leadData,
            id: `lead-${nanoid()}`,
            createdAt: new Date().toISOString()
        };
        setLeads(prev => [...prev, newLead]);
        triggerNewLeadTasks(newLead.id);
        return newLead;
    };

    const updateLead = async (updatedLead: Lead) => {
        setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    };

    const registerInteraction = async (leadId: string) => {
        setLeads(prev => prev.map(l => {
            if (l.id === leadId) {
                return {
                    ...l,
                    lastInteractionAt: new Date().toISOString(),
                    whatsappWindowStatus: 'open',
                    lostDueToWindow: false
                };
            }
            return l;
        }));
    };

    const checkWindows = () => {
        const now = new Date();
        setLeads(prev => prev.map(l => {
            if (l.lastInteractionAt && l.whatsappWindowStatus === 'open') {
                const lastInteraction = new Date(l.lastInteractionAt);
                const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 24) {
                    return {
                        ...l,
                        whatsappWindowStatus: 'closed',
                        lostDueToWindow: true
                    };
                }
            }
            return l;
        }));
    };

    const addDeal = async (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newDeal: Deal = {
            ...dealData,
            id: `deal-${nanoid()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setDeals(prev => [...prev, newDeal]);
        if (newDeal.stage) {
            triggerDealStageTasks(newDeal.id, newDeal.stage);
        }
        return newDeal;
    };

    const updateDeal = async (updatedDeal: Deal) => {
        const oldDeal = deals.find(d => d.id === updatedDeal.id);
        setDeals(prev => prev.map(d => d.id === updatedDeal.id ? { ...updatedDeal, updatedAt: new Date().toISOString() } : d));
        if (oldDeal && oldDeal.stage !== updatedDeal.stage) {
            triggerDealStageTasks(updatedDeal.id, updatedDeal.stage);
        }
    };

    const updateDealStage = async (dealId: string, newStage: DealStage) => {
        const oldDeal = deals.find(d => d.id === dealId);
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage, updatedAt: new Date().toISOString() } : d));
        if (oldDeal && oldDeal.stage !== newStage) {
            triggerDealStageTasks(dealId, newStage);
        }
    };

    const addDealActivity = async (dealId: string, activityData: Omit<DealActivity, 'id' | 'date'>) => {
        const newActivity: DealActivity = {
            ...activityData,
            id: `act-${nanoid()}`,
            date: new Date().toISOString()
        };
        setDeals(prev => prev.map(d => {
            if (d.id === dealId) {
                return {
                    ...d,
                    activities: [...(d.activities || []), newActivity],
                    updatedAt: new Date().toISOString()
                };
            }
            return d;
        }));
    };

    return (
        <SalesFunnelContext.Provider value={{
            leads,
            deals,
            tasks,
            strategies,
            addLead,
            updateLead,
            registerInteraction,
            checkWindows,
            addDeal,
            updateDeal,
            updateDealStage,
            addDealActivity,
            addTask,
            updateTask,
            deleteTask,
            toggleStrategy,
            triggerNewLeadTasks,
            triggerDealStageTasks
        }}>
            {children}
        </SalesFunnelContext.Provider>
    );
};

export const useSalesFunnelContext = () => {
    const context = useContext(SalesFunnelContext);
    if (context === undefined) {
        throw new Error('useSalesFunnelContext must be used within a SalesFunnelProvider');
    }
    return context;
};
