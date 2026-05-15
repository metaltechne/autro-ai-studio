
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
import { evaluateProcess, getComponentCost, calculateKitCosts } from '../hooks/manufacturing-evaluator';
import { BRAZIL_UFS } from '../contexts/FinancialsContext';
import { Select } from './ui/Select';
import { usePermissions } from '../hooks/usePermissions';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    const { findKitById, updateKit, deleteKit, components, saveChanges } = inventory;
    const { calculateSaleDetails, settings: financialSettings } = useFinancials();
    const { addToast } = useToast();
    const { canViewCosts } = usePermissions();

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    
    const kit = useMemo(() => findKitById(kitId), [kitId, findKitById]);
    const [draftKit, setDraftKit] = useState<Kit | null>(kit || null);

    const [simulationParams, setSimulationParams] = useState({
        clientType: 'final' as 'final' | 'resale' | 'use_contributor',
        destUF: financialSettings?.originUF || 'SP',
        salesChannel: 'direct' as 'direct' | 'marketplace',
        selectedMarketplaceId: '',
    });

    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (index: string) => {
        setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
    };

    useEffect(() => {
        setDraftKit(kit || null);
    }, [kit]);

    const hasDraftChanges = useMemo(() => {
        return kit && draftKit && JSON.stringify(draftKit) !== JSON.stringify(kit);
    }, [kit, draftKit]);

    const handleApplyChanges = async () => {
        if (!draftKit) return;
        setIsSavingDraft(true);
        try {
            await updateKit(draftKit);
            await saveChanges();
            addToast("Configurações de logística e custos aplicadas com sucesso.", "success");
        } catch (error) {
            console.error("Erro ao aplicar mudanças:", error);
            addToast("Erro ao salvar alterações.", "error");
        } finally {
            setIsSavingDraft(false);
        }
    };

    const generatorFamilias = useMemo(() => {
        const all = (manufacturing.familias || []).filter(f => 
            f.nodes?.some(n => n.data.type === 'productGenerator')
        );

        if (all.some(f => !!f.masterProcessTag)) {
            return all.filter(f => !!f.masterProcessTag);
        }

        return all.filter(f => {
            const nome = f.nome?.toUpperCase() || '';
            const isSubProcess = nome.includes('CABO') || nome.includes('HASTE') || nome.includes('SEGREDO') || nome.includes('CORPO CHAVE');
            return !isSubProcess;
        });
    }, [manufacturing.familias]);

    const availableFamiliasGrouped = useMemo(() => {
        if (!kit) return {};
        const groups: Record<string, FamiliaComponente[]> = {
            'FIX-P': [],
            'FIX-S': [],
            'Generico': []
        };
        
        generatorFamilias.forEach(f => {
            const tag = f.masterProcessTag;
            if (tag && groups[tag]) {
                groups[tag].push(f);
            } else {
                const nome = f.nome?.toUpperCase() || '';
                if (nome.includes('FIX-S') || nome.includes('FIX S')) {
                    groups['FIX-S'].push(f);
                } else if (nome.includes('FIX-P') || nome.includes('FIX P') || nome.includes('POR-P') || nome.includes('POR P')) {
                    groups['FIX-P'].push(f);
                } else {
                    groups['Generico'].push(f);
                }
            }
        });
        
        return groups;
    }, [kit, generatorFamilias]);

    const costDetails = useMemo(() => {
        if (!kit) return null;

        const details = calculateKitCosts(
            kit,
            { components },
            manufacturing,
            financialSettings,
            { 
                selectedFamiliaId: inventory.globalFastenerFamiliaId, 
                selectedNutFamiliaId: inventory.globalNutFamiliaId,
                sellingPriceOverride: draftKit?.sellingPriceOverride,
                pricingStrategy: draftKit?.pricingStrategy 
            }
        );

        const marketplace = financialSettings?.marketplaceFees?.find(m => m.id === simulationParams.selectedMarketplaceId);
        const saleDetails = calculateSaleDetails(details.totalCost, {
            priceOverride: draftKit?.sellingPriceOverride,
            strategy: draftKit?.pricingStrategy,
            simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee },
        });

        return { 
            ...details,
            saleDetails
        };
    }, [kit, draftKit?.sellingPriceOverride, draftKit?.pricingStrategy, components, manufacturing, calculateSaleDetails, simulationParams, financialSettings, inventory.globalFastenerFamiliaId, inventory.globalNutFamiliaId]);

    const handleDelete = async () => {
        if (kit) {
            await deleteKit(kit.id);
            addToast(`Kit "${kit.name}" excluído.`, 'success');
            setCurrentView(View.KITS);
        }
        setIsDeleting(false);
    };
    
    if (!kit || !draftKit || !costDetails) return <p>Carregando detalhes do kit...</p>;

    const activeBreakdown = costDetails.breakdown;
    const activeTotalCost = costDetails.totalCost;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                 <Button onClick={() => setCurrentView(View.KITS)} variant="secondary">&larr; Voltar para Kits</Button>
                <div className="flex gap-2">
                    <Button onClick={() => setCurrentView(View.KIT_ENGINEERING)} variant="secondary">Ver Fluxo de Engenharia</Button>
                    <Button onClick={() => setIsEditModalOpen(true)}>Editar Estrutura</Button>
                    <Button onClick={() => setIsDeleting(true)} variant="danger">Excluir Kit</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card className="sticky top-24 p-0 overflow-hidden border-none shadow-soft">
                        <div className="h-48 bg-autro-blue relative flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                            </div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-3 border border-white/20">
                                    <span className="text-4xl font-black text-white tracking-tighter">{(kit.marca || '??').substring(0, 2).toUpperCase()}</span>
                                </div>
                                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">{kit.marca || 'Sem Marca'}</span>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-sm">
                                    <InlineQRCode data={{ type: 'kit', id: kit.id }} size={80} />
                                </div>
                                <div className="min-w-0 flex-grow">
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight break-words">{kit.name}</h2>
                                    <p className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider mt-1">SKU: {kit.sku}</p>
                                </div>
                            </div>
                            <div className="space-y-1 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                                <DataRow label="Marca" value={kit.marca} />
                                <DataRow label="Modelo" value={kit.modelo} />
                                <DataRow label="Ano" value={kit.ano} />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-soft">
                        <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                            Logística e Baixa de Estoque
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Família para Parafusos/Hastes (Global)</label>
                                        <p className="font-bold text-slate-900">
                                            {manufacturing.familias.find(f => f.id === inventory.globalFastenerFamiliaId)?.nome || "Padrão Automático"}
                                        </p>
                                    </div>
                                    
                                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Família para Porcas (Global)</label>
                                        <p className="font-bold text-slate-900">
                                            {manufacturing.familias.find(f => f.id === inventory.globalNutFamiliaId)?.nome || "Detecção Automática"}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-4 text-[11px] text-slate-500 font-medium leading-tight italic">
                                    * As famílias de custos e etapas de fabricação são controladas globalmente na visualização de listagem de kits para evitar conflitos.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {kit.compatibilityRules && kit.compatibilityRules.length > 0 && (
                        <Card className="border-none shadow-soft">
                            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                Regras de Compatibilidade
                            </h3>
                            <div className="space-y-3">
                                {kit.compatibilityRules.map((rule) => (
                                    <div key={rule.condition + rule.result} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center gap-2">
                                        <div className="flex-shrink-0">
                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded uppercase tracking-widest">Condição</span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 flex-grow">{rule.condition}</p>
                                        <div className="hidden md:block w-px h-4 bg-slate-200"></div>
                                        <div className="flex-shrink-0">
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-widest">Resultado</span>
                                        </div>
                                        <p className="text-sm font-black text-slate-900">{rule.result}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {canViewCosts && (
                        <Card className="border-none shadow-soft">
                             <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                                 <div className="w-1.5 h-6 bg-autro-primary rounded-full"></div>
                                 Finanças e Precificação de Produção
                             </h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                 <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Custo Total de Produção</p>
                                     <p className="text-3xl font-black text-slate-900">{formatCurrency(costDetails.totalCost)}</p>
                                     <div className="mt-2 flex gap-2">
                                         <span className="text-[9px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded uppercase">Materiais: {formatCurrency(costDetails.materialCost || 0)}</span>
                                         <span className="text-[9px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded uppercase">Fabricação: {formatCurrency(costDetails.fabricationCost || 0)}</span>
                                     </div>
                                 </div>
                                  <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-sm">
                                     <p className="text-[10px] text-autro-primary font-black uppercase tracking-widest mb-1">Preço Sugerido de Venda</p>
                                     <p className="text-3xl font-black text-autro-primary">{formatCurrency(costDetails.saleDetails.sellingPrice)}</p>
                                     <div className="mt-2">
                                         <span className="text-[9px] font-bold text-indigo-500 bg-indigo-100/50 px-2 py-0.5 rounded uppercase">Estratégia: {kit.pricingStrategy === 'margin' ? 'Margem Alvo' : 'Markup Fixo'}</span>
                                     </div>
                                 </div>
                             </div>

                             <div className="mt-4 p-5 border border-slate-100 rounded-2xl bg-slate-50/50">
                                 <h4 className="font-black text-slate-900 text-xs mb-4 flex items-center gap-2 uppercase tracking-widest">
                                     <svg className="h-4 w-4 text-autro-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                     Simulador de Venda Regional
                                 </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select label="Tipo de Cliente" value={simulationParams.clientType} onChange={e => setSimulationParams(p => ({ ...p, clientType: e.target.value as any }))}><option value="final">Consumidor Final</option><option value="resale">Revenda</option><option value="use_contributor">Empresa (Uso/Consumo)</option></Select>
                                    <Select label="Estado (UF) Destino" value={simulationParams.destUF} onChange={e => setSimulationParams(p => ({ ...p, destUF: e.target.value }))}>{BRAZIL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</Select>
                                </div>
                             </div>
                             <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                                 <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                     <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Margem de Contribuição</span>
                                     <div className="text-right">
                                         <span className="text-lg font-black text-emerald-700 block">{formatCurrency(costDetails.saleDetails.contributionMargin)}</span>
                                         <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">{(costDetails.saleDetails.contributionMarginPercentage || 0).toFixed(2)}%</span>
                                     </div>
                                 </div>
                                 <DataRow label="Deduções Totais (Impostos/Comissões)" value={formatCurrency(costDetails.saleDetails.totalDeductions)} />
                                 <DataRow label="Lucro Líquido Estimado" value={formatCurrency(costDetails.saleDetails.profit)} className="!border-none font-black text-slate-900 text-lg" />
                             </div>
                        </Card>
                    )}

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-black uppercase tracking-tight">Composição de Materiais e Fixadores</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Impacto no estoque por unidade vendida</p>
                            </div>
                        </div>
                        <div className="overflow-hidden border rounded-xl">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50 font-black text-[10px] uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Item / Parafuso / Porca</th>
                                        <th className="px-4 py-3 text-center">Qtd</th>
                                        {canViewCosts && <th className="px-4 py-3 text-right">Preço Unit.</th>}
                                        {canViewCosts && <th className="px-4 py-3 text-right">Valor Parcial</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {activeBreakdown.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhum componente ou fixador definido para este kit.
                                            </td>
                                        </tr>
                                    ) : activeBreakdown.map((item, index) => {
                                        const isNut = item.sku.includes('x0');
                                        const hasBreakdown = item.costBreakdown && item.costBreakdown.length > 0;
                                        const isExpanded = expandedRows[item.id || item.sku];

                                        return (
                                            <React.Fragment key={`${item.id || item.sku}-${index}`}>
                                                <tr className={item.type === 'Fixador' ? (isNut ? 'bg-amber-50/20' : 'bg-indigo-50/20') : (item.sku.startsWith('EMB-') ? 'bg-emerald-50/10' : '')}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {hasBreakdown && (
                                                                <button 
                                                                    onClick={() => toggleRow(item.id || item.sku)}
                                                                    className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            )}
                                                            <div>
                                                                <div className={`font-bold text-sm ${isNut ? 'text-amber-900' : 'text-slate-800'}`}>{item.name}</div>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{item.sku}</div>
                                                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                                                    <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-widest">Baixa Inventário</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-black text-slate-900">{item.quantity}x</td>
                                                    {canViewCosts && <td className="px-4 py-3 text-right font-bold text-slate-500">{formatCurrency(item.unitCost)}</td>}
                                                    {canViewCosts && <td className="px-4 py-3 text-right font-bold text-slate-600">{formatCurrency(item.totalCost)}</td>}
                                                </tr>
                                                {isExpanded && hasBreakdown && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={4} className="px-4 py-3">
                                                            <div className="pl-8">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Composição de Custo</h4>
                                                                <div className="space-y-1">
          {item.costBreakdown!.map((step, stepIndex) => (
                                                                        <div key={`${step.nodeId || step.name}-${stepIndex}`} className="flex justify-between items-center text-sm border-b border-slate-200 last:border-0 pb-1 last:pb-0">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-medium text-slate-700">{step.name}</span>
                                                                                {step.details && <span className="text-[10px] text-slate-500">{step.details}</span>}
                                                                            </div>
                                                                            <span className="font-mono text-slate-600">{formatCurrency(step.cost)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-900 text-white font-black">
                                    {canViewCosts && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-4 text-sm uppercase tracking-widest text-right">Custo Total Estrutura</td>
                                            <td className="px-4 py-4 text-right text-lg text-emerald-400">{formatCurrency(activeTotalCost)}</td>
                                        </tr>
                                    )}
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
