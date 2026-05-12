import React from 'react';
import { useSaveLock } from '../../contexts/SaveLockContext';

export const SaveMonitor: React.FC = () => {
    const { isBlocked, saveCount, blockMessage, unblockSave } = useSaveLock();

    if (!isBlocked && saveCount < 3) return null;

    return (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 border ${isBlocked ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'}`}>
            <div className="flex flex-col gap-2">
                <h3 className={`font-bold ${isBlocked ? 'text-red-800' : 'text-yellow-800'}`}>
                    {isBlocked ? 'Sistema Bloqueado' : 'Monitoramento de Salvamento'}
                </h3>
                <p className="text-sm">Tentativas de salvamento: {saveCount}</p>
                {isBlocked && (
                    <>
                        <p className="text-xs text-red-700">{blockMessage}</p>
                        <button 
                            onClick={unblockSave}
                            className="mt-2 bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                        >
                            Desbloquear e Limpar
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
