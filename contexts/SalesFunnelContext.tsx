import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Lead, Deal, DealStage, DealActivity, Task, TaskStatus, ServiceStrategy } from '../types';
import { nanoid } from 'nanoid';
import * as api from '../hooks/api';
import { useToast } from '../hooks/useToast';

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
    isLoading: boolean;
    isDirty: boolean;
    savingStatus: 'idle' | 'saving' | 'saved' | 'error';
    lastSync: number | null;
    isOutdated: boolean;
    addLead: (leadData: Omit<Lead, 'id' | 'createdAt'>) => Promise<Lead>;
    updateLead: (updatedLead: Lead) => Promise<void>;
    registerInteraction: (leadId: string) => Promise<void>;
    checkWindows: () => void;
    addDeal: (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Deal>;
    updateDeal: (updatedDeal: Deal) => Promise<void>;
    updateDealStage: (dealId: string, newStage: DealStage) => Promise<void>;
    addDealActivity: (dealId: string, activityData: Omit<DealActivity, 'id' | 'date'>) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<Task>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    toggleStrategy: (id: string) => void;
    triggerNewLeadTasks: (leadId: string) => void;
    triggerDealStageTasks: (dealId: string, newStage: DealStage) => void;
    saveChanges: () => Promise<void>;
    loadData: () => Promise<void>;
    discardDrafts: () => void;
}

const SalesFunnelContext = createContext<SalesFunnelContextType | undefined>(undefined);

