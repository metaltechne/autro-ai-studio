import React, { createContext, useContext, useState, useCallback } from 'react';

interface SaveLockContextType {
    isBlocked: boolean;
    blockSave: (message: string) => void;
    unblockSave: () => void;
    saveCount: number;
    incrementSaveCount: () => void;
    resetSaveCount: () => void;
    blockMessage: string;
}

const SaveLockContext = createContext<SaveLockContextType | undefined>(undefined);

export const SaveLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isBlocked, setIsBlocked] = useState(false);
    const [saveCount, setSaveCount] = useState(0);
    const [blockMessage, setBlockMessage] = useState('');

    const blockSave = useCallback((message: string) => {
        setIsBlocked(true);
        setBlockMessage(message);
    }, []);

    const unblockSave = useCallback(() => {
        setIsBlocked(false);
        setBlockMessage('');
        setSaveCount(0);
    }, []);

    const incrementSaveCount = useCallback(() => {
        setSaveCount(prev => prev + 1);
    }, []);

    const resetSaveCount = useCallback(() => {
        setSaveCount(0);
    }, []);

    return (
        <SaveLockContext.Provider value={{ isBlocked, blockSave, unblockSave, saveCount, incrementSaveCount, resetSaveCount, blockMessage }}>
            {children}
        </SaveLockContext.Provider>
    );
};

export const useSaveLock = () => {
    const context = useContext(SaveLockContext);
    if (!context) throw new Error('useSaveLock must be used within a SaveLockProvider');
    return context;
};
