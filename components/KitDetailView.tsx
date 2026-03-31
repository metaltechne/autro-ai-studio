
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryHook, ManufacturingHook, Kit, View, ScannedQRCodeData, KitCostBreakdownItem, SaleDetails, Component, FamiliaComponente, KitCostDetails } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { InlineQRCode } from './ui/InlineQRCode';
import { useFinancials } from '../contexts/FinancialsContext';
import { KitEditModal } from './KitEditModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { useToast } from '../hooks/useToast';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';
import { BRAZIL_UFS } from '../contexts/FinancialsContext';
import { Select } from './ui/Select';
import { usePermissions } from '../hooks/usePermissions';

interface KitDetailViewProps {
  kitId: string;
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  setCurrentView: (view: View) => void;
  onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const DataRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`flex justify-between items-center py-2 border-b ${className}`}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-black text-right font-semibold">{value}</dd>
    </div>
);

export const KitDetailView: React.FC<KitDetailViewProps> = ({ kitId, inventory, manufacturing, setCurrentView, onShowQRCode }) => {
    const { findKitById, updateKit, deleteKit, components } = inventory;
    const { calculateSaleDetails, settings: financialSettings } = useFinancials();
    const { addToast } = useToast();
    const { canViewCosts } = usePermissions();

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const kit = useMemo(() => findKitById(kitId), [kitId, findKitById]);
    const [draftKit, setDraftKit] = useState<Kit | null>(kit || null);

    const [simulationParams, setSimulationParams] = useState({
        clientType: 'final' as 'final' | 'resale' | 'use_contributor',
        destUF: financialSettings?.originUF || 'SP',
        salesChannel: 'direct' as 'direct' | 'marketplace',
        selectedMarketplaceId: '',
    });

    useEffect(() => {
        setDraftKit(kit || null);
    }, [kit]);

    // Debounced save
    useEffect(() => {
        if (!draftKit) return;
        const handler = setTimeout(() => {
            if (kit && JSON.stringify(draftKit) !== JSON.stringify(kit)) {
                updateKit(draftKit);
            }
        }, 1500);
        return () => clearTimeout(handler);
    }, [draftKit, kit, updateKit]);


    const costDetails = useMemo(() => {
        if (!kit) return null;

        const familiaMap = new Map<string, FamiliaComponente>(manufacturing.familias.map(f => [f.id, f]));
        const preferredId = financialSettings?.preferredFastenerFamiliaId || 'fam-fixadores';
        const fastenerFamilia = familiaMap.get(preferredId);
        
        const fixSFamilia = manufacturing.familias.find(f => f.nome?.toLowerCase().includes('fix-s') || f.nome?.toLowerCase().includes('fix s'));
        const fixPFamilia = manufacturing.familias.find(f => f.nome?.toLowerCase().includes('fix-p') || f.nome?.toLowerCase().includes('fix p'));
        
        const keyComponents = components.filter(c => c.familiaId?.startsWith('fam-chave'));
        const keyFixS = keyComponents.find(c => c.name?.toLowerCase().includes('fix-s') || c.name?.toLowerCase().includes('fix s'));
        const keyFixP = keyComponents.find(c => c.name?.toLowerCase().includes('fix-p') || c.name?.toLowerCase().includes('fix p'));

        const getFastenerCostForFamily = (dimension: string, familia: any): number => {
            if (!familia) return 0;
            const dimParts = dimension.replace('mm','').split('x');
            const bitola = Number(dimParts[0]);
            const comprimento = dimParts.length > 1 ? Number(dimParts[1]) : 0;
            if (!isNaN(bitola)) {
                const result = evaluateProcess(familia, { bitola, comprimento }, components);
                return result.custoFabricacao + result.custoMateriaPrima;
            }
            return 0;
        };

        const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));
        let baseTotalCost = 0;
        const breakdown: KitCostBreakdownItem[] = [];

        // 1. Processar Componentes (SKUs Fixos)
        kit.components.forEach(kc => {
            const component = componentSkuMap.get(kc.componentSku);
            if (component) {
                const unitCost = getComponentCost(component);
                const itemTotalCost = unitCost * kc.quantity;
                baseTotalCost += itemTotalCost;
                const familia = familiaMap.get(component.familiaId || '');
                breakdown.push({
                    name: component.name, sku: component.sku, quantity: kc.quantity,
                    unitCost: unitCost, totalCost: itemTotalCost, type: 'Componente',
                    familiaId: familia?.id, familiaName: familia?.nome,
                });
            }
        });

        let defaultTotalCost = baseTotalCost;
        const defaultBreakdown = [...breakdown];

        // 2. Processar Fixadores (Dimensões Dinâmicas)
        if (kit.requiredFasteners) {
            kit.requiredFasteners.forEach(rf => {
                const unitCost = getFastenerCostForFamily(rf.dimension, fastenerFamilia);
                const itemTotalCost = unitCost * rf.quantity;
                defaultTotalCost += itemTotalCost;
                
                const isNut = rf.dimension.includes('x0');
                const name = isNut
                    ? `Porca M${rf.dimension.split('x')[0]} (Inox)`
                    : `Parafuso ${rf.dimension}`;
                    
                defaultBreakdown.push({
                    name, 
                    sku: `DIM-${rf.dimension}`, 
                    quantity: rf.quantity,
                    unitCost: unitCost, 
                    totalCost: itemTotalCost, 
                    type: isNut ? 'Fixador' : 'Fixador', // Keep generic for style but differentiated in name
                    familiaId: fastenerFamilia?.id, 
                    familiaName: fastenerFamilia?.nome,
                });
            });
        }
        
        const marketplace = financialSettings?.marketplaceFees?.find(m => m.id === simulationParams.selectedMarketplaceId);
        const saleDetails = calculateSaleDetails(defaultTotalCost, {
            priceOverride: draftKit?.sellingPriceOverride,
            strategy: draftKit?.pricingStrategy,
            simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee },
        });

        let fixSTotalCost = baseTotalCost;
        const fixSBreakdown = [...breakdown];
        if (fixSFamilia && kit.requiredFasteners) {
            kit.requiredFasteners.forEach(rf => {
                const unitCost = getFastenerCostForFamily(rf.dimension, fixSFamilia);
                const itemTotalCost = unitCost * rf.quantity;
                fixSTotalCost += itemTotalCost;
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const name = isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`;
                fixSBreakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
            if (keyFixS) {
                const unitCost = getComponentCost(keyFixS);
                fixSTotalCost += unitCost;
                fixSBreakdown.push({
                    name: keyFixS.name, sku: keyFixS.sku, quantity: 1,
                    unitCost, totalCost: unitCost, type: 'Componente',
                });
            }
        }

        let fixPTotalCost = baseTotalCost;
        const fixPBreakdown = [...breakdown];
        if (fixPFamilia && kit.requiredFasteners) {
            kit.requiredFasteners.forEach(rf => {
                const unitCost = getFastenerCostForFamily(rf.dimension, fixPFamilia);
                const itemTotalCost = unitCost * rf.quantity;
                fixPTotalCost += itemTotalCost;
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const name = isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`;
                fixPBreakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
            if (keyFixP) {
                const unitCost = getComponentCost(keyFixP);
                fixPTotalCost += unitCost;
                fixPBreakdown.push({
                    name: keyFixP.name, sku: keyFixP.sku, quantity: 1,
                    unitCost, totalCost: unitCost, type: 'Componente',
                });
            }
        }

        const options: KitCostDetails['options'] = {};
        if (fixSFamilia) {
            options.fixS = {
                totalCost: fixSTotalCost,
                saleDetails: calculateSaleDetails(fixSTotalCost, {
                    priceOverride: draftKit?.sellingPriceOverride,
                    strategy: draftKit?.pricingStrategy,
                    simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee },
                }),
                keyName: keyFixS?.name,
                breakdown: fixSBreakdown.sort((a, b) => b.totalCost - a.totalCost)
            };
        }
        if (fixPFamilia) {
            options.fixP = {
                totalCost: fixPTotalCost,
                saleDetails: calculateSaleDetails(fixPTotalCost, {
                    priceOverride: draftKit?.sellingPriceOverride,
                    strategy: draftKit?.pricingStrategy,
                    simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee },
                }),
                keyName: keyFixP?.name,
                breakdown: fixPBreakdown.sort((a, b) => b.totalCost - a.totalCost)
            };
        }

        return { 
            totalCost: defaultTotalCost, 
            materialCost: 0,
            fabricationCost: 0,
            breakdown: defaultBreakdown.sort((a,b) => b.totalCost - a.totalCost), 
            saleDetails,
            options
        };
    }, [kit, draftKit, components, manufacturing.familias, calculateSaleDetails, simulationParams, financialSettings]);

    const [selectedBreakdown, setSelectedBreakdown] = useState<'default' | 'fixS' | 'fixP'>('default');

    const handleDelete = async () => {
        if (kit) {
            await deleteKit(kit.id);
            addToast(`Kit "${kit.name}" excluído.`, 'success');
            setCurrentView(View.KITS);
        }
        setIsDeleting(false);
    };
    
    if (!kit || !draftKit || !costDetails) return <p>Carregando detalhes do kit...</p>;

    const activeBreakdown = selectedBreakdown === 'fixS' && costDetails.options?.fixS?.breakdown 
        ? costDetails.options.fixS.breakdown 
        : selectedBreakdown === 'fixP' && costDetails.options?.fixP?.breakdown 
            ? costDetails.options.fixP.breakdown 
            : costDetails.breakdown;

    const activeTotalCost = selectedBreakdown === 'fixS' && costDetails.options?.fixS 
        ? costDetails.options.fixS.totalCost 
        : selectedBreakdown === 'fixP' && costDetails.options?.fixP 
            ? costDetails.options.fixP.totalCost 
            : costDetails.totalCost;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                 <Button onClick={() => setCurrentView(View.KITS)} variant="secondary">&larr; Voltar para Kits</Button>
                <div className="flex gap-2">
                    <Button onClick={() => setIsEditModalOpen(true)}>Editar Estrutura</Button>
                    <Button onClick={() => setIsDeleting(true)} variant="danger">Excluir Kit</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card className="sticky top-24">
                        <div className="flex items-start gap-4 mb-6">
                            <InlineQRCode data={{ type: 'kit', id: kit.id }} size={80} />
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 leading-tight">{kit.name}</h2>
                                <p className="text-xs font-mono text-gray-500 uppercase">SKU: {kit.sku}</p>
                            </div>
                        </div>
                        <dl className="space-y-1">
                            <DataRow label="Marca" value={kit.marca} />
                            <DataRow label="Modelo" value={kit.modelo} />
                            <DataRow label="Ano" value={kit.ano} />
                        </dl>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {canViewCosts && (
                        <Card>
                             <h3 className="text-xl font-bold text-black mb-4">Finanças e Precificação</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                 <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                     <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Custo de Produção</p>
                                     <p className="text-3xl font-black text-slate-900">{formatCurrency(costDetails.totalCost)}</p>
                                 </div>
                                  <div className="p-4 bg-autro-blue-light/30 rounded-xl border border-autro-blue/10">
                                     <p className="text-[10px] text-autro-blue font-black uppercase tracking-widest">Preço Final de Venda</p>
                                     <p className="text-3xl font-black text-autro-blue">{formatCurrency(costDetails.saleDetails.sellingPrice)}</p>
                                 </div>
                             </div>

                             {(costDetails.options?.fixS || costDetails.options?.fixP) && (
                                 <div className="mb-6 space-y-3">
                                     {costDetails.options?.fixS && (
                                         <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                             <div className="flex justify-between items-center mb-2">
                                                 <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Opção Fix-S {costDetails.options.fixS.keyName ? `(+ ${costDetails.options.fixS.keyName})` : ''}</p>
                                                 <p className="text-xl font-black text-autro-blue">{formatCurrency(costDetails.options.fixS.saleDetails.sellingPrice)}</p>
                                             </div>
                                             <div className="flex justify-between text-xs text-slate-500">
                                                 <span>Custo: {formatCurrency(costDetails.options.fixS.totalCost)}</span>
                                                 <span className="text-green-600 font-bold">Margem: {formatCurrency(costDetails.options.fixS.saleDetails.contributionMargin)} ({(costDetails.options.fixS.saleDetails.contributionMarginPercentage).toFixed(1)}%)</span>
                                             </div>
                                         </div>
                                     )}
                                     {costDetails.options?.fixP && (
                                         <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                             <div className="flex justify-between items-center mb-2">
                                                 <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Opção Fix-P {costDetails.options.fixP.keyName ? `(+ ${costDetails.options.fixP.keyName})` : ''}</p>
                                                 <p className="text-xl font-black text-autro-blue">{formatCurrency(costDetails.options.fixP.saleDetails.sellingPrice)}</p>
                                             </div>
                                             <div className="flex justify-between text-xs text-slate-500">
                                                 <span>Custo: {formatCurrency(costDetails.options.fixP.totalCost)}</span>
                                                 <span className="text-green-600 font-bold">Margem: {formatCurrency(costDetails.options.fixP.saleDetails.contributionMargin)} ({(costDetails.options.fixP.saleDetails.contributionMarginPercentage).toFixed(1)}%)</span>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

                             <div className="mt-4 p-4 border rounded-xl bg-slate-50">
                                 <h4 className="font-bold text-black mb-3 flex items-center gap-2">
                                     <svg className="h-4 w-4 text-autro-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                     Simulador Regional e Canal
                                 </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Select label="Destinatário" value={simulationParams.clientType} onChange={e => setSimulationParams(p => ({ ...p, clientType: e.target.value as any }))}><option value="final">Consumidor Final</option><option value="resale">Revenda</option><option value="use_contributor">Empresa (Uso/Consumo)</option></Select>
                                    <Select label="UF Destino" value={simulationParams.destUF} onChange={e => setSimulationParams(p => ({ ...p, destUF: e.target.value }))}>{BRAZIL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</Select>
                                </div>
                             </div>
                             <dl className="mt-4 border-t pt-4">
                                 <DataRow label="Margem Contribuição" value={`${formatCurrency(costDetails.saleDetails.contributionMargin)} (${costDetails.saleDetails.contributionMarginPercentage.toFixed(2)}%)`} className="!text-green-700 font-bold" />
                                 <DataRow label="Impostos Totais" value={formatCurrency(costDetails.saleDetails.totalTaxes)} />
                                 <DataRow label="Lucro Líquido Real" value={formatCurrency(costDetails.saleDetails.profit)} className="!border-none font-black text-slate-900" />
                             </dl>
                        </Card>
                    )}

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-black">Composição de Materiais e Fixadores</h3>
                            {(costDetails.options?.fixS || costDetails.options?.fixP) && (
                                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setSelectedBreakdown('default')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${selectedBreakdown === 'default' ? 'bg-white text-autro-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Padrão
                                    </button>
                                    {costDetails.options?.fixS && (
                                        <button
                                            onClick={() => setSelectedBreakdown('fixS')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${selectedBreakdown === 'fixS' ? 'bg-white text-autro-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Fix-S
                                        </button>
                                    )}
                                    {costDetails.options?.fixP && (
                                        <button
                                            onClick={() => setSelectedBreakdown('fixP')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${selectedBreakdown === 'fixP' ? 'bg-white text-autro-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Fix-P
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="overflow-hidden border rounded-xl">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50 font-black text-[10px] uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Item / Parafuso / Porca</th>
                                        <th className="px-4 py-3 text-center">Qtd</th>
                                        <th className="px-4 py-3 text-right">Preço Unit.</th>
                                        <th className="px-4 py-3 text-right">Valor Parcial</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {activeBreakdown.map((item, index) => {
                                        const isNut = item.sku.includes('x0');
                                        return (
                                            <tr key={index} className={item.type === 'Fixador' ? (isNut ? 'bg-amber-50/20' : 'bg-indigo-50/20') : ''}>
                                                <td className="px-4 py-3">
                                                    <div className={`font-bold text-sm ${isNut ? 'text-amber-900' : 'text-slate-800'}`}>{item.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{item.sku} • {isNut ? 'Porca' : item.type}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-black text-slate-900">{item.quantity}x</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-500">{formatCurrency(item.unitCost)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-600">{formatCurrency(item.totalCost)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-900 text-white font-black">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-4 text-sm uppercase tracking-widest text-right">Custo Total Estrutura</td>
                                        <td className="px-4 py-4 text-right text-lg text-emerald-400">{formatCurrency(activeTotalCost)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
            
            {isEditModalOpen && <KitEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={async (u) => { if ('id' in u) await updateKit(u); }} kitToEdit={kit} inventory={inventory} />}
            <ConfirmationModal isOpen={isDeleting} onClose={() => setIsDeleting(false)} onConfirm={handleDelete} title={`Excluir Kit "${kit.name}"`} confirmText="Confirmar Exclusão">
                <p className="text-gray-600">Tem certeza que deseja excluir permanentemente este kit? Esta ação é irreversível.</p>
            </ConfirmationModal>
        </div>
    );
};
