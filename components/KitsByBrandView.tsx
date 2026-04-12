import React, { useState, useMemo } from 'react';
// FIX: Import KitComponent to resolve type errors.
import { InventoryHook, Kit, ManufacturingHook, AggregatedPart, SaleDetails, QuoteItem, KitComponent, Component, KitCostDetails, KitCostBreakdownItem } from '../types';
import { Card } from './ui/Card';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { EmailReportModal } from './ui/EmailReportModal';
import { SaleDetailsModal } from './ui/SaleDetailsModal';
import { useFinancials } from '../contexts/FinancialsContext';
import { Input } from './ui/Input';

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

export const KitsByBrandView: React.FC<KitsByBrandViewProps> = ({ inventory, manufacturing }) => {
  const { kits, components } = inventory;
  const { familias } = manufacturing;
  const { calculateSaleDetails, settings } = useFinancials();

  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'catalog'>('analysis');
  const [quoteItems, setQuoteItems] = useState<Map<string, QuoteItem>>(new Map());
  const [saleDetailsModalData, setSaleDetailsModalData] = useState<{ kitName: string; cost: number; materialCost?: number; fabricationCost?: number; saleDetails?: SaleDetails; breakdown?: KitCostBreakdownItem[] } | null>(null);


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
    const costMap = new Map<string, KitCostDetails>();
    const fastenerFamilia = familias.find(f => f.id === 'fam-fixadores');
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
          const cost = result.custoMateriaPrima + result.custoFabricacao;
          cache.set(dimension, cost);
          return cost;
      }
      return 0;
    };

    for (const kit of (kits || [])) {
      let baseTotalCost = 0;
      let baseMaterialCost = 0;
      let baseFabricationCost = 0;
      const breakdown: KitCostBreakdownItem[] = [];
      
      (kit.components || []).forEach((kc: KitComponent) => {
        const component = kc.componentSku ? componentSkuMap.get(kc.componentSku.toUpperCase()) : undefined;
        if (component) {
          const unitCost = getComponentCost(component);
          const itemTotalCost = unitCost * kc.quantity;
          
          let materialCost = 0;
          let fabricationCost = 0;
          
          if (component.type === 'raw_material' || component.sourcing === 'purchased') {
            materialCost = itemTotalCost;
          } else {
            materialCost = (component.custoMateriaPrima || 0) * kc.quantity;
            fabricationCost = (component.custoFabricacao || 0) * kc.quantity;
          }
          
          baseMaterialCost += materialCost;
          baseFabricationCost += fabricationCost;
          baseTotalCost += itemTotalCost;
          
          breakdown.push({
            name: component.name, sku: component.sku, quantity: kc.quantity,
            unitCost: unitCost, totalCost: itemTotalCost, type: 'Componente'
          });
        }
      });

      let defaultTotalCost = baseTotalCost;
      let defaultMaterialCost = baseMaterialCost;
      let defaultFabricationCost = baseFabricationCost;
      const defaultBreakdown = [...breakdown];
      if (kit.requiredFasteners && Array.isArray(kit.requiredFasteners)) {
        kit.requiredFasteners.forEach(rf => {
          if (!rf.dimension) return;
          const isNut = rf.dimension.includes('x0') || rf.dimension.endsWith('x0');
          let familiaToUse = isNut ? porPFamilia : fixSFamilia;
          
          if (kit.selectedFamiliaId) {
              const selectedFamilia = manufacturing.familias.find(f => f.id === kit.selectedFamiliaId);
              if (selectedFamilia) {
                  const isSelectedFamiliaNut = selectedFamilia.nome?.toLowerCase().includes('por-p') || selectedFamilia.nome?.toLowerCase().includes('por p');
                  if (isNut && isSelectedFamiliaNut) {
                      familiaToUse = selectedFamilia;
                  } else if (!isNut && !isSelectedFamiliaNut) {
                      familiaToUse = selectedFamilia;
                  }
              }
          }

          const unitCost = getFastenerCostForFamily(rf.dimension, familiaToUse || fastenerFamilia, fastenerCostCache);
          const itemTotalCost = unitCost * rf.quantity;
          defaultTotalCost += itemTotalCost;
          defaultMaterialCost += itemTotalCost; // Fasteners are material cost
          defaultBreakdown.push({
            name: isNut ? `Porca M${rf.dimension.split('x')[0]}` : `Fixador ${rf.dimension}`, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
            unitCost, totalCost: itemTotalCost, type: 'Fixador'
          });
        });
      }

      let currentKeyName = undefined;

      const saleDetails = calculateSaleDetails(defaultTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });

      const options: KitCostDetails['options'] = {};
      
      const fasteners = kit.requiredFasteners || [];
      const hasNuts = fasteners.some(rf => {
          const parts = rf.dimension.split('x');
          return parts.length > 1 && parseInt(parts[1]) === 0;
      });
      const hasScrews = fasteners.some(rf => {
          const parts = rf.dimension.split('x');
          return parts.length > 1 && parseInt(parts[1]) > 0;
      });

      if (fixSFamilia && hasScrews) {
        let fixSTotalCost = baseTotalCost;
        let fixSMaterialCost = baseMaterialCost;
        const fixSBreakdown = [...breakdown];
        kit.requiredFasteners?.forEach(rf => {
          const unitCost = getFastenerCostForFamily(rf.dimension, fixSFamilia, fixSCostCache);
          const itemTotalCost = unitCost * rf.quantity;
          fixSTotalCost += itemTotalCost;
          fixSMaterialCost += itemTotalCost;
          fixSBreakdown.push({
            name: `Fixador ${rf.dimension}`, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
            unitCost, totalCost: itemTotalCost, type: 'Fixador'
          });
        });
        options.fixS = {
          totalCost: fixSTotalCost,
          materialCost: fixSMaterialCost,
          fabricationCost: baseFabricationCost,
          saleDetails: calculateSaleDetails(fixSTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy }),
          breakdown: fixSBreakdown
        };
      }

      if (fixPFamilia && hasScrews) {
        let fixPTotalCost = baseTotalCost;
        let fixPMaterialCost = baseMaterialCost;
        const fixPBreakdown = [...breakdown];
        kit.requiredFasteners?.forEach(rf => {
          const unitCost = getFastenerCostForFamily(rf.dimension, fixPFamilia, fixPCostCache);
          const itemTotalCost = unitCost * rf.quantity;
          fixPTotalCost += itemTotalCost;
          fixPMaterialCost += itemTotalCost;
          fixPBreakdown.push({
            name: `Fixador ${rf.dimension}`, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
            unitCost, totalCost: itemTotalCost, type: 'Fixador'
          });
        });
        options.fixP = {
          totalCost: fixPTotalCost,
          materialCost: fixPMaterialCost,
          fabricationCost: baseFabricationCost,
          saleDetails: calculateSaleDetails(fixPTotalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy }),
          breakdown: fixPBreakdown
        };
      }

      costMap.set(kit.id, { 
        totalCost: defaultTotalCost, 
        materialCost: defaultMaterialCost, 
        fabricationCost: defaultFabricationCost, 
        breakdown: defaultBreakdown, 
        saleDetails,
        keyName: currentKeyName,
        options
      });
    }
    return costMap;
  }, [kits, familias, components, inventory.components, calculateSaleDetails, manufacturing.familias]);
  
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
          
          const isNut = dimension.includes('x0') || dimension.endsWith('x0');
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

  const handleExportPDF = () => {
    if (filteredKits.length === 0) return;
    
    const doc = new jsPDF();
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
            formatCurrency(kitCostsAndSales.get(kit.id)?.cost || 0),
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

    doc.save(`${getFilename()}.pdf`);
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
        'Custo (R$)': kitCostsAndSales.get(k.id)?.cost || 0,
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
  
  const handleGenerateQuotePDF = () => {
    if (quoteItems.size === 0) return;
    
    const doc = new jsPDF();
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

    doc.save(`orcamento_autro_${getTimestamp()}.pdf`);
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
                    <StatCard title="Custo Total da Frota" value={formatCurrency(selectionSummary.totalCostValue)} description="Soma dos custos de todos os kits." />
                    <StatCard title="Valor de Venda da Frota" value={formatCurrency(selectionSummary.totalSaleValue)} description="Receita potencial de todos os kits." />
                    <StatCard title="Margem de Contribuição" value={formatCurrency(totalContributionMargin)} description="Valor de Venda - Custo Total." />
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
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo do Kit</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço de Venda</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">M. Contribuição</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredKits.map(kit => {
                                    const details = kitCostsAndSales.get(kit.id);
                                    return (
                                        <tr key={kit.id} className="group transition-colors duration-200 hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{kit.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.modelo}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.ano}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kit.sku}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-black">{formatCurrency(details?.totalCost || 0)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-autro-blue">{formatCurrency(details?.saleDetails?.sellingPrice || 0)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                                                {formatCurrency(details?.saleDetails?.contributionMargin || 0)}
                                                <span className="text-xs text-gray-500 ml-1">({(details?.saleDetails?.contributionMarginPercentage || 0).toFixed(1)}%)</span>
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
                  </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCard title="Tipos de Peças" value={aggregatedParts.length.toLocaleString('pt-BR')} description="Número de SKUs/tipos de peças únicos necessários." />
                    <StatCard title="Total de Unidades" value={aggregatedParts.reduce((t, p) => t + p.totalQuantity, 0).toLocaleString('pt-BR')} description="Soma de todas as unidades de peças necessárias." />
                    <StatCard title="Valor Total Agregado" value={formatCurrency(totalAggregatedValue)} description="Custo total estimado para todas as peças." />
                </div>
                {aggregatedParts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peça Necessária</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU/Tipo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd. Total</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {aggregatedParts.map(({ name, sku, totalQuantity, totalValue }) => (
                                    <tr key={sku} className="group transition-colors duration-200 hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sku}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-autro-blue">{totalQuantity.toLocaleString('pt-BR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-black">{formatCurrency(totalValue)}</td>
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
                    {filteredKits.map(kit => {
                        const details = kitCostsAndSales.get(kit.id);
                        return (
                            <Card key={kit.id} className="flex flex-col p-0 overflow-hidden group border-none shadow-soft hover:shadow-float transition-all duration-300">
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
                                    <div className="absolute top-3 right-3 bg-autro-primary px-2 py-0.5 rounded text-[10px] font-black text-white shadow-lg uppercase tracking-tighter">
                                        {kit.modelo}
                                    </div>
                                </div>
                                <div className="p-4 flex-grow flex flex-col bg-white">
                                    <h4 className="font-black text-slate-900 text-base mb-1 line-clamp-2 uppercase tracking-tight">{kit.name}</h4>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">SKU: {kit.sku}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{kit.ano}</span>
                                    </div>
                                    
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between items-end p-2 bg-slate-50 rounded-lg border border-slate-100">
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Custo Produção</span>
                                                <span className="font-bold text-slate-700 text-sm">{formatCurrency(details?.totalCost || 0)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Preço Venda</span>
                                                <span className="font-black text-autro-primary text-lg">{formatCurrency(details?.saleDetails?.sellingPrice || 0)}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Margem de Contribuição</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-black text-emerald-600">{formatCurrency(details?.saleDetails?.contributionMargin || 0)}</span>
                                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">{(details?.saleDetails?.contributionMarginPercentage || 0).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        {details?.keyName && (
                                            <div className="flex justify-between items-center px-2 pt-1 border-t border-slate-100">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Chave Associada</span>
                                                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{details.keyName}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <Button 
                                            onClick={() => handleAddToQuote(kit)} 
                                            variant="primary" 
                                            size="sm" 
                                            className="h-10 text-[10px] uppercase font-black tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95"
                                        >
                                            Adicionar
                                        </Button>
                                        <Button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSaleDetailsModalData({ 
                                                    kitName: kit.name, 
                                                    cost: details?.totalCost || 0, 
                                                    materialCost: details?.materialCost,
                                                    fabricationCost: details?.fabricationCost,
                                                    saleDetails: details?.saleDetails, 
                                                    breakdown: details?.breakdown 
                                                });
                                            }}
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-10 text-[10px] uppercase font-black tracking-widest border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Detalhes
                                        </Button>
                                    </div>
                                </div>
                            </Card>
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
                        {Array.from(quoteItems.values()).map((item: QuoteItem) => {
                            const details = kitCostsAndSales.get(item.kit.id);
                            return (
                                <div key={item.kit.id} className="p-2 border rounded-md">
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
      {saleDetailsModalData && <SaleDetailsModal isOpen={!!saleDetailsModalData} onClose={() => setSaleDetailsModalData(null)} {...saleDetailsModalData} />}
    </div>
  );
};