import { useMemo, useCallback, useRef } from 'react';
import { Kit, Component, KitCostDetails, KitCostBreakdownItem, SaleDetails } from '../types';
import { useInventory } from './useInventory';
import { useManufacturing } from './useManufacturing';
import { useFinancials } from '../contexts/FinancialsContext';
import { evaluateProcess, getComponentCost, calculateKitCosts } from './manufacturing-evaluator';

export const useKitPricing = () => {
    const { components, kits, findComponentBySku } = useInventory();
    const manufacturing = useManufacturing();
    const { calculateSaleDetails, settings } = useFinancials();
    
    const kitCostCache = useRef(new Map<string, number>());

    const getKitPrice = useCallback((kitId: string): number => {
        const kit = kits.find(k => k.id === kitId);
        if (!kit) return 0;

        const cacheKey = `${kitId}-${settings?.preferredFastenerFamiliaId}-${kit.selectedFamiliaId || ''}-${kit.selectedNutFamiliaId || ''}-${kit.sellingPriceOverride || 0}-${kit.pricingStrategy || ''}`;
        
        if (kitCostCache.current.has(cacheKey)) {
            const totalCost = kitCostCache.current.get(cacheKey)!;
            const saleDetails = calculateSaleDetails(totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
            return saleDetails.sellingPrice;
        }

        const details = calculateKitCosts(
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

        kitCostCache.current.set(cacheKey, details.totalCost);
        
        const saleDetails = calculateSaleDetails(details.totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
        return saleDetails.sellingPrice;
    }, [kits, components, manufacturing, settings, calculateSaleDetails]);

    return { getKitPrice };
};
