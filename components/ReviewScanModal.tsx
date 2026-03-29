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
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-black">Dados Extraídos pela IA</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg space-y-2">
                        <p><strong>Fornecedor:</strong> {data.supplier || 'Não identificado'}</p>
                        <p><strong>Valor Total:</strong> <span className="font-bold text-autro-blue">{formatCurrency(data.totalValue)}</span></p>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-black">Parcelas Identificadas</h3>
                     <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-3 py-2 text-left">Valor</th>
                                    <th className="px-3 py-2 text-left">Vencimento</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.installments.map((inst, index) => (
                                    <tr key={index} className="border-t">
                                        <td className="px-3 py-2 font-semibold">{formatCurrency(inst.value)}</td>
                                        <td className="px-3 py-2">{formatDate(inst.dueDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t pt-4">
                     <h3 className="text-lg font-semibold text-black">Associar à Ordem</h3>
                     <p className="text-sm text-gray-500 mb-2">Selecione uma ordem pendente para vincular estes pagamentos.</p>
                     <Select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}>
                        <option value="">Selecione uma Ordem...</option>
                        {pendingOrders.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                     </Select>
                </div>
            </div>
             <div className="flex justify-end pt-6 mt-6 border-t gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={isSaving || !selectedOrderId}>
                    {isSaving ? 'Salvando...' : 'Confirmar e Lançar'}
                </Button>
            </div>
        </Modal>
    );
};