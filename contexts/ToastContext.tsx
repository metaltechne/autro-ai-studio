import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastContextType } from '../types';
import { ToastContainer } from '../components/ui/Toast';
import { nanoid } from 'nanoid';

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = nanoid();
        setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, []);

    const value = React.useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};