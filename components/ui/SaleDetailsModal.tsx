
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
    onPrint?: () => void;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ isOpen, onClose, kitName, cost, materialCost, fabricationCost, saleDetails, breakdown, onPrint }) => {
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
                                <li key={idx} className="px-3 py-2 flex flex-col justify-start text-sm">
                                    <div className="flex justify-between items-center w-full">
                                        <div>
                                            <span className="font-medium text-slate-800">{item.name}</span>
                                            <span className="text-slate-500 ml-2 text-xs">({item.quantity}x {formatCurrency(item.unitCost)})</span>
                                        </div>
                                        <span className="font-bold text-slate-600">{formatCurrency(item.totalCost)}</span>
                                    </div>
                                    {item.costBreakdown && item.costBreakdown.length > 0 && (
                                        <div className="pl-4 mt-1 space-y-0.5 border-l-2 border-slate-100">
                                            {item.costBreakdown.map((step, sidx) => (
                                                <div key={sidx} className="flex justify-between items-center text-[10px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-[8px] text-slate-300">↳</span>
                                                        {step.name} 
                                                        {step.timeSeconds ? <span className="text-[8px] text-slate-400">({(step.timeSeconds / 60).toFixed(1)} min)</span> : null}
                                                    </span>
                                                    <span>{formatCurrency(step.cost)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                    <DataRow label="Deduções Totais (Impostos/Venda)" value={formatCurrency(saleDetails.totalDeductions)} />
                </dl>
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-black mb-2">Detalhamento das Deduções</h4>
                    <dl className="space-y-1 text-sm">
                        {saleDetails.taxBreakdown.map(tax => (
                            <DataRow key={tax.name} label={`${tax.name} (${tax.percentage}%)`} value={formatCurrency(tax.value)} />
                        ))}
                    </dl>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 mt-4 border-t">
                {onPrint && (
                    <Button 
                        onClick={onPrint} 
                        variant="secondary" 
                        className="w-full sm:w-auto text-autro-blue border-autro-blue flex items-center justify-center gap-2 font-black text-xs h-10 tracking-widest px-6"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        IMPRIMIR FICHA TÉCNICA
                    </Button>
                )}
                <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto font-black text-xs h-10 tracking-widest px-6 uppercase">Fechar</Button>
            </div>
        </Modal>
    );
};
