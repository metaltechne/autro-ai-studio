import React, { useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { PurchaseOrdersHook, ManufacturingOrdersHook, Installment } from '../types';

interface ExtractedData {
    supplier: string;
    totalValue: number;
    installments: {
        value: number;
        dueDate: string; // YYYY-MM-DD
    }[];
}

interface ReviewScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ExtractedData;
    purchaseOrdersHook: PurchaseOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export const ReviewScanModal: React.FC<ReviewScanModalProps> = ({ isOpen, onClose, data, purchaseOrdersHook, manufacturingOrdersHook }) => {
    const { addToast } = useToast();
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const pendingOrders = useMemo(() => {
        const po = purchaseOrdersHook.purchaseOrders
            .filter(o => o.status === 'pendente')
            .map(o => ({ value: o.id, label: `Compra ${o.id}` }));
        
        const mo = manufacturingOrdersHook.manufacturingOrders
            .filter(o => o.status === 'pendente')
            .map(o => ({ value: o.id, label: `Fabricação ${o.id}` }));
            
        return [...po, ...mo];
    }, [purchaseOrdersHook.purchaseOrders, manufacturingOrdersHook.manufacturingOrders]);
    
    const handleConfirm = async () => {
        if (!selectedOrderId) {
            addToast("Selecione uma ordem para associar o documento.", 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            const newInstallments: Installment[] = data.installments.map((inst, index) => ({
                id: `inst-${nanoid()}`,
                number: String(index + 1),
                value: inst.value,
                dueDate: inst.dueDate,
                status: 'pendente'
            }));

            if (selectedOrderId.startsWith('PO-')) {
                await purchaseOrdersHook.updatePurchaseOrderInstallments(selectedOrderId, newInstallments);
            } else if (selectedOrderId.startsWith('MO-')) {
                await manufacturingOrdersHook.updateManufacturingOrderInstallments(selectedOrderId, newInstallments);
            }
            addToast(`Dados financeiros lançados na ordem ${selectedOrderId}!`, 'success');
            onClose();
        } catch (error) {
            console.error("Failed to save installments:", error);
            addToast("Falha ao salvar os dados financeiros.", 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Revisar e Lançar Documento" size="2xl">
            <div className="space-y-8">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                        Dados Extraídos pela IA
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p>
                            <p className="text-lg font-bold text-slate-900">{data.supplier || 'Não identificado'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(data.totalValue)}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-autro-blue rounded-full"></div>
                        Parcelas Identificadas
                    </h3>
                     <div className="overflow-hidden border border-slate-200 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Vencimento</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {data.installments.map((inst, index) => (
                                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{formatCurrency(inst.value)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(inst.dueDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-white rounded-full"></div>
                        Associar à Ordem
                    </h3>
                     <p className="text-sm text-slate-300 mb-4 leading-relaxed">Selecione uma ordem pendente para vincular estes pagamentos e atualizar o financeiro.</p>
                     <Select 
                        value={selectedOrderId} 
                        onChange={e => setSelectedOrderId(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white focus:ring-white/10 focus:border-white"
                    >
                        <option value="" className="text-slate-900">Selecione uma Ordem...</option>
                        {pendingOrders.map(opt => (
                            <option key={opt.value} value={opt.value} className="text-slate-900">{opt.label}</option>
                        ))}
                     </Select>
                </div>
            </div>
             <div className="flex justify-end pt-8 mt-8 border-t border-slate-100 gap-3">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={isSaving || !selectedOrderId} className="min-w-[160px]">
                    {isSaving ? 'Salvando...' : 'Confirmar e Lançar'}
                </Button>
            </div>
        </Modal>
    );
};
