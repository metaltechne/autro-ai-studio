
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { WorkStation, Consumable, StandardOperation, ManufacturingHook, OperationConsumable } from '../../types';
import { nanoid } from 'nanoid';

interface ManufacturingSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    manufacturing: ManufacturingHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ManufacturingSettingsModal: React.FC<ManufacturingSettingsModalProps> = ({ isOpen, onClose, manufacturing }) => {
    const { 
        workStations, 
        consumables, 
        standardOperations, 
        saveWorkStations, 
        saveConsumables, 
        saveOperations 
    } = manufacturing;

    const [activeTab, setActiveTab] = useState<'stages' | 'workstations' | 'consumables'>('stages');
    const [isLinkingInsumo, setIsLinkingInsumo] = useState<string | null>(null);
    
    // States para novos cadastros
    const [newStation, setNewStation] = useState({ name: '', hourlyRate: '' });
    const [newConsumable, setNewConsumable] = useState({ name: '', unit: 'un', purchasePrice: '', monthlyConsumption: '', monthlyProduction: '3000', category: 'GERAL' });
    const [newOp, setNewOp] = useState({ name: '', category: 'GERAL', workStationId: '', timeSeconds: '60' });

    // --- Handlers para Vinculação de Insumos ---
    const handleAddConsumableToOp = (opId: string, consumableId: string) => {
        const updated = standardOperations.map(op => {
            if (op.id !== opId) return op;
            const existing = op.operationConsumables || [];
            if (existing.some(c => c.consumableId === consumableId)) return op;
            return {
                ...op,
                operationConsumables: [...existing, { consumableId, quantity: 1 }]
            };
        });
        saveOperations(updated);
        setIsLinkingInsumo(null);
    };

    const handleRemoveConsumableFromOp = (opId: string, consumableId: string) => {
        const updated = standardOperations.map(op => {
            if (op.id !== opId) return op;
            return {
                ...op,
                operationConsumables: (op.operationConsumables || []).filter(c => c.consumableId !== consumableId)
            };
        });
        saveOperations(updated);
    };

    // --- Handlers para Insumos ---
    const handleUpdateConsumable = (id: string, field: keyof Consumable, value: any) => {
        const updated = consumables.map(c => {
            if (c.id !== id) return c;
            const updatedItem = { ...c, [field]: value };
            const price = field === 'purchasePrice' ? Number(value) : updatedItem.purchasePrice;
            const cons = field === 'monthlyConsumption' ? Number(value) : updatedItem.monthlyConsumption;
            const prod = field === 'monthlyProduction' ? Number(value) : updatedItem.monthlyProduction;
            updatedItem.unitCost = prod > 0 ? (price * cons) / prod : 0;
            return updatedItem;
        });
        saveConsumables(updated);
    };

    const handleAddConsumable = () => {
        if (!newConsumable.name) return;
        const price = Number(newConsumable.purchasePrice) || 0;
        const cons = Number(newConsumable.monthlyConsumption) || 0;
        const prod = Number(newConsumable.monthlyProduction) || 3000;
        const unitCost = prod > 0 ? (price * cons) / prod : 0;

        saveConsumables([...consumables, { 
            id: nanoid(), name: newConsumable.name, unit: newConsumable.unit, purchasePrice: price,
            monthlyConsumption: cons, monthlyProduction: prod, unitCost: unitCost, category: newConsumable.category
        }]);
        setNewConsumable({ name: '', unit: 'un', purchasePrice: '', monthlyConsumption: '', monthlyProduction: '3000', category: 'GERAL' });
    };

    // --- Handlers para Operadores ---
    const handleAddStation = () => {
        if (!newStation.name || !newStation.hourlyRate) return;
        saveWorkStations([...workStations, { id: nanoid(), name: newStation.name, hourlyRate: parseFloat(newStation.hourlyRate) }]);
        setNewStation({ name: '', hourlyRate: '' });
    };

