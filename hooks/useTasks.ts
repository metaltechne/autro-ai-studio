import { useSalesFunnelContext } from '../contexts/SalesFunnelContext';

export const useTasks = () => {
    const { tasks, isLoading, addTask, updateTask, deleteTask, loadData } = useSalesFunnelContext();

    return {
        tasks,
        isLoading,
        addTask,
        updateTask,
        deleteTask,
        refreshTasks: loadData
    };
};
