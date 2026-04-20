import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { ManufacturingOrder, PurchaseOrder, ProductionOrder, Installment } from '../../types';
import { nanoid } from 'nanoid';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
const formatDate = (isoString: string | undefined) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

type OrderWithFinancials = (ManufacturingOrder | PurchaseOrder | ProductionOrder) & { totalValue: number };

export const FinancialManagementModal: React.FC<{
    order: OrderWithFinancials | null;
    onClose: () => void;
    onSave: (orderId: string, installments: Installment[]) => Promise<void>;
    onReanalyze?: (orderId: string) => Promise<void>;
}> = ({ order, onClose, onSave, onReanalyze }) => {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [newInstallment, setNewInstallment] = useState({ number: '', value: '', dueDate: '', supplierName: '', notes: '' });
    const [termInput, setTermInput] = useState('');

    const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
    const [draftInstallment, setDraftInstallment] = useState<Installment | null>(null);

    useEffect(() => {
        if (order) {
            setInstallments(order.installments || []);
            setTermInput('');
            setEditingInstallmentId(null);
            setDraftInstallment(null);
        }
    }, [order]);
    
    if (!order) return null;

    const handleReanalyze = async () => {
        if (!onReanalyze) return;
        setIsReanalyzing(true);
        try {
            await onReanalyze(order.id);
        } finally {
            setIsReanalyzing(false);
        }
    };

    const handleAddInstallment = () => {
        if (!newInstallment.value || !newInstallment.dueDate) {
            alert('Valor e Data de Vencimento são obrigatórios.');
            return;
        }
        const newInst: Installment = {
            id: `inst-${nanoid()}`,
            number: newInstallment.number,
            value: parseFloat(newInstallment.value),
            dueDate: newInstallment.dueDate,
            status: 'pendente',
            supplierName: newInstallment.supplierName,
            notes: newInstallment.notes,
        };
        setInstallments([...installments, newInst]);
        setNewInstallment({ number: '', value: '', dueDate: '', supplierName: '', notes: '' });
    };

    const handleGenerateFromTerms = () => {
        const terms = termInput.split(',').map(t => parseInt(t.trim(), 10)).filter(t => !isNaN(t) && t > 0);
        if (terms.length === 0) {
            alert('Formato de prazo inválido. Use números separados por vírgula, ex: 30,60,90');
            return;
        }

        const total = order.totalValue;
        const valuePerInstallment = parseFloat((total / terms.length).toFixed(2));
        const today = new Date();

        const newInstallments = terms.map((days, index) => {
            const dueDate = new Date(today);
            dueDate.setUTCDate(dueDate.getUTCDate() + days);
            return {
                id: `inst-${nanoid()}`,
                number: String(index + 1),
                value: valuePerInstallment,
                dueDate: dueDate.toISOString().split('T')[0],
                status: 'pendente' as const,
                supplierName: '',
                notes: ''
            };
        });

        setInstallments(newInstallments);
    };

    const handleRemoveInstallment = (id: string) => {
        setInstallments(installments.filter(inst => inst.id !== id));
    };

    const handleToggleStatus = (id: string) => {
        setInstallments(installments.map(inst => 
            inst.id === id ? { ...inst, status: inst.status === 'pendente' ? 'pago' : 'pendente' } : inst
        ));
    };
    
    const handleEdit = (installment: Installment) => {
        setEditingInstallmentId(installment.id);
        setDraftInstallment({ ...installment });
    };

    const handleCancelEdit = () => {
        setEditingInstallmentId(null);
        setDraftInstallment(null);
    };

    const handleSaveDraft = () => {
        if (!draftInstallment) return;
        setInstallments(prev => prev.map(inst => inst.id === editingInstallmentId ? draftInstallment : inst));
        handleCancelEdit();
    };

    const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!draftInstallment) return;
        const { name, value } = e.target;
        setDraftInstallment({
            ...draftInstallment,
            [name]: e.target.type === 'number' ? parseFloat(value) || 0 : value
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(order.id, installments);
        setIsSaving(false);
        onClose();
    };
    const totalValue = installments.reduce((sum, i) => sum + i.value, 0);

    return (
        <Modal isOpen={!!order} onClose={onClose} title={`Gestão Financeira: ${order.id}`} size="4xl">
            <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor da Ordem</h4>
                        <div className="flex items-center gap-3">
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(order.totalValue)}</p>
                            {onReanalyze && (
                                <button 
                                    onClick={handleReanalyze} 
                                    disabled={isReanalyzing}
                                    className="p-1.5 text-slate-400 hover:text-autro-blue hover:bg-white rounded-lg shadow-sm transition-all duration-200"
                                    title="Recalcular custo"
                                >
                                    <svg className={`w-4 h-4 ${isReanalyzing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                     <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Parcelado</h4>
                        <p className={`text-2xl font-black ${Math.abs(order.totalValue - totalValue) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(totalValue)}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Diferença</h4>
                        <p className={`text-2xl font-black ${Math.abs(order.totalValue - totalValue) > 0.01 ? 'text-amber-600' : 'text-slate-300'}`}>{formatCurrency(order.totalValue - totalValue)}</p>
                    </div>
                </div>
                
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-white rounded-full"></div>
                        Gerar Parcelas Automaticamente
                    </h4>
                     <div className="flex items-end gap-3">
                         <Input 
                            label="Prazos (em dias)"
                            value={termInput}
                            onChange={e => setTermInput(e.target.value)}
                            placeholder="Ex: 30,60,90"
                            className="flex-grow bg-slate-800 border-slate-700 text-white focus:ring-white/10 focus:border-white"
                         />
                         <Button onClick={handleGenerateFromTerms} variant="secondary" className="mb-0.5">Gerar</Button>
                     </div>
                </div>

                <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-autro-blue rounded-full"></div>
                        Boletos / Parcelas
                    </h4>
                    <div className="space-y-3">
                        {installments.map(inst => (
                            editingInstallmentId === inst.id && draftInstallment ? (
                                <div key={inst.id} className="p-6 bg-slate-50 border-2 border-autro-blue rounded-2xl space-y-4 animate-in zoom-in-95 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <Input label="Número" name="number" value={draftInstallment.number || ''} onChange={handleDraftChange} />
                                        <Input label="Fornecedor" name="supplierName" value={draftInstallment.supplierName || ''} onChange={handleDraftChange} />
                                        <Input label="Valor (R$)" name="value" type="number" step="0.01" value={draftInstallment.value} onChange={handleDraftChange} />
                                        <Input label="Vencimento" name="dueDate" type="date" value={draftInstallment.dueDate} onChange={handleDraftChange} />
                                    </div>
                                    <Input label="Notas" name="notes" value={draftInstallment.notes || ''} onChange={handleDraftChange} />
                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button size="sm" variant="secondary" onClick={handleCancelEdit}>Cancelar</Button>
                                        <Button size="sm" onClick={handleSaveDraft}>Salvar Alterações</Button>
                                    </div>
                                </div>
                            ) : (
                                <div key={inst.id} className="group grid grid-cols-12 gap-4 items-center p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-slate-200 transition-all duration-200">
                                    <div className="col-span-12 md:col-span-5 flex flex-col">
                                        <span className="font-bold text-slate-900 text-sm">{inst.supplierName || 'Fornecedor não especificado'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">#{inst.number || '--'} {inst.notes && `• ${inst.notes}`}</span>
                                    </div>
                                    <div className="col-span-4 md:col-span-2 text-sm font-black text-slate-900">{formatCurrency(inst.value)}</div>
                                    <div className="col-span-4 md:col-span-2 text-sm text-slate-500 font-medium">{formatDate(inst.dueDate)}</div>
                                    <div className="col-span-4 md:col-span-3 flex justify-end items-center gap-3">
                                        <button 
                                            onClick={() => handleToggleStatus(inst.id)} 
                                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors ${inst.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                                        >
                                            {inst.status}
                                        </button>
                                        <button onClick={() => handleEdit(inst)} className="p-2 text-slate-400 hover:text-autro-blue hover:bg-slate-50 rounded-xl transition-all duration-200" title="Editar">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleRemoveInstallment(inst.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200" title="Remover">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            )
                        ))}
                         {installments.length === 0 && (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <p className="text-sm font-medium text-slate-400">Nenhum boleto registrado para esta ordem.</p>
                            </div>
                         )}
                    </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-slate-400 rounded-full"></div>
                        Adicionar Novo Boleto Manualmente
                    </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <Input label="Número" value={newInstallment.number} onChange={e => setNewInstallment(p => ({...p, number: e.target.value}))} />
                        <Input label="Fornecedor" value={newInstallment.supplierName} onChange={e => setNewInstallment(p => ({...p, supplierName: e.target.value}))} />
                        <Input label="Valor (R$)" type="number" step="0.01" value={newInstallment.value} onChange={e => setNewInstallment(p => ({...p, value: e.target.value}))} />
                        <Input label="Vencimento" type="date" value={newInstallment.dueDate} onChange={e => setNewInstallment(p => ({...p, dueDate: e.target.value}))} />
                        <div className="md:col-span-2 lg:col-span-4">
                           <Input label="Notas" value={newInstallment.notes} onChange={e => setNewInstallment(p => ({...p, notes: e.target.value}))} placeholder="Ex: Referente ao serviço X" />
                        </div>
                     </div>
                     <div className="flex justify-end mt-6">
                        <Button onClick={handleAddInstallment} variant="secondary">Adicionar Parcela</Button>
                     </div>
                </div>
            </div>
            <div className="flex justify-end pt-8 border-t border-slate-100 mt-8 gap-3">
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving} className="min-w-[160px]">
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </div>
        </Modal>
    );
};
