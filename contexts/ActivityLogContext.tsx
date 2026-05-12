
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ActivityLog, ActivityLogHook } from '../types';
import { useAuth } from './AuthContext';
import { nanoid } from 'nanoid';
import * as api from '../hooks/api';

const ActivityLogContext = createContext<ActivityLogHook | undefined>(undefined);

export const ActivityLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSync, setLastSync] = useState<number>(Date.now());
    const [remoteLastModified, setRemoteLastModified] = useState<number>(Date.now());

    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        const logs = await api.getActivityLogs(100);
        setActivityLogs(logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setLastSync(Date.now());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Real-time synchronization
    useEffect(() => {
        const unsubscribe = api.subscribeToLastModified((timestamp) => {
            setRemoteLastModified(timestamp);
        }, 'inventory');
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Prevent reloading if the change was made by this client locally
        const lastLocal = api.getLastLocalUpdate('inventory');
        if (remoteLastModified === lastLocal && lastLocal > 0) return;

        if (remoteLastModified > lastSync + 2000 && !isLoading) {
            loadLogs();
        }
    }, [remoteLastModified, lastSync, isLoading, loadLogs]);

    const addActivityLog = useCallback(async (action: string, details?: Record<string, any>) => {
        const logAuthor = (details?.user === 'AI Worker' ? 'AI Worker' : user?.email) || 'Sistema';
        
        const sanitizedDetails = details ? JSON.parse(JSON.stringify(details)) : undefined;

        const newLog: ActivityLog & { details?: Record<string, any> } = {
            id: `log-${nanoid()}`,
            timestamp: new Date().toISOString(),
            user: logAuthor,
            action,
        };
        
        if (sanitizedDetails && Object.keys(sanitizedDetails).length > 0) {
            newLog.details = sanitizedDetails;
        }

        const newLogs = [newLog, ...activityLogs.slice(0, 199)]; // Keep max 200 logs
        setActivityLogs(newLogs);
        await api.saveActivityLogs(newLogs);

    }, [user, activityLogs]);

    const value = { activityLogs, addActivityLog, isLoading };

    return (
        <ActivityLogContext.Provider value={value}>
            {children}
        </ActivityLogContext.Provider>
    );
};

export const useActivityLog = (): ActivityLogHook => {
    const context = useContext(ActivityLogContext);
    if (context === undefined) {
        throw new Error('useActivityLog must be used within an ActivityLogProvider');
    }
    return context;
};
