
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    InventoryHook,
    ManufacturingHook,
    ProductionOrdersHook,
    ManufacturingOrdersHook,
    CuttingOrdersHook,
    PurchaseOrdersHook,
    Component,
    FamiliaComponente,
    PurchaseRecommendation,
    ProductionRecommendation,
    CuttingRecommendation,
    PurchasePlannerHook,
    RawMaterialForecastItem,
} from '../types';
// Fix: Import getComponentCost and parseFastenerSku from shared evaluator.
import { evaluateProcess, calculateMaterialCost, getComponentCost, parseFastenerSku } from './manufacturing-evaluator';

export const usePurchasePlanner = (
    inventory: InventoryHook,
    manufacturing: ManufacturingHook,
    productionOrdersHook: ProductionOrdersHook,
    manufacturingOrdersHook: ManufacturingOrdersHook,
    purchaseOrdersHook: PurchaseOrdersHook,
    cuttingOrdersHook: CuttingOrdersHook
): PurchasePlannerHook => {

    const { components, findComponentById, inventoryLogs } = inventory;
    const { familias } = manufacturing;
    const { productionOrders } = productionOrdersHook;
    const { manufacturingOrders } = manufacturingOrdersHook;

    const [isLoading, setIsLoading] = useState(true);
    const [plannerData, setPlannerData] = useState<{
        cuttingRecommendations: CuttingRecommendation[];
        productionPlan: ProductionRecommendation[];
        purchasePlan: PurchaseRecommendation[];
        rawMaterialForecast: RawMaterialForecastItem[];
    }>({ cuttingRecommendations: [], productionPlan: [], purchasePlan: [], rawMaterialForecast: [] });


    // 1. ABC Analysis calculation
    const abcAnalysisData = useMemo((): Map<string, 'A' | 'B' | 'C'> => {
        const consumptionMap = new Map<string, number>();
        inventoryLogs.forEach(log => {
            if (log.type === 'saída') {
                const component = findComponentById(log.componentId);
                if (component) {
                    const cost = getComponentCost(component);
                    const value = (consumptionMap.get(log.componentId) || 0) + (log.quantity * cost);
                    consumptionMap.set(log.componentId, value);
                }
            }
        });

        let totalConsumptionValue = 0;
        const consumptionList = Array.from(consumptionMap.entries()).map(([componentId, value]) => {
            totalConsumptionValue += value;
            return { componentId, value };
        });

        const sortedConsumption = consumptionList.sort((a, b) => b.value - a.value);

        const abcMap = new Map<string, 'A' | 'B' | 'C'>();
        let cumulativeValue = 0;
        sortedConsumption.forEach(item => {
            cumulativeValue += item.value;
            const cumulativePercentage = totalConsumptionValue > 0 ? (cumulativeValue / totalConsumptionValue) * 100 : 0;
            
            let classification: 'A' | 'B' | 'C' = 'C';
            if (cumulativePercentage <= 80) classification = 'A';
            else if (cumulativePercentage <= 95) classification = 'B';
            
            abcMap.set(item.componentId, classification);
        });

        return abcMap;
    }, [inventoryLogs, findComponentById]);

    const cuttingCost = useMemo(() => {
        const cuttingFamilia = familias.find(f => f.id === 'fam-corte-fixador');
        if (!cuttingFamilia) return Infinity; // A high cost if process doesn't exist
        const result = evaluateProcess(cuttingFamilia, {}, components, {}, { allFamilias: familias });
        return result.custoFabricacao + result.custoMateriaPrima;
    }, [familias, components]);


    useEffect(() => {
        // This effect recalculates the entire plan when dependencies change.
        
        // --- Step 1: Aggregate all demands ---
        const demand = new Map<string, number>(); // componentId -> quantity
        const componentMap = new Map(components.map(c => [c.id, c]));
        const componentSkuMap = new Map(components.map(c => [c.sku, c]));

        // From Production Orders (Kits)
        productionOrders.filter(o => o.status === 'pendente' || o.status === 'em_montagem').forEach(order => {
            order.selectedScenario.detailedRequirements.forEach(req => {
                demand.set(req.componentId, (demand.get(req.componentId) || 0) + req.required);
            });
        });

        // From Manufacturing Orders (Components)
        manufacturingOrders.filter(o => o.status === 'pendente' || o.status === 'em_producao').forEach(order => {
            order.analysis.requirements.forEach(req => {
                if (req.type === 'materiaPrima' || req.type === 'inventoryComponent') {
                     demand.set(req.id, (demand.get(req.id) || 0) + req.quantity);
                }
            });
        });

        // --- Step 2: Process demands recursively ---
        const productionRecs = new Map<string, ProductionRecommendation>();
        const purchaseRecs = new Map<string, PurchaseRecommendation>();
        const cuttingRecs = new Map<string, CuttingRecommendation>();
        
        const familiaMap = new Map(familias.map(f => [f.id, f]));
        const fastenerComponents = components.filter(c => c.familiaId === 'fam-fixadores');

        // Virtual stock for cutting planning
        const virtualStock = new Map<string, number>(components.map(c => [c.id, c.stock]));
        const demandToProcess = new Map(demand);

        while(demandToProcess.size > 0){
            const entry = demandToProcess.entries().next().value;
            if (!entry) break;
            const [componentId, requiredQty] = entry as [string, number];
            demandToProcess.delete(componentId);

            const component = componentMap.get(componentId) as Component | undefined;
            if (!component) continue;

            const currentStock = virtualStock.get(component.id) || 0;
            if(currentStock >= requiredQty) {
                virtualStock.set(component.id, currentStock - requiredQty);
                continue;
            }

            const deficit = requiredQty - currentStock;
            virtualStock.set(component.id, 0);

            // --- Fastener Cutting Logic ---
            const fastenerDetails = parseFastenerSku(component.sku);
            let remainingDeficit = deficit;
            if(fastenerDetails && component.sourcing !== 'manufactured'){
                const potentialSources = fastenerComponents.filter(c => {
                    const sourceStock = virtualStock.get(c.id) || 0;
                    if(sourceStock <= 0) return false;
                    const sourceDetails = parseFastenerSku(c.sku);
                    return sourceDetails && sourceDetails.head === fastenerDetails.head && sourceDetails.bitola === fastenerDetails.bitola && sourceDetails.comprimento > fastenerDetails.comprimento;
                }).sort((a,b) => (parseFastenerSku(a.sku)?.comprimento || 0) - (parseFastenerSku(b.sku)?.comprimento || 0));

                let bestSource: Component | null = null;
                for (const source of potentialSources) {
                    const costToCut = getComponentCost(source) + cuttingCost;
                    const costToBuy = getComponentCost(component);
                    if (costToCut < costToBuy) {
                        bestSource = source;
                        break;
                    }
                }
                
                if (bestSource) {
                    const sourceStock = virtualStock.get(bestSource.id)!;
                    const canCut = Math.min(deficit, sourceStock);
                    
                    const existingCut = cuttingRecs.get(component.id) || {
                        sourceComponentId: bestSource.id, targetComponentId: component.id,
                        quantityToCut: 0, costSaving: 0, abcClass: abcAnalysisData.get(component.id) || 'C'
                    };
                    existingCut.quantityToCut += canCut;
                    existingCut.costSaving += (getComponentCost(component) - (getComponentCost(bestSource) + cuttingCost)) * canCut;
                    cuttingRecs.set(component.id, existingCut);
                    virtualStock.set(bestSource.id, sourceStock - canCut);
                    remainingDeficit -= canCut;
                }
            }
            if(remainingDeficit <= 0) continue;
            
            // --- Normal Planning Logic ---
            if (component.type === 'raw_material' || component.sourcing === 'purchased') {
                const existingPurchase = purchaseRecs.get(component.id) || {
                    componentId: component.id, name: component.name, sku: component.sku,
                    sourcing: component.sourcing || 'purchased', required: 0, inStock: component.stock, toOrder: 0,
                    abcClass: abcAnalysisData.get(component.id) || 'C'
                };
                existingPurchase.toOrder += remainingDeficit;
                existingPurchase.required += requiredQty;
                purchaseRecs.set(component.id, existingPurchase);
            }
            else if (component.sourcing === 'manufactured' || component.sourcing === 'beneficiado') {
                const existingProd = productionRecs.get(component.id) || {
                    componentId: component.id, name: component.name, sku: component.sku,
                    required: 0, inStock: component.stock, toProduce: 0,
                    abcClass: abcAnalysisData.get(component.id) || 'C'
                };
                existingProd.toProduce += remainingDeficit;
                existingProd.required += requiredQty;
                productionRecs.set(component.id, existingProd);

                const familia = familiaMap.get(component.familiaId!) as FamiliaComponente | undefined;
                if (familia) {
                    // Re-evaluate process variables if necessary (e.g. for fasteners with dynamic dims)
                    const skuInfo = parseFastenerSku(component.sku);
                    const variables = skuInfo ? { bitola: skuInfo.bitola, comprimento: skuInfo.comprimento } : {};
                    const stringVariables = skuInfo ? { headCode: skuInfo.head } : {};

                    const analysis = evaluateProcess(familia, variables, components, stringVariables, { allFamilias: familias });
                    
                    for (const node of analysis.nodes) {
                        if ((node.data.type === 'materiaPrima' || node.data.type === 'inventoryComponent') && node.data.cost > 0) {
                            let subComponentId = node.data.type === 'materiaPrima' ? node.data.baseMaterialId : node.data.componentId;
                            
                            // Handle dynamic material/component resolution
                            if (node.data.type === 'materiaPrima' && !subComponentId && node.data.sourceSku) {
                                subComponentId = (componentSkuMap.get(node.data.sourceSku) as Component | undefined)?.id;
                            } else if (node.data.type === 'inventoryComponent' && !subComponentId && node.data.componentIdTemplate) {
                                const resolvedSku = node.data.componentIdTemplate.replace('{headCode}', stringVariables.headCode || '');
                                subComponentId = (componentSkuMap.get(resolvedSku) as Component | undefined)?.id;
                            }

                            const consumption = node.data.consumption || 1;
                            
                            if (subComponentId) {
                                 let quantityNeeded = remainingDeficit * consumption;
                                 
                                 // Fix for 'm' unit raw materials (e.g. tubes) being consumed in 'mm'
                                 const subComponent = componentMap.get(subComponentId) as Component | undefined;
                                 if (subComponent && subComponent.type === 'raw_material' && subComponent.consumptionUnit === 'm') {
                                     quantityNeeded /= 1000;
                                 }

                                 demandToProcess.set(subComponentId, (demandToProcess.get(subComponentId) || 0) + quantityNeeded);
                            }
                        }
                    }
                }
            }
        }

        // --- Step 3: Raw Material Forecast (Explode the Production Plan) ---
        // This calculates exactly how much raw material is needed for the PLANNED production,
        // regardless of whether we have enough material stock or not. It's a "BOM Explosion".
        const rawMaterialNeeds = new Map<string, number>();

        for (const prodItem of productionRecs.values()) {
             const component = componentSkuMap.get(prodItem.sku) as Component | undefined;
             if (!component || !component.familiaId) continue;
             const familia = familiaMap.get(component.familiaId) as FamiliaComponente | undefined;
             if (!familia) continue;

             const skuInfo = parseFastenerSku(component.sku);
             const variables = skuInfo ? { bitola: skuInfo.bitola, comprimento: skuInfo.comprimento } : {};
             const stringVariables = skuInfo ? { headCode: skuInfo.head } : {};

             const analysis = evaluateProcess(familia, variables, components, stringVariables, { allFamilias: familias });
             
             for (const node of analysis.nodes) {
                 if (node.data.type === 'materiaPrima' && node.data.baseMaterialId) {
                     const material = componentMap.get(node.data.baseMaterialId) as Component | undefined;
                     if (material) {
                        let consumption = node.data.consumption || 1;
                        // Handle mm to m conversion for tubes/bars
                        if (material.consumptionUnit === 'm') {
                            consumption /= 1000;
                        }
                        const totalRequired = consumption * prodItem.toProduce;
                        rawMaterialNeeds.set(material.id, (rawMaterialNeeds.get(material.id) || 0) + totalRequired);
                     }
                 }
             }
        }

        const rawMaterialForecast: RawMaterialForecastItem[] = [];
        rawMaterialNeeds.forEach((requiredQty, materialId) => {
            const material = componentMap.get(materialId) as Component | undefined;
            if (material) {
                const currentStock = material.stock;
                const netToBuy = Math.max(0, requiredQty - currentStock);
                
                // Calculate purchasing cost based on Purchase Unit
                // e.g. required 60m. Stock 0. Purchase Unit = Barra (6m).
                // Cost = (NetToBuy / QtyPerPurchUnit) * PurchaseCost
                let estimatedCost = 0;
                if (netToBuy > 0) {
                     let buyQty = netToBuy;
                     if (material.purchaseQuantity && material.purchaseQuantity > 0) {
                         buyQty = netToBuy / material.purchaseQuantity; // Convert to purchase units (e.g. bars)
                     }
                     estimatedCost = buyQty * (material.purchaseCost || 0);
                }

                rawMaterialForecast.push({
                    materialId: material.id,
                    name: material.name,
                    sku: material.sku,
                    unit: material.consumptionUnit || 'un',
                    purchaseUnit: material.purchaseUnit || 'un',
                    requiredForPlan: requiredQty,
                    currentStock: currentStock,
                    netToBuy: netToBuy,
                    totalCost: estimatedCost
                });
            }
        });
        
        setPlannerData({
            cuttingRecommendations: Array.from(cuttingRecs.values()),
            productionPlan: Array.from(productionRecs.values()).sort((a, b) => a.abcClass.localeCompare(b.abcClass)),
            purchasePlan: Array.from(purchaseRecs.values()).sort((a, b) => a.abcClass.localeCompare(b.abcClass)),
            rawMaterialForecast: rawMaterialForecast.sort((a,b) => b.netToBuy - a.netToBuy),
        });

        setIsLoading(false);

    }, [components, productionOrders, manufacturingOrders, familias, abcAnalysisData, cuttingCost]);

    const generateCuttingOrders = useCallback(async (recommendations: CuttingRecommendation[]) => {
        if (recommendations.length === 0) return;
        await cuttingOrdersHook.addMultipleCuttingOrders(recommendations);
    }, [cuttingOrdersHook]);

    const generateManufacturingOrders = useCallback(async (recommendations: ProductionRecommendation[]) => {
        if (recommendations.length === 0) return;
        const orderItems = recommendations.map(rec => ({ componentId: rec.componentId, quantity: Math.ceil(rec.toProduce) }));
        const analysis = manufacturing.analyzeManufacturingRun(orderItems, components);
        await manufacturingOrdersHook.addManufacturingOrder(orderItems, analysis);
    }, [manufacturing, components, manufacturingOrdersHook]);

    const generatePurchaseOrders = useCallback(async (recommendations: PurchaseRecommendation[]) => {
        if (recommendations.length === 0) return;
        const leadTimes = recommendations.map(rec => findComponentById(rec.componentId)?.leadTimeDays || 0);
        const maxLeadTime = Math.max(0, ...leadTimes);
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
        await purchaseOrdersHook.addPurchaseOrder(recommendations, deliveryDate.toISOString().split('T')[0]);
    }, [purchaseOrdersHook, findComponentById]);


    return {
        isLoading,
        ...plannerData,
        generateCuttingOrders,
        generateManufacturingOrders,
        generatePurchaseOrders,
    };
};
