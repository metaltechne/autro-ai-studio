
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { InventoryHook, Kit, ManufacturingHook, KitCostDetails, KitCostBreakdownItem, ScannedQRCodeData, SaleDetails, Component, View, KitComponent, SaleItem } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { KitEditModal } from './KitEditModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Pagination } from './ui/Pagination';
import { InlineQRCode } from './ui/InlineQRCode';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { KitImportModal } from './KitImportModal';
import { Select } from './ui/Select';
import { useFinancials } from '../contexts/FinancialsContext';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from './ui/Modal';
import { SaleDetailsModal } from './ui/SaleDetailsModal';
import { getLogoBase64ForPdf } from '../data/assets';
import { savePdfResiliently } from '../src/utils/pdfDownloadHelper';
import { Database, AlertTriangle, RefreshCw, Cloud } from 'lucide-react';

interface KitsViewProps {
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
  onViewDetails: (kitId: string) => void;
}

const ITEMS_PER_PAGE = 20;

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

const defaultSaleDetails: SaleDetails = {
    sellingPrice: 0,
    profit: 0,
    totalTaxes: 0,
    taxBreakdown: [],
    isOverridden: false,
    contributionMargin: 0,
    contributionMarginPercentage: 0,
};

const KitCard: React.FC<{ 
    kit: Kit; 
    costDetails: KitCostDetails;
    onViewDetails: (kitId: string) => void;
    onShowSaleDetails: (details: { kitName: string, cost: number, materialCost?: number, fabricationCost?: number, saleDetails?: SaleDetails, breakdown?: KitCostBreakdownItem[] }) => void;
    calculateSaleDetails: (cost: number, options: { priceOverride?: number; strategy?: 'markup' | 'override' }) => SaleDetails;
}> = ({ kit, costDetails, onViewDetails, onShowSaleDetails, calculateSaleDetails }) => {
    const [selectedOption, setSelectedOption] = useState<string>('default');
    const { canViewCosts } = usePermissions();

    const activeDetails = useMemo(() => {
        if (selectedOption === 'default' || !costDetails.options?.[selectedOption]) {
            return {
                cost: costDetails.totalCost,
                materialCost: costDetails.materialCost,
                fabricationCost: costDetails.fabricationCost,
                saleDetails: costDetails.saleDetails,
                breakdown: costDetails.breakdown,
                label: 'Padrão',
                keyName: costDetails.keyName
            };
        }
        const opt = costDetails.options[selectedOption];
        return {
            cost: opt.totalCost,
            materialCost: opt.materialCost,
            fabricationCost: opt.fabricationCost,
            saleDetails: opt.saleDetails,
            breakdown: opt.breakdown,
            label: selectedOption === 'fixS' ? 'Fix-S' : 'Fix-P',
            keyName: opt.keyName
        };
    }, [selectedOption, costDetails]);
    
    const hasOptions = costDetails.options && Object.keys(costDetails.options).length > 0;

    return (
        <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-float border-none shadow-soft p-0 overflow-hidden bg-white group cursor-pointer" onClick={() => onViewDetails(kit.id)}>
            <div className="h-32 bg-autro-blue relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-2 border border-white/20 transition-transform group-hover:scale-110 duration-300">
                        <span className="text-2xl font-black text-white tracking-tighter">{(kit.marca || '??').substring(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{kit.marca || 'Sem Marca'}</span>
                </div>
                <div className="absolute top-3 right-3 flex gap-1">
                    <div className="bg-autro-primary px-2 py-0.5 rounded text-[10px] font-black text-white shadow-lg uppercase tracking-tighter">
                        {kit.modelo || 'N/A'}
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                        {kit.ano || 'N/A'}
                    </div>
                </div>
            </div>

            <div className="p-4 flex-grow flex flex-col space-y-4">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-grow">
                        <h4 className="font-black text-slate-900 text-base line-clamp-2 uppercase tracking-tight" title={kit.name}>{kit.name}</h4>
                        <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">SKU: {kit.sku}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Composição do Kit</p>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">{activeDetails.breakdown.length} itens</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 space-y-1">
                        {activeDetails.breakdown.map((item, i) => {
                            const isPackaging = item.sku.startsWith('EMB-');
                            const isKey = item.type === 'Chave';
                            const isFastener = item.type === 'Fixador';
                            const isNut = item.sku.includes('x0');

                            let bgColor = 'bg-slate-100';
                            let textColor = 'text-slate-900';
                            let labelColor = 'text-slate-500';

                            if (isPackaging) {
                                bgColor = 'bg-emerald-100/50';
                                textColor = 'text-emerald-900';
                                labelColor = 'text-emerald-600';
                            } else if (isKey) {
                                bgColor = 'bg-purple-100/50';
                                textColor = 'text-purple-900';
                                labelColor = 'text-purple-600';
                            } else if (isFastener) {
                                if (isNut) {
                                    bgColor = 'bg-amber-100/50';
                                    textColor = 'text-amber-900';
                                    labelColor = 'text-amber-600';
                                } else {
                                    bgColor = 'bg-indigo-100/50';
                                    textColor = 'text-indigo-900';
                                    labelColor = 'text-indigo-600';
                                }
                            }

                            return (
                                <div key={i} className={`flex justify-between text-[10px] items-center py-1 px-1.5 rounded border-b border-transparent hover:border-slate-100 transition-colors`}>
                                    <span className={`${labelColor} line-clamp-2 mr-2 font-medium`} title={item.name}>{item.name}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`font-bold ${textColor} ${bgColor} px-1.5 py-0.5 rounded`}>{item.quantity}x</span>
                                        {canViewCosts && <span className="text-slate-500 font-mono">{formatCurrency(item.totalCost)}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3">
                    {canViewCosts && (
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custo Produção</span>
                            <span className="font-bold text-slate-700 text-xs">{formatCurrency(activeDetails.cost)}</span>
                        </div>
                    )}
                    
                    <div className="flex flex-col space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço Sugerido</span>
                            <span className="font-black text-autro-primary text-base">{formatCurrency(activeDetails.saleDetails.sellingPrice)}</span>
                        </div>
                        
                        {hasOptions && (
                            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={() => setSelectedOption('default')}
                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${selectedOption === 'default' ? 'bg-autro-primary text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-autro-primary/30'}`}
                                >
                                    Padrão
                                </button>
                                {costDetails.options?.fixS && (
                                    <button 
                                        onClick={() => setSelectedOption('fixS')}
                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${selectedOption === 'fixS' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-600/30'}`}
                                    >
                                        Fix-S
                                    </button>
                                )}
                                {costDetails.options?.fixP && (
                                    <button 
                                        onClick={() => setSelectedOption('fixP')}
                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${selectedOption === 'fixP' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-amber-600/30'}`}
                                    >
                                        Fix-P
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {activeDetails.keyName && (
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chave:</span>
                            <span className="text-[9px] font-bold text-slate-600 truncate max-w-[120px]">{activeDetails.keyName}</span>
                        </div>
                    )}

                    {canViewCosts && (
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Margem</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-black text-emerald-600">{formatCurrency(activeDetails.saleDetails.contributionMargin)}</span>
                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-100/50 px-1.5 py-0.5 rounded">{activeDetails.saleDetails.contributionMarginPercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-2 mt-auto flex gap-2">
                    <Button 
                        variant="primary" 
                        size="sm" 
                        className="flex-1 h-10 text-[10px] uppercase font-black tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onShowSaleDetails({ 
                                kitName: `${kit.name} (${activeDetails.label})`, 
                                cost: activeDetails.cost, 
                                materialCost: activeDetails.materialCost,
                                fabricationCost: activeDetails.fabricationCost,
                                saleDetails: activeDetails.saleDetails, 
                                breakdown: activeDetails.breakdown 
                            });
                        }}
                    >
                        Produção
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export const KitsView: React.FC<KitsViewProps> = ({ inventory, manufacturing, onShowQRCode, onViewDetails }) => {
  const { 
    kits, addKit, updateKit, deleteKit, components,
    isDirty, savingStatus, saveChanges, lastSync, isOutdated, refreshFromCloud
  } = inventory;
  const { calculateSaleDetails } = useFinancials();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [deletingKit, setDeletingKit] = useState<Kit | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [saleDetailsModalData, setSaleDetailsModalData] = useState<{ kitName: string; cost: number; materialCost?: number; fabricationCost?: number; saleDetails?: SaleDetails; breakdown?: KitCostBreakdownItem[] } | null>(null);

  const [filters, setFilters] = useState({
    searchTerm: '',
    brand: '',
    model: '',
    year: '',
    fastenerDim: '',
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
  const [isDiscardDraftConfirmOpen, setIsDiscardDraftConfirmOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const kitCostDetailsMap = useMemo((): Map<string, KitCostDetails> => {
    const detailsMap = new Map<string, KitCostDetails>();
    const fastenerFamilia = manufacturing.familias.find(f => f.id === 'fam-fixadores');
    const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
    const fixPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase() === 'montagem fix-p');
    const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');

    const fastenerCostCache = new Map<string, number>();
    const fixSCostCache = new Map<string, number>();
    const fixPCostCache = new Map<string, number>();
    const porPCostCache = new Map<string, number>();
    
    const componentSkuMap = new Map<string, Component>(components.filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c]));

    const getFastenerCostForFamily = (dimension: string, familia: any, cache: Map<string, number>): number => {
      if (!familia) return 0;
      if (cache.has(dimension)) {
        return cache.get(dimension)!;
      }
      const simpleDim = dimension.replace(/mm/i, '').replace(/M/i, '');
      const [bitolaStr, comprimentoStr] = simpleDim.split('x');
      const bitola = parseInt(bitolaStr, 10);
      const comprimento = parseInt(comprimentoStr, 10);
      if (!isNaN(bitola) && !isNaN(comprimento)) {
          const result = evaluateProcess(
              familia,
              { bitola, comprimento },
              inventory.components,
              {},
              { allFamilias: manufacturing.familias }
          );
          const fastenerCost = result.custoMateriaPrima + result.custoFabricacao;
          cache.set(dimension, fastenerCost);
          return fastenerCost;
      }
      return 0;
    };

    for (const kit of (kits || [])) {
        try {
            let baseTotalCost = 0;
            let baseMaterialCost = 0;
            let baseFabricationCost = 0;
            const breakdown: KitCostBreakdownItem[] = [];
            
            if (kit.components && Array.isArray(kit.components)) {
                kit.components.forEach((kc: KitComponent) => {
                    if (!kc.componentSku) return;
                    const component: Component | undefined = componentSkuMap.get(kc.componentSku.toUpperCase());
                    if (component) {
                        const unitCost = getComponentCost(component);
                        const itemTotalCost = unitCost * kc.quantity;
                        baseTotalCost += itemTotalCost;

                        if (component.type === 'raw_material' || component.sourcing === 'purchased') {
                            baseMaterialCost += itemTotalCost;
                        } else {
                            baseMaterialCost += (component.custoMateriaPrima || 0) * kc.quantity;
                            baseFabricationCost += (component.custoFabricacao || 0) * kc.quantity;
                        }

                        breakdown.push({
                            name: component.name, sku: component.sku, quantity: kc.quantity,
                            unitCost: unitCost, totalCost: itemTotalCost, type: 'Componente',
                        });
                    }
                });
            }

        let defaultTotalCost = baseTotalCost;
        let defaultMaterialCost = baseMaterialCost;
        let defaultFabricationCost = baseFabricationCost;
        const defaultBreakdown = [...breakdown];

        if (kit.requiredFasteners && Array.isArray(kit.requiredFasteners)) {
            kit.requiredFasteners.forEach((rf: { dimension: string; quantity: number }) => {
                if (!rf.dimension) return;
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || (f.nome || '').toLowerCase() === 'montagem fix-s' || (f.nome || '').toLowerCase().includes('fix'));
                const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || (f.nome || '').toLowerCase() === 'montagem por-p' || (f.nome || '').toLowerCase().includes('por'));
                
                let familiaToUse = isNut ? porPFamilia : fixSFamilia;
                
                if (isNut && kit.selectedNutFamiliaId) {
                    familiaToUse = manufacturing.familias.find(f => f.id === kit.selectedNutFamiliaId) || familiaToUse;
                } else if (!isNut && kit.selectedFamiliaId) {
                    familiaToUse = manufacturing.familias.find(f => f.id === kit.selectedFamiliaId) || familiaToUse;
                }

                const unitCost = getFastenerCostForFamily(rf.dimension, familiaToUse || fastenerFamilia, fastenerCostCache);
                const itemTotalCost = unitCost * rf.quantity;
                defaultTotalCost += itemTotalCost;
                defaultMaterialCost += itemTotalCost;

                const name = isNut
                    ? `Porca M${rf.dimension.split('x')[0]}`
                    : `Fixador ${rf.dimension}`;
                defaultBreakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
        }

        // Keys are no longer bundled with kits automatically
        let currentKeyCost = 0;
        let currentKeyName = undefined;

        defaultTotalCost += currentKeyCost;

        const saleDetails = calculateSaleDetails(defaultTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });

        let fixSTotalCost = baseTotalCost;
        const fixSBreakdown = [...breakdown];
        if (fixSFamilia && kit.requiredFasteners) {
            kit.requiredFasteners.forEach((rf: { dimension: string; quantity: number }) => {
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const familiaToUse = isNut ? porPFamilia : fixSFamilia;
                
                const unitCost = getFastenerCostForFamily(rf.dimension, familiaToUse || fastenerFamilia, fixSCostCache);
                const itemTotalCost = unitCost * rf.quantity;
                fixSTotalCost += itemTotalCost;
                const name = isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`;
                fixSBreakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
        }

        let fixPTotalCost = baseTotalCost;
        const fixPBreakdown = [...breakdown];
        if (fixPFamilia && kit.requiredFasteners) {
            kit.requiredFasteners.forEach((rf: { dimension: string; quantity: number }) => {
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const familiaToUse = isNut ? porPFamilia : fixPFamilia;
                
                const unitCost = getFastenerCostForFamily(rf.dimension, familiaToUse || fastenerFamilia, fixPCostCache);
                const itemTotalCost = unitCost * rf.quantity;
                fixPTotalCost += itemTotalCost;
                const name = isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`;
                fixPBreakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
        }

        const options: KitCostDetails['options'] = {};
        if (fixSFamilia) {
            options.fixS = {
                totalCost: fixSTotalCost,
                materialCost: fixSTotalCost - baseFabricationCost, // Simplified for now
                fabricationCost: baseFabricationCost,
                saleDetails: calculateSaleDetails(fixSTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy }),
                breakdown: fixSBreakdown.sort((a, b) => b.totalCost - a.totalCost)
            };
        }
        if (fixPFamilia) {
            options.fixP = {
                totalCost: fixPTotalCost,
                materialCost: fixPTotalCost - baseFabricationCost,
                fabricationCost: baseFabricationCost,
                saleDetails: calculateSaleDetails(fixPTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy }),
                breakdown: fixPBreakdown.sort((a, b) => b.totalCost - a.totalCost)
            };
        }

        detailsMap.set(kit.id, { 
            totalCost: defaultTotalCost, 
            materialCost: defaultMaterialCost, 
            fabricationCost: defaultFabricationCost, 
            breakdown: defaultBreakdown.sort((a, b) => b.totalCost - a.totalCost), 
            saleDetails,
            keyName: currentKeyName,
            options
        });
        } catch (err) {
            console.error(`Error calculating costs for kit ${kit.id}:`, err);
            // Provide fallback details to prevent crash
            detailsMap.set(kit.id, {
                totalCost: 0,
                materialCost: 0,
                fabricationCost: 0,
                breakdown: [],
                saleDetails: defaultSaleDetails,
                keyName: '',
                options: {}
            });
        }
    }
    return detailsMap;
  }, [kits, components, manufacturing.familias, inventory.components, calculateSaleDetails]);

  const handleOpenModalForCreate = useCallback(() => {
    setEditingKit(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveKit = useCallback(async (kitData: Kit | Omit<Kit, 'id'>) => {
    if ('id' in kitData) {
      await updateKit(kitData);
    } else {
      await addKit(kitData);
    }
    setIsModalOpen(false);
  }, [addKit, updateKit]);

  const handleSync = async () => {
    if (isOutdated) {
        setIsSyncConfirmOpen(true);
        return;
    }
    await saveChanges();
  };

  const handleRefresh = () => {
    if (isDirty) {
        setIsRefreshConfirmOpen(true);
        return;
    }
    localStorage.removeItem('localDrafts');
    refreshFromCloud();
  };

  const filterOptions = useMemo(() => {
    const brands = [...new Set(kits.map(k => k.marca))].sort((a: string, b: string) => a.localeCompare(b));
    const relevantKitsForModel = filters.brand ? kits.filter(k => k.marca === filters.brand) : [];
    const models = [...new Set(relevantKitsForModel.map(k => k.modelo))].sort((a: string, b: string) => a.localeCompare(b));
    const relevantKitsForYear = filters.model ? relevantKitsForModel.filter(k => k.modelo === filters.model) : [];
    const years = [...new Set(relevantKitsForYear.map(k => k.ano))].sort((a: string, b: string) => a.localeCompare(b));
    return { brands, models, years };
  }, [kits, filters.brand, filters.model]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => {
        const newFilters = { ...prev, [name]: value };
        if (name === 'brand') { newFilters.model = ''; newFilters.year = ''; }
        if (name === 'model') { newFilters.year = ''; }
        return newFilters;
    });
    setCurrentPage(1); // Reset to first page on any filter change
  };

  const handleClearFilters = () => {
    setFilters({ searchTerm: '', brand: '', model: '', year: '', fastenerDim: '' });
  };

  const filteredKits = useMemo(() => {
    return kits.filter(k => {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      const lowerFastenerDim = filters.fastenerDim.toLowerCase();
      const passesSearch = filters.searchTerm ? 
        (k.name || '').toLowerCase().includes(lowerSearchTerm) ||
        (k.sku || '').toLowerCase().includes(lowerSearchTerm) : true;
      const passesBrand = filters.brand ? k.marca === filters.brand : true;
      const passesModel = filters.model ? k.modelo === filters.model : true;
      const passesYear = filters.year ? k.ano === filters.year : true;
      const passesFastener = filters.fastenerDim ? 
        (k.requiredFasteners || []).some(f => (f.dimension || '').toLowerCase().includes(lowerFastenerDim)) : true;
      return passesSearch && passesBrand && passesModel && passesYear && passesFastener;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [kits, filters]);

  const totalPages = Math.ceil(filteredKits.length / ITEMS_PER_PAGE);
  const paginatedKits = filteredKits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    try {
        const logoBase64 = await getLogoBase64ForPdf();
        if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
        }
    } catch (error) { console.error("Could not load logo for PDF:", error); }
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Kits de Produtos', 200, 22, { align: 'right' });
    doc.setDrawColor('#002B8A');
    doc.line(14, 28, 200, 28);
    autoTable(doc, {
      head: [['Nome', 'Marca', 'Modelo', 'Ano', 'SKU', 'Custo Total', 'Preço de Venda']],
      body: filteredKits.map(k => {
          const details = kitCostDetailsMap.get(k.id);
          return [k.name, k.marca, k.modelo, k.ano, k.sku, formatCurrency(details?.totalCost || 0), formatCurrency(details?.saleDetails?.sellingPrice || 0)]
      }),
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [0, 43, 138] },
    });
    savePdfResiliently(doc, `relatorio_kits_${Date.now()}.pdf`);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredKits.map(k => {
        const details = kitCostDetailsMap.get(k.id);
        return {
            'Nome do Kit': k.name, 'SKU': k.sku, 'Marca': k.marca, 'Modelo': k.modelo, 'Ano': k.ano,
            'Custo Total (R$)': details?.totalCost || 0, 'Preço de Venda (R$)': details?.saleDetails?.sellingPrice || 0,
            'Componentes (SKU:Qtd)': k.components.map((c: KitComponent) => `${c.componentSku}:${c.quantity}`).join(','),
            'Fixadores (Dimensao:Qtd)': k.requiredFasteners.map((f: { dimension: string; quantity: number }) => `${f.dimension}:${f.quantity}`).join(','),
        }
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kits');
    XLSX.writeFile(workbook, `relatorio_kits_${Date.now()}.xlsx`);
  };

  return (
    <div>
        <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { setFileToImport(f); setIsImportModalOpen(true); } e.target.value = ''; }} accept=".xlsx, .xls" className="hidden" />
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-bold text-black">Kits de Produtos</h2>
                {isOutdated && (
                    <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase animate-pulse border border-amber-200">
                        <AlertTriangle size={12} />
                        Versão Desatualizada
                        <button onClick={handleRefresh} className="underline ml-1 hover:text-amber-900">Atualizar</button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3">
                <p className="text-slate-500 font-medium">Gestão de kits e composições comerciais.</p>
                <div className="h-4 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1.5">
                    {savingStatus === 'saving' && <span className="flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                    {savingStatus === 'saved' && <span className="text-green-600 text-[10px] font-black uppercase">✓ Sincronizado</span>}
                    {lastSync && savingStatus === 'idle' && !isDirty && (
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                            Sincronizado às {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    {isDirty && savingStatus === 'idle' && (
                        <div className="flex items-center gap-2">
                            <span className="text-amber-600 text-[10px] font-black uppercase animate-pulse flex items-center gap-1">
                                <Database size={10} />
                                Rascunho Ativo
                            </span>
                            <button 
                                onClick={() => setIsDiscardDraftConfirmOpen(true)}
                                className="text-[9px] text-red-400 hover:text-red-600 font-black uppercase underline"
                            >
                                Descartar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-2">
                {isDirty && (
                    <Button 
                        onClick={handleSync} 
                        disabled={savingStatus === 'saving'}
                        className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 flex items-center gap-2"
                    >
                        <Cloud size={16} />
                        {savingStatus === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                )}
                <Button onClick={handleExportPDF} variant="secondary" disabled={filteredKits.length === 0}>PDF</Button>
                <Button onClick={handleExportExcel} variant="secondary" disabled={filteredKits.length === 0}>Excel</Button>
                <Button onClick={handleOpenModalForCreate}>Novo Kit</Button>
            </div>
             <div className="flex gap-2 border-l pl-2">
                <Button onClick={() => fileInputRef.current?.click()}>Importar Excel</Button>
            </div>
        </div>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <Input className="lg:col-span-2" label="Pesquisar por Nome/SKU" name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Pesquisar..." />
            <Select label="Marca" name="brand" value={filters.brand} onChange={handleFilterChange}>
                <option value="">Todas as Marcas</option>
                {filterOptions.brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Select label="Modelo" name="model" value={filters.model} onChange={handleFilterChange} disabled={!filters.brand}>
                <option value="">Todos os Modelos</option>
                {filterOptions.models.map((m: string) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Select label="Ano" name="year" value={filters.year} onChange={handleFilterChange} disabled={!filters.model}>
                <option value="">Todos os Anos</option>
                {filterOptions.years.map((y: string) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Input label="Dimensão do Fixador" name="fastenerDim" value={filters.fastenerDim} onChange={handleFilterChange} placeholder="Ex: 8x40mm" />
             <Button onClick={handleClearFilters} variant="secondary" className="w-full">Limpar Filtros</Button>
        </div>
      </Card>

      {paginatedKits.length === 0 && (
        <EmptyState
            icon={<svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
            title="Nenhum Kit Encontrado"
            message="Comece adicionando um novo kit ou mude os filtros."
        >
            <Button onClick={handleOpenModalForCreate}>Adicionar Kit</Button>
        </EmptyState>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {paginatedKits.map(kit => (
          <KitCard 
            key={kit.id} 
            kit={kit} 
            costDetails={kitCostDetailsMap.get(kit.id) || { totalCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [], saleDetails: defaultSaleDetails }} 
            onViewDetails={onViewDetails}
            onShowSaleDetails={setSaleDetailsModalData}
            calculateSaleDetails={calculateSaleDetails}
          />
        ))}
      </div>
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {isModalOpen && <KitEditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveKit} kitToEdit={editingKit} inventory={inventory} />}
      {isImportModalOpen && <KitImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} file={fileToImport} inventory={inventory} />}
      {deletingKit && (
        <ConfirmationModal isOpen={!!deletingKit} onClose={() => setDeletingKit(null)} onConfirm={async () => { await deleteKit(deletingKit.id); setDeletingKit(null); }} title={`Excluir Kit "${deletingKit.name}"`} isConfirming={isConfirmingDelete} confirmText="Sim, Excluir">
            <p className="text-sm text-gray-600">Tem certeza que deseja excluir o kit "{deletingKit.name} ({deletingKit.sku})"? Esta ação não pode ser desfeita.</p>
        </ConfirmationModal>
      )}
      {saleDetailsModalData && <SaleDetailsModal isOpen={!!saleDetailsModalData} onClose={() => setSaleDetailsModalData(null)} {...saleDetailsModalData} />}
    </div>
  );
};
