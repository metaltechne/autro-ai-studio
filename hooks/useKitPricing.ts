import { useMemo, useCallback, useRef } from 'react';
import { Kit, Component, KitCostDetails, KitCostBreakdownItem, SaleDetails } from '../types';
import { useInventory } from './useInventory';
import { useManufacturing } from './useManufacturing';
import { useFinancials } from '../contexts/FinancialsContext';
import { evaluateProcess, getComponentCost } from './manufacturing-evaluator';

export const useKitPricing = () => {
    const { components, kits, findComponentBySku } = useInventory();
    const { familias } = useManufacturing();
    const { calculateSaleDetails, settings } = useFinancials();
    
    const fastenerCostCache = useRef(new Map<string, number>());

    const getKitPrice = useCallback((kitId: string): number => {
        const kit = kits.find(k => k.id === kitId);
        if (!kit) return 0;

        const preferredId = settings?.preferredFastenerFamiliaId || 'fam-fixadores';
        let fastenerFamilia = familias.find(f => f.id === preferredId);
        if (!fastenerFamilia) {
            fastenerFamilia = familias.find(f => (f.nome || '').toLowerCase().includes('fixador'));
        }
        let totalCost = 0;
        
        (kit.components || []).forEach(kc => {
            const component = findComponentBySku(kc.componentSku);
            if (component) {
                totalCost += getComponentCost(component) * kc.quantity;
            }
        });
        
        if (kit.requiredFasteners && fastenerFamilia) {
            (kit.requiredFasteners || []).forEach(rf => {
                const cleanDim = rf.dimension.toLowerCase().replace(/mm/g, '').replace(/m/g, '').replace(/\s+/g, '');
                const cacheKey = `${cleanDim}-${fastenerFamilia?.id}`;
                
                if (fastenerCostCache.current.has(cacheKey)) {
                    totalCost += fastenerCostCache.current.get(cacheKey)! * rf.quantity;
                } else {
                    const [bitolaStr, compStr] = cleanDim.split('x');
                    const bitola = Number(bitolaStr);
                    const comprimento = Number(compStr || 0);
                    
                    if (!isNaN(bitola)) {
                        const isNut = rf.dimension.includes('x0') || rf.dimension.endsWith('x0');
                        const fixSFamilia = familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
                        const porPFamilia = familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
                        const familiaToUse = isNut ? porPFamilia : fixSFamilia;
                        const result = evaluateProcess(familiaToUse || fastenerFamilia, { bitola, comprimento }, components, {}, { allFamilias: familias });
                        const fastenerCost = result.custoFabricacao + result.custoMateriaPrima;
                        fastenerCostCache.current.set(cacheKey, fastenerCost);
                        totalCost += fastenerCost * rf.quantity;
                    }
                }
            });
        }
        
        const saleDetails = calculateSaleDetails(totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
        return saleDetails.sellingPrice;
    }, [kits, components, familias, settings, calculateSaleDetails, findComponentBySku]);

    return { getKitPrice };
};
