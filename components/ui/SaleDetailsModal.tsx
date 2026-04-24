
import React from 'react';
import { SaleDetails, KitCostBreakdownItem } from '../../types';
import { Modal } from './Modal';
import { Button } from './Button';
import { usePermissions } from '../../hooks/usePermissions';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const DataRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`flex justify-between items-start py-2 border-b ${className}`}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-black text-right font-semibold">{value}</dd>
    </div>
);

interface SaleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    kitName: string;
    cost: number;
    materialCost?: number;
    fabricationCost?: number;
    saleDetails?: SaleDetails;
    breakdown?: KitCostBreakdownItem[];
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ isOpen, onClose, kitName, cost, materialCost, fabricationCost, saleDetails, breakdown }) => {
    const { canViewCosts } = usePermissions();
    if (!saleDetails) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Composição de Preço: ${kitName}`}>
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-baseline">
                        <span className="text-lg font-medium text-black">Preço Final de Venda</span>
                        <span className="text-3xl font-bold text-autro-blue">{formatCurrency(saleDetails.sellingPrice)}</span>
                    </div>
                     {saleDetails.isOverridden && <p className="text-xs text-center text-gray-500 mt-1">(Preço definido manualmente)</p>}
                </div>
                
                {breakdown && breakdown.length > 0 && canViewCosts && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Itens do Kit
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {breakdown.map((item, idx) => (
                                <li key={idx} className="px-3 py-2 flex justify-between items-center text-sm">
                                    <div>
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        <span className="text-slate-500 ml-2 text-xs">({item.quantity}x {formatCurrency(item.unitCost)})</span>
                                    </div>
                                    <span className="font-bold text-slate-600">{formatCurrency(item.totalCost)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <dl className="space-y-2 text-sm">
                    {canViewCosts && <DataRow label="Custo Total do Kit" value={formatCurrency(cost)} className="font-bold" />}
                    {canViewCosts && materialCost !== undefined && <DataRow label="• Materiais" value={formatCurrency(materialCost)} className="pl-4 text-gray-500" />}
                    {canViewCosts && fabricationCost !== undefined && <DataRow label="• Fabricação" value={formatCurrency(fabricationCost)} className="pl-4 text-gray-500" />}
                    
                    {canViewCosts && (
                        <div className="pt-2">
                            <DataRow 
                                label="Margem de Contribuição" 
                                value={`${formatCurrency(saleDetails.contributionMargin)} (${saleDetails.contributionMarginPercentage.toFixed(2)}%)`}
                                className="text-green-700 font-bold"
                            />
                        </div>
                    )}
                    {canViewCosts && <DataRow label="Lucro Líquido" value={formatCurrency(saleDetails.profit)} />}
                    <DataRow label="Total de Impostos" value={formatCurrency(saleDetails.totalTaxes)} />
                </dl>
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-black mb-2">Detalhamento dos Impostos</h4>
                    <dl className="space-y-1 text-sm">
                        {saleDetails.taxBreakdown.map(tax => (
                            <DataRow key={tax.name} label={`${tax.name} (${tax.percentage}%)`} value={formatCurrency(tax.value)} />
                        ))}
                    </dl>
                </div>
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t">
                <Button onClick={onClose} variant="secondary">Fechar</Button>
            </div>
        </Modal>
    );
};