    // --- Handlers para Operações ---
    const handleAddOp = () => {
        if (!newOp.name || !newOp.workStationId) return;
        saveOperations([...standardOperations, {
            id: nanoid(),
            name: newOp.name,
            category: newOp.category,
            workStationId: newOp.workStationId,
            timeSeconds: parseInt(newOp.timeSeconds) || 60,
            operationConsumables: []
        }]);
        setNewOp({ name: '', category: 'GERAL', workStationId: '', timeSeconds: '60' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Central de Gestão de Custos Industriais" size="4xl">
            {/* Tabs Navigation */}
            <div className="flex gap-2 border-b mb-6 bg-slate-50 p-1 rounded-t-lg">
                <button 
                    onClick={() => setActiveTab('stages')} 
                    className={`flex-1 px-4 py-3 rounded-md transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'stages' ? 'bg-white shadow-sm text-autro-blue border-b-2 border-autro-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Operações Padrão
                </button>
                <button 
                    onClick={() => setActiveTab('workstations')} 
                    className={`flex-1 px-4 py-3 rounded-md transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'workstations' ? 'bg-white shadow-sm text-autro-blue border-b-2 border-autro-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Operadores
                </button>
                <button 
                    onClick={() => setActiveTab('consumables')} 
                    className={`flex-1 px-4 py-3 rounded-md transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'consumables' ? 'bg-white shadow-sm text-autro-blue border-b-2 border-autro-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Base de Insumos (Rateio)
                </button>
            </div>

            <div className="min-h-[500px]">
                {/* --- ABA 1: OPERAÇÕES (SERVIÇOS) --- */}
                {activeTab === 'stages' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-100 p-4 rounded-xl items-end shadow-inner">
                            <div className="md:col-span-2">
                                <Input label="Nome do Serviço" value={newOp.name} onChange={e => setNewOp({...newOp, name: e.target.value})} placeholder="Ex: Solda de Estrutura" />
                            </div>
                            <Select label="Operador Padrão" value={newOp.workStationId} onChange={e => setNewOp({...newOp, workStationId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {workStations.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                            </Select>
                            <Input label="Tempo Padrão (s)" type="number" value={newOp.timeSeconds} onChange={e => setNewOp({...newOp, timeSeconds: e.target.value})} />
                            <div className="md:col-span-1">
                                <p className="text-[9px] text-slate-400 font-bold mb-1 italic leading-tight">Valor ajustável individualmente no fluxo</p>
                            </div>
                            <Button onClick={handleAddOp} className="w-full h-10 font-black text-[10px] uppercase">Cadastrar</Button>
                        </div>

                        <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">OPERAÇÃO INDUSTRIAL</th>
                                        <th className="px-4 py-4 text-left">OPERADOR PADRÃO</th>
                                        <th className="px-4 py-4 text-left">INSUMOS APLICADOS</th>
                                        <th className="px-4 py-4 text-right">CUSTO ESTIMADO</th>
                                        <th className="px-4 py-4 text-right">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {standardOperations.map(op => {
                                        const ws = workStations.find(w => w.id === op.workStationId);
                                        
                                        // Cálculo do custo da operação na tabela com tratamento NaN
                                        const laborCost = ((op.timeSeconds || 0) / 3600) * (ws?.hourlyRate || 0);
                                        const consumablesCost = (op.operationConsumables || []).reduce((sum, oc) => {
                                            const c = consumables.find(item => item.id === oc.consumableId);
                                            return sum + ((oc.quantity || 0) * (c?.unitCost || 0));
                                        }, 0);
                                        const totalOpCost = (laborCost || 0) + (consumablesCost || 0);

                                        return (
                                            <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-700 leading-tight">{op.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase">{op.timeSeconds} segundos</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 font-medium">{ws?.name || '---'}</td>
                                                <td className="px-4 py-3 min-w-[200px]">
                                                    <div className="flex flex-wrap gap-1 items-center">
                                                        {(op.operationConsumables || []).map(oc => {
                                                            const c = consumables.find(item => item.id === oc.consumableId);
                                                            return (
                                                                <span key={oc.consumableId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">
                                                                    {c?.name || 'Insumo'}
                                                                    <button onClick={() => handleRemoveConsumableFromOp(op.id, oc.consumableId)} className="hover:text-red-500">×</button>
                                                                </span>
                                                            );
                                                        })}
                                                        <button 
                                                            onClick={() => setIsLinkingInsumo(op.id)}
                                                            className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase"
                                                        >
                                                            + Vincular
                                                        </button>
                                                    </div>
                                                    {isLinkingInsumo === op.id && (
                                                        <div className="absolute z-30 mt-1 w-48 bg-white shadow-xl border rounded-lg p-2 animate-fade-in">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Escolha o Insumo:</p>
                                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                                {consumables.map(c => (
                                                                    <button 
                                                                        key={c.id} 
                                                                        onClick={() => handleAddConsumableToOp(op.id, c.id)}
                                                                        className="w-full text-left p-1.5 hover:bg-slate-50 text-xs rounded font-medium text-slate-600 truncate"
                                                                    >
                                                                        {c.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <button onClick={() => setIsLinkingInsumo(null)} className="w-full mt-2 text-[9px] text-red-400 font-bold uppercase">Fechar</button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 inline-block shadow-sm">
                                                        <span className="text-sm font-black text-emerald-700" title={`Mão de Obra: ${formatCurrency(laborCost)} | Insumos: ${formatCurrency(consumablesCost)}`}>
                                                            {formatCurrency(totalOpCost)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => saveOperations(standardOperations.filter(i => i.id !== op.id))} className="text-red-300 hover:text-red-600 font-bold text-xl" title="Excluir">×</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- ABA 2: OPERADORES --- */}
                {activeTab === 'workstations' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-6 rounded-xl items-end shadow-inner border border-slate-200">
                            <Input label="Nome do Operador" placeholder="Ex: Antonio Marcos Rosa" value={newStation.name} onChange={e => setNewStation({ ...newStation, name: e.target.value })} />
                            <Input label="Valor da Hora (R$)" type="number" step="0.01" value={newStation.hourlyRate} onChange={e => setNewStation({ ...newStation, hourlyRate: e.target.value })} />
                            <Button onClick={handleAddStation} className="h-10 font-black text-[10px] uppercase">Adicionar Operador</Button>
                        </div>
                        <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">OPERADOR</th>
                                        <th className="px-4 py-4 text-right">CUSTO HORA</th>
                                        <th className="px-4 py-4 text-right">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {workStations.map(ws => (
                                        <tr key={ws.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-700">{ws.name}</td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold text-lg">{formatCurrency(ws.hourlyRate)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => saveWorkStations(workStations.filter(w => w.id !== ws.id))} className="text-red-300 hover:text-red-600 font-bold text-xl">×</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- ABA 3: INSUMOS --- */}
                {activeTab === 'consumables' && (
                     <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-xl border-l-8 border-emerald-400">
                            <div>
                                <h4 className="text-xl font-black uppercase tracking-tighter">Calculadora de Custo de Saída</h4>
                                <p className="text-slate-400 text-sm">Fórmula: (Preço Compra × Gasto Mês) ÷ Produção Mês</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white p-4 rounded-xl items-end shadow-sm border border-slate-200">
                            <div className="md:col-span-2">
                                <Input label="Nome do Insumo" value={newConsumable.name} onChange={e => setNewConsumable({ ...newConsumable, name: e.target.value })} />
                            </div>
                            <Input label="Preço Compra (R$)" type="number" value={newConsumable.purchasePrice} onChange={e => setNewConsumable({ ...newConsumable, purchasePrice: e.target.value })} />
                            <Input label="Gasto Mês (Qtd)" type="number" value={newConsumable.monthlyConsumption} onChange={e => setNewConsumable({ ...newConsumable, monthlyConsumption: e.target.value })} />
                            <Input label="Produção Mês (un)" type="number" value={newConsumable.monthlyProduction} onChange={e => setNewConsumable({ ...newConsumable, monthlyProduction: e.target.value })} />
                            <Button onClick={handleAddConsumable} className="w-full h-10 font-black text-[10px] uppercase">Cadastrar</Button>
                        </div>

                        <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 font-black text-[10px] uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">INSUMO</th>
                                        <th className="px-4 py-4 text-right">PREÇO COMPRA</th>
                                        <th className="px-4 py-4 text-right">GASTO MENSAL</th>
                                        <th className="px-4 py-4 text-right text-emerald-600">CUSTO SAÍDA (UN)</th>
                                        <th className="px-4 py-4 text-right">AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {consumables.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3">
                                                <input className="w-full font-bold text-slate-700 bg-transparent border-none focus:ring-0 rounded px-0" value={c.name} onChange={e => handleUpdateConsumable(c.id, 'name', e.target.value)} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="number" className="w-full text-right font-mono text-slate-600 bg-transparent border-none focus:ring-0" value={c.purchasePrice} onChange={e => handleUpdateConsumable(c.id, 'purchasePrice', e.target.value)} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="number" className="w-full text-right font-mono text-slate-600 bg-transparent border-none focus:ring-0" value={c.monthlyConsumption} onChange={e => handleUpdateConsumable(c.id, 'monthlyConsumption', e.target.value)} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-block">
                                                    <span className="text-sm font-black text-emerald-700">{formatCurrency(c.unitCost)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => saveConsumables(consumables.filter(item => item.id !== c.id))} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
            `}</style>
        </Modal>
    );
};
