import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import * as api from './api';

export const useTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getTasks();
            setTasks(data || []);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const addTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
        const newTask: Task = {
            ...task,
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
        };
        const newTasks = [...tasks, newTask];
        setTasks(newTasks);
        await api.saveTasks(newTasks);
        return newTask;
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        const newTasks = tasks.map(t => {
            if (t.id === id) {
                const updated = { ...t, ...updates };
                if (updates.status === TaskStatus.COMPLETED && t.status !== TaskStatus.COMPLETED) {
                    updated.completedAt = new Date().toISOString();
                }
                return updated;
            }
            return t;
        });
        setTasks(newTasks);
        await api.saveTasks(newTasks);
    };

    const deleteTask = async (id: string) => {
        const newTasks = tasks.filter(t => t.id !== id);
        setTasks(newTasks);
        await api.saveTasks(newTasks);
    };

    return {
        tasks,
        isLoading,
        addTask,
        updateTask,
        deleteTask,
        refreshTasks: fetchTasks
    };
};
