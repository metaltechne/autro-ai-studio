
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

    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

    const toggleRow = (index: number) => {
        setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
    };

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


    const keyComponents = useMemo(() => {
        return components
            .filter(c => c.familiaId?.startsWith('fam-chave'))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [components]);

    const availableFamilias = useMemo(() => {
        if (!kit) return [];
        const hasNuts = kit.requiredFasteners?.some(rf => rf.dimension.includes('x0') || rf.dimension.endsWith('x0mm'));
        const hasScrews = kit.requiredFasteners?.some(rf => !(rf.dimension.includes('x0') || rf.dimension.endsWith('x0mm')));

        return manufacturing.familias.filter(f => {
            const nome = f.nome?.toLowerCase() || '';
            if (hasNuts && !hasScrews) {
                return nome.includes('por-p') || nome.includes('por p');
            }
            if (hasScrews && !hasNuts) {
                return nome.includes('fix-s') || nome.includes('fix s') || nome.includes('fix-p') || nome.includes('fix p');
            }
            if (hasScrews && hasNuts) {
                return nome.includes('fix-s') || nome.includes('fix s') || nome.includes('fix-p') || nome.includes('fix p') || nome.includes('por-p') || nome.includes('por p');
            }
            return true;
        });
    }, [kit, manufacturing.familias]);

    const costDetails = useMemo(() => {
        if (!kit) return null;

        const familiaMap = new Map<string, FamiliaComponente>(manufacturing.familias.map(f => [f.id, f]));
        const preferredId = financialSettings?.preferredFastenerFamiliaId || 'fam-fixadores';
        const fastenerFamilia = familiaMap.get(preferredId);

        const getFastenerCostForFamily = (dimension: string, familia: any): { unitCost: number, costBreakdown: any[] } => {
            if (!familia) return { unitCost: 0, costBreakdown: [] };
            const simpleDim = dimension.replace(/mm/i, '').replace(/M/i, '');
            const dimParts = simpleDim.split('x');
            const bitola = Number(dimParts[0]);
            const comprimento = dimParts.length > 1 ? Number(dimParts[1]) : 0;
            if (!isNaN(bitola)) {
                const result = evaluateProcess(familia, { bitola, comprimento }, components, {}, { allFamilias: manufacturing.familias });
                return {
                    unitCost: result.custoFabricacao + result.custoMateriaPrima,
                    costBreakdown: result.costBreakdown
                };
            }
            return { unitCost: 0, costBreakdown: [] };
        };

        const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku.toUpperCase(), c]));
        let baseTotalCost = 0;
        const breakdown: KitCostBreakdownItem[] = [];

        // 1. Processar Componentes (SKUs Fixos)
        (kit.components || []).forEach(kc => {
            if (!kc.componentSku) return;
            const component = componentSkuMap.get(kc.componentSku.toUpperCase());
            if (component) {
                const unitCost = getComponentCost(component);
                const itemTotalCost = unitCost * kc.quantity;
                baseTotalCost += itemTotalCost;
                const familia = familiaMap.get(component.familiaId || '');
                
                let costBreakdown = [];
                if (component.type === 'raw_material' || component.sourcing === 'purchased') {
                    costBreakdown.push({ name: 'Matéria Prima', type: 'material', cost: unitCost });
                } else {
                    // Tentar obter breakdown detalhado se houver família
                    if (familia && (component.sku.includes('FIX-') || component.sku.includes('POR-') || component.sku.includes('CHAVE-'))) {
                        const simpleSku = component.sku.replace(/mm/i, '').replace(/M/i, '');
                        const parts = simpleSku.split('-');
                        const dimPart = parts[parts.length - 1];
                        const [bitolaStr, comprimentoStr] = dimPart.split('X');
                        const bitola = parseInt(bitolaStr, 10);
                        const comprimento = parseInt(comprimentoStr, 10);
                        
                        if (!isNaN(bitola)) {
                            const result = evaluateProcess(familia, { bitola, comprimento }, components, {}, { allFamilias: manufacturing.familias });
                            costBreakdown = result.costBreakdown;
                        }
                    }

                    if (costBreakdown.length === 0) {
                        if ((component.custoMateriaPrima || 0) > 0) {
                            costBreakdown.push({ name: 'Matéria Prima', type: 'material', cost: component.custoMateriaPrima });
                        }
                        if ((component.custoFabricacao || 0) > 0) {
                            costBreakdown.push({ name: 'Fabricação', type: 'labor', cost: component.custoFabricacao });
                        }
                    }
                }

                breakdown.push({
                    name: component.name, sku: component.sku, quantity: kc.quantity,
                    unitCost: unitCost, totalCost: itemTotalCost, type: 'Componente',
                    familiaId: familia?.id, familiaName: familia?.nome,
                    costBreakdown
                });
            } else {
                // Componente não encontrado no inventário, mas está no kit
                breakdown.push({
                    name: `Item Desconhecido (${kc.componentSku})`,
                    sku: kc.componentSku,
                    quantity: kc.quantity,
                    unitCost: 0,
                    totalCost: 0,
                    type: 'Componente',
                    costBreakdown: []
                });
            }
        });

        let defaultTotalCost = baseTotalCost;
        const defaultBreakdown = [...breakdown];

        // 2. Processar Fixadores (Dimensões Dinâmicas)
        if (kit.requiredFasteners && Array.isArray(kit.requiredFasteners)) {
            kit.requiredFasteners.forEach(rf => {
                if (!rf.dimension) return;
                const isNut = rf.dimension.includes('x0');
                const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
                const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
                
                let familiaToUse = isNut ? porPFamilia : fixSFamilia;
                
                if (draftKit?.selectedFamiliaId) {
                    const selectedFamilia = familiaMap.get(draftKit.selectedFamiliaId);
                    if (selectedFamilia) {
                        // If it's a nut, ensure the selected family is appropriate for nuts (e.g., POR-P)
                        // If it's a screw, ensure the selected family is appropriate for screws (e.g., FIX-S, FIX-P)
                        const isSelectedFamiliaNut = selectedFamilia.nome?.toLowerCase().includes('por-p') || selectedFamilia.nome?.toLowerCase().includes('por p');
                        if (isNut && isSelectedFamiliaNut) {
                            familiaToUse = selectedFamilia;
                        } else if (!isNut && !isSelectedFamiliaNut) {
                            familiaToUse = selectedFamilia;
                        }
                    }
                }

                const { unitCost, costBreakdown } = getFastenerCostForFamily(rf.dimension, familiaToUse || fastenerFamilia);
                const itemTotalCost = unitCost * rf.quantity;
                defaultTotalCost += itemTotalCost;
                
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
                    familiaId: familiaToUse?.id || fastenerFamilia?.id, 
                    familiaName: familiaToUse?.nome || fastenerFamilia?.nome,
                    costBreakdown
                });
            });
        }
        
        // 3. Processar Chave Selecionada
        if (draftKit?.selectedKeyId) {
            const keyComponent = componentSkuMap.get((draftKit.selectedKeyId || '').toUpperCase()) || components.find(c => c.id === draftKit.selectedKeyId);
            if (keyComponent) {
                const unitCost = getComponentCost(keyComponent);
                defaultTotalCost += unitCost; // Quantity is 1 per kit
                const familia = familiaMap.get(keyComponent.familiaId || '');
                
                let costBreakdown: any[] = [];
                if (keyComponent.type === 'raw_material' || keyComponent.sourcing === 'purchased') {
                    costBreakdown.push({ name: 'Matéria Prima', type: 'material', cost: unitCost });
                } else {
                    if ((keyComponent.custoMateriaPrima || 0) > 0) {
                        costBreakdown.push({ name: 'Matéria Prima', type: 'material', cost: keyComponent.custoMateriaPrima });
                    }
                    if ((keyComponent.custoFabricacao || 0) > 0) {
                        costBreakdown.push({ name: 'Fabricação', type: 'labor', cost: keyComponent.custoFabricacao });
                    }
                }
                
                defaultBreakdown.push({
                    name: keyComponent.name, 
                    sku: keyComponent.sku, 
                    quantity: 1,
                    unitCost: unitCost, 
                    totalCost: unitCost, 
                    type: 'Chave',
                    familiaId: familia?.id, 
                    familiaName: familia?.nome,
                    costBreakdown
                });
            }
        }
        
        const marketplace = financialSettings?.marketplaceFees?.find(m => m.id === simulationParams.selectedMarketplaceId);
        const saleDetails = calculateSaleDetails(defaultTotalCost, {
            priceOverride: draftKit?.sellingPriceOverride,
            strategy: draftKit?.pricingStrategy,
            simulationParams: { ...simulationParams, marketplaceFee: marketplace?.fee },
        });

        let totalMaterialCost = 0;
        let totalFabricationCost = 0;

        defaultBreakdown.forEach(item => {
            if (item.costBreakdown) {
                item.costBreakdown.forEach(cb => {
                    if (cb.type === 'material') totalMaterialCost += (cb.cost || 0) * item.quantity;
                    if (cb.type === 'labor' || cb.type === 'process') totalFabricationCost += (cb.cost || 0) * item.quantity;
                });
            }
        });

        return { 
            totalCost: defaultTotalCost, 
            materialCost: totalMaterialCost,
            fabricationCost: totalFabricationCost,
            breakdown: defaultBreakdown.sort((a,b) => b.totalCost - a.totalCost), 
            saleDetails
        };
    }, [kit, draftKit, components, manufacturing.familias, calculateSaleDetails, simulationParams, financialSettings]);

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
                            Configuração do Kit
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select 
                                label="Família de Fixadores" 
                                value={draftKit.selectedFamiliaId || ''} 
                                onChange={e => setDraftKit(prev => prev ? { ...prev, selectedFamiliaId: e.target.value } : null)}
                            >
                                <option value="">Padrão do Sistema</option>
                                {availableFamilias.map(f => (
                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                ))}
                            </Select>
                            <Select 
                                label="Chave Associada" 
                                value={draftKit.selectedKeyId || ''} 
                                onChange={e => setDraftKit(prev => prev ? { ...prev, selectedKeyId: e.target.value } : null)}
                            >
                                <option value="">Nenhuma chave associada</option>
                                {keyComponents.map(k => (
                                    <option key={k.id} value={k.id}>{k.name}</option>
                                ))}
                            </Select>
                        </div>
                    </Card>

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
                                 <DataRow label="Impostos Totais (ICMS/IPI/PIS/COFINS)" value={formatCurrency(costDetails.saleDetails.totalTaxes)} />
                                 <DataRow label="Lucro Líquido Estimado" value={formatCurrency(costDetails.saleDetails.profit)} className="!border-none font-black text-slate-900 text-lg" />
                             </div>
                        </Card>
                    )}

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-black">Composição de Materiais e Fixadores</h3>
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
                                    {activeBreakdown.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhum componente ou fixador definido para este kit.
                                            </td>
                                        </tr>
                                    ) : activeBreakdown.map((item, index) => {
                                        const isNut = item.sku.includes('x0');
                                        const hasBreakdown = item.costBreakdown && item.costBreakdown.length > 0;
                                        const isExpanded = expandedRows[index];

                                        return (
                                            <React.Fragment key={index}>
                                                <tr className={item.type === 'Fixador' ? (isNut ? 'bg-amber-50/20' : 'bg-indigo-50/20') : (item.sku.startsWith('EMB-') ? 'bg-emerald-50/10' : '')}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {hasBreakdown && (
                                                                <button 
                                                                    onClick={() => toggleRow(index)}
                                                                    className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            )}
                                                            <div>
                                                                <div className={`font-bold text-sm ${isNut ? 'text-amber-900' : 'text-slate-800'}`}>{item.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-mono">{item.sku} • {isNut ? 'Porca' : item.type}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-black text-slate-900">{item.quantity}x</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-500">{formatCurrency(item.unitCost)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-600">{formatCurrency(item.totalCost)}</td>
                                                </tr>
                                                {isExpanded && hasBreakdown && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={4} className="px-4 py-3">
                                                            <div className="pl-8">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Composição de Custo</h4>
                                                                <div className="space-y-1">
                                                                    {item.costBreakdown!.map((step, stepIdx) => (
                                                                        <div key={stepIdx} className="flex justify-between items-center text-sm border-b border-slate-200 last:border-0 pb-1 last:pb-0">
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