export const SalesFunnelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [strategies, setStrategies] = useState<ServiceStrategy[]>(DEFAULT_STRATEGIES);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [remoteLastModified, setRemoteLastModified] = useState<number | null>(null);
    const [isOutdated, setIsOutdated] = useState(false);

    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        console.log("[SalesFunnel] loadData start");
        setIsLoading(true);
        try {
            const [leadsData, dealsData, tasksData, strategiesData] = await Promise.all([
                api.getLeads(),
                api.getDeals(),
                api.getTasks(),
                api.getStrategies()
            ]);
            console.log("[SalesFunnel] loadData fetched data");

            const now = Date.now();
            setLastSync(now);
            setRemoteLastModified(now);
            setIsOutdated(false);
            
            const deduplicate = <T extends { id: string }>(arr: T[]): T[] => {
                const map = new Map<string, T>();
                for (const item of arr) {
                    if (item && item.id) {
                        map.set(item.id, item);
                    }
                }
                return Array.from(map.values());
            };

            // Initialize lastSaved states with loaded server data
            setLastSavedLeads(deduplicate(leadsData || []));
            setLastSavedDeals(deduplicate(dealsData || []));
            setLastSavedTasks(deduplicate(tasksData || []));
            setLastSavedStrategies(deduplicate(strategiesData || []));

            // Check for local drafts
            const leadsDraft = api.getLocalDraft('leads');
            const dealsDraft = api.getLocalDraft('deals');
            const tasksDraft = api.getLocalDraft('tasks');
            const strategiesDraft = api.getLocalDraft('strategies');

            if (leadsDraft || dealsDraft || tasksDraft || strategiesDraft) {
                console.log("[SalesFunnel] Aplicando rascunhos locais encontrados.");
                if (leadsDraft) setLeads(deduplicate(leadsDraft.data));
                else setLeads(deduplicate(leadsData || []));

                if (dealsDraft) setDeals(deduplicate(dealsDraft.data));
                else setDeals(deduplicate(dealsData || []));

                if (tasksDraft) setTasks(deduplicate(tasksDraft.data));
                else setTasks(deduplicate(tasksData || []));

                if (strategiesDraft) setStrategies(deduplicate(strategiesDraft.data));
                else setStrategies(deduplicate(strategiesData && strategiesData.length > 0 ? strategiesData : DEFAULT_STRATEGIES));

                setIsDirty(true);
            } else {
                setLeads(deduplicate(leadsData || []));
                setDeals(deduplicate(dealsData || []));
                setTasks(deduplicate(tasksData || []));
                setStrategies(deduplicate(strategiesData && strategiesData.length > 0 ? strategiesData : DEFAULT_STRATEGIES));
                setIsDirty(false);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do funil:", error);
            addToast("Erro ao carregar dados do funil.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // Sync monitoring
    useEffect(() => {
        console.log("[SalesFunnel] Subscribing to last modified sync");
        const unsubscribe = api.subscribeToLastModified((timestamp) => {
            console.log("[SalesFunnel] lastModified updated:", timestamp, "lastSync:", lastSync);
            if (lastSync && timestamp > lastSync) {
                setIsOutdated(true);
            }
        });
        return unsubscribe;
    }, [lastSync]);

    const [lastSavedLeads, setLastSavedLeads] = useState<Lead[]>([]);
    const [lastSavedDeals, setLastSavedDeals] = useState<Deal[]>([]);
    const [lastSavedTasks, setLastSavedTasks] = useState<Task[]>([]);
    const [lastSavedStrategies, setLastSavedStrategies] = useState<ServiceStrategy[]>([]);

    const saveChanges = useCallback(async () => {
        if (savingStatus === 'saving') return;
        setSavingStatus('saving');
        try {
            const savePromises = [];
            
            if (JSON.stringify(leads) !== JSON.stringify(lastSavedLeads)) {
                savePromises.push(api.saveLeads(leads).then(() => setLastSavedLeads(leads)));
            }
            if (JSON.stringify(deals) !== JSON.stringify(lastSavedDeals)) {
                savePromises.push(api.saveDeals(deals).then(() => setLastSavedDeals(deals)));
            }
            if (JSON.stringify(tasks) !== JSON.stringify(lastSavedTasks)) {
                savePromises.push(api.saveTasks(tasks).then(() => setLastSavedTasks(tasks)));
            }
            if (JSON.stringify(strategies) !== JSON.stringify(lastSavedStrategies)) {
                savePromises.push(api.saveStrategies(strategies).then(() => setLastSavedStrategies(strategies)));
            }

            if (savePromises.length > 0) {
                await Promise.all(savePromises);
                
                api.clearLocalDraft('leads');
                api.clearLocalDraft('deals');
                api.clearLocalDraft('tasks');
                api.clearLocalDraft('strategies');
                
                setLastSync(Date.now());
                setIsDirty(false);
            } else {
                setIsDirty(false);
            }
            
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 3000);
        } catch (error) {
            console.error("Erro ao salvar funil:", error);
            addToast("Erro ao salvar alterações do funil.", "error");
            setSavingStatus('error');
            setIsDirty(true);
        }
    }, [leads, deals, tasks, strategies, lastSavedLeads, lastSavedDeals, lastSavedTasks, lastSavedStrategies, savingStatus, addToast]);

    // Auto-save logic
    useEffect(() => {
        if (isDirty && !isLoading && savingStatus !== 'saving') {
            const delay = savingStatus === 'error' ? 30000 : 5000; // 30s se falhar, 5s normal (aumentado para evitar abusos Dataguard)
            const timer = setTimeout(() => {
                if (savingStatus === 'error') {
                    setSavingStatus('idle'); // Reseta para idle permitindo que a próxima execução de fato chame saveChanges
                } else {
                    saveChanges();
                }
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isDirty, isLoading, savingStatus, saveChanges]);

    const discardDrafts = useCallback(() => {
        api.clearLocalDraft('leads');
        api.clearLocalDraft('deals');
        api.clearLocalDraft('tasks');
        api.clearLocalDraft('strategies');
        setIsDirty(false);
        loadData();
        addToast("Rascunhos descartados.", "info");
    }, [loadData, addToast]);

    // Auto-save drafts to localStorage
    useEffect(() => {
        if (isDirty && !isLoading) {
            api.saveLocalDraft('leads', leads);
            api.saveLocalDraft('deals', deals);
            api.saveLocalDraft('tasks', tasks);
            api.saveLocalDraft('strategies', strategies);
        }
    }, [leads, deals, tasks, strategies, isDirty, isLoading]);

    // Update overdue tasks automatically - Run only once on load or when tasks change significantly
    useEffect(() => {
        if (isLoading || tasks.length === 0) return;
        
        let hasChanges = false;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const updatedTasks = tasks.map(task => {
            if ((task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) && task.dueDate) {
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
            console.log("[SalesFunnel] Overdue tasks detected and corrected");
            setTasks(updatedTasks);
            setIsDirty(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]); // Keep isLoading here to only run once load completes

    const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
        const newTask: Task = {
            ...task,
            id: `task-${nanoid()}`,
            createdAt: new Date().toISOString()
        };
        setTasks(prev => [...prev, newTask]);
        setIsDirty(true);
        return newTask;
    }, []);

    const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
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
        setIsDirty(true);
    }, []);

    const deleteTask = useCallback(async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        setIsDirty(true);
    }, []);

    const toggleStrategy = useCallback((id: string) => {
        setStrategies(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
        setIsDirty(true);
    }, []);

    const triggerNewLeadTasks = useCallback((leadId: string) => {
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
    }, [strategies, addTask]);

    const triggerDealStageTasks = useCallback((dealId: string, newStage: DealStage) => {
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
    }, [deals, strategies, addTask]);

    const addLead = useCallback(async (leadData: Omit<Lead, 'id' | 'createdAt'>) => {
        const newLead: Lead = {
            ...leadData,
            id: `lead-${nanoid()}`,
            createdAt: new Date().toISOString()
        };
        setLeads(prev => [...prev, newLead]);
        setIsDirty(true);
        triggerNewLeadTasks(newLead.id);
        return newLead;
    }, [triggerNewLeadTasks]);

    const updateLead = useCallback(async (updatedLead: Lead) => {
        setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        setIsDirty(true);
    }, []);

    const registerInteraction = useCallback(async (leadId: string) => {
        setLeads(prev => prev.map(l => {
            if (l.id === leadId) {
                return {
                    ...l,
                    lastInteractionAt: new Date().toISOString(),
                    whatsappWindowStatus: 'open' as 'open' | 'closed',
                    lostDueToWindow: false
                };
            }
            return l;
        }));
        setIsDirty(true);
    }, []);

    const checkWindows = useCallback(() => {
        const now = new Date();
        setLeads(prev => {
            let changed = false;
            const next = prev.map(l => {
                if (l.lastInteractionAt && l.whatsappWindowStatus === 'open') {
                    const lastInteraction = new Date(l.lastInteractionAt);
                    const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
                    if (diffHours >= 24) {
                        changed = true;
                        return {
                            ...l,
                            whatsappWindowStatus: 'closed' as 'open' | 'closed',
                            lostDueToWindow: true
                        };
                    }
                }
                return l;
            });
            if (changed) {
                setIsDirty(true);
                return next;
            }
            return prev;
        });
    }, []);

    const addDeal = useCallback(async (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newDeal: Deal = {
            ...dealData,
            id: `deal-${nanoid()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setDeals(prev => [...prev, newDeal]);
        setIsDirty(true);
        if (newDeal.stage) {
            triggerDealStageTasks(newDeal.id, newDeal.stage);
        }
        return newDeal;
    }, [triggerDealStageTasks]);

    const updateDeal = useCallback(async (updatedDeal: Deal) => {
        const oldDeal = deals.find(d => d.id === updatedDeal.id);
        setDeals(prev => prev.map(d => d.id === updatedDeal.id ? { ...updatedDeal, updatedAt: new Date().toISOString() } : d));
        setIsDirty(true);
        if (oldDeal && oldDeal.stage !== updatedDeal.stage) {
            triggerDealStageTasks(updatedDeal.id, updatedDeal.stage);
        }
    }, [deals, triggerDealStageTasks]);

    const updateDealStage = useCallback(async (dealId: string, newStage: DealStage) => {
        const oldDeal = deals.find(d => d.id === dealId);
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage, updatedAt: new Date().toISOString() } : d));
        setIsDirty(true);
        if (oldDeal && oldDeal.stage !== newStage) {
            triggerDealStageTasks(dealId, newStage);
        }
    }, [deals, triggerDealStageTasks]);

    const addDealActivity = useCallback(async (dealId: string, activityData: Omit<DealActivity, 'id' | 'date'>) => {
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
        setIsDirty(true);
    }, []);

    return (
        <SalesFunnelContext.Provider value={{
            leads,
            deals,
            tasks,
            strategies,
            isLoading,
            isDirty,
            savingStatus,
            lastSync,
            isOutdated,
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
            triggerDealStageTasks,
            saveChanges,
            loadData,
            discardDrafts
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
