
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { InventoryHook, ScannedQRCodeData, Component, InventoryLogReason, SessionItem } from '../types';
import { useToast } from '../hooks/useToast';
import { ConfirmationModal } from './ui/ConfirmationModal';
import * as api from '../hooks/api';

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

type ActiveTab = 'entrada' | 'baixa' | 'conferencia';

const reasonLabels: Record<Extract<InventoryLogReason, 'uso_producao_kit' | 'venda_direta' | 'ajuste_inventario_negativo' | 'perda_dano'>, string> = {
    uso_producao_kit: 'Produção / Montagem',
    venda_direta: 'Venda Balcão',
    ajuste_inventario_negativo: 'Ajuste de Saldo',
    perda_dano: 'Avaria / Sucata',
};

const checkoutReasons: Extract<InventoryLogReason, 'uso_producao_kit' | 'venda_direta' | 'ajuste_inventario_negativo' | 'perda_dano'>[] = ['uso_producao_kit', 'venda_direta', 'ajuste_inventario_negativo', 'perda_dano'];

const LOCAL_STORAGE_KEY_PREFIX = 'autro_stockMovement_session_';

export const StockMovementView: React.FC<{ inventory: InventoryHook }> = ({ inventory }) => {
    const { addToast } = useToast();
    const { findComponentById, addMultipleInventoryLogs } = inventory;

    const [activeTab, setActiveTab] = useState<ActiveTab>('entrada');
    const [sessionItems, setSessionItems] = useState<Map<string, SessionItem>>(new Map());
    const [lastCheckedItem, setLastCheckedItem] = useState<Component | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [checkoutReason, setCheckoutReason] = useState<InventoryLogReason>('uso_producao_kit');
    const [isConfirming, setIsConfirming] = useState(false);
    const [scannedItem, setScannedItem] = useState<Component | null>(null);
    const [quantityToAdd, setQuantityToAdd] = useState(1);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSaveToFirebase = async () => {
        setIsSyncing(true);
        try {
            await api.forceUseSupabase();
            const localData = await api.getLocalData();
            await api.restoreAllData(localData);
            await api.forceUseLocalStorage();
            addToast('Dados salvos no Supabase!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            addToast('Erro ao salvar no Firebase.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };
    
    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'qr-reader';
    
    useEffect(() => {
        try {
            const savedSession = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${activeTab}`);
            if (savedSession) {
                const parsedSessionArray = JSON.parse(savedSession) as [string, { componentId: string; quantity: number }][];
                const hydratedSession = new Map<string, SessionItem>();
                parsedSessionArray.forEach(([key, value]) => {
                    const component = findComponentById(value.componentId);
                    if (component) hydratedSession.set(key, { component, quantity: value.quantity });
                });
                setSessionItems(hydratedSession);
            }
        } catch (e) {
            localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${activeTab}`);
        }
    }, [activeTab, findComponentById]);

    useEffect(() => {
        const sessionToSave = Array.from(sessionItems.entries()).map(([key, item]) => [key, { componentId: item.component.id, quantity: item.quantity }]);
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${activeTab}`, JSON.stringify(sessionToSave));
    }, [sessionItems, activeTab]);

    const onScanSuccess = useCallback((decodedText: string) => {
        try {
            const data = JSON.parse(decodedText) as ScannedQRCodeData;
            if (!data || data.type !== 'component' || !data.id) {
                addToast("QR Code inválido.", 'error');
                return;
            }
            const component = findComponentById(data.id);
            if (!component) {
                addToast(`Item não encontrado.`, 'error');
                return;
            }
            if (activeTab === 'conferencia') {
                setLastCheckedItem(component);
                addToast(`Conferência: ${component.name}`, 'info');
            } else {
                setScannedItem(component);
                setQuantityToAdd(1);
                // Beep effect placeholder
            }
        } catch (e) {
            addToast("QR Code não reconhecido.", 'error');
        }
    }, [activeTab, findComponentById, addToast]);
    
    const handleAddToSession = () => {
        if (!scannedItem || quantityToAdd <= 0) return;
        setSessionItems((prev) => {
            const newItems = new Map<string, SessionItem>(prev);
            const existing = newItems.get(scannedItem.id);
            if (existing) {
                newItems.set(scannedItem.id, { ...existing, quantity: existing.quantity + quantityToAdd });
            }
            else newItems.set(scannedItem.id, { component: scannedItem, quantity: quantityToAdd });
            return newItems;
        });
        addToast(`${quantityToAdd}x ${scannedItem.name} adicionado.`, 'success');
        setScannedItem(null);
    };

    const startScanner = useCallback(() => {
        if (!isScanning) {
            const html5QrcodeScanner = new window.Html5Qrcode(scannerContainerId, { verbose: false });
            scannerRef.current = html5QrcodeScanner;
            html5QrcodeScanner.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 280, height: 280 } },
                onScanSuccess,
                () => {}
            ).then(() => setIsScanning(true)).catch(() => addToast("Erro na Câmera.", 'error'));
        }
    }, [isScanning, onScanSuccess, addToast]);
    
    const stopScanner = useCallback(() => {
        if (isScanning && scannerRef.current) {
            scannerRef.current.stop().then(() => setIsScanning(false));
        }
    }, [isScanning]);
    
    const executeConfirm = async () => {
        const logs = Array.from(sessionItems.values()).map((item: SessionItem) => ({
            componentId: item.component.id,
            type: activeTab === 'entrada' ? 'entrada' as const : 'saída' as const,
            quantity: item.quantity,
            reason: activeTab === 'entrada' ? 'compra_fornecedor' as const : checkoutReason,
            notes: `Movimentação via Terminal QR`
        }));
        await addMultipleInventoryLogs(logs);
        addToast(`Lote de ${activeTab} processado com sucesso!`, 'success');
        setSessionItems(new Map());
        setIsConfirming(false);
    };

    // Fix: Explicitly type 'sum' to number to resolve "Operator '+' cannot be applied to types 'unknown' and 'number'" error.
    const totalItems = Array.from(sessionItems.values()).reduce((sum: number, item: SessionItem) => sum + item.quantity, 0);

    return (
        <div className="h-full flex flex-col font-sans max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Mission Control: Terminal</h2>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Operação de Fluxo de Estoque em Tempo Real</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSaveToFirebase} disabled={isSyncing} variant="primary">
                        {isSyncing ? 'Salvando...' : '💾 Salvar'}
                    </Button>
                    <div className="flex bg-slate-200 p-1.5 rounded-2xl w-full md:w-auto shadow-inner">
                        {['entrada', 'baixa', 'conferencia'].map((t) => (
                            <button
                                key={t}
                                onClick={() => { setActiveTab(t as ActiveTab); setSessionItems(new Map()); setScannedItem(null); }}
                                className={`flex-1 md:w-32 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Lado Esquerdo: Scanner e Feedback Imediato */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <Card className="flex flex-col items-center justify-center p-8 bg-slate-900 border-none shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none"></div>
                        <div id={scannerContainerId} className="w-full aspect-square max-w-[320px] bg-black rounded-3xl overflow-hidden border-4 border-slate-700 shadow-inner relative">
                            {!isScanning && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-800/50 backdrop-blur-sm">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Scanner Desativado</p>
                                </div>
                            )}
                            {isScanning && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line z-10"></div>}
                        </div>
                        
                        <div className="mt-6 flex gap-3 w-full max-w-[320px]">
                            <Button onClick={startScanner} disabled={isScanning} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 border-none shadow-lg shadow-blue-900/40">Ativar</Button>
                            <Button onClick={stopScanner} disabled={!isScanning} variant="secondary" className="flex-1 h-12 !bg-slate-800 !text-slate-400 !border-slate-700">Pausar</Button>
                        </div>

                        {scannedItem && activeTab !== 'conferencia' && (
                            <div className="w-full mt-6 p-5 bg-white rounded-2xl animate-fade-in shadow-xl ring-4 ring-blue-500/20">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-50 pb-2">Item Detectado</h4>
                                <div className="mb-4">
                                    <p className="text-lg font-black text-slate-900 leading-tight uppercase truncate">{scannedItem.name}</p>
                                    <p className="text-xs font-mono text-slate-400 font-bold">{scannedItem.sku}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-grow">
                                        <Input type="number" min="1" value={quantityToAdd} onChange={e => setQuantityToAdd(Number(e.target.value) || 1)} className="h-12 !bg-slate-50 font-black text-lg" />
                                    </div>
                                    <Button onClick={handleAddToSession} className="h-12 px-8">OK</Button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {[5, 10, 50].map(n => (
                                        <button key={n} onClick={() => setQuantityToAdd(n)} className="flex-1 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 hover:bg-blue-600 hover:text-white transition-colors">+{n}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {activeTab === 'conferencia' && lastCheckedItem && (
                        <Card className="bg-slate-900 text-white p-8 rounded-3xl text-center border-none shadow-2xl animate-fade-in">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 block">Resultado Conferência</span>
                            <p className="text-2xl font-black uppercase mb-1">{lastCheckedItem.name}</p>
                            <p className="text-xs text-slate-500 font-mono mb-6">{lastCheckedItem.sku}</p>
                            <div className="inline-block px-10 py-6 bg-white/5 rounded-3xl border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Saldo Atual em Sistema</p>
                                <p className="text-6xl font-black text-white">{lastCheckedItem.stock}</p>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Lado Direito: Resumo da Sessão e Ações de Lote */}
                {activeTab !== 'conferencia' && (
                    <Card className="lg:col-span-7 flex flex-col min-h-0 p-0 overflow-hidden border-2 border-slate-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Resumo do Lote</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase">{totalItems} unidades prontas para processar</p>
                            </div>
                            <Button variant="danger" size="sm" onClick={() => setSessionItems(new Map())} disabled={sessionItems.size === 0} className="rounded-xl h-9">Limpar Tudo</Button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-6 space-y-3 bg-white">
                            {Array.from(sessionItems.values()).length > 0 ? Array.from(sessionItems.values()).map(({ component, quantity }) => (
                                <div key={component.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors group">
                                    <div className="min-w-0">
                                        <p className="font-black text-slate-900 uppercase text-sm truncate">{component.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400 font-bold">{component.sku}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl font-black text-slate-900">{quantity}x</span>
                                        <button onClick={() => {
                                            const newMap = new Map(sessionItems);
                                            newMap.delete(component.id);
                                            setSessionItems(newMap);
                                        }} className="opacity-0 group-hover:opacity-100 p-2 text-rose-300 hover:text-rose-600 transition-all">×</button>
                                    </div>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 py-20">
                                    <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" /></svg>
                                    <p className="text-xs font-black uppercase tracking-widest">Nenhum item bipado ainda</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-900 border-t border-slate-800">
                            {activeTab === 'baixa' && (
                                <div className="mb-6">
                                    <Select label="Finalidade da Baixa" value={checkoutReason} onChange={e => setCheckoutReason(e.target.value as InventoryLogReason)} className="!bg-slate-800 !text-white !border-slate-700 h-12">
                                        {checkoutReasons.map(r => <option key={r} value={r} className="bg-slate-800">{reasonLabels[r]}</option>)}
                                    </Select>
                                </div>
                            )}
                            <Button onClick={() => setIsConfirming(true)} disabled={sessionItems.size === 0} className={`w-full h-16 text-lg font-black shadow-2xl border-none ${activeTab === 'entrada' ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950' : 'bg-rose-500 hover:bg-rose-400 text-rose-950'}`}>
                                PROCESSAR {activeTab === 'entrada' ? 'RECEBIMENTO' : 'SAÍDA'}
                            </Button>
                        </div>
                    </Card>
                )}
            </div>

            <ConfirmationModal
                isOpen={isConfirming}
                onClose={() => setIsConfirming(false)}
                onConfirm={executeConfirm}
                title={`Confirmar Lote de ${activeTab.toUpperCase()}`}
                confirmText="Processar Agora"
                variant={activeTab === 'entrada' ? 'primary' : 'danger'}
            >
                <p className="text-sm font-medium text-slate-600">Deseja atualizar o saldo de <span className="font-black text-slate-900">{totalItems} unidades</span> no banco de dados?</p>
            </ConfirmationModal>

            <style>{`
                @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
                .animate-scan-line { animation: scan 2s linear infinite; }
            `}</style>
        </div>
    );
};
