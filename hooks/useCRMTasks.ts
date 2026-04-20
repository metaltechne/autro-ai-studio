import { useSalesFunnelContext } from '../contexts/SalesFunnelContext';

export const useCRMTasks = (_leads?: any, _deals?: any) => {
    const context = useSalesFunnelContext();
    
    return {
        tasks: context.tasks,
        strategies: context.strategies,
        addTask: context.addTask,
        updateTask: context.updateTask,
        deleteTask: context.deleteTask,
        toggleStrategy: context.toggleStrategy,
        triggerNewLeadTasks: context.triggerNewLeadTasks,
        triggerDealStageTasks: context.triggerDealStageTasks
    };
};
