import React from 'react';
import { useActivityLog } from '../contexts/ActivityLogContext';
import { Card } from './ui/Card';

const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
const AIIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-autro-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
};

export const ActivityLogView: React.FC = () => {
    const { activityLogs, isLoading } = useActivityLog();

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Log de Atividades do Sistema</h2>
            <Card>
                <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
                    {isLoading ? (
                        <p className="text-center text-gray-500 py-10">Carregando histórico...</p>
                    ) : activityLogs.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">Nenhuma atividade registrada ainda.</p>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {activityLogs.map(log => (
                                <li key={log.id} className="p-4 flex items-start space-x-4">
                                    <div className="flex-shrink-0 mt-1">
                                        {log.user === 'AI Worker' ? <AIIcon /> : <UserIcon />}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-semibold text-black">
                                                {log.user}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatDateTime(log.timestamp)}
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-700 mt-1">{log.action}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>
        </div>
    );
};
