
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ActivityLog, ActivityLogHook } from '../types';
import { useAuth } from './AuthContext';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';
import * as api from '../hooks/api';

const ActivityLogContext = createContext<ActivityLogHook | undefined>(undefined);

export const ActivityLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadLogs = async () => {
            setIsLoading(true);
            const logs = await api.getActivityLogs();
            setActivityLogs(logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            setIsLoading(false);
        };
        loadLogs();
    }, []);

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
