
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { InventoryHook, Kit, ManufacturingHook, KitCostDetails, KitCostBreakdownItem, ScannedQRCodeData, SaleDetails, Component, View, KitComponent, SaleItem, CostStep } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { KitEditModal } from './KitEditModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { evaluateProcess, getComponentCost, calculateKitCosts } from '../hooks/manufacturing-evaluator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Pagination } from './ui/Pagination';
import { InlineQRCode } from './ui/InlineQRCode';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { KitImportModal } from './KitImportModal';
import { Select } from './ui/Select';
import { useFinancials } from '../contexts/FinancialsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { Modal } from './ui/Modal';
import { SaleDetailsModal } from './ui/SaleDetailsModal';
import { getLogoBase64ForPdf } from '../data/assets';
import { savePdfResiliently } from '../src/utils/pdfDownloadHelper';
import { Database, AlertTriangle, RefreshCw, Cloud, Download, FileText } from 'lucide-react';

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
    totalDeductions: 0,
    taxBreakdown: [],
    isOverridden: false,
    contributionMargin: 0,
    contributionMarginPercentage: 0,
};

const KitCard: React.FC<{ 
    kit: Kit; 
    costDetails: KitCostDetails;
    onViewDetails: (kitId: string) => void;
    onShowSaleDetails: (details: { kitId: string, kitName: string, cost: number, materialCost?: number, fabricationCost?: number, saleDetails?: SaleDetails, breakdown?: KitCostBreakdownItem[] }) => void;
    onPrint: (kit: Kit, details: KitCostDetails) => void;
    calculateSaleDetails: (cost: number, options: { priceOverride?: number; strategy?: 'markup' | 'override' }) => SaleDetails;
}> = ({ kit, costDetails, onViewDetails, onShowSaleDetails, onPrint, calculateSaleDetails }) => {
    const [selectedOption, setSelectedOption] = useState<string>('default');
    const { canViewCosts } = usePermissions();

    const activeDetails = useMemo(() => {
        if (selectedOption === 'default' || !costDetails.options?.[selectedOption]) {
            return {
                totalCost: costDetails.totalCost,
                materialCost: costDetails.materialCost,
                fabricationCost: costDetails.fabricationCost,
                saleDetails: costDetails.saleDetails,
                breakdown: costDetails.breakdown,
                label: 'Padrão',
                keyName: costDetails.keyName,
                selectedFastenerFamiliaName: costDetails.selectedFastenerFamiliaName,
                selectedNutFamiliaName: costDetails.selectedNutFamiliaName
            };
        }
        const opt = costDetails.options[selectedOption];
        return {
            totalCost: opt.totalCost,
            materialCost: opt.materialCost,
            fabricationCost: opt.fabricationCost,
            saleDetails: opt.saleDetails,
            breakdown: opt.breakdown,
            label: selectedOption === 'fixS' ? 'Fix-S' : 'Fix-P',
            keyName: opt.keyName,
            selectedFastenerFamiliaName: opt.selectedFastenerFamiliaName,
            selectedNutFamiliaName: opt.selectedNutFamiliaName
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
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                        <div className="bg-autro-primary px-2 py-0.5 rounded text-[10px] font-black text-white shadow-lg uppercase tracking-tighter">
                            {kit.modelo || 'N/A'}
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                            {kit.ano || 'N/A'}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {activeDetails.selectedFastenerFamiliaName && (
                            <div className="bg-indigo-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-tighter">
                                F: {activeDetails.selectedFastenerFamiliaName}
                            </div>
                        )}
                        {activeDetails.selectedNutFamiliaName && (
                            <div className="bg-amber-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-tighter">
                                P: {activeDetails.selectedNutFamiliaName}
                            </div>
                        )}
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
                            const isNut = item.sku && item.sku.includes('x0');

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
                            <span className="font-bold text-slate-700 text-xs">{formatCurrency(activeDetails.totalCost)}</span>
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

                <div className="pt-2 mt-auto flex flex-col gap-2">
                    <div className="flex gap-2">
                        <Button 
                            variant="primary" 
                            size="sm" 
                            className="flex-1 h-10 text-[10px] uppercase font-black tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 bg-slate-900"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onShowSaleDetails({ 
                                    kitId: kit.id,
                                    kitName: `${kit.name} (${activeDetails.label})`, 
                                    cost: activeDetails.totalCost, 
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
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full h-9 text-[10px] uppercase font-black tracking-widest border-autro-blue text-autro-blue hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onPrint(kit, activeDetails);
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        IMPRIMIR FICHA TÉCNICA
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export const KitsView: React.FC<KitsViewProps> = ({ inventory, manufacturing, onShowQRCode, onViewDetails }) => {
  const { 
    kits, addKit, updateKit, deleteKit, components,
    isDirty, savingStatus, saveChanges, lastSync, isOutdated, refreshFromCloud,
    globalFastenerFamiliaId, setGlobalFastenerFamiliaId,
    globalNutFamiliaId, setGlobalNutFamiliaId
  } = inventory;
  const { calculateSaleDetails, settings: financialSettings } = useFinancials();
  const { canViewCosts } = usePermissions();
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [deletingKit, setDeletingKit] = useState<Kit | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [saleDetailsModalData, setSaleDetailsModalData] = useState<{ kitId: string; kitName: string; cost: number; materialCost?: number; fabricationCost?: number; saleDetails?: SaleDetails; breakdown?: KitCostBreakdownItem[] } | null>(null);

  const [filters, setFilters] = useState({
    searchTerm: '',
    brand: '',
    model: '',
    year: '',
    fastenerDim: '',
  });

  const [tempFastenerId, setTempFastenerId] = useState<string>(globalFastenerFamiliaId || '');
  const [tempNutId, setTempNutId] = useState<string>(globalNutFamiliaId || '');

  // Sync temp state if global state changes externally
  useEffect(() => {
    setTempFastenerId(globalFastenerFamiliaId || '');
  }, [globalFastenerFamiliaId]);

  useEffect(() => {
    setTempNutId(globalNutFamiliaId || '');
  }, [globalNutFamiliaId]);

  const handleApplyGlobalFilters = () => {
    setGlobalFastenerFamiliaId(tempFastenerId);
    setGlobalNutFamiliaId(tempNutId);
    addToast("Filtros globais aplicados.", "success");
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
  const [isDiscardDraftConfirmOpen, setIsDiscardDraftConfirmOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const [isExporting, setIsExporting] = useState(false);

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

  const kitCostDetailsMap = useMemo((): Map<string, KitCostDetails> => {
    const detailsMap = new Map<string, KitCostDetails>();
    
    // Optimization: Only calculate for current page to avoid lag
    // If you need all for some reason, use inventory.kits, but paginatedKits is enough for display
    const visibleKits = paginatedKits;

    const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase().includes('fix-s'));
    const fixPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase().includes('fix-p'));
    const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase().includes('por-p'));

    for (const kit of visibleKits) {
        try {
            // 1. Calculate Default View (Global Selection)
            const defaultDetails = calculateKitCosts(
                kit,
                { components },
                manufacturing,
                financialSettings,
                { 
                    selectedFamiliaId: globalFastenerFamiliaId, 
                    selectedNutFamiliaId: globalNutFamiliaId,
                    sellingPriceOverride: kit.sellingPriceOverride,
                    pricingStrategy: kit.pricingStrategy
                }
            );
            
            // Add sale details
            defaultDetails.saleDetails = calculateSaleDetails(defaultDetails.totalCost, {
                priceOverride: kit.sellingPriceOverride,
                strategy: kit.pricingStrategy
            });

            // Add standard metadata for the view
            const mappedKit: KitCostDetails = {
                ...defaultDetails,
                label: 'Padrão',
                selectedFastenerFamiliaName: globalFastenerFamiliaId 
                    ? (manufacturing.familias.find(f => f.id === globalFastenerFamiliaId)?.nome || globalFastenerFamiliaId)
                    : 'AUTO (FIX-S)',
                selectedNutFamiliaName: globalNutFamiliaId
                    ? (manufacturing.familias.find(f => f.id === globalNutFamiliaId)?.nome || globalNutFamiliaId)
                    : 'AUTO (POR-P)',
                options: {}
            };

            // 2. Generate Options (Fix-S vs Fix-P) for quick comparison
            if (fixSFamilia) {
                const sDetails = calculateKitCosts(kit, { components }, manufacturing, financialSettings, {
                    selectedFamiliaId: fixSFamilia.id,
                    selectedNutFamiliaId: globalNutFamiliaId || porPFamilia?.id
                });
                mappedKit.options!.fixS = {
                    ...sDetails,
                    label: 'Fix-S',
                    selectedFastenerFamiliaName: 'FIX-S',
                    saleDetails: calculateSaleDetails(sDetails.totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy })
                };
            }

            if (fixPFamilia) {
                const pDetails = calculateKitCosts(kit, { components }, manufacturing, financialSettings, {
                    selectedFamiliaId: fixPFamilia.id,
                    selectedNutFamiliaId: globalNutFamiliaId || porPFamilia?.id
                });
                mappedKit.options!.fixP = {
                    ...pDetails,
                    label: 'Fix-P',
                    selectedFastenerFamiliaName: 'FIX-P',
                    saleDetails: calculateSaleDetails(pDetails.totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy })
                };
            }

            detailsMap.set(kit.id, mappedKit);
        } catch (err) {
            console.error(`Error calculating costs for kit ${kit.id}:`, err);
            detailsMap.set(kit.id, {
                totalCost: 0,
                materialCost: 0,
                fabricationCost: 0,
                breakdown: [],
                saleDetails: defaultSaleDetails,
                options: {}
            });
        }
    }
    return detailsMap;
  }, [paginatedKits, components, manufacturing, calculateSaleDetails, globalFastenerFamiliaId, globalNutFamiliaId, financialSettings]);

  const exportKitsPDF = useCallback(async () => {
    setIsExporting(true);
    addToast("Gerando relatório PDF de todos os kits... Aguarde.", "info");
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const fullDetailsMap = new Map<string, KitCostDetails>();
        const fastenerFamilia = manufacturing.familias.find(f => f.id === 'fam-fixadores' || f.nome?.toLowerCase() === 'fixadores');
        const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
        const fixPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase() === 'montagem fix-p');
        const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
        
        const normalizeSku = (sku: string) => sku.toUpperCase().replace(',', '.').trim();
        const componentSkuMap = new Map<string, Component>();
        if (Array.isArray(components)) {
        (components || []).forEach(c => {
            if (c.sku) componentSkuMap.set(normalizeSku(c.sku), c);
            if (c.id) componentSkuMap.set(c.id.toUpperCase(), c);
        });
        }

        const findComponent = (skuOrId: string) => {
            if (!skuOrId) return undefined;
            const normalized = normalizeSku(skuOrId);
            let found = componentSkuMap.get(normalized);
            if (found) return found;
            found = componentSkuMap.get(skuOrId.toUpperCase());
            if (found) return found;
            if (normalized.includes('.')) {
                const alternative = normalized.replace(/\.?0+$/, '');
                found = componentSkuMap.get(alternative);
                if (found) return found;
            }
            return undefined;
        };

        const getFastenerDetails = (dimension: string, familia: any): { unitCost: number, materialCost: number, fabricationCost: number, breakdown: CostStep[] } => {
            if (!familia) return { unitCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [] };
            const simpleDim = dimension.replace(/mm/i, '').replace(/M/i, '');
            const [bitolaStr, comprimentoStr] = simpleDim.split('x');
            const bitola = parseInt(bitolaStr, 10);
            const comprimento = parseInt(comprimentoStr, 10) || 0;
            if (!isNaN(bitola)) {
                const result = evaluateProcess(familia, { bitola, comprimento }, inventory.components, {}, { allFamilias: manufacturing.familias, workStations: manufacturing.workStations, consumables: manufacturing.consumables, operations: manufacturing.standardOperations });
                return { unitCost: result.custoMateriaPrima + result.custoFabricacao, materialCost: result.custoMateriaPrima, fabricationCost: result.custoFabricacao, breakdown: result.costBreakdown };
            }
            return { unitCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [] };
        };

        for (const kit of (filteredKits || [])) {
            try {
                let baseTotalCost = 0;
                let baseMaterialCost = 0;
                let baseFabricationCost = 0;
                const aggregated = new Map<string, KitCostBreakdownItem>();
                
                const addToAggregated = (item: KitCostBreakdownItem) => {
                    const existing = aggregated.get(item.sku);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalCost += item.totalCost;
                    } else {
                        aggregated.set(item.sku, { ...item });
                    }
                };

                if (kit.components && Array.isArray(kit.components)) {
                    kit.components.forEach((kc: KitComponent) => {
                        if (!kc.componentSku) return;
                        const component = findComponent(kc.componentSku);
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
                            addToAggregated({
                                name: component.name, sku: component.sku, quantity: kc.quantity,
                                unitCost, materialCost: component.type === 'raw_material' || component.sourcing === 'purchased' ? unitCost : (component.custoMateriaPrima || 0),
                                fabricationCost: component.type === 'raw_material' || component.sourcing === 'purchased' ? 0 : (component.custoFabricacao || 0),
                                totalCost: itemTotalCost, type: 'Componente', costBreakdown: []
                            });
                        }
                    });
                }

                if (kit.requiredFasteners) {
                    kit.requiredFasteners.forEach((rf: any) => {
                        const isNut = rf.dimension && (rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0'));
                        let familiaToUse = isNut ? porPFamilia : fixSFamilia;
                        const currentFixFamiliaId = kit.selectedFamiliaId || globalFastenerFamiliaId;
                        const currentNutFamiliaId = kit.selectedNutFamiliaId || globalNutFamiliaId;
                        if (isNut && currentNutFamiliaId) {
                            familiaToUse = currentNutFamiliaId === 'porP' ? porPFamilia : manufacturing.familias.find(f => f.id === currentNutFamiliaId) || familiaToUse;
                        } else if (!isNut && currentFixFamiliaId) {
                            familiaToUse = currentFixFamiliaId === 'fixP' ? fixPFamilia : (currentFixFamiliaId === 'fixS' ? fixSFamilia : manufacturing.familias.find(f => f.id === currentFixFamiliaId) || familiaToUse);
                        }
                        const fastenerDetails = getFastenerDetails(rf.dimension, familiaToUse || fastenerFamilia);
                        const itemCost = fastenerDetails.unitCost * rf.quantity;
                        baseTotalCost += itemCost;
                        baseMaterialCost += fastenerDetails.materialCost * rf.quantity;
                        baseFabricationCost += fastenerDetails.fabricationCost * rf.quantity;
                        
                        const familyTag = familiaToUse?.masterProcessTag || 
                                          (familiaToUse?.nome?.toUpperCase().includes('POR-P') ? 'POR-P' : 
                                           familiaToUse?.nome?.toUpperCase().includes('FIX-P') ? 'FIX-P' : 
                                           familiaToUse?.nome?.toUpperCase().includes('FIX-S') ? 'FIX-S' : 'FIX');

                        addToAggregated({
                            name: isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`,
                            sku: `${familyTag}-${rf.dimension.toUpperCase().replace('MM', '')}`, quantity: rf.quantity,
                            unitCost: fastenerDetails.unitCost, materialCost: fastenerDetails.materialCost,
                            fabricationCost: fastenerDetails.fabricationCost, totalCost: itemCost, type: 'Fixador', costBreakdown: []
                        });

                        // Copo Automático no PDF
                        if (!isNut) {
                            const simpleDim = rf.dimension.replace(/mm/i, '').replace(/M/i, '');
                            const bitola = parseInt(simpleDim.split('x')[0], 10);
                            if (!isNaN(bitola)) {
                                    const copoBitola = (bitola === 10 || bitola === 12) ? 25.4 : (bitola === 8 ? 22.22 : 19.05);
                                    const formattedBitola = String(Number(copoBitola.toFixed(2)));
                                    const copoFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-COPO');
                                    
                                    const skuToFind = `COPO-${copoBitola.toFixed(2)}`;
                                    const componentFound = findComponent(skuToFind);

                                    if (copoFamilia) {
                                        const res = evaluateProcess(copoFamilia, { bitola: copoBitola }, inventory.components, {}, { allFamilias: manufacturing.familias });
                                        const unitCost = res.custoMateriaPrima + res.custoFabricacao;
                                        const cupTotal = unitCost * rf.quantity;
                                        baseTotalCost += cupTotal;
                                        baseMaterialCost += res.custoMateriaPrima * rf.quantity;
                                        baseFabricationCost += res.custoFabricacao * rf.quantity;
                                        addToAggregated({
                                            name: componentFound ? componentFound.name : `Copo ${formattedBitola.replace('.', ',')}`, 
                                            sku: componentFound ? componentFound.sku : skuToFind, 
                                            quantity: rf.quantity,
                                            unitCost: unitCost,
                                            materialCost: res.custoMateriaPrima,
                                            fabricationCost: res.custoFabricacao,
                                            totalCost: cupTotal, type: 'Copo', costBreakdown: []
                                        });
                                    }
                            }
                        }
                    });
                }

                const saleDetails = calculateSaleDetails(baseTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
                fullDetailsMap.set(kit.id, { totalCost: baseTotalCost, materialCost: baseMaterialCost, fabricationCost: baseFabricationCost, breakdown: Array.from(aggregated.values()), saleDetails, label: 'Padrão' });
            } catch (err) { console.error(err); }
        }

        const doc = new jsPDF();
        try {
            const logoBase64 = await getLogoBase64ForPdf();
            if (logoBase64) doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
        } catch (error) { console.error(error); }

        doc.setFontSize(18);
        doc.text('Relatório Consolidado de Kits e Composições', 14, 28);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 34);
        
        const tableBody: any[] = [];
        filteredKits.forEach(kit => {
            const details = fullDetailsMap.get(kit.id);
            if (!details) return;

            // Summary Row for Kit
            tableBody.push([
                { content: kit.name, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: kit.sku || '', styles: { fillColor: [240, 240, 240] } },
                { content: kit.marca || '', styles: { fillColor: [240, 240, 240] } },
                { content: formatCurrency(details.totalCost), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: formatCurrency(details.saleDetails.sellingPrice), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `${details.saleDetails.contributionMarginPercentage.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            // Composition Rows
            details.breakdown.forEach(item => {
                tableBody.push([
                    `  - ${item.name}`,
                    item.sku || '',
                    item.type,
                    formatCurrency(item.unitCost),
                    formatCurrency(item.totalCost),
                    `${item.quantity}x`
                ]);
            });
        });

        autoTable(doc, {
            startY: 40,
            head: [['Kit / Item', 'SKU', 'Marca/Tipo', 'Custo Unit/Total', 'Preço/Total', 'Margem/Qtd']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [0, 43, 138], fontSize: 9 },
            styles: { fontSize: 8 },
        });

        savePdfResiliently(doc, `Relatorio_Composicao_Kits_${Date.now()}.pdf`);
        addToast("PDF exportado com sucesso.", "success");
    } catch (error) {
        console.error("PDF Export error:", error);
        addToast("Erro ao exportar PDF.", "error");
    } finally {
        setIsExporting(false);
    }
  }, [filteredKits, components, manufacturing.familias, calculateSaleDetails, inventory.components, addToast, globalFastenerFamiliaId, globalNutFamiliaId]);

  const exportKitComposition = useCallback(async () => {
    setIsExporting(true);
    addToast("Calculando composição e custos de todos os kits... Aguarde.", "info");
    
    // Pequeno delay para permitir o UI atualizar
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const fullDetailsMap = new Map<string, KitCostDetails>();
        const fastenerFamilia = manufacturing.familias.find(f => f.id === 'fam-fixadores' || f.nome?.toLowerCase() === 'fixadores');
        const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
        const fixPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase() === 'montagem fix-p');
        const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
        
        const normalizeSku = (sku: string) => sku.toUpperCase().replace(',', '.').trim();
        const componentSkuMap = new Map<string, Component>();
        (components || []).forEach(c => {
            if (c.sku) componentSkuMap.set(normalizeSku(c.sku), c);
            if (c.id) componentSkuMap.set(c.id.toUpperCase(), c);
        });

        const findComponent = (skuOrId: string) => {
            if (!skuOrId) return undefined;
            const normalized = normalizeSku(skuOrId);
            let found = componentSkuMap.get(normalized);
            if (found) return found;
            found = componentSkuMap.get(skuOrId.toUpperCase());
            if (found) return found;
            if (normalized.includes('.')) {
                const alternative = normalized.replace(/\.?0+$/, '');
                found = componentSkuMap.get(alternative);
                if (found) return found;
            }
            return undefined;
        };

        const getFastenerDetails = (dimension: string, familia: any): { unitCost: number, materialCost: number, fabricationCost: number, breakdown: CostStep[] } => {
            if (!familia) return { unitCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [] };
            const simpleDim = dimension.replace(/mm/i, '').replace(/M/i, '');
            const [bitolaStr, comprimentoStr] = simpleDim.split('x');
            const bitola = parseInt(bitolaStr, 10);
            const comprimento = parseInt(comprimentoStr, 10) || 0;
            if (!isNaN(bitola)) {
                const result = evaluateProcess(familia, { bitola, comprimento }, inventory.components, {}, { allFamilias: manufacturing.familias, workStations: manufacturing.workStations, consumables: manufacturing.consumables, operations: manufacturing.standardOperations });
                return { unitCost: result.custoMateriaPrima + result.custoFabricacao, materialCost: result.custoMateriaPrima, fabricationCost: result.custoFabricacao, breakdown: result.costBreakdown };
            }
            return { unitCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [] };
        };

        for (const kit of (kits || [])) {
            try {
                let baseTotalCost = 0;
                let baseMaterialCost = 0;
                let baseFabricationCost = 0;
                const aggregated = new Map<string, KitCostBreakdownItem>();
                
                const addToAggregated = (item: KitCostBreakdownItem) => {
                    const existing = aggregated.get(item.sku);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalCost += item.totalCost;
                    } else {
                        aggregated.set(item.sku, { ...item });
                    }
                };

                if (kit.components && Array.isArray(kit.components)) {
                    kit.components.forEach((kc: KitComponent) => {
                        if (!kc.componentSku) return;
                        const component = findComponent(kc.componentSku);
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
                            addToAggregated({
                                name: component.name, sku: component.sku, quantity: kc.quantity,
                                unitCost, materialCost: component.type === 'raw_material' || component.sourcing === 'purchased' ? unitCost : (component.custoMateriaPrima || 0),
                                fabricationCost: component.type === 'raw_material' || component.sourcing === 'purchased' ? 0 : (component.custoFabricacao || 0),
                                totalCost: itemTotalCost, type: 'Componente', costBreakdown: []
                            });
                        }
                    });
                }

                if (kit.requiredFasteners) {
                    kit.requiredFasteners.forEach((rf: any) => {
                        const isNut = rf.dimension && (rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0'));
                        let familiaToUse = isNut ? porPFamilia : fixSFamilia;
                        const currentFixFamiliaId = kit.selectedFamiliaId || globalFastenerFamiliaId;
                        const currentNutFamiliaId = kit.selectedNutFamiliaId || globalNutFamiliaId;
                        if (isNut && currentNutFamiliaId) {
                            familiaToUse = currentNutFamiliaId === 'porP' ? porPFamilia : manufacturing.familias.find(f => f.id === currentNutFamiliaId) || familiaToUse;
                        } else if (!isNut && currentFixFamiliaId) {
                            familiaToUse = currentFixFamiliaId === 'fixP' ? fixPFamilia : (currentFixFamiliaId === 'fixS' ? fixSFamilia : manufacturing.familias.find(f => f.id === currentFixFamiliaId) || familiaToUse);
                        }
                        const fastenerDetails = getFastenerDetails(rf.dimension, familiaToUse || fastenerFamilia);
                        const itemCost = fastenerDetails.unitCost * rf.quantity;
                        baseTotalCost += itemCost;
                        baseMaterialCost += fastenerDetails.materialCost * rf.quantity;
                        baseFabricationCost += fastenerDetails.fabricationCost * rf.quantity;
                        
                        const familyTag = familiaToUse?.masterProcessTag || 
                                          (familiaToUse?.nome?.toUpperCase().includes('POR-P') ? 'POR-P' : 
                                           familiaToUse?.nome?.toUpperCase().includes('FIX-P') ? 'FIX-P' : 
                                           familiaToUse?.nome?.toUpperCase().includes('FIX-S') ? 'FIX-S' : 'FIX');

                        addToAggregated({
                            name: isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`,
                            sku: `${familyTag}-${rf.dimension.toUpperCase().replace('MM', '')}`, quantity: rf.quantity,
                            unitCost: fastenerDetails.unitCost, materialCost: fastenerDetails.materialCost,
                            fabricationCost: fastenerDetails.fabricationCost, totalCost: itemCost, type: 'Fixador', costBreakdown: []
                        });

                        // Copo Automático no Excel
                        if (!isNut) {
                            const simpleDim = rf.dimension.replace(/mm/i, '').replace(/M/i, '');
                            const bitola = parseInt(simpleDim.split('x')[0], 10);
                            if (!isNaN(bitola)) {
                                    const copoBitola = (bitola === 10 || bitola === 12) ? 25.4 : (bitola === 8 ? 22.22 : 19.05);
                                    const formattedBitola = String(Number(copoBitola));
                                    const copoFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-COPO');

                                    const skuToFind = `COPO-${formattedBitola}`;
                                    const componentFound = findComponent(skuToFind) || findComponent(`COPO-${copoBitola.toFixed(2)}`);

                                    if (copoFamilia) {
                                        const res = evaluateProcess(copoFamilia, { bitola: copoBitola }, inventory.components, {}, { allFamilias: manufacturing.familias });
                                        const unitCost = res.custoMateriaPrima + res.custoFabricacao;
                                        const cupTotal = unitCost * rf.quantity;
                                        baseTotalCost += cupTotal;
                                        baseMaterialCost += res.custoMateriaPrima * rf.quantity;
                                        baseFabricationCost += res.custoFabricacao * rf.quantity;
                                        addToAggregated({
                                            name: componentFound ? componentFound.name : `Copo ${formattedBitola.replace('.', ',')}`, 
                                            sku: componentFound ? componentFound.sku : skuToFind, 
                                            quantity: rf.quantity,
                                            unitCost: unitCost,
                                            materialCost: res.custoMateriaPrima,
                                            fabricationCost: res.custoFabricacao,
                                            totalCost: cupTotal, type: 'Copo', costBreakdown: []
                                        });
                                    }
                            }
                        }
                    });
                }

                const saleDetails = calculateSaleDetails(baseTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
                fullDetailsMap.set(kit.id, { totalCost: baseTotalCost, materialCost: baseMaterialCost, fabricationCost: baseFabricationCost, breakdown: Array.from(aggregated.values()), saleDetails, label: 'Padrão' });
            } catch (err) { console.error(err); }
        }

        const wb = XLSX.utils.book_new();
        const rows: any[] = [];
        kits.forEach(kit => {
            const details = fullDetailsMap.get(kit.id);
            if (!details) return;
            rows.push({
                "Kit Nome": kit.name, "SKU": kit.sku || '', "Marca": kit.marca || '', "Modelo": kit.modelo || '', "Ano": kit.ano || '',
                "Item": "RESUMO", "Qtd": 1, "Custo Total": details.totalCost, "Preço Venda": details.saleDetails.sellingPrice, "Margem %": details.saleDetails.contributionMarginPercentage.toFixed(1) + '%'
            });
            details.breakdown.forEach(item => {
                rows.push({ "Kit Nome": "", "SKU": "", "Marca": "", "Modelo": "", "Ano": "", "Item": item.name, "Qtd": item.quantity, "Custo Total": item.totalCost, "Preço Venda": "", "Margem %": "" });
            });
            rows.push({}); // Espaçador
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Kits e Composições");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, `Relatorio_Composicao_Custos_${new Date().toLocaleDateString()}.xlsx`);
        addToast("Relatório de composição exportado com sucesso.", "success");
    } catch (error) {
        console.error("Export error:", error);
        addToast("Erro ao exportar relatório.", "error");
    } finally {
        setIsExporting(false);
    }
  }, [kits, components, manufacturing.familias, calculateSaleDetails, inventory.components, addToast, globalFastenerFamiliaId, globalNutFamiliaId]);

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

  const handlePrintTechnicalSheet = async (kit: Kit, detailsOverride?: KitCostDetails) => {
    const details = detailsOverride || kitCostDetailsMap.get(kit.id);
    if (!details) return;

    const doc = new jsPDF();
    try {
        const logoBase64 = await getLogoBase64ForPdf();
        if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
        }
    } catch (err) { console.error("Logo error:", err); }

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA TÉCNICA - AUTRO', 14, 30);
    
    doc.line(14, 33, 200, 33);

    // Kit Info
    doc.setFontSize(14);
    const variationLabel = details.label ? ` (${details.label})` : '';
    const kitNameFull = `${kit.name}${variationLabel}`;
    
    // Auto-wrap title
    const wrappedTitle = doc.splitTextToSize(kitNameFull, 180);
    doc.text(wrappedTitle, 14, 42);
    
    // Calculate next Y based on wrapped title height
    let currentY = 42 + (wrappedTitle.length * 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Identificação (SKU): ${kit.sku}`, 14, currentY);
    currentY += 5;
    doc.text(`Marca: ${kit.marca} | Modelo: ${kit.modelo} | Ano: ${kit.ano}`, 14, currentY);
    currentY += 12;

    // Price Info (optional depending on permissions)
    if (canViewCosts) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO FINANCEIRO', 14, currentY);
        currentY += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Custo Matéria-Prima: ${formatCurrency(details.materialCost || 0)}`, 14, currentY);
        doc.text(`Preço de Venda: ${formatCurrency(details.saleDetails?.sellingPrice)}`, 120, currentY);
        currentY += 5;
        doc.text(`Custo de Fabricação: ${formatCurrency(details.fabricationCost || 0)}`, 14, currentY);
        doc.text(`Margem de C.: ${formatCurrency(details.saleDetails?.contributionMargin)} (${details.saleDetails?.contributionMarginPercentage.toFixed(1)}%)`, 120, currentY);
        currentY += 5;
        doc.setFont('helvetica', 'bold');
        doc.text(`Custo Total Produção: ${formatCurrency(details.totalCost)}`, 14, currentY);
        currentY += 13;
    } else {
        currentY += 5;
    }

    // Breakdown Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPOSIÇÃO E DETALHAMENTO DE CUSTOS', 14, currentY);
    
    const tableStartY = currentY + 5;

    const tableBody: any[] = [];
    details.breakdown.forEach(item => {
        const fabCost = item.fabricationCost !== undefined ? item.fabricationCost : 0;
        const matCost = item.materialCost !== undefined ? item.materialCost : item.unitCost;

        tableBody.push([
            item.quantity.toString(),
            item.name,
            item.sku,
            formatCurrency(matCost),
            formatCurrency(fabCost),
            formatCurrency(item.totalCost)
        ]);

        // Subprocesses
        if (item.costBreakdown && item.costBreakdown.length > 0) {
            item.costBreakdown.forEach(step => {
                const timeStr = step.timeSeconds ? `${(step.timeSeconds / 60).toFixed(1)} min` : '-';
                tableBody.push([
                    '',
                    `   > ${step.name}`,
                    timeStr,
                    step.type === 'labor' ? 'Etapa' : 'Insumo',
                    step.details || '',
                    formatCurrency(step.cost)
                ]);
            });
        }
    });

    autoTable(doc, {
        startY: tableStartY,
        head: [['Qtd', 'Item / Detalhamento de Processo', 'SKU / Tempo', 'C. Mat / Etapa', 'Obs / Detalhes', 'Subtotal']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [0, 43, 138], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        didParseCell: (data) => {
            if (data.row.cells[1].text[0].startsWith('   >')) {
                data.cell.styles.fontStyle = 'italic';
                data.cell.styles.textColor = [100, 100, 100];
                data.cell.styles.fontSize = 7;
            }
        },
        foot: [
            ['', '', '', '', 'TOTAL:', formatCurrency(details.totalCost)]
        ],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Documento gerado automaticamente pelo sistema Autro.', 14, finalY);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, finalY + 5);

    savePdfResiliently(doc, `ficha_tecnica_${kit.sku}_${Date.now()}.pdf`);
  };

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

  const handleDetailedExportExcel = () => {
    const dataToExport: any[] = [];
    
    filteredKits.forEach(k => {
        const details = kitCostDetailsMap.get(k.id);
        if (!details) return;

        const variants = [{ label: 'Padrão', details: details }];
        if (details.options) {
            Object.entries(details.options).forEach(([key, opt]) => {
                variants.push({ label: opt.label, details: opt as any });
            });
        }

        variants.forEach(v => {
            v.details.breakdown.forEach((item: any) => {
                // Determine specific process costs
                const laborCosts = (item.costBreakdown || [])
                    .filter((s: any) => s.type === 'labor')
                    .reduce((sum: number, s: any) => sum + s.cost, 0);
                
                const consumableCosts = (item.costBreakdown || [])
                    .filter((s: any) => s.type === 'consumable')
                    .reduce((sum: number, s: any) => sum + s.cost, 0);

                // Add main item row
                dataToExport.push({
                    'Kit': k.name,
                    'Versão Kit': v.label,
                    'SKU Kit': k.sku,
                    'Marca': k.marca,
                    'Modelo': k.modelo,
                    'Ano': k.ano,
                    'Tipo Item': item.type,
                    'Item Nome': item.name,
                    'Item SKU': item.sku,
                    'Quantidade': item.quantity,
                    'Custo Unit. Matéria-Prima (R$)': (item.materialCost || 0),
                    'Custo Unit. Fabricação (R$)': (item.fabricationCost || 0),
                    'Subtotal Item (R$)': item.totalCost,
                    'Parcela Mão-de-Obra (R$)': laborCosts * item.quantity,
                    'Parcela Insumos (R$)': consumableCosts * item.quantity,
                    'Processo': 'Resumo do Item',
                    'Preço Venda sugerido Kit (R$)': v.details.saleDetails.sellingPrice,
                    'Status': 'V2.0 PRODUCTION'
                });

                // Add rows for each manufacturing step
                if (item.costBreakdown && item.costBreakdown.length > 0) {
                    item.costBreakdown.forEach((step: CostStep) => {
                        dataToExport.push({
                            'Kit': k.name,
                            'Versão Kit': v.label,
                            'SKU Kit': k.sku,
                            'Marca': k.marca,
                            'Modelo': k.modelo,
                            'Ano': k.ano,
                            'Tipo Item': `${item.type} (Processo)`,
                            'Item Nome': item.name,
                            'Item SKU': item.sku,
                            'Quantidade': item.quantity,
                            'Custo Unit. Matéria-Prima (R$)': 0,
                            'Custo Unit. Fabricação (R$)': step.cost,
                            'Subtotal Item (R$)': step.cost * item.quantity,
                            'Parcela Mão-de-Obra (R$)': (step.type === 'labor' ? step.cost : 0) * item.quantity,
                            'Parcela Insumos (R$)': (step.type === 'consumable' ? step.cost : 0) * item.quantity,
                            'Processo': step.name,
                            'Detalhes Processo': step.details || '',
                            'Preço Venda sugerido Kit (R$)': v.details.saleDetails.sellingPrice,
                        });
                    });
                }
            });
        });
    });

    if (dataToExport.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estrutura e Processos');
    XLSX.writeFile(workbook, `diagnostico_kits_v2_${Date.now()}.xlsx`);
  };

  const handleExportKeysExcel = () => {
    const keyFamilies = manufacturing.familias.filter(f => f.id.toLowerCase().includes('chave') || f.nome.toLowerCase().includes('chave'));
    if (keyFamilies.length === 0) {
        addToast('Nenhuma família de chaves encontrada.', 'info');
        return;
    }

    const dataToExport: any[] = [];
    const dummyVariables = { bitola: 10, comprimento: 40, headCode: 'STD' };

    keyFamilies.forEach(fam => {
        const result = evaluateProcess(
            fam,
            { bitola: 10, comprimento: 40 },
            inventory.components,
            { bitola: '10', comprimento: '40', headCode: 'STD' },
            { 
                allFamilias: manufacturing.familias, 
                workStations: manufacturing.workStations, 
                consumables: manufacturing.consumables, 
                operations: manufacturing.standardOperations 
            }
        );

        dataToExport.push({
            'ID Família': fam.id,
            'Nome Família': fam.nome,
            'Custo MP Estimado (Base 10x40)': result.custoMateriaPrima,
            'Custo Fab Estimado (Base 10x40)': result.custoFabricacao,
            'Custo Total Estimado': result.custoMateriaPrima + result.custoFabricacao,
            'Tempo Total (Seg)': result.totalTimeSeconds,
            'Tipo': 'Resumo Chave'
        });

        if (result.costBreakdown) {
            result.costBreakdown.forEach((step: CostStep) => {
                dataToExport.push({
                    'ID Família': fam.id,
                    'Nome Família': fam.nome,
                    'Etapa': step.name,
                    'Tipo Etapa': step.type,
                    'Custo Etapa': step.cost,
                    'Tempo Etapa (Seg)': step.timeSeconds || 0,
                    'Detalhes': step.details || '',
                    'Tipo': 'Processo'
                });
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Custos Chaves');
    XLSX.writeFile(workbook, `custos_chaves_${Date.now()}.xlsx`);
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
            <div className="flex flex-col gap-1">
                <p className="text-slate-500 font-medium">Gestão de kits e composições comerciais.</p>
                <div className="flex flex-wrap items-end gap-3 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Fio/Fixador Global</label>
                        <select 
                            value={tempFastenerId} 
                            onChange={(e) => setTempFastenerId(e.target.value)}
                            className="text-[10px] font-bold bg-white border border-slate-200 rounded p-1 min-w-[120px]"
                        >
                            <option value="">Auto (Original)</option>
                            <option value="fixS">FIX-S (Original)</option>
                            <option value="fixP">FIX-P (Inox)</option>
                            {manufacturing.familias.filter(f => f.category === 'manufacturing').map(f => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Porca Global</label>
                        <select 
                            value={tempNutId} 
                            onChange={(e) => setTempNutId(e.target.value)}
                            className="text-[10px] font-bold bg-white border border-slate-200 rounded p-1 min-w-[120px]"
                        >
                            <option value="">Auto (Padrão)</option>
                            <option value="porP">POR-P (Inox)</option>
                            {manufacturing.familias.filter(f => f.category === 'manufacturing').map(f => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </select>
                    </div>
                    <Button 
                        size="sm" 
                        onClick={handleApplyGlobalFilters}
                        className="h-7 text-[10px] uppercase font-black px-4 bg-slate-800"
                    >
                        Aplicar
                    </Button>
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
                <Button 
                    onClick={exportKitComposition} 
                    disabled={isExporting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase flex items-center gap-2"
                >
                    <Download size={14} />
                    {isExporting ? 'Calculando...' : 'Exportar Composição (Excel)'}
                </Button>
                <Button 
                    onClick={exportKitsPDF} 
                    disabled={isExporting}
                    className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase flex items-center gap-2"
                >
                    <FileText size={14} />
                    {isExporting ? 'Processando...' : 'Exportar PDF'}
                </Button>
                <Button onClick={handleExportKeysExcel} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase flex items-center gap-2">
                    <Download size={14} />
                    Exportar Processos Chaves (Excel)
                </Button>
                <Button onClick={handleOpenModalForCreate}>Novo Kit</Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="secondary">Importar</Button>
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
        <div className="space-y-6">
          <EmptyState
              icon={<svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
              title="Nenhum Kit Encontrado"
              message="O catálogo de kits está vazio ou os filtros aplicados não retornaram resultados."
          >
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleOpenModalForCreate}>Adicionar Kit Manulmente</Button>
                <Button variant="secondary" onClick={async () => {
                  if (confirm("Deseja restaurar os kits originais do sistema? Isso adicionará os kits padrão se eles não existirem.")) {
                    await inventory.refreshFromCloud();
                  }
                }}>Restaurar Dados Iniciais</Button>
              </div>
          </EmptyState>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {paginatedKits.map((kit, index) => (
          <KitCard 
            key={`${kit.id}-${index}`} 
            kit={kit} 
            costDetails={kitCostDetailsMap.get(kit.id) || { totalCost: 0, materialCost: 0, fabricationCost: 0, breakdown: [], saleDetails: defaultSaleDetails }} 
            onViewDetails={onViewDetails}
            onShowSaleDetails={setSaleDetailsModalData}
            onPrint={handlePrintTechnicalSheet}
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
      {saleDetailsModalData && (
          <SaleDetailsModal 
            isOpen={!!saleDetailsModalData} 
            onClose={() => setSaleDetailsModalData(null)} 
            {...saleDetailsModalData} 
            onPrint={() => {
                const kit = kits.find(k => k.id === saleDetailsModalData.kitId);
                if (kit) {
                    const details: KitCostDetails = {
                        totalCost: saleDetailsModalData.cost,
                        materialCost: saleDetailsModalData.materialCost || 0,
                        fabricationCost: saleDetailsModalData.fabricationCost || 0,
                        saleDetails: saleDetailsModalData.saleDetails || defaultSaleDetails,
                        breakdown: saleDetailsModalData.breakdown || [],
                        label: (saleDetailsModalData.kitName || '').includes('(') ? saleDetailsModalData.kitName.split('(').pop()?.replace(')', '') : 'Padrão'
                    };
                    handlePrintTechnicalSheet(kit, details);
                }
            }}
          />
      )}
    </div>
  );
};
