
import React, { useState, useEffect } from 'react';
import { getFirebaseStats, FirebaseStats } from '../hooks/api';
import { Card } from './ui/Card';
import { Activity, ArrowDown, ArrowUp, Database, AlertTriangle, Clock, Shield, ShieldAlert, Trash2, RotateCcw } from 'lucide-react';

export const FirebaseUsageMonitor: React.FC = () => {
    const [stats, setStats] = useState<FirebaseStats>(getFirebaseStats());
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setStats(getFirebaseStats());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Firebase Spark Plan Limits
    const LIMITS = {
        storage: 1024 * 1024 * 1024, // 1 GB
        download: 10 * 1024 * 1024 * 1024, // 10 GB
        connections: 100
    };

    const recentWarnings = stats.lastOperations.filter(op => {
        const sameKeyOps = stats.lastOperations.filter(o => o.key === op.key && Math.abs(o.timestamp - op.timestamp) < 5000);
        return sameKeyOps.length > 5;
    });

    const isHighUsage = stats.blockedOperations > 0 || recentWarnings.length > 0;

    return (
        <div className={`fixed bottom-4 left-4 z-[9999] transition-all duration-300 ${isExpanded ? 'w-96' : 'w-12'}`}>
            {!isExpanded ? (
                <button 
                    onClick={() => setIsExpanded(true)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 ${
                        isHighUsage ? 'bg-red-600 animate-pulse border-red-300' : 'bg-slate-900 border-white/20 hover:bg-slate-800'
                    } text-white`}
                >
                    {isHighUsage ? <ShieldAlert size={20} /> : <Shield size={20} />}
                </button>
            ) : (
                <Card className={`p-4 bg-white border-2 shadow-2xl flex flex-col gap-4 overflow-hidden transition-colors ${stats.blockedOperations > 0 ? 'border-red-200' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-center border-b pb-2">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className={stats.blockedOperations > 0 ? "text-red-600" : "text-blue-600"} />
                            <h3 className="text-xs font-black uppercase tracking-tighter">DataGuard Professional</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {stats.blockedOperations > 0 && (
                                <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse">
                                    {stats.blockedOperations} BLOQUEIOS
                                </span>
                            )}
                            <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase mb-1">
                                <ArrowDown size={10} /> Leituras
                            </div>
                            <p className="text-base font-black text-blue-900 leading-none">{stats.reads}</p>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="flex items-center gap-1 text-[8px] font-black text-amber-600 uppercase mb-1">
                                <ArrowUp size={10} /> Escritas
                            </div>
                            <p className="text-base font-black text-amber-900 leading-none">{stats.writes}</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                            <div className="flex items-center gap-1 text-[8px] font-black text-red-600 uppercase mb-1">
                                <ShieldAlert size={10} /> Bloqueios
                            </div>
                            <p className="text-base font-black text-red-900 leading-none">{stats.blockedOperations}</p>
                        </div>
                    </div>

                    {/* Spark Plan Limits Section */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1">
                            <Clock size={10} /> Limites Spark (Grátis)
                        </p>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-600 mb-1 uppercase">
                                    <span>Download Mensal</span>
                                    <span>{formatBytes(stats.bytesRead)} / 10 GB</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1">
                                    <div 
                                        className="bg-blue-500 h-1 rounded-full transition-all duration-500" 
                                        style={{ width: `${Math.min((stats.bytesRead / LIMITS.download) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-600 mb-1 uppercase">
                                    <span>Armazenamento</span>
                                    <span>~{formatBytes(stats.bytesWritten)} / 1 GB</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1">
                                    <div 
                                        className="bg-amber-500 h-1 rounded-full transition-all duration-500" 
                                        style={{ width: `${Math.min((stats.bytesWritten / LIMITS.storage) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {stats.blockedOperations > 0 && (
                        <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg flex items-center gap-3">
                            <ShieldAlert size={20} className="animate-bounce" />
                            <div>
                                <p className="text-[10px] font-black uppercase leading-tight">Sistema em Alerta</p>
                                <p className="text-[9px] opacity-80 font-bold leading-tight">Gravações abusivas foram interceptadas pelo DataGuard.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditoria de Dados</p>
                        <button 
                            onClick={() => setShowLogs(!showLogs)}
                            className="text-[9px] font-black text-blue-600 hover:underline"
                        >
                            {showLogs ? 'OCULTAR LOGS' : 'VER LOGS DETALHADOS'}
                        </button>
                    </div>

                    {showLogs && (
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {stats.lastOperations.length === 0 ? (
                                <p className="text-[10px] text-slate-400 text-center py-4">Nenhuma operação registrada.</p>
                            ) : (
                                stats.lastOperations.map((op, i) => (
                                    <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                    op.type === 'read' ? 'bg-blue-100 text-blue-700' : 
                                                    op.type === 'write' ? 'bg-amber-100 text-amber-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {op.type}
                                                </span>
                                                <span className="font-mono text-[9px] text-slate-600 font-bold truncate max-w-[140px]">{op.key}</span>
                                            </div>
                                            <span className="text-[8px] text-slate-400 font-bold">
                                                {new Date(op.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[8px] text-slate-400">
                                            <span>Tamanho: {formatBytes(op.size)}</span>
                                            {op.size > 10240 && <span className="text-amber-500 font-black">PESADO</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    <div className="pt-2 border-t flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-[8px] text-slate-400 font-black uppercase">Segurança Ativa</p>
                        </div>
                        <p className="text-[8px] text-slate-300 font-bold">v3.0 Secure Core</p>
                    </div>
                </Card>
            )}
        </div>
    );
};
