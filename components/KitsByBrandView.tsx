import React, { useState, useMemo } from 'react';
// FIX: Import KitComponent to resolve type errors.
import { InventoryHook, Kit, ManufacturingHook, AggregatedPart, SaleDetails, QuoteItem, KitComponent, Component, KitCostDetails, KitCostBreakdownItem, CostStep } from '../types';
import { Card } from './ui/Card';
import { evaluateProcess, getComponentCost, calculateKitCosts } from '../hooks/manufacturing-evaluator';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EmailReportModal } from './ui/EmailReportModal';
import { SaleDetailsModal } from './ui/SaleDetailsModal';
import { useFinancials } from '../contexts/FinancialsContext';
import { usePermissions } from '../hooks/usePermissions';
import { Input } from './ui/Input';
import { savePdfResiliently } from '../src/utils/pdfDownloadHelper';
import { getLogoBase64ForPdf } from '../data/assets';

interface KitsByBrandViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-autro-blue-light p-4 rounded-lg">
        <h3 className="text-black text-sm font-medium">{title}</h3>
        <p className={`text-2xl font-bold text-autro-blue`}>{value}</p>
        {description && <p className="text-xs text-gray-600 mt-1">{description}</p>}
    </div>
);

const CatalogKitCard: React.FC<{
    kit: Kit;
    costDetails: KitCostDetails;
    onAddToQuote: (kit: Kit, variant?: 'Padrão' | 'Fix-S' | 'Fix-P') => void;
    onShowDetails: (details: { kitId: string; kitName: string; cost: number; materialCost?: number; fabricationCost?: number; saleDetails?: SaleDetails; breakdown?: KitCostBreakdownItem[] }) => void;
    onPrint: (kit: Kit, details: KitCostDetails) => void;
    canViewCosts: boolean;
}> = ({ kit, costDetails, onAddToQuote, onShowDetails, onPrint, canViewCosts }) => {
    const [selectedOption, setSelectedOption] = useState<string>('default');
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
        <Card className="flex flex-col p-0 overflow-hidden group border-none shadow-soft hover:shadow-float transition-all duration-300">
            <div className="h-32 bg-autro-blue relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-2 border border-white/20">
                        <span className="text-2xl font-black text-white tracking-tighter">{(kit.marca || '??').substring(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{kit.marca || 'Sem Marca'}</span>
                </div>
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                        <div className="bg-autro-primary px-2 py-0.5 rounded text-[10px] font-black text-white shadow-lg uppercase tracking-tighter">
                            {kit.modelo}
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
            <div className="p-4 flex-grow flex flex-col bg-white">
                <h4 className="font-black text-slate-900 text-base mb-1 line-clamp-2 uppercase tracking-tight">{kit.name}</h4>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">SKU: {kit.sku}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{kit.ano}</span>
                </div>
                
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-end p-2 bg-slate-50 rounded-lg border border-slate-100">
                        {canViewCosts ? (
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Custo Produção</span>
                                <span className="font-bold text-slate-700 text-sm">{formatCurrency(activeDetails.totalCost)}</span>
                            </div>
                        ) : (
                            <div></div>
                        )}
                        <div className="text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Preço Venda</span>
                            <span className="font-black text-autro-primary text-lg">{formatCurrency(activeDetails.saleDetails.sellingPrice)}</span>
                        </div>
                    </div>
                    
                    {hasOptions && (
                        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar pt-1">
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

                    {canViewCosts && (
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Margem de Contribuição</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-black text-emerald-600">{formatCurrency(activeDetails.saleDetails.contributionMargin)}</span>
                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">{activeDetails.saleDetails.contributionMarginPercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    )}
                    {activeDetails.keyName && (
                        <div className="flex justify-between items-center px-2 pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Chave Associada</span>
                            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{activeDetails.keyName}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            onClick={() => onAddToQuote(kit, selectedOption === 'default' ? 'Padrão' : selectedOption === 'fixS' ? 'Fix-S' : 'Fix-P')} 
                            variant="primary" 
                            size="sm" 
                            className="h-10 text-[10px] uppercase font-black tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 bg-slate-900"
                        >
                            PRODUÇÃO
                        </Button>
                        <Button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onShowDetails({ 
                                    kitId: kit.id,
                                    kitName: `${kit.name} (${activeDetails.label})`, 
                                    cost: activeDetails.totalCost, 
                                    materialCost: activeDetails.materialCost,
                                    fabricationCost: activeDetails.fabricationCost,
                                    saleDetails: activeDetails.saleDetails, 
                                    breakdown: activeDetails.breakdown 
                                });
                            }}
                            variant="secondary" 
                            size="sm" 
                            className="h-10 text-[10px] uppercase font-black tracking-widest border-slate-200 hover:bg-slate-50 transition-all active:scale-95 px-1"
                        >
                            DETALHES
                        </Button>
                    </div>
                    <Button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onPrint(kit, activeDetails);
                        }}
                        variant="secondary" 
                        size="sm" 
                        className="h-9 text-[10px] uppercase font-black tracking-widest border-autro-blue text-autro-blue hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-2"
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

export const KitsByBrandView: React.FC<KitsByBrandViewProps> = ({ inventory, manufacturing }) => {
  const { kits, components } = inventory;
  const { familias } = manufacturing;
  const { calculateSaleDetails, settings } = useFinancials();
  const { canViewCosts } = usePermissions();

  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'catalog'>('analysis');
  const [quoteItems, setQuoteItems] = useState<Map<string, QuoteItem>>(new Map());
  const [saleDetailsModalData, setSaleDetailsModalData] = useState<{ kitId: string; kitName: string; cost: number; materialCost?: number; fabricationCost?: number; saleDetails?: SaleDetails; breakdown?: KitCostBreakdownItem[] } | null>(null);


  const filterOptions = useMemo(() => {
    const brandSet = new Set(kits.map(k => k.marca));
    const modelSet = new Set<string>();
    
    if (selectedBrand) {
        kits.filter(k => k.marca === selectedBrand).forEach(k => modelSet.add(k.modelo));
    }

    return {
      // FIX: Add explicit types to sort callback parameters to resolve 'unknown' type error.
      brands: Array.from(brandSet).sort((a: string, b: string) => a.localeCompare(b)),
      models: Array.from(modelSet).sort((a: string, b: string) => a.localeCompare(b)),
    };
  }, [kits, selectedBrand]);
  
  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedBrand(e.target.value);
      setSelectedModel(''); // Reset model when brand changes
  }
  
  const kitCostsAndSales = useMemo(() => {
    const detailsMap = new Map<string, KitCostDetails>();
    
    for (const kit of (kits || [])) {
      try {
        // 1. Calculate Default
        const defaultDetails = calculateKitCosts(
            kit,
            { components },
            manufacturing,
            settings,
            { 
              selectedFamiliaId: kit.selectedFamiliaId, 
              selectedNutFamiliaId: kit.selectedNutFamiliaId,
              sellingPriceOverride: kit.sellingPriceOverride,
              pricingStrategy: kit.pricingStrategy 
            }
        );
        
        defaultDetails.saleDetails = calculateSaleDetails(defaultDetails.totalCost, {
            priceOverride: kit.sellingPriceOverride,
            strategy: kit.pricingStrategy
        });

        const options: KitCostDetails['options'] = {};
        
        // 2. Fix-S Variant
        const fixSFam = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase().includes('fix-s') || f.nome?.toLowerCase().includes('montagem fix-s'));
        if (fixSFam) {
            const fixSDetails = calculateKitCosts(kit, { components }, manufacturing, settings, { selectedFamiliaId: fixSFam.id });
            fixSDetails.saleDetails = calculateSaleDetails(fixSDetails.totalCost, {
                priceOverride: kit.sellingPriceOverride,
                strategy: kit.pricingStrategy
            });
            options['fixS'] = fixSDetails;
        }

        // 3. Fix-P Variant
        const fixPFam = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase().includes('fix-p'));
        if (fixPFam) {
            const fixPDetails = calculateKitCosts(kit, { components }, manufacturing, settings, { selectedFamiliaId: fixPFam.id });
            fixPDetails.saleDetails = calculateSaleDetails(fixPDetails.totalCost, {
                priceOverride: kit.sellingPriceOverride,
                strategy: kit.pricingStrategy
            });
            options['fixP'] = fixPDetails;
        }

        // Mapping associated family names for display
        let defaultFastenerName = '';
        let defaultNutName = '';
        if (kit.selectedFamiliaId) {
            defaultFastenerName = manufacturing.familias.find(f => f.id === kit.selectedFamiliaId)?.nome || kit.selectedFamiliaId;
        }
        if (kit.selectedNutFamiliaId) {
            defaultNutName = manufacturing.familias.find(f => f.id === kit.selectedNutFamiliaId)?.nome || kit.selectedNutFamiliaId;
        }

        detailsMap.set(kit.id, { 
            ...defaultDetails, 
            options,
            selectedFastenerFamiliaName: defaultFastenerName,
            selectedNutFamiliaName: defaultNutName
        });
      } catch (error) {
        console.error(`Error calculating details Map:`, error);
      }
    }
    return detailsMap;
  }, [kits, components, manufacturing, settings, calculateSaleDetails]);
  
  const filteredKits = useMemo(() => {
    if (!selectedBrand) return [];
    return kits.filter(k => 
      k.marca === selectedBrand && 
      (!selectedModel || k.modelo === selectedModel)
    ).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.name.localeCompare(b.name));
  }, [selectedBrand, selectedModel, kits]);

  const selectionSummary = useMemo(() => {
    if (filteredKits.length === 0) {
        return { totalCostValue: 0, totalSaleValue: 0, uniqueModels: 0 };
    }
    let totalCostValue = 0;
    let totalSaleValue = 0;
    const modelSet = new Set<string>();

    for(const kit of filteredKits) {
        const details = kitCostsAndSales.get(kit.id);
        totalCostValue += details?.totalCost || 0;
        totalSaleValue += details?.saleDetails?.sellingPrice || 0;
        modelSet.add(kit.modelo);
    }
    
    return {
        totalCostValue,
        totalSaleValue,
        uniqueModels: modelSet.size
    };
  }, [filteredKits, kitCostsAndSales]);

  const aggregatedParts = useMemo((): AggregatedPart[] => {
    if (filteredKits.length === 0) return [];

    const partsMap = new Map<string, AggregatedPart>();
    const preferredId = settings?.preferredFastenerFamiliaId || 'fam-fixadores';
    const fastenerFamilia = familias.find(f => f.id === preferredId);
    const fastenerCostCache = new Map<string, number>();
    const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));

    const getFastenerCost = (bitola: number, comprimento: number, familiaToUse: any): number => {
        const cacheKey = `${bitola}x${comprimento}-${familiaToUse?.id || 'default'}`;
        if (fastenerCostCache.has(cacheKey)) {
            return fastenerCostCache.get(cacheKey)!;
        }
        if (familiaToUse) {
            const result = evaluateProcess(
                familiaToUse,
                { bitola, comprimento },
                inventory.components,
                {},
                { allFamilias: manufacturing.familias }
            );
            const cost = result.custoMateriaPrima + result.custoFabricacao;
            fastenerCostCache.set(cacheKey, cost);
            return cost;
        }
        return 0;
    };
    
    for (const kit of filteredKits) {
      // FIX: Add explicit type to forEach callback parameter to resolve 'unknown' type error.
      if (kit.components && Array.isArray(kit.components)) {
        kit.components.forEach(({ componentSku, quantity }: KitComponent) => {
          const component = componentSkuMap.get(componentSku);
          if (component) {
            const current = partsMap.get(component.sku) || { name: component.name, sku: component.sku, totalQuantity: 0, totalValue: 0 };
            const cost = getComponentCost(component);
            current.totalQuantity += quantity;
            current.totalValue += quantity * cost;
            partsMap.set(component.sku, current);
          }
        });
      }

      if (kit.requiredFasteners) {
        for (const { dimension, quantity } of kit.requiredFasteners) {
          const simpleDim = dimension.replace('mm','');
          const [bitolaStr, comprimentoStr] = simpleDim.split('x');
          const bitola = parseInt(bitolaStr, 10);
          const comprimento = parseInt(comprimentoStr, 10);
          if (isNaN(bitola) || isNaN(comprimento)) continue;

          const sku = `DIM-${simpleDim}`;
          const current = partsMap.get(sku) || {
            name: comprimento === 0 ? `Fix Porca (Qualquer Cabeça) M${bitola}` : `Fixador (Qualquer Cabeça) ${simpleDim}`,
            sku, totalQuantity: 0, totalValue: 0
          };
          
          const isNut = dimension && (dimension.includes('x0') || dimension.endsWith('x0'));
          const fixSFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
          const porPFamilia = manufacturing.familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
          const familiaToUse = isNut ? porPFamilia : fixSFamilia;
          
          const cost = getFastenerCost(bitola, comprimento, familiaToUse || fastenerFamilia);
          current.totalQuantity += quantity;
          current.totalValue += quantity * cost;
          partsMap.set(sku, current);
        }
      }
    }
    
    return Array.from(partsMap.values()).sort((a,b) => a.name.localeCompare(b.name));
  }, [filteredKits, familias, components, inventory.components, settings]);
  
  const totalAggregatedValue = useMemo(() => {
      return aggregatedParts.reduce((total, part) => total + part.totalValue, 0);
  }, [aggregatedParts]);

  const getTimestamp = () => new Date().toISOString().split('T')[0];
  const getFilename = () => `frota_${selectedBrand.replace(/\s/g, '_')}${selectedModel ? `_${selectedModel.replace(/\s/g, '_')}`: ''}_${getTimestamp()}`;

  const handlePrintTechnicalSheet = async (kit: Kit, detailsOverride?: KitCostDetails) => {
    const details = detailsOverride || kitCostsAndSales.get(kit.id);
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
    const labelSuffix = details.label ? ` (${details.label})` : '';
    const kitNameFull = `${kit.name}${labelSuffix}`;
    
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

        // Add subprocesses if available
        if (item.costBreakdown && item.costBreakdown.length > 0) {
            item.costBreakdown.forEach(step => {
                const timeStr = step.timeSeconds ? `${(step.timeSeconds / 60).toFixed(1)} min` : '-';
                tableBody.push([
                    '',
                    `   > ${step.name}`,
                    timeStr,
                    step.type === 'labor' ? 'Etapa' : 'Insumo',
                    '',
                    '',
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

    savePdfResiliently(doc, `ficha_tecnica_${kit.sku}_${getTimestamp()}.pdf`);
  };

  const handleExportPDF = async () => {
    if (filteredKits.length === 0) return;
    
    const doc = new jsPDF();
    try {
        const logoBase64 = await getLogoBase64ForPdf();
        if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
        }
    } catch (err) { console.error("Logo error:", err); }

    const title = `Relatório de Frota: ${selectedBrand}${selectedModel ? ` - ${selectedModel}` : ''}`;
    let startY = 32;

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    // Summary section
    doc.setFontSize(12);
    doc.text('Resumo da Seleção', 14, startY);
    startY += 8;
    autoTable(doc, {
        body: [
            ['Kits Encontrados', filteredKits.length.toLocaleString('pt-BR')],
            ['Modelos Únicos na Seleção', selectionSummary.uniqueModels.toLocaleString('pt-BR')],
            ['Valor de Custo Total da Frota', formatCurrency(selectionSummary.totalCostValue)],
            ['Valor de Venda Total da Frota', formatCurrency(selectionSummary.totalSaleValue)],
            ['Tipos de Peças Agregadas', aggregatedParts.length.toLocaleString('pt-BR')],
            ['Valor Total das Peças Agregadas', formatCurrency(totalAggregatedValue)],
        ],
        startY: startY,
        theme: 'plain',
    });
    startY = (doc as any).lastAutoTable.finalY + 10;
    
    // Kits Table
    doc.setFontSize(12);
    doc.text('Kits Detalhados', 14, startY);
    startY += 8;
    autoTable(doc, {
        head: [['Nome do Kit / Módulo', 'Modelo', 'Ano', 'SKU', 'Custo do Kit', 'Preço de Venda']],
        body: filteredKits.map(kit => [
            kit.name,
            kit.modelo,
            kit.ano,
            kit.sku,
            formatCurrency(kitCostsAndSales.get(kit.id)?.totalCost || 0),
            // FIX: Added optional chaining to prevent 'cannot read properties of undefined' errors when accessing nested 'saleDetails' properties.
            formatCurrency(kitCostsAndSales.get(kit.id)?.saleDetails?.sellingPrice || 0),
        ]),
        startY: startY,
        theme: 'grid',
        headStyles: { fillColor: [0, 43, 138] },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;
    
    // Aggregated Parts Table
    if (aggregatedParts.length > 0) {
        doc.setFontSize(12);
        doc.text('Peças Agregadas', 14, startY);
        startY += 8;
        autoTable(doc, {
          head: [['Peça Agregada', 'SKU/Tipo', 'Qtd. Total', 'Valor Total']],
          body: aggregatedParts.map(p => [
              p.name,
              p.sku,
              p.totalQuantity.toLocaleString('pt-BR'),
              formatCurrency(p.totalValue),
          ]),
          startY: startY,
          theme: 'grid',
          headStyles: { fillColor: [0, 43, 138] },
        });
    }

    savePdfResiliently(doc, `${getFilename()}.pdf`);
  };

  const handleExportExcel = () => {
    if (filteredKits.length === 0) return;
    
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      { 'Métrica': 'Marca Selecionada', 'Valor': selectedBrand },
      { 'Métrica': 'Modelo Selecionado', 'Valor': selectedModel || 'Todos' },
      {},
      { 'Métrica': 'Resumo dos Kits', 'Valor': '' },
      { 'Métrica': 'Kits Encontrados', 'Valor': filteredKits.length },
      { 'Métrica': 'Modelos Únicos na Seleção', 'Valor': selectionSummary.uniqueModels },
      { 'Métrica': 'Valor de Custo Total dos Kits (R$)', 'Valor': selectionSummary.totalCostValue },
      { 'Métrica': 'Valor de Venda Total dos Kits (R$)', 'Valor': selectionSummary.totalSaleValue },
      {},
      { 'Métrica': 'Resumo das Peças Agregadas', 'Valor': '' },
      { 'Métrica': 'Tipos de Peças Únicas', 'Valor': aggregatedParts.length },
      { 'Métrica': 'Total de Unidades de Peças', 'Valor': aggregatedParts.reduce((t, p) => t + p.totalQuantity, 0) },
      { 'Métrica': 'Valor Total das Peças (R$)', 'Valor': totalAggregatedValue },
    ];
    const summaryWS = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
    summaryWS['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Resumo da Frota');

    // Detailed Kits Sheet
    const kitsData = filteredKits.map(k => ({
        'Nome do Kit': k.name,
        'Modelo': k.modelo,
        'Ano': k.ano,
        'SKU': k.sku,
        'Custo (R$)': kitCostsAndSales.get(k.id)?.totalCost || 0,
        // FIX: Added optional chaining to prevent 'cannot read properties of undefined' errors when accessing nested 'saleDetails' properties.
        'Preço Venda (R$)': kitCostsAndSales.get(k.id)?.saleDetails?.sellingPrice || 0
    }));
    const kitsWS = XLSX.utils.json_to_sheet(kitsData);
    XLSX.utils.book_append_sheet(wb, kitsWS, 'Kits Detalhados');
    
    // Aggregated Parts Sheet
    if (aggregatedParts.length > 0) {
        const partsData = aggregatedParts.map(p => ({
            'Peça Necessária': p.name,
            'SKU/Tipo': p.sku,
            'Quantidade Total': p.totalQuantity,
            'Valor Total (R$)': p.totalValue
        }));
        const partsWS = XLSX.utils.json_to_sheet(partsData);
        XLSX.utils.book_append_sheet(wb, partsWS, 'Peças Agregadas');
    }

    XLSX.writeFile(wb, `${getFilename()}.xlsx`);
  };

  const handleDetailedExportExcel = () => {
    if (filteredKits.length === 0) return;
    
    const dataToExport: any[] = [];
    
    filteredKits.forEach(k => {
        const details = kitCostsAndSales.get(k.id);
        if (!details) return;

        const variants = [{ label: 'Padrão', details: details }];
        if (details.options) {
            Object.entries(details.options).forEach(([key, opt]) => {
                variants.push({ label: opt.label, details: opt as any });
            });
        }

        variants.forEach(v => {
            v.details.breakdown.forEach((item: any) => {
                const laborCosts = (item.costBreakdown || [])
                    .filter((s: any) => s.type === 'labor')
                    .reduce((sum: number, s: any) => sum + s.cost, 0);
                
                const consumableCosts = (item.costBreakdown || [])
                    .filter((s: any) => s.type === 'consumable')
                    .reduce((sum: number, s: any) => sum + s.cost, 0);

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
                    'Preço Venda sugerido Kit (R$)': v.details.saleDetails.sellingPrice,
                    'Status': 'V1.0 PRODUCTION'
                });
            });
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estrutura Completa Engenharia');
    
    const wscols = [
        {wch: 35}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, 
        {wch: 10}, {wch: 15}, {wch: 35}, {wch: 15}, {wch: 12}, 
        {wch: 25}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20},
        {wch: 25}, {wch: 20}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `estrutura_engenharia_frota_${Date.now()}.xlsx`);
  };

  const totalContributionMargin = selectionSummary.totalSaleValue - selectionSummary.totalCostValue;

  // --- Quote Logic ---
  const handleAddToQuote = (kit: Kit) => {
    setQuoteItems(prev => {
        // FIX: Add explicit type to new Map to preserve types.
        const newMap = new Map<string, QuoteItem>(prev);
        const existing = newMap.get(kit.id);
        if (existing) {
            // FIX: Added explicit type annotation to resolve 'unknown' type error.
            newMap.set(kit.id, { ...existing, quantity: existing.quantity + 1 });
        } else {
            newMap.set(kit.id, { kit, quantity: 1 });
        }
        return newMap;
    });
  };
  
  const handleUpdateQuoteQuantity = (kitId: string, newQuantity: number) => {
      setQuoteItems(prev => {
          // FIX: Add explicit type to new Map to preserve types.
          const newMap = new Map<string, QuoteItem>(prev);
          const existing = newMap.get(kitId);
          if (existing) {
              if (newQuantity > 0) {
                  // FIX: Spread types may only be created from object types.
                  newMap.set(kitId, { ...existing, quantity: newQuantity });
              } else {
                  newMap.delete(kitId);
              }
          }
          return newMap;
      });
  };

  const handleClearQuote = () => setQuoteItems(new Map());

  const quoteTotal = useMemo(() => {
    let total = 0;
    // FIX: Explicitly typed callback parameter for forEach to resolve 'unknown' type error.
    quoteItems.forEach((item: QuoteItem) => {
        const details = kitCostsAndSales.get(item.kit.id);
        // FIX: Added optional chaining to prevent 'cannot read properties of undefined' errors when accessing nested 'saleDetails' properties.
        total += (details?.saleDetails?.sellingPrice || 0) * item.quantity;
    });
    return total;
  }, [quoteItems, kitCostsAndSales]);
  
  const handleGenerateQuotePDF = async () => {
    if (quoteItems.size === 0) return;
    
    const doc = new jsPDF();
    try {
        const logoBase64 = await getLogoBase64ForPdf();
        if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', 14, 12, 40, 10);
        }
    } catch (err) { console.error("Logo error:", err); }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AUTRO', 14, 22);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Orçamento', 200, 22, { align: 'right' });
    
    doc.line(14, 25, 200, 25);

    doc.setFontSize(10);
    doc.text('Cliente:', 14, 40);
    doc.text('_________________________', 30, 40);
    doc.text('Data:', 14, 50);
    doc.text(new Date().toLocaleDateString('pt-BR'), 30, 50);

    // FIX: Explicitly typed callback parameter for map to resolve 'unknown' type error.
    const tableData = Array.from(quoteItems.values()).map((item: QuoteItem) => {
        const details = kitCostsAndSales.get(item.kit.id);
        // FIX: Added optional chaining to prevent 'cannot read properties of undefined' errors when accessing nested 'saleDetails' properties.
        const unitPrice = details?.saleDetails?.sellingPrice || 0;
        return [
            item.quantity,
            `${item.kit.name} (SKU: ${item.kit.sku})`,
            formatCurrency(unitPrice),
            formatCurrency(unitPrice * item.quantity)
        ];
    });

    autoTable(doc, {
        startY: 60,
        head: [['Qtd', 'Descrição', 'Preço Unit.', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 43, 138] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Valor Total:', 140, finalY + 15, { align: 'right' });
    doc.text(formatCurrency(quoteTotal), 200, finalY + 15, { align: 'right' });

    doc.setFontSize(8);
    doc.text('Orçamento válido por 15 dias.', 14, 280);
    doc.text('AUTRO - Soluções em Autopeças', 200, 280, { align: 'right' });

    savePdfResiliently(doc, `orcamento_autro_${getTimestamp()}.pdf`);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-black mb-6">Kits por Frota</h2>
      <Card className="mb-8">
          <h3 className="text-lg font-semibold text-black mb-4">Filtrar Frota</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select id="brand-select" label="Marca do Veículo" value={selectedBrand} onChange={handleBrandChange}>
                <option value="">Selecione uma marca...</option>
                {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                ))}
            </Select>
             <Select id="model-select" label="Modelo do Veículo" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={!selectedBrand}>
                <option value="">Todos os modelos...</option>
                {filterOptions.models.map(model => (
                    <option key={model} value={model}>{model}</option>
                ))}
            </Select>
          </div>
      </Card>
      
       <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button onClick={() => setActiveTab('analysis')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analysis' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            Análise de Frota
          </button>
          <button onClick={() => setActiveTab('catalog')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'catalog' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            Catálogo e Orçamento
          </button>
        </nav>
      </div>

      {!selectedBrand ? (
          <div className="text-center text-gray-500 py-16 px-6 border-2 border-dashed rounded-lg bg-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <h3 className="mt-2 text-lg font-medium text-black">Selecione uma Frota</h3>
              <p className="mt-1 text-sm">Escolha uma marca no filtro acima para começar.</p>
          </div>
      ) : activeTab === 'analysis' ? (
        <div className="space-y-8">
            <Card>
                <h3 className="text-xl font-semibold text-black mb-4">Resumo da Frota: <span className="text-autro-blue">{selectedBrand}{selectedModel && ` - ${selectedModel}`}</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Kits Encontrados" value={filteredKits.length.toLocaleString('pt-BR')} description="Total de kits que correspondem aos filtros." />
                    {canViewCosts && <StatCard title="Custo Total da Frota" value={formatCurrency(selectionSummary.totalCostValue)} description="Soma dos custos de todos os kits." />}
                    <StatCard title="Valor de Venda da Frota" value={formatCurrency(selectionSummary.totalSaleValue)} description="Receita potencial de todos os kits." />
                    {canViewCosts && <StatCard title="Margem de Contribuição" value={formatCurrency(totalContributionMargin)} description="Valor de Venda - Custo Total." />}
                </div>
            </Card>
            <Card>
                <h3 className="text-xl font-semibold text-black mb-4">Detalhes dos Kits Encontrados</h3>
                {filteredKits.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome do Kit / Módulo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modelo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ano</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                    {canViewCosts && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo do Kit</th>}
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço de Venda</th>
                                    {canViewCosts && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">M. Contribuição</th>}
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ficha</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredKits.map((kit, index) => {
                                    const details = kitCostsAndSales.get(kit.id);
                                    return (
                                        <tr key={`${kit.id}-${index}`} className="group transition-colors duration-200 hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{kit.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.modelo}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.ano}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.sku}</td>
                                            {canViewCosts && <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-black">{formatCurrency(details?.totalCost || 0)}</td>}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-autro-blue">{formatCurrency(details?.saleDetails?.sellingPrice || 0)}</td>
                                            {canViewCosts && (
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                                                    {formatCurrency(details?.saleDetails?.contributionMargin || 0)}
                                                    <span className="text-xs text-gray-500 ml-1">({(details?.saleDetails?.contributionMarginPercentage || 0).toFixed(1)}%)</span>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button 
                                                    onClick={() => handlePrintTechnicalSheet(kit)}
                                                    className="text-autro-blue hover:text-blue-800 transition-colors"
                                                    title="Imprimir Ficha Técnica"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : ( <div className="text-center text-gray-500 py-8"><p>Nenhum kit corresponde aos filtros selecionados.</p></div> )}
            </Card>
            <Card>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                  <h3 className="text-xl font-semibold text-black">Lista Agregada de Peças (para toda a frota selecionada)</h3>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button onClick={() => setIsEmailModalOpen(true)} variant="secondary" disabled={aggregatedParts.length === 0} className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                        Email
                    </Button>
                    <Button onClick={handleExportPDF} variant="secondary" disabled={aggregatedParts.length === 0}>PDF</Button>
                    <Button onClick={handleExportExcel} variant="secondary" disabled={aggregatedParts.length === 0}>Excel</Button>
                    <Button onClick={handleDetailedExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={filteredKits.length === 0}>Planilha de Custos</Button>
                  </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCard title="Tipos de Peças" value={aggregatedParts.length.toLocaleString('pt-BR')} description="Número de SKUs/tipos de peças únicos necessários." />
                    <StatCard title="Total de Unidades" value={aggregatedParts.reduce((t, p) => t + p.totalQuantity, 0).toLocaleString('pt-BR')} description="Soma de todas as unidades de peças necessárias." />
                    {canViewCosts && <StatCard title="Valor Total Agregado" value={formatCurrency(totalAggregatedValue)} description="Custo total estimado para todas as peças." />}
                </div>
                {aggregatedParts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peça Necessária</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU/Tipo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd. Total</th>
                                    {canViewCosts && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {aggregatedParts.map(({ name, sku, totalQuantity, totalValue }, index) => (
                                    <tr key={`${sku}-${index}`} className="group transition-colors duration-200 hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sku}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-autro-blue">{totalQuantity.toLocaleString('pt-BR')}</td>
                                        {canViewCosts && <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-black">{formatCurrency(totalValue)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : ( <div className="text-center text-gray-500 py-8 border-2 border-dashed rounded-lg"><p>Nenhuma peça encontrada para esta combinação de marca e modelo.</p></div> )}
            </Card>
        </div>
      ) : ( // Catalog Tab
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xl font-semibold text-black">Catálogo de Kits para {selectedBrand} {selectedModel}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
                    {filteredKits.map((kit, index) => {
                        const details = kitCostsAndSales.get(kit.id);
                        if (!details) return null;
                        return (
                            <CatalogKitCard 
                                key={`${kit.id}-${index}`}
                                kit={kit}
                                costDetails={details}
                                canViewCosts={canViewCosts}
                                onAddToQuote={handleAddToQuote}
                                onShowDetails={(data) => setSaleDetailsModalData(data)}
                                onPrint={handlePrintTechnicalSheet}
                            />
                        )
                    })}
                </div>
            </div>
            <div className="lg:col-span-1">
                 <Card className="sticky top-24">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-black">Orçamento</h3>
                        <Button onClick={handleClearQuote} variant="danger" size="sm" disabled={quoteItems.size === 0}>Limpar</Button>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                        {Array.from(quoteItems.values()).map((item: QuoteItem, index) => {
                            const details = kitCostsAndSales.get(item.kit.id);
                            return (
                                <div key={`${item.kit.id}-${index}`} className="p-2 border rounded-md">
                                    <p className="font-semibold text-sm">{item.kit.name}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <Input type="number" value={item.quantity} onChange={(e) => handleUpdateQuoteQuantity(item.kit.id, parseInt(e.target.value) || 0)} className="w-20 h-8 text-sm" min="0" />
                                        <p className="text-sm font-semibold">{formatCurrency((details?.saleDetails?.sellingPrice || 0) * item.quantity)}</p>
                                    </div>
                                </div>
                            )
                        })}
                        {quoteItems.size === 0 && <p className="text-center text-sm text-gray-500 py-4">Nenhum item no orçamento.</p>}
                    </div>
                     <div className="mt-4 pt-4 border-t">
                        <p className="flex justify-between text-lg font-bold"><span>Total:</span><span>{formatCurrency(quoteTotal)}</span></p>
                        <Button onClick={handleGenerateQuotePDF} disabled={quoteItems.size === 0} className="w-full mt-4">Gerar PDF do Orçamento</Button>
                    </div>
                </Card>
            </div>
          </div>
      )}

      {isEmailModalOpen && (
        <EmailReportModal
            isOpen={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            selectionSummary={{ selectedBrand, selectedModel, totalValue: selectionSummary.totalCostValue, uniqueModels: selectionSummary.uniqueModels}}
            aggregatedParts={aggregatedParts}
            totalAggregatedValue={totalAggregatedValue}
        />
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
                    saleDetails: saleDetailsModalData.saleDetails || {} as any,
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