import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { ManufacturingOrder, PurchaseOrder, ProductionOrder, Installment } from '../../types';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';

const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return 'R$ --';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
}> = ({ order, onClose, onSave }) => {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [isSaving, setIsSaving] = useState(false);
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
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-md font-semibold text-black">Valor Total da Ordem</h4>
                        <p className="text-2xl font-bold text-autro-blue">{formatCurrency(order.totalValue)}</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-md font-semibold text-black">Valor Total das Parcelas</h4>
                        <p className={`text-2xl font-bold ${Math.abs(order.totalValue - totalValue) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totalValue)}</p>
                    </div>
                </div>
                
                <div className="border-t pt-4">
                     <h4 className="text-md font-semibold text-black mb-2">Gerar Parcelas Automaticamente</h4>
                     <div className="flex items-end gap-2">
                         <Input 
                            label="Prazos (em dias)"
                            value={termInput}
                            onChange={e => setTermInput(e.target.value)}
                            placeholder="Ex: 30,60,90"
                            className="flex-grow"
                         />
                         <Button onClick={handleGenerateFromTerms} variant="secondary">Gerar</Button>
                     </div>
                </div>

                <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-black mb-2">Boletos / Parcelas</h4>
                    <div className="space-y-2">
                        {installments.map(inst => (
                            editingInstallmentId === inst.id && draftInstallment ? (
                                <div key={inst.id} className="p-3 bg-blue-50 border border-autro-blue rounded-lg space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <Input label="Número" name="number" value={draftInstallment.number || ''} onChange={handleDraftChange} />
                                        <Input label="Fornecedor" name="supplierName" value={draftInstallment.supplierName || ''} onChange={handleDraftChange} />
                                        <Input label="Valor (R$)" name="value" type="number" step="0.01" value={draftInstallment.value} onChange={handleDraftChange} />
                                        <Input label="Vencimento" name="dueDate" type="date" value={draftInstallment.dueDate} onChange={handleDraftChange} />
                                    </div>
                                    <Input label="Notas" name="notes" value={draftInstallment.notes || ''} onChange={handleDraftChange} />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="secondary" onClick={handleCancelEdit}>Cancelar</Button>
                                        <Button size="sm" onClick={handleSaveDraft}>Salvar</Button>
                                    </div>
                                </div>
                            ) : (
                                <div key={inst.id} className="grid grid-cols-12 gap-3 items-center p-2 bg-gray-50 rounded-md">
                                    <div className="col-span-12 md:col-span-6 flex flex-col">
                                        <span className="font-semibold text-black text-sm">{inst.supplierName || 'Fornecedor não especificado'}</span>
                                        <span className="text-xs text-gray-500">#{inst.number || '--'} {inst.notes && `- ${inst.notes}`}</span>
                                    </div>
                                    <div className="col-span-4 md:col-span-2 text-sm font-semibold text-black">{formatCurrency(inst.value)}</div>
                                    <div className="col-span-4 md:col-span-2 text-sm text-gray-600">{formatDate(inst.dueDate)}</div>
                                    <div className="col-span-4 md:col-span-2 flex justify-end items-center gap-2">
                                        <button onClick={() => handleToggleStatus(inst.id)} className={`px-2 py-1 text-xs rounded-full ${inst.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inst.status}</button>
                                        <button onClick={() => handleEdit(inst)} className="p-1 text-gray-500 hover:text-autro-blue">&#9998;</button>
                                        <button onClick={() => handleRemoveInstallment(inst.id)} className="p-1 text-red-500 hover:text-red-700 font-bold">&times;</button>
                                    </div>
                                </div>
                            )
                        ))}
                         {installments.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Nenhum boleto registrado.</p>}
                    </div>
                </div>

                <div className="border-t pt-4">
                     <h4 className="text-md font-semibold text-black mb-2">Adicionar Novo Boleto Manualmente</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <Input label="Número" value={newInstallment.number} onChange={e => setNewInstallment(p => ({...p, number: e.target.value}))} />
                        <Input label="Fornecedor" value={newInstallment.supplierName} onChange={e => setNewInstallment(p => ({...p, supplierName: e.target.value}))} />
                        <Input label="Valor (R$)" type="number" step="0.01" value={newInstallment.value} onChange={e => setNewInstallment(p => ({...p, value: e.target.value}))} />
                        <Input label="Vencimento" type="date" value={newInstallment.dueDate} onChange={e => setNewInstallment(p => ({...p, dueDate: e.target.value}))} />
                        <div className="md:col-span-2 lg:col-span-4">
                           <Input label="Notas" value={newInstallment.notes} onChange={e => setNewInstallment(p => ({...p, notes: e.target.value}))} placeholder="Ex: Referente ao serviço X" />
                        </div>
                     </div>
                     <div className="flex justify-end mt-2">
                        <Button onClick={handleAddInstallment} variant="secondary">Adicionar Parcela</Button>
                     </div>
                </div>
            </div>
            <div className="flex justify-end pt-4 border-t mt-4 gap-2">
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
        </Modal>
    );
};