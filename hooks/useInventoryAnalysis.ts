
import { useMemo, useState, useEffect } from 'react';
import { InventoryAnalysisHook, InventoryHook, ProductionOrdersHook, ManufacturingHook, ABCAnalysisItem, ReorderPointItem, KitDemandForecastItem, PlanningAnalysis, ProductionRecommendation, PurchaseRecommendation, Component, MaterialRequirementItem } from '../types';
import { evaluateProcess, parseFastenerSku } from './manufacturing-evaluator';

interface UseInventoryAnalysisProps {
    inventory: InventoryHook;
    productionOrdersHook: ProductionOrdersHook;
    manufacturing: ManufacturingHook;
    startDate: string;
    endDate: string;
}

export const useInventoryAnalysis = ({
    inventory,
    productionOrdersHook,
    manufacturing,
    startDate,
    endDate
}: UseInventoryAnalysisProps): InventoryAnalysisHook & { isLoading: boolean } => {
    
    const { components, kits, inventoryLogs, findComponentBySku, findKitById, findComponentById } = inventory;
    const { productionOrders } = productionOrdersHook;
    const { familias, analyzeManufacturingRun, getAllUniqueHeadCodes } = manufacturing;
    const [isLoading, setIsLoading] = useState(true);

    const [analysisData, setAnalysisData] = useState<{
        abcAnalysis: ABCAnalysisItem[];
        kitDemandForecast: KitDemandForecastItem[];
        reorderPointAlerts: ReorderPointItem[];
        planningAnalysis: PlanningAnalysis;
        materialRequirements: MaterialRequirementItem[];
    }>({
        abcAnalysis: [],
        kitDemandForecast: [],
        reorderPointAlerts: [],
        planningAnalysis: { productionPlan: [], purchasePlan: [] },
        materialRequirements: [],
    });

    useEffect(() => {
        setIsLoading(true);

        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); 

        // 1. ABC Analysis
        const consumptionMap = new Map<string, number>();
        const recentLogs = inventoryLogs.filter(log => {
            const logDate = new Date(log.date).getTime();
            return logDate >= startTimestamp && logDate <= endTimestamp && log.type === 'saída';
        });
        
        for (const log of recentLogs) {
            const component = findComponentById(log.componentId);
            if (component) {
                const cost = (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0) || (component.purchaseCost || 0);
                const value = (consumptionMap.get(component.id) || 0) + (log.quantity * cost);
                consumptionMap.set(component.id, value);
            }
        }
        
        let totalConsumptionValue = 0;
        const consumptionList = Array.from(consumptionMap.entries()).map(([componentId, value]) => {
            totalConsumptionValue += value;
            return { componentId, value };
        });

        const sortedConsumption = consumptionList.sort((a, b) => b.value - a.value);

        let cumulativeValue = 0;
        const abcAnalysisResult = sortedConsumption.map(item => {
            const component = findComponentById(item.componentId)!;
            cumulativeValue += item.value;
            const cumulativePercentage = totalConsumptionValue > 0 ? (cumulativeValue / totalConsumptionValue) * 100 : 0;
            
            let classification: 'A' | 'B' | 'C';
            if (cumulativePercentage <= 80) classification = 'A';
            else if (cumulativePercentage <= 95) classification = 'B';
            else classification = 'C';

            return {
                componentId: component.id, name: component.name, sku: component.sku,
                consumptionValue: item.value, cumulativePercentage, classification,
            };
        });

        const abcMap = new Map(abcAnalysisResult.map(i => [i.componentId, i.classification]));

        // 2. Kit Demand Forecast
        const completedProductionOrders = productionOrders.filter(o => o.status === 'concluída');
        const demandMap = new Map<string, number>();
        for (const order of completedProductionOrders) {
            const orderDate = new Date(order.createdAt).getTime();
            if (orderDate < startTimestamp || orderDate > endTimestamp) continue;

            for (const item of order.orderItems) {
                if (item.type !== 'kit') continue;
                demandMap.set(item.id, (demandMap.get(item.id) || 0) + item.quantity);
            }
        }
        
        const kitDemandForecastResult = Array.from(demandMap.entries()).map(([kitId, demand]) => {
            const kit = findKitById(kitId);
            return {
                kitId, name: kit?.name || 'Kit Desconhecido', sku: kit?.sku || 'N/A',
                pastSales: demand,
                forecastNext30Days: demand, // Naive forecast: same as past period
            };
        }).sort((a,b) => b.forecastNext30Days - a.forecastNext30Days);

        // 3. Reorder Point Alerts
        const purchasableItems = components.filter(c => c.sourcing === 'purchased' || c.type === 'raw_material');
        const reorderPointAlertsResult: ReorderPointItem[] = [];
        const daysInRange = Math.max(1, (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24));

        for (const item of purchasableItems) {
            const totalConsumption = recentLogs.filter(log => log.componentId === item.id).reduce((sum, log) => sum + log.quantity, 0);
            const dailyConsumption = totalConsumption / daysInRange;
            
            // Only calc reorder point if we have consumption or lead time
            if (dailyConsumption > 0 && item.leadTimeDays) {
                const safetyStock = dailyConsumption * 7; // 7 days safety
                const reorderPoint = Math.ceil((dailyConsumption * item.leadTimeDays) + safetyStock);

                if (item.stock < reorderPoint) {
                    reorderPointAlertsResult.push({
                        componentId: item.id, name: item.name, sku: item.sku, currentStock: item.stock,
                        reorderPoint, dailyConsumption, suggestedOrderQty: Math.ceil(dailyConsumption * 30)
                    });
                }
            }
        }

        // 4. Planning Analysis (Immediate Needs)
        const productionPlan: Map<string, ProductionRecommendation> = new Map();
        const purchasePlan: Map<string, PurchaseRecommendation> = new Map();
        const aggregatedComponentNeeds: Map<string, number> = new Map();
        const componentSkuMap = new Map(components.map(c => [c.sku, c]));
        const defaultHeadCode = getAllUniqueHeadCodes()[0] || 'A-0002';

        for (const forecast of kitDemandForecastResult) {
            if (forecast.forecastNext30Days <= 0) continue;
            const kit = findKitById(forecast.kitId);
            if (!kit) continue;

            for (const comp of kit.components) {
                aggregatedComponentNeeds.set(comp.componentSku, (aggregatedComponentNeeds.get(comp.componentSku) || 0) + (comp.quantity * forecast.forecastNext30Days));
            }
            for (const fastener of kit.requiredFasteners) {
                const fastenerSku = `FIX-${defaultHeadCode}-${fastener.dimension.replace('mm','')}`;
                aggregatedComponentNeeds.set(fastenerSku, (aggregatedComponentNeeds.get(fastenerSku) || 0) + (fastener.quantity * forecast.forecastNext30Days));
            }
        }

        for (const [sku, requiredQty] of aggregatedComponentNeeds.entries()) {
            const component = componentSkuMap.get(sku) as Component | undefined;
            const inStock = component?.stock || 0;
            if (inStock < requiredQty) {
                const deficit = requiredQty - inStock;
                if (component?.sourcing === 'purchased' || component?.sourcing === 'beneficiado' || component?.type === 'raw_material') {
                     purchasePlan.set(sku, { componentId: component?.id || `virtual-buy-${sku}`, name: component?.name || sku, sku, sourcing: component?.sourcing || 'purchased', required: requiredQty, inStock, toOrder: deficit, abcClass: (component ? abcMap.get(component.id) : 'C') || 'C' });
                } else {
                    const name = component?.name || (sku.startsWith('FIX-') ? `Fixador ${defaultHeadCode} ${sku.split('-')[2]}` : `Componente ${sku}`);
                    productionPlan.set(sku, { componentId: component?.id || `virtual-make-${sku}`, name, sku, required: requiredQty, inStock, toProduce: deficit, abcClass: (component ? abcMap.get(component.id) : 'C') || 'C' });
                }
            }
        }

        // 5. Material Requirements (Forecasted Inputs/Raw Materials)
        const materialRequirementsMap = new Map<string, number>();

        // Iterate through all component needs (Manufactured items generate raw material needs)
        aggregatedComponentNeeds.forEach((requiredQty, sku) => {
            const component = componentSkuMap.get(sku) as Component | undefined;
            
            // If it's a manufactured component (or a virtual fastener), we explode it
            // If it's purchased/raw, it's a direct need.
            
            let needsExplosion = false;
            let familiaId = component?.familiaId;
            let variables: any = {};
            let stringVariables: any = {};

            if (component) {
                if (component.sourcing === 'manufactured' || component.sourcing === 'beneficiado') {
                    needsExplosion = true;
                } else {
                    // Direct requirement (Purchased component used in kit)
                    materialRequirementsMap.set(component.id, (materialRequirementsMap.get(component.id) || 0) + requiredQty);
                }
            } else if (sku.startsWith('FIX-')) {
                 // Virtual fastener
                 needsExplosion = true;
                 familiaId = 'fam-fixadores'; // Assumed
                 const skuInfo = parseFastenerSku(sku);
                 if (skuInfo) {
                     variables = { bitola: skuInfo.bitola, comprimento: skuInfo.comprimento };
                     stringVariables = { headCode: skuInfo.head };
                 }
            } else {
                // Unknown component, assume direct buy virtual
                // We can't map ID easily without the component object, skipping for now or log error
            }

            if (needsExplosion && familiaId) {
                 const familia = familias.find(f => f.id === familiaId);
                 if (familia) {
                     const analysis = evaluateProcess(familia, variables, components, stringVariables, { allFamilias: familias });
                     
                     analysis.nodes.forEach(node => {
                         if ((node.data.type === 'materiaPrima' || node.data.type === 'inventoryComponent') && node.data.cost > 0) {
                             // Determine the ID of the consumed item
                             let consumedId = node.data.type === 'materiaPrima' ? node.data.baseMaterialId : node.data.componentId;
                             
                             // Handle dynamic inputs (e.g. Moedas based on HeadCode)
                             if (node.data.type === 'inventoryComponent' && node.data.componentIdTemplate && stringVariables.headCode) {
                                 const resolvedSku = node.data.componentIdTemplate.replace('{headCode}', stringVariables.headCode);
                                 const resolvedComp = componentSkuMap.get(resolvedSku) as Component | undefined;
                                 if (resolvedComp) consumedId = resolvedComp.id;
                             }
                             
                             if (consumedId) {
                                 const consumptionPerUnit = node.data.consumption || 1;
                                 let totalConsumption = consumptionPerUnit * requiredQty;
                                 
                                 // Adjust units if necessary (e.g., mm to m for bars)
                                 const consumedComp = findComponentById(consumedId);
                                 if (consumedComp && consumedComp.type === 'raw_material' && consumedComp.consumptionUnit === 'm') {
                                     totalConsumption /= 1000;
                                 }

                                 materialRequirementsMap.set(consumedId, (materialRequirementsMap.get(consumedId) || 0) + totalConsumption);
                             }
                         }
                     });
                 }
            }
        });

        // Convert Map to Array for MaterialRequirements
        const materialRequirementsResult: MaterialRequirementItem[] = [];
        materialRequirementsMap.forEach((required, componentId) => {
            const component = findComponentById(componentId);
            if (component) {
                const balance = component.stock - required;
                let status: 'ok' | 'warning' | 'critical' = 'ok';
                if (balance < 0) status = 'critical';
                else if (balance < required * 0.2) status = 'warning'; // Less than 20% buffer

                const coverage = required > 0 ? (component.stock / required) * 100 : 100;

                materialRequirementsResult.push({
                    componentId,
                    name: component.name,
                    sku: component.sku,
                    type: component.type,
                    unit: component.consumptionUnit || 'un',
                    currentStock: component.stock,
                    projectedDemand: required,
                    balance,
                    status,
                    coveragePercent: coverage
                });
            }
        });


        const planningAnalysisResult = {
            productionPlan: Array.from(productionPlan.values()),
            purchasePlan: Array.from(purchasePlan.values()),
        };

        setAnalysisData({
            abcAnalysis: abcAnalysisResult,
            kitDemandForecast: kitDemandForecastResult,
            reorderPointAlerts: reorderPointAlertsResult,
            planningAnalysis: planningAnalysisResult,
            materialRequirements: materialRequirementsResult.sort((a,b) => a.coveragePercent - b.coveragePercent),
        });

        setIsLoading(false);

    }, [inventory, productionOrdersHook, manufacturing, startDate, endDate]);


    return {
        isLoading,
        ...analysisData
    };
};
