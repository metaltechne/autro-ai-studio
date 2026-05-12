
import { 
    FamiliaComponente, Component, Kit, WorkStation, Consumable, 
    StandardOperation, GeneratedProduct, ProcessNodeData, CostStep,
    KitCostDetails, KitCostBreakdownItem 
} from '../types';
import type { Node, Edge } from 'reactflow';

export interface EvalConfig {
    workStations?: WorkStation[];
    consumables?: Consumable[];
    operations?: StandardOperation[];
    allFamilias?: FamiliaComponente[];
}

export interface ProcessRequirement {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    type: 'materiaPrima' | 'inventoryComponent' | string;
    familiaId?: string;
}

export const getComponentCost = (component: Component): number => {
    // If it is a raw material or purchased, use purchase cost
    if ((component.sourcing === 'purchased' || component.type === 'raw_material') && component.purchaseCost) {
        const divisor = (component.purchaseQuantity && component.purchaseQuantity > 0) ? component.purchaseQuantity : 1;
        return component.purchaseCost / divisor;
    }
    // For manufactured components, prefer the sum of specific costs
    const manufacturedCost = (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0);
    
    // Safety check: if manufactured cost is very low but generic cost exists, it might be an error in type/sourcing
    if (manufacturedCost === 0 && (component.cost || component.purchaseCost)) {
        return component.cost || component.purchaseCost || 0;
    }

    return manufacturedCost;
};

/**
 * Calculates total cost and breakdown for a kit, including automatic parts (copos) 
 * and dynamic fasteners, ensuring consistency across all views.
 */
export const calculateKitCosts = (
    kit: Kit,
    inventory: { components: Component[] },
    manufacturing: { 
        familias: FamiliaComponente[]; 
        workStations?: WorkStation[]; 
        consumables?: Consumable[]; 
        standardOperations?: StandardOperation[]; 
    },
    financialSettings?: any,
    overrides?: { selectedFamiliaId?: string; selectedNutFamiliaId?: string; sellingPriceOverride?: number; pricingStrategy?: any }
): KitCostDetails => {
    const components = inventory.components;
    const familias = manufacturing.familias;
    const familiaMap = new Map(familias.map(f => [f.id, f]));
    
    const evalConfig: EvalConfig = {
        allFamilias: familias,
        workStations: manufacturing.workStations,
        consumables: manufacturing.consumables,
        operations: manufacturing.standardOperations
    };
    
    // Maps for SKU lookup
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

    const aggregatedBreakdown = new Map<string, KitCostBreakdownItem>();
    const addToBreakdown = (item: KitCostBreakdownItem) => {
        const key = item.sku || item.name;
        const existing = aggregatedBreakdown.get(key);
        if (existing) {
            existing.quantity += item.quantity;
            existing.totalCost += item.totalCost;
            existing.materialCost = (existing.materialCost || 0) + (item.materialCost || 0);
            existing.fabricationCost = (existing.fabricationCost || 0) + (item.fabricationCost || 0);
        } else {
            aggregatedBreakdown.set(key, { ...item });
        }
    };

    let totalMaterial = 0;
    let totalFabrication = 0;

    // 1. Fixed Components
    (kit.components || []).forEach(kc => {
        let component = findComponent(kc.componentSku);
        
        let mat = 0;
        let fab = 0;
        let costBreakdown: CostStep[] = [];
        let name = '';
        let sku = kc.componentSku;
        let famId: string | undefined = undefined;

        if (component) {
            mat = component.custoMateriaPrima || 0;
            fab = component.custoFabricacao || 0;
            name = component.name;
            sku = component.sku;
            famId = component.familiaId;

            // If it has a family, evaluate live to get the production steps (breakdown)
            if (famId) {
                const fam = familiaMap.get(famId);
                if (fam) {
                    let bitola = component.dimensions?.bitola || 0;
                    let comprimento = component.dimensions?.comprimento || 0;
                    
                    // Parse SKU for dimensions if not in component properties
                    if (bitola === 0 && sku.includes('-')) {
                        const parts = sku.split('-');
                        const dimPart = parts[parts.length - 1].replace(/mm/i, '').replace(/M/i, '').replace(',', '.');
                        if (dimPart.includes('X')) {
                            const [b, c] = dimPart.split('X');
                            bitola = parseFloat(b);
                            comprimento = parseFloat(c || '0');
                        } else {
                            bitola = parseFloat(dimPart);
                        }
                    }

                    // Use all component dimensions as variables
                    const evalVars = { bitola, comprimento, ...(component.dimensions || {}) };
                    const res = evaluateProcess(fam, evalVars, components, {}, evalConfig);
                    
                    // Only override if we got actual steps or costs
                    if (res.costBreakdown.length > 0 || res.custoMateriaPrima > 0 || res.custoFabricacao > 0) {
                        mat = res.custoMateriaPrima;
                        fab = res.custoFabricacao;
                        costBreakdown = res.costBreakdown;
                    }
                }
            }
        } else {
            // Heuristic detection for unknown SKUs that follow patterns
            const upperSku = sku.toUpperCase();
            let heuristicFam: FamiliaComponente | undefined = undefined;
            
            if (upperSku.includes('COPO-')) {
                heuristicFam = familias.find(f => f.id === 'fam-MONTAGEM-COPO' || f.nome?.toLowerCase().includes('copo'));
                name = `Copo ${sku.split('-').pop()?.replace('.', ',')}`;
            } else if (upperSku.includes('FIX-')) {
                heuristicFam = familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase().includes('fix-s'));
                name = `Parafuso/Haste ${sku.split('-').pop()}`;
            } else if (upperSku.includes('POR-')) {
                heuristicFam = familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase().includes('por-p'));
                name = `Porca ${sku.split('-').pop()}`;
            } else if (upperSku.includes('CHAVE-')) {
                heuristicFam = familias.find(f => f.id === 'fam-MONTAGEM-CHAVE' || f.nome?.toLowerCase().includes('chave'));
                name = `Chave ${sku.split('-').pop()}`;
            }

            if (heuristicFam) {
                famId = heuristicFam.id;
                let bitola = 0;
                let comprimento = 0;
                const parts = upperSku.split('-');
                const dimPart = parts[parts.length - 1].replace(/mm/i, '').replace(/M/i, '').replace(',', '.');
                
                if (dimPart.includes('X')) {
                    const [b, c] = dimPart.split('X');
                    bitola = parseFloat(b);
                    comprimento = parseFloat(c || '0');
                } else {
                    bitola = parseFloat(dimPart);
                    comprimento = 0;
                }

                if (!isNaN(bitola) && bitola > 0) {
                    const res = evaluateProcess(heuristicFam, { bitola, comprimento }, components, {}, evalConfig);
                    mat = res.custoMateriaPrima;
                    fab = res.custoFabricacao;
                    costBreakdown = res.costBreakdown;
                }
            } else {
                name = `Item Desconhecido (${kc.componentSku})`;
            }
        }

        if (costBreakdown.length === 0) {
            if (mat > 0) costBreakdown.push({ name: 'Matéria Prima', type: 'material', cost: mat });
            if (fab > 0) costBreakdown.push({ name: 'Fabricação', type: 'labor', cost: fab });
        }

        const unitCost = mat + fab;
        totalMaterial += mat * kc.quantity;
        totalFabrication += fab * kc.quantity;

        addToBreakdown({
            name: name,
            sku: sku,
            quantity: kc.quantity,
            unitCost: unitCost,
            materialCost: mat * kc.quantity,
            fabricationCost: fab * kc.quantity,
            totalCost: unitCost * kc.quantity,
            type: 'Componente',
            familiaId: famId,
            costBreakdown
        });
    });

    // 2. Dynamic Fasteners
    if (kit.requiredFasteners) {
        kit.requiredFasteners.forEach(rf => {
            if (!rf.dimension) return;
            const isNut = rf.dimension.toLowerCase().includes('x0') || rf.dimension.endsWith('x0');
            const preferredId = financialSettings?.preferredFastenerFamiliaId || 'fam-fixadores';
            
            const fixSFamilia = familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase().includes('fix-s'));
            const porPFamilia = familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase().includes('por-p'));
            
            let familiaToUse = isNut ? porPFamilia : fixSFamilia;
            if (isNut && overrides?.selectedNutFamiliaId) {
                familiaToUse = familiaMap.get(overrides.selectedNutFamiliaId) || familiaToUse;
            } else if (!isNut && overrides?.selectedFamiliaId) {
                familiaToUse = familiaMap.get(overrides.selectedFamiliaId) || familiaToUse;
            }

            if (!familiaToUse) familiaToUse = familiaMap.get(preferredId);
            if (!familiaToUse) return;

            const simpleDim = rf.dimension.replace(/mm/i, '').replace(/M/i, '').replace(/\s+/g, '');
            const [bStr, cStr] = simpleDim.split('x');
            const bitola = parseFloat(bStr);
            const comprimento = parseFloat(cStr || '0');

            if (!isNaN(bitola)) {
                const result = evaluateProcess(familiaToUse, { bitola, comprimento }, components, {}, evalConfig);
                const mat = result.custoMateriaPrima;
                const fab = result.custoFabricacao;
                const unitCost = mat + fab;
                
                totalMaterial += mat * rf.quantity;
                totalFabrication += fab * rf.quantity;

                const familyTag = familiaToUse.masterProcessTag || 
                                 (isNut ? 'POR-P' : (familiaToUse.nome?.includes('FIX-P') ? 'FIX-P' : 'FIX-S'));

                addToBreakdown({
                    name: isNut ? `Porca M${bitola} (Fix)` : `Parafuso ${rf.dimension}`,
                    sku: `${familyTag}-${simpleDim.toUpperCase()}`,
                    quantity: rf.quantity,
                    unitCost: unitCost,
                    materialCost: mat * rf.quantity,
                    fabricationCost: fab * rf.quantity,
                    totalCost: unitCost * rf.quantity,
                    type: 'Fixador',
                    familiaId: familiaToUse.id,
                    costBreakdown: result.costBreakdown
                });
            }
        });
    }

    // 3. Automatic Copos
    if (kit.requiredFasteners) {
        kit.requiredFasteners.forEach(rf => {
            if (!rf.dimension) return;
            const isNut = rf.dimension.toLowerCase().includes('x0') || rf.dimension.endsWith('x0');
            if (isNut) return;

            const simpleDim = rf.dimension.replace(/mm/i, '').replace(/M/i, '').replace(/\s+/g, '');
            const bitola = parseFloat(simpleDim.split('x')[0]);
            
            if (!isNaN(bitola)) {
                const copoBitola = (bitola === 10 || bitola === 12) ? 25.4 : (bitola === 8 ? 22.22 : 19.05);
                const copoFamilia = familias.find(f => f.id === 'fam-MONTAGEM-COPO' || f.nome?.toLowerCase().includes('copo'));
                
                if (copoFamilia) {
                    const res = evaluateProcess(copoFamilia, { bitola: copoBitola, comprimento: 0 }, components, {}, evalConfig);
                    const mat = res.custoMateriaPrima;
                    const fab = res.custoFabricacao;
                    const unitCost = mat + fab;

                    totalMaterial += mat * rf.quantity;
                    totalFabrication += fab * rf.quantity;

                    const sku = `COPO-${copoBitola.toFixed(2)}`;
                    const componentFound = findComponent(sku);

                    addToBreakdown({
                        name: componentFound ? componentFound.name : `Copo ${copoBitola.toFixed(2)}`,
                        sku: sku,
                        quantity: rf.quantity,
                        unitCost: unitCost,
                        materialCost: mat * rf.quantity,
                        fabricationCost: fab * rf.quantity,
                        totalCost: unitCost * rf.quantity,
                        type: 'Copo',
                        familiaId: copoFamilia.id,
                        costBreakdown: res.costBreakdown
                    });
                }
            }
        });
    }

    const totalCost = totalMaterial + totalFabrication;
    const finalBreakdown = Array.from(aggregatedBreakdown.values());

    return {
        totalCost,
        materialCost: totalMaterial,
        fabricationCost: totalFabrication,
        breakdown: finalBreakdown.sort((a,b) => b.totalCost - a.totalCost),
        saleDetails: { sellingPrice: 0, profit: 0, totalDeductions: 0, taxBreakdown: [], isOverridden: false, contributionMargin: 0, contributionMarginPercentage: 0 }
    };
};

export const calculateMaterialCost = (material: Component, quantity: number): number => {
    const divisor = (material.purchaseQuantity && material.purchaseQuantity > 0) ? material.purchaseQuantity : 1;
    const unitPrice = (material.purchaseCost || 0) / divisor;
    return unitPrice * quantity;
};

export const parseFastenerSku = (sku: string) => {
    // Regex mais flexível: 
    // 1. FIX-CABEÇA-M6x20 ou FIX-CABEÇA-6x20
    // 2. FIX-M6x20 ou FIX-6x20
    const regexFull = /^FIX-([A-Z0-9-]+)-(?:M)?(\d+)x(\d+)(?:MM)?$/i;
    const regexSimple = /^FIX-(?:M)?(\d+)x(\d+)(?:MM)?$/i;
    
    let match = sku.match(regexFull);
    if (match) {
        return {
            head: match[1],
            bitola: parseInt(match[2], 10),
            comprimento: parseInt(match[3], 10)
        };
    }
    
    match = sku.match(regexSimple);
    if (match) {
        return {
            head: 'PADRAO',
            bitola: parseInt(match[1], 10),
            comprimento: parseInt(match[2], 10)
        };
    }
    
    return null;
};

const calculateNodeValue = (
    node: Node<ProcessNodeData>,
    allInventoryItems: Component[],
    allStringVariables: Record<string, string>,
    allVariables: Record<string, number>,
    config?: EvalConfig,
    activeDimensionId?: string,
    maps?: { baseMaterialMap: Map<string, Component>, componentSkuMap: Map<string, Component> },
    depth = 0
) => {
    const normalizeValue = (s: string) => s.replace(',', '.').replace(/^m/i, '').trim();
    const data = node.data;
    let material = 0;
    let labor = 0;
    let timeSeconds = 0;
    const requirements: ProcessRequirement[] = [];
    const subSteps: CostStep[] = [];

    const baseMaterialMap = maps?.baseMaterialMap || new Map((allInventoryItems || []).filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = maps?.componentSkuMap || new Map((allInventoryItems || []).filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c]));

    const type = (data.type as string) || '';
    const isMaterialMapping = type === 'materialMapping' || type === 'materialMappingNode';
    const isServiceMapping = type === 'serviceMapping' || type === 'serviceMappingNode';
    const isSubProcessMapping = type === 'subProcessMapping' || type === 'subProcessMappingNode';

    // Determine which variables to use for matching based on mappingMode
    const mappingMode = data.mappingMode || 'thread';
    const primaryVarName = mappingMode === 'diameter' ? 'diametro' : 'bitola';
    
    // For diameter mode, try headdiameter or tubo as fallbacks
    let vPrimary: string | undefined = undefined;
    if (mappingMode === 'diameter') {
        vPrimary = normalizeValue(String(allStringVariables.diametro || allStringVariables.tubo || allStringVariables.headdiameter || allVariables.diametro || allVariables.tubo || allVariables.headdiameter || ""));
    } else {
        vPrimary = normalizeValue(String(allStringVariables.bitola || allStringVariables.Bitola || allVariables.bitola || ""));
    }

    if ((isMaterialMapping || isServiceMapping || isSubProcessMapping) && data.dimensions) {
        // Find row by ID first, then by bitola/comprimento as fallback (case-insensitive)
        let row = data.dimensions.find(d => d.id === activeDimensionId);
        
        if (!row && vPrimary) {
             row = data.dimensions.find(d => {
                const dPrimaryVar = normalizeValue(String((d as any)[primaryVarName] || (d as any).bitola || ""));
                const dCompr = normalizeValue(String((d as any).comprimento || (d as any).Comprimento || ""));
                const vCompr = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || "0"));
                const matchC = (vCompr === "" || vCompr === "0") ? true : dCompr === vCompr;
                return dPrimaryVar === vPrimary && matchC;
             });
        }
        
        // Even more flexible: check ANY key for bitola-like and comprimento-like names
        if (!row && vPrimary) {
            row = data.dimensions.find(d => {
                const primaryKeyInRow = Object.keys(d).find(k => k.toLowerCase() === primaryVarName || k.toLowerCase() === 'bitola');
                const comprKey = Object.keys(d).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp');
                
                if (!primaryKeyInRow) return false;
                
                const dPrimaryVal = normalizeValue(String(d[primaryKeyInRow] || ""));
                const dCompr = comprKey ? normalizeValue(String(d[comprKey] || "")) : "0";
                
                const vComprSafe = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || "0"));
                
                const matchC = (vComprSafe === "0" || vComprSafe === "") ? true : dCompr === vComprSafe;
                return dPrimaryVal === vPrimary && matchC;
            });
        }

        // Final fallback: if still not found, use first row if it's the only one 
        // (common for sub-processes that only have one generic mapping)
        if (!row && data.dimensions.length === 1) {
            row = data.dimensions[0];
        }

        if (row) {
            if (isMaterialMapping) {
                if (row.baseMaterialId) {
                    const mat = baseMaterialMap.get(row.baseMaterialId);
                    if (mat) {
                        const qty = row.consumption || 1;
                        material += calculateMaterialCost(mat, qty);
                        requirements.push({
                            id: mat.id, name: mat.name, sku: mat.sku,
                            quantity: qty,
                            unit: mat.consumptionUnit || 'un', type: 'materiaPrima'
                        });
                    }
                }
                if (row.bodyPieceMaterialId) {
                    const mat = baseMaterialMap.get(row.bodyPieceMaterialId);
                    if (mat) {
                        const qty = row.consumption || 1;
                        material += calculateMaterialCost(mat, qty);
                        requirements.push({
                            id: mat.id, name: mat.name, sku: mat.sku,
                            quantity: qty,
                            unit: mat.consumptionUnit || 'un', type: 'materiaPrima'
                        });
                    }
                }
                // Add machining costs from row to subSteps
                if (Number(row.headMachiningCost) > 0) {
                    subSteps.push({ name: 'Usinagem Cabeça', type: 'labor', cost: Number(row.headMachiningCost) });
                    labor += Number(row.headMachiningCost);
                }
                if (Number(row.bodyPieceCost) > 0) {
                    subSteps.push({ name: 'Usinagem Corpo', type: 'labor', cost: Number(row.bodyPieceCost) });
                    labor += Number(row.bodyPieceCost);
                }
                return { material, labor, requirements, timeSeconds, subSteps, nodeName: data.label };
            } else if (isServiceMapping) {
                labor = Number(row.serviceCost) || 0;
                if (labor > 0) subSteps.push({ name: 'Serviço Terceiro', type: 'labor', cost: labor });
                return { material, labor, requirements, timeSeconds, subSteps, nodeName: data.label };
            } else if (isSubProcessMapping && row.targetFamiliaId && config) {
                const targetFamilia = config.allFamilias?.find(f => f.id === row.targetFamiliaId);
                if (targetFamilia) {
                    const subRes = evaluateProcess(targetFamilia, allVariables, allInventoryItems, allStringVariables, config, undefined, undefined, (depth || 0) + 1);
                    material = subRes.custoMateriaPrima;
                    labor = subRes.custoFabricacao;
                    timeSeconds = subRes.totalTimeSeconds;
                    requirements.push(...subRes.requirements);
                }
            }
        }
    } else if (type === 'etapaFabricacao' || type === 'etapaFabricacaoNode') {
        const mode = data.costCalculationMode || 'time';
        
        // --- NOME DESCRITIVO PARA ETAPA ---
        let nodeName = data.label || 'Etapa de Fabricação';
        const labelLower = nodeName.toLowerCase();
        if (labelLower.includes('solda')) {
            const diams = [allStringVariables.moedabitola, allStringVariables.flangebitola, allStringVariables.diametro, allStringVariables.bitola].filter(Boolean);
            if (diams.length > 0) {
                const uniqueDiams = Array.from(new Set(diams)).map(d => String(d).replace('.', ','));
                nodeName = `${nodeName} (${uniqueDiams.join('/')}mm)`;
            }
        }
        
        if (mode === 'fixed') {
            labor = Number(data.fixedCost) || 0;
            return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName };
        } else if (mode === 'workstation') {
            const ws = config?.workStations?.find(w => w.id === data.workStationId);
            labor = ws?.hourlyRate || 0;
            timeSeconds = 3600; // 1 hour default for workstation mode if not specified
            return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName };
        } else { // time mode
            const op = config?.operations?.find(o => o.id === data.operationId);
            const ws = config?.workStations?.find(w => w.id === (data.manualOperatorId || op?.workStationId)) || config?.workStations?.[0];
            const time = data.manualTimeSeconds !== undefined ? data.manualTimeSeconds : (op?.timeSeconds || 0);
            timeSeconds = Number(time);
            labor = (timeSeconds / 3600) * (ws?.hourlyRate || 0);
            const subSteps: CostStep[] = [];
            
            // Add labor as a sub-step to show workstation/rate details
            if (timeSeconds > 0) {
                subSteps.push({
                    name: `Mão de Obra: ${ws?.name || 'Operador'}`,
                    type: 'labor',
                    cost: (timeSeconds / 3600) * (ws?.hourlyRate || 0),
                    timeSeconds: timeSeconds,
                    details: `Taxa: R$ ${ws?.hourlyRate || 0}/h`
                });
            }

            const consCost = (op?.operationConsumables || []).reduce((sum, oc) => {
                const c = config?.consumables?.find(item => item.id === oc.consumableId);
                if (c) {
                    const yieldFactor = (c.monthlyProduction && c.monthlyProduction > 0) ? (1 / c.monthlyProduction) : 1;
                    const effectiveQuantity = (oc.quantity || 0) * yieldFactor;
                    const itemCost = effectiveQuantity * (c?.unitCost || 0);

                    requirements.push({
                        id: c.id,
                        name: c.name,
                        sku: c.id,
                        quantity: effectiveQuantity,
                        unit: c.unit,
                        type: 'inventoryComponent'
                    });

                    if (itemCost > 0) {
                        subSteps.push({
                            name: `Insumo: ${c.name}`,
                            type: 'material',
                            cost: itemCost,
                            details: `${effectiveQuantity.toFixed(4)} ${c.unit}`
                        });
                    }
                    return sum + itemCost;
                }
                return sum;
            }, 0);
            labor += consCost;
            return { material, labor, requirements, timeSeconds, subSteps, nodeName };
        }
    } else if (data.type === 'inventoryComponent') {
        let mappedVariables = { ...allVariables };
        let mappedStringVariables = { ...allStringVariables };
        
        if (data.variableMappings && Array.isArray(data.variableMappings)) {
            data.variableMappings.forEach(mapping => {
                const sVarStr = String(mapping.sourceVar || '').toLowerCase().trim();
                const sValStr = String(mapping.sourceValue || '').toLowerCase().trim();
                const currVal = String(mappedStringVariables[sVarStr] || '').toLowerCase().trim();
                
                const normalizeValue = (s: string) => s.replace(',', '.').replace(/^m/i, '').trim();
                
                if (currVal === sValStr || normalizeValue(currVal) === normalizeValue(sValStr)) {
                    const cleanTarget = String(mapping.targetValue || '').replace(',', '.').trim();
                    const newNum = parseFloat(cleanTarget);
                    if (!isNaN(newNum)) {
                        mappedVariables[sVarStr] = newNum;
                    } else {
                        delete mappedVariables[sVarStr];
                    }
                    mappedStringVariables[sVarStr] = String(mapping.targetValue || '').trim();
                }
            });
        }

        let targetSku = data.componentIdTemplate || "";
        if (targetSku) {
            Object.entries(mappedStringVariables || {}).forEach(([k, v]) => targetSku = targetSku.replace(new RegExp(`{${k}}`, 'gi'), v));
        } else if (data.componentId) {
            targetSku = allInventoryItems.find(i => i.id === data.componentId)?.sku || "";
        }
        
        // --- CÁLCULO DO NOME DESCRITIVO ---
        let descriptiveName = data.label || targetSku || 'Componente';
        const labelLower = descriptiveName.toLowerCase();
        let dimVal = '';

        if (labelLower.includes('moeda')) {
            dimVal = mappedStringVariables.moedabitola || mappedStringVariables.diametrocabeca || mappedStringVariables.headdiameter || mappedStringVariables.bitola;
        } else if (labelLower.includes('flange')) {
            dimVal = mappedStringVariables.flangebitola || mappedStringVariables.diametrocabeca || mappedStringVariables.headdiameter || mappedStringVariables.bitola;
        } else {
            dimVal = mappedStringVariables.diametro || mappedStringVariables.bitola;
        }

        if (dimVal && !descriptiveName.includes(String(dimVal))) {
            const formattedDim = String(dimVal).replace('.', ',');
            if (labelLower.includes('moeda') || labelLower.includes('flange')) {
                descriptiveName = `${descriptiveName} mm ${formattedDim}`;
            } else {
                descriptiveName = `${descriptiveName} ${formattedDim}`;
            }

            if (mappedStringVariables.comprimento && mappedStringVariables.comprimento !== '0' && !labelLower.includes('moeda') && !labelLower.includes('flange')) {
                descriptiveName += `x${mappedStringVariables.comprimento}`;
            }
        }
        // --- FIM CÁLCULO DO NOME ---

        const item = targetSku ? componentSkuMap.get(targetSku.toUpperCase()) : undefined;
        const qty = data.consumption || 1;

        if (item) {
            let itemRealTimeCost = 0;
            let itemRealTimeTime = 0;
            let usedRealTime = false;
            let subSteps: CostStep[] = [];

            if (data.sourceFamiliaId && config?.allFamilias) {
                const sourceFam = config.allFamilias.find(f => f.id === data.sourceFamiliaId);
                if (sourceFam) {
                    const subRes = evaluateProcess(sourceFam, mappedVariables, allInventoryItems, mappedStringVariables, config, undefined, maps, (depth || 0) + 1);
                    itemRealTimeCost = (subRes.custoMateriaPrima + subRes.custoFabricacao) * qty;
                    itemRealTimeTime = subRes.totalTimeSeconds * qty;
                    usedRealTime = true;
                    
                    subSteps = (subRes.costBreakdown || []).map(step => ({
                        ...step,
                        cost: step.cost * qty,
                        timeSeconds: step.timeSeconds ? step.timeSeconds * qty : undefined,
                        name: `[${sourceFam.nome}] ${step.name}`
                    }));
                }
            }

            if (usedRealTime) {
                material = itemRealTimeCost; 
                timeSeconds = itemRealTimeTime;
            } else {
                material = getComponentCost(item) * qty;
            }

            requirements.push({
                id: item.id,
                name: descriptiveName || item.name,
                sku: item.sku,
                quantity: qty,
                unit: item.consumptionUnit || 'un',
                type: 'inventoryComponent',
                familiaId: item.familiaId
            });
            
            if (usedRealTime && subSteps.length > 0) {
                return { material, labor, requirements, timeSeconds, subSteps, nodeName: descriptiveName };
            }
        } else {
            // Se não encontrou o item físico, ainda assim adicionamos o requisito nominal para o planejamento
            requirements.push({
                id: targetSku || data.componentId || 'unknown',
                name: descriptiveName,
                sku: targetSku || 'N/A',
                quantity: qty,
                unit: 'un',
                type: 'inventoryComponent',
                familiaId: data.sourceFamiliaId
            });

            if (data.sourceFamiliaId && config?.allFamilias) {
                const sourceFam = config.allFamilias.find(f => f.id === data.sourceFamiliaId);
                
                if (sourceFam) {
                    const subRes = evaluateProcess(sourceFam, mappedVariables, allInventoryItems, mappedStringVariables, config, undefined, maps, (depth || 0) + 1);
                    
                    const isLinkedProcess = !!data.sourceFamiliaId && !data.componentId;
                    
                    if (isLinkedProcess) {
                        material = (subRes.custoMateriaPrima) * qty;
                        labor = (subRes.custoFabricacao) * qty;
                    } else {
                        material = (subRes.custoMateriaPrima + subRes.custoFabricacao) * qty;
                        labor = 0;
                    }
                    
                    timeSeconds = subRes.totalTimeSeconds * qty;
                    requirements.push(...subRes.requirements.map(r => ({ ...r, quantity: r.quantity * qty })));

                    const subSteps: CostStep[] = (subRes.costBreakdown || []).map(step => ({
                        ...step,
                        cost: step.cost * qty,
                        timeSeconds: step.timeSeconds ? step.timeSeconds * qty : undefined,
                        name: `[${sourceFam.nome}] ${step.name}`
                    }));
                    
                    return { material, labor, requirements, timeSeconds, subSteps, nodeName: descriptiveName };
                }
            }
        }
        return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName: descriptiveName };
    } else if (data.type === 'materiaPrima' && data.baseMaterialId) {
        const mat = baseMaterialMap.get(data.baseMaterialId);
        if (mat) {
            const qty = data.consumption || 1;
            // Removido a divisão por 1000 pois o consumo já deve estar na unidade correta (metros ou unidades)
            material = calculateMaterialCost(mat, qty);
            requirements.push({
                id: mat.id,
                name: mat.name,
                sku: mat.sku,
                quantity: qty,
                unit: mat.consumptionUnit || 'un',
                type: 'materiaPrima'
            });
            return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName: mat.name };
        }
    } else if (data.type === 'processVariable') {
        labor = Number(data.cost) || 0;
        return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName: data.label };
    }
    return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[], nodeName: data.label };
};

// --- MEMOIZATION SYSTEM ---
const evalCache = new Map<string, any>();
const MAX_CACHE_SIZE = 500;

const getCacheKey = (familia: FamiliaComponente, variables: any, stringVariables: any, config?: EvalConfig) => {
    // Stringify variables
    const varHash = JSON.stringify(variables) + JSON.stringify(stringVariables);
    
    // Hash nodes data deeply so changes in manualTimeSeconds, operators, etc. invalidate cache.
    // Exclude any function properties just in case of stray injected hooks.
    const nodesHash = JSON.stringify(familia.nodes?.map(n => ({
        id: n.id,
        data: Object.fromEntries(Object.entries(n.data).filter(([_, v]) => typeof v !== 'function'))
    })) || []);
    
    const structureHash = `${familia.id}-${nodesHash}-${JSON.stringify(familia.edges || [])}`;
    
    // Ensure changes to hourly rates, operation times, or consumable costs bust the cache
    const opsStr = config?.operations?.map(o => `${o.id}:${o.timeSeconds}:${JSON.stringify(o.operationConsumables)}`).join('|') || '';
    const wsStr = config?.workStations?.map(w => `${w.id}:${w.hourlyRate}`).join('|') || '';
    const consStr = config?.consumables?.map(c => `${c.id}:${c.unitCost}`).join('|') || '';
    const configHash = `${opsStr}-${wsStr}-${consStr}`;

    return `${familia.id}-${varHash}-${structureHash}-${configHash}`;
};

export const clearEvalCache = () => evalCache.clear();
// --- END MEMOIZATION ---

export const evaluateProcess = (
    familia: FamiliaComponente,
    variables: Record<string, number>,
    allInventoryItems: Component[],
    stringVariables: Record<string, string> = {},
    config?: EvalConfig,
    preCalculatedPath?: Set<string>,
    preCalculatedMaps?: { baseMaterialMap: Map<string, Component>, componentSkuMap: Map<string, Component> },
    depth = 0
): { custoMateriaPrima: number; custoFabricacao: number; totalTimeSeconds: number; nodes: Node<ProcessNodeData>[]; costBreakdown: CostStep[]; requirements: ProcessRequirement[]; activePath: Set<string> } => {
    
    // Circular dependency protection
    if (depth > 10) {
        return { custoMateriaPrima: 0, custoFabricacao: 0, totalTimeSeconds: 0, nodes: familia.nodes || [], costBreakdown: [], requirements: [], activePath: new Set<string>() };
    }

    // Memoization check
    const cacheKey = getCacheKey(familia, variables, stringVariables, config);
    if (!preCalculatedPath && evalCache.has(cacheKey)) {
        const cached = evalCache.get(cacheKey);
        // Map cached costs onto current nodes to preserve positions and other non-calculated data
        const updatedNodes = (familia.nodes || []).map(node => {
            const cachedNode = cached.nodes.find((n: any) => n.id === node.id);
            if (cachedNode) {
                return { ...node, data: { ...node.data, cost: cachedNode.data.cost, targetGenerators: cachedNode.data.targetGenerators } };
            }
            return node;
        });
        return { ...cached, nodes: updatedNodes };
    }

    const allVariables: Record<string, number> = {};
    const allStringVariables: Record<string, string> = {};
    
    Object.entries(variables || {}).forEach(([k, v]) => allVariables[k.toLowerCase()] = v);
    Object.entries(stringVariables || {}).forEach(([k, v]) => allStringVariables[k.toLowerCase()] = v);
    
    const baseMaterialMap = preCalculatedMaps?.baseMaterialMap || new Map((allInventoryItems || []).filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = preCalculatedMaps?.componentSkuMap || new Map((allInventoryItems || []).filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c]));
    const maps = { baseMaterialMap, componentSkuMap };

    let dnaNode = familia.nodes?.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
    let codesNode = familia.nodes?.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');

    let finalActivePath = new Set<string>();

    // Herança de contexto: Se a família não tem DNA ou Códigos (comum em montagens), 
    // tenta buscar nos componentes de inventário que apontam para outras famílias.
    if ((!dnaNode || !codesNode) && config?.allFamilias) {
        const invNodes = familia.nodes?.filter(n => n.data.type === 'inventoryComponent' && n.data.sourceFamiliaId) || [];
        for (const node of invNodes) {
            const sourceFam = config.allFamilias?.find(f => f.id === node.data.sourceFamiliaId);
            if (sourceFam) {
                if (!dnaNode) dnaNode = sourceFam.nodes?.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dnaTableNode');
                if (!codesNode) codesNode = sourceFam.nodes?.find(n => (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
            }
            if (dnaNode && codesNode) break;
        }
    }

    let activeDimensionId: string | undefined = undefined;

    const mappingMode = dnaNode?.data.mappingMode || 'thread';
    const primaryVarName = mappingMode === 'diameter' ? 'diametro' : 'bitola';

    if (dnaNode?.data.dimensions && dnaNode.data.dimensions.length > 0) {
        // Tenta encontrar a linha correspondente às variáveis de entrada.
        // Se não houver variáveis (ex: visualização inicial no designer), usa a primeira linha como padrão.
        const normalizeValue = (s: string) => s.replace(',', '.').replace(/^m/i, '').trim();
        
        let vPrimary: string = "";
        if (mappingMode === 'diameter') {
            vPrimary = normalizeValue(String(allStringVariables.diametro || allStringVariables.tubo || allStringVariables.headdiameter || allVariables.diametro || allVariables.tubo || allVariables.headdiameter || ""));
        } else {
            vPrimary = normalizeValue(String(allStringVariables.bitola || allStringVariables.Bitola || allVariables.bitola || (allVariables as any).Bitola || ""));
        }
        
        const vCompr = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || (allVariables as any).Comprimento || ""));

        let row = dnaNode.data.dimensions.find(d => {
            const dPrimary = normalizeValue(String((d as any)[primaryVarName] || (d as any).bitola || (d as any).Bitola || ""));
            const dCompr = normalizeValue(String((d as any).comprimento || (d as any).Comprimento || ""));
            const matchC = (vCompr === "" || vCompr === "0") ? true : dCompr === vCompr;
            return dPrimary === vPrimary && matchC;
        });

        // Even more flexible search for bitola/comprimento/primary
        if (!row && vPrimary) {
            row = dnaNode.data.dimensions.find(d => {
                const primaryKeyInRow = Object.keys(d).find(k => k.toLowerCase() === primaryVarName || k.toLowerCase() === 'bitola' || k.toLowerCase() === 'rosca');
                const comprKey = Object.keys(d).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp');
                
                if (!primaryKeyInRow) return false;
                
                const db = normalizeValue(String(d[primaryKeyInRow] || ""));
                const dc = comprKey ? normalizeValue(String(d[comprKey] || "")) : "0";
                
                const vComprSafe = (vCompr || "0");
                const matchCompr = (vComprSafe === "0" || vComprSafe === "") ? true : dc === vComprSafe;
                
                return db === vPrimary && matchCompr;
            });
        }

        // Final fallback: Always pick the first row if no match is found, so it doesn't break the trace
        if (!row && dnaNode.data.dimensions && dnaNode.data.dimensions.length > 0) {
            row = dnaNode.data.dimensions[0];
        }
        
        if (row) {
            activeDimensionId = row.id;
            // Popula variáveis da linha, mas preserva valores que vieram explicitamente de fora
            Object.entries(row || {}).forEach(([key, value]) => {
                const lowerKey = key.toLowerCase();
                const cleanValue = typeof value === 'string' ? value.replace(',', '.') : value;
                const numValue = (typeof cleanValue === 'number') ? cleanValue : parseFloat(String(cleanValue));
                
                if (allVariables[lowerKey] === undefined && !isNaN(numValue)) {
                    allVariables[lowerKey] = numValue;
                }
                if (allStringVariables[lowerKey] === undefined) {
                    allStringVariables[lowerKey] = (typeof value === 'number' && value % 1 !== 0)
                        ? value.toFixed(2)
                        : String(value ?? "");
                }
            });
            
            // Variáveis de exibição formatadas - Força bitola e comprimento em minúsculo no mapa
            const bitolaKey = Object.keys(row).find(k => k.toLowerCase() === 'bitola') || 'bitola';
            const compKey = Object.keys(row).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp') || 'comprimento';
            
            const bitVal = row[bitolaKey];
            allStringVariables.bitola = (typeof bitVal === 'number' && bitVal % 1 !== 0) 
                ? bitVal.toFixed(2) 
                : String(bitVal || "");
            
            const compRowVal = row[compKey];
            allStringVariables.comprimento = (typeof compRowVal === 'number' && compRowVal % 1 !== 0)
                ? compRowVal.toFixed(2)
                : String(compRowVal || "");
            
            // Formatação inteligente da dimensão (evita x0 em itens sem comprimento)
            const compVal = parseFloat(allStringVariables.comprimento || "0");
            if (compVal === 0 || isNaN(compVal)) {
                allStringVariables.dimensao = `M${allStringVariables.bitola}`;
            } else {
                allStringVariables.dimensao = `M${allStringVariables.bitola}x${allStringVariables.comprimento}`;
            }

            // --- INJECT HEAD DIAMETER AND TUBO RULE (USER SPECIFIC) ---
            const bitolaNum = allVariables.bitola;
            if (bitolaNum) {
                let headDiameter = 0;
                let tuboDiameter = 0;
                
                // Normalization: Map legacy head diameters to thread sizes or tube sizes
                // 15.85 is often used as a smaller head for M5/M6 in some legacy data
                if (bitolaNum === 5 || bitolaNum === 6 || bitolaNum === 19.05 || bitolaNum === 15.85) {
                    headDiameter = 19.05;
                    tuboDiameter = 10;
                }
                else if (bitolaNum === 8 || bitolaNum === 22.22) {
                    headDiameter = 22.22;
                    tuboDiameter = 12.7;
                }
                else if (bitolaNum === 10 || bitolaNum === 12 || bitolaNum === 25.4) {
                    headDiameter = 25.4;
                    tuboDiameter = 15.87;
                }
                else if (bitolaNum === 14 || bitolaNum === 31.75) {
                    headDiameter = 31.75;
                    tuboDiameter = 19.05;
                }

                if (headDiameter > 0) {
                    allVariables.diametrocabeca = headDiameter;
                    allStringVariables.diametrocabeca = String(headDiameter).replace('.', ',');
                    allVariables.headdiameter = headDiameter;
                    allStringVariables.headdiameter = String(headDiameter).replace('.', ',');
                    
                    if (tuboDiameter > 0) {
                        allVariables.tubo = tuboDiameter;
                        allStringVariables.tubo = String(tuboDiameter).replace('.', ',');
                    }
                    
                    // Also update moedabitola and flangebitola
                    if (allVariables.moedabitola === undefined || (bitolaNum >= 15 && bitolaNum <= 32)) {
                        allVariables.moedabitola = headDiameter;
                        allStringVariables.moedabitola = String(headDiameter).replace('.', ',');
                    }
                    if (allVariables.flangebitola === undefined || (bitolaNum >= 15 && bitolaNum <= 32)) {
                        allVariables.flangebitola = headDiameter;
                        allStringVariables.flangebitola = String(headDiameter).replace('.', ',');
                    }
                }
            }
            // --- END USER SPECIFIC RULE ---

            // Specialized formatting for SKUs (e.g. 25.4 -> 25.40)
            const formatForSku = (v: any) => {
                const n = parseFloat(String(v).replace(',', '.'));
                if (isNaN(n)) return String(v);
                return n % 1 !== 0 ? n.toFixed(2) : String(n);
            };

            allStringVariables.fbitola = formatForSku(allVariables.bitola || 0);
            allStringVariables.fdiametro = formatForSku(allVariables.diametrocabeca || allVariables.headdiameter || 0);
            allStringVariables.fmoeda = formatForSku(allVariables.moedabitola || 0);
            allStringVariables.fflange = formatForSku(allVariables.flangebitola || 0);
            allStringVariables.ftubo = formatForSku(allVariables.tubo || 0);

            // Se a linha do DNA tem um código (code), usa ele como headCode se não houver um definido
            if (row.code && !allStringVariables.headCode) {
                allStringVariables.headCode = row.code;
            }
        } else {
            // Se não encontrou a linha mas temos variáveis, garante que elas estão nos formatos corretos
            if (!allStringVariables.bitola && allVariables.bitola !== undefined) allStringVariables.bitola = String(allVariables.bitola);
            if (!allStringVariables.comprimento && allVariables.comprimento !== undefined) allStringVariables.comprimento = String(allVariables.comprimento);
            
            const bitolaStr = allStringVariables.bitola || '0';
            const compVal = parseFloat(allStringVariables.comprimento || '0');
            if (compVal === 0 || isNaN(compVal)) {
                allStringVariables.dimensao = `M${bitolaStr}`;
            } else {
                allStringVariables.dimensao = `M${bitolaStr}x${compVal}`;
            }
        }
    }

    if (codesNode?.data.headCodes && codesNode.data.headCodes.length > 0) {
        const hc = codesNode.data.headCodes.find((c: any) => String(c.code).toLowerCase().trim() === String(allStringVariables.headCode || "").toLowerCase().trim()) 
                 || (allStringVariables.headCode ? null : codesNode.data.headCodes[0]);
        if (hc) {
            allStringVariables.headCode = hc.code;
        }
    }

    const generatorNodes = familia.nodes?.filter(n => 
        (n.data.type as string) === 'productGenerator' || 
        (n.data.type as string) === 'finalProduct' || 
        (n.data.type as string) === 'productGeneratorNode' ||
        (n.data.type as string) === 'final' ||
        (n.data.type as string) === 'finalNode'
    ) || [];
    
    // If no generators, use all nodes that have no outgoing edges as "virtual generators"
    let effectiveGenerators = [...generatorNodes];
    if (effectiveGenerators.length === 0) {
        effectiveGenerators = (familia.nodes || []).filter(n => {
            const hasOutgoing = (familia.edges || []).some(e => e.source === n.id);
            const isConfig = ['dnaTable', 'dimensionTable', 'dnaTableNode', 'headCodeTable', 'codificationTable', 'codificationTableNode'].includes(n.data.type as string);
            return !hasOutgoing && !isConfig;
        });
    }

    if (effectiveGenerators.length === 0 && (familia.nodes || []).length > 0) {
        // Last resort: if no dead ends (e.g. only cycles or single table), use all non-config nodes
        effectiveGenerators = (familia.nodes || []).filter(n => !['dnaTable', 'dimensionTable', 'dnaTableNode', 'headCodeTable', 'codificationTable', 'codificationTableNode'].includes(n.data.type as string));
    }

    if (effectiveGenerators.length === 0) return { custoMateriaPrima: 0, custoFabricacao: 0, totalTimeSeconds: 0, nodes: familia.nodes || [], costBreakdown: [], requirements: [], activePath: new Set<string>() };

    if (preCalculatedPath) {
        finalActivePath = preCalculatedPath;
    } else {
        // ALGORITMO DE TRACE (SINAL DE CUSTO)
        const activeForward = new Set<string>();
        
        // Identifica pontos de partida: tabelas de configuração OU nós sem entradas (raízes do processo)
        const startNodes = (familia.nodes || []).filter(n => {
            const type = n.data.type as string;
            const isConfigTable = ['dnaTable', 'dimensionTable', 'dnaTableNode', 'headCodeTable', 'codificationTable', 'codificationTableNode'].includes(type);
            if (isConfigTable) return true;
            
            // Se não for tabela, mas não tiver entradas, também é um ponto de partida (ex: componentes de inventário em montagens)
            const hasIncomingEdges = (familia.edges || []).some(e => e.target === n.id);
            return !hasIncomingEdges;
        });

        const queue = [...startNodes.map(n => n.id)];
        (startNodes || []).forEach(n => activeForward.add(n.id));

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const outgoingEdges = (familia.edges || []).filter(e => e.source === currentId);
            outgoingEdges.forEach(edge => {
                let canPass = true;
                // Se o sinal sai de uma linha (Roxa), ele só passa se for a linha ativa
                if (edge.sourceHandle?.startsWith('row-')) {
                    const handleId = edge.sourceHandle.replace('row-', '');
                    if (handleId !== activeDimensionId) canPass = false; 
                }
                // Se o sinal entra em uma linha (Roxa), ele só passa se for a linha ativa
                if (edge.targetHandle?.startsWith('row-')) {
                    const handleId = edge.targetHandle.replace('row-', '');
                    if (handleId !== activeDimensionId) canPass = false; 
                }
                if (canPass && !activeForward.has(edge.target)) {
                    activeForward.add(edge.target);
                    queue.push(edge.target);
                }
            });
        }

        const reachesGenerator = new Set<string>();
        const backwardQueue = [...effectiveGenerators.map(n => n.id)];
        effectiveGenerators.forEach(n => reachesGenerator.add(n.id));
        
        while (backwardQueue.length > 0) {
            const curr = backwardQueue.shift()!;
            (familia.edges || []).filter(e => e.target === curr).forEach(e => {
                if (!reachesGenerator.has(e.source)) {
                    reachesGenerator.add(e.source);
                    backwardQueue.push(e.source);
                }
            });
        }

        finalActivePath = new Set([...activeForward].filter(id => reachesGenerator.has(id)));
    }
    let totalMaterial = 0;
    let totalLabor = 0;
    let totalTimeSeconds = 0;
    const requirements: ProcessRequirement[] = [];
    const breakdown: CostStep[] = [];
    
    // Optimization: Calculate all node values once and store them
    const nodeResultsMap = new Map<string, any>();
    (familia.nodes || []).forEach(node => {
        if (finalActivePath.has(node.id)) {
            const res = calculateNodeValue(node, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
            nodeResultsMap.set(node.id, res);
        }
    });

    const nodeCostMap = new Map<string, number>();
    const nodeTargetsMap = new Map<string, string[]>();

    (familia.nodes || []).forEach(node => {
        const isGenerator = effectiveGenerators.some(gn => gn.id === node.id);
        
        // Determinar para quais geradores este nó contribui
        const targets: string[] = [];
        effectiveGenerators.forEach(gn => {
            const individualReaches = new Set<string>();
            const q = [gn.id];
            individualReaches.add(gn.id);
            while(q.length > 0) {
                const c = q.shift()!;
                (familia.edges || []).filter(e => e.target === c).forEach(e => {
                    if (!individualReaches.has(e.source)) {
                        individualReaches.add(e.source);
                        q.push(e.source);
                    }
                });
            }
            if (individualReaches.has(node.id)) {
                targets.push(gn.data.label || familia.nome || 'Produto');
            }
        });
        nodeTargetsMap.set(node.id, targets);

        if (finalActivePath.has(node.id) && !isGenerator) {
            const res = nodeResultsMap.get(node.id);
            if (!res) return;
            
            const nodeTotal = res.material + res.labor;
            totalMaterial += res.material;
            totalLabor += res.labor;
            totalTimeSeconds += (res.timeSeconds || 0);
            requirements.push(...res.requirements);
            if (nodeTotal > 0 || res.timeSeconds! > 0) {
                breakdown.push({ nodeId: node.id, name: res.nodeName || node.data.label, type: (res.labor > 0 || res.timeSeconds! > 0) ? 'labor' : 'material', cost: nodeTotal, timeSeconds: res.timeSeconds });
                
                // Add sub-steps (like consumables) to the breakdown
                if (res.subSteps && res.subSteps.length > 0) {
                    res.subSteps.forEach((ss: CostStep) => {
                        breakdown.push({
                            ...ss,
                            name: `   + ${ss.name}`, // Indent sub-steps
                        });
                    });
                }
                
                nodeCostMap.set(node.id, nodeTotal);
            }
        }
    });

    const updatedNodes = (familia.nodes || []).map(node => {
        let displayCost = nodeCostMap.get(node.id) || 0;
        const isGenerator = effectiveGenerators.some(gn => gn.id === node.id);
        const targets = nodeTargetsMap.get(node.id) || [];
        
        if (isGenerator) {
            // Para geradores, o custo é o que chega neles (trace reverso individual)
            const individualReaches = new Set<string>();
            const q = [node.id];
            individualReaches.add(node.id);
            while(q.length > 0) {
                const c = q.shift()!;
                (familia.edges || []).filter(e => e.target === c).forEach(e => {
                    if (!individualReaches.has(e.source)) {
                        individualReaches.add(e.source);
                        q.push(e.source);
                    }
                });
            }
            
            let genMaterial = 0;
            let genLabor = 0;
            (familia.nodes || []).forEach(n => {
                if (individualReaches.has(n.id) && finalActivePath.has(n.id)) {
                    const res = nodeResultsMap.get(n.id);
                    if (res) {
                        genMaterial += res.material;
                        genLabor += res.labor;
                    }
                }
            });
            displayCost = genMaterial + genLabor;
        }
        
        return { ...node, data: { ...node.data, cost: displayCost, targetGenerators: targets } };
    });

    // O custo total da família para fins de exibição no cabeçalho será o do ÚLTIMO gerador 
    // ou a soma de todos os nós terminais que não são tabelas de configuração.
    let reportMaterial = 0;
    let reportLabor = 0;
    
    const terminalNodes = updatedNodes.filter(n => {
        const hasOutgoing = (familia.edges || []).some(e => e.source === n.id);
        const isConfig = ['dnaTable', 'dimensionTable', 'dnaTableNode', 'headCodeTable', 'codificationTable', 'codificationTableNode'].includes(n.data.type as string);
        return !hasOutgoing && !isConfig;
    });

    if (terminalNodes.length > 0) {
        terminalNodes.forEach(tn => {
            const individualReaches = new Set<string>();
            const q = [tn.id];
            individualReaches.add(tn.id);
            while(q.length > 0) {
                const c = q.shift()!;
                (familia.edges || []).filter(e => e.target === c).forEach(e => {
                    if (!individualReaches.has(e.source)) {
                        individualReaches.add(e.source);
                        q.push(e.source);
                    }
                });
            }
            (familia.nodes || []).forEach(n => {
                if (individualReaches.has(n.id) && finalActivePath.has(n.id)) {
                    const res = nodeResultsMap.get(n.id);
                    if (res) {
                        reportMaterial += res.material;
                        reportLabor += res.labor;
                    }
                }
            });
        });
    } else {
        // Fallback robusto: se não houver terminais claros, usamos a soma de tudo que foi calculado no loop de processamento
        reportMaterial = totalMaterial;
        reportLabor = totalLabor;
    }

    // Agregar requisitos duplicados (se vários nós usarem o mesmo insumo/materia-prima)
    const requirementsMap: Record<string, any> = {};
    requirements.forEach(req => {
        const key = `${req.type}-${req.id}`;
        if (requirementsMap[key]) {
            requirementsMap[key].quantity += req.quantity;
        } else {
            requirementsMap[key] = { ...req };
        }
    });

    const result = { 
        custoMateriaPrima: reportMaterial || totalMaterial, 
        custoFabricacao: reportLabor || totalLabor, 
        totalTimeSeconds, 
        nodes: updatedNodes, 
        costBreakdown: breakdown, 
        requirements: Object.values(requirementsMap),
        activePath: finalActivePath
    };
    
    // Store in cache
    if (!preCalculatedPath) {
        if (evalCache.size >= MAX_CACHE_SIZE) {
            const firstKey = evalCache.keys().next().value;
            if (firstKey) evalCache.delete(firstKey);
        }
        evalCache.set(cacheKey, result);
    }

    return result;
};

export const generateAllProductsForFamilia = (
    familia: FamiliaComponente,
    allInventoryItems: Component[],
    kits: Kit[],
    config: EvalConfig
): GeneratedProduct[] => {
    const generatorNodes = familia.nodes?.filter(n => (n.data.type as string) === 'productGenerator' || (n.data.type as string) === 'productGeneratorNode') || [];
    if (generatorNodes.length === 0) return [];

    const products: GeneratedProduct[] = [];
    
    const baseMaterialMap = new Map((allInventoryItems || []).filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = new Map((allInventoryItems || []).filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c]));
    const maps = { baseMaterialMap, componentSkuMap };

    generatorNodes.forEach(genNode => {
        const { nameTemplate, skuTemplate, defaultSourcing } = genNode.data.generationConfig || { nameTemplate: '', skuTemplate: '', defaultSourcing: 'manufactured' };
        
        let dnaNode = familia.nodes?.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
        let codesNode = familia.nodes?.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
        
        if (!dnaNode || !codesNode) {
            const inheritNodes = familia.nodes?.filter(n => n.data.type === 'inventoryComponent' && n.data.sourceFamiliaId) || [];
            for (const node of inheritNodes) {
                const sourceFam = config.allFamilias?.find(f => f.id === node.data.sourceFamiliaId);
                if (sourceFam) {
                    if (!dnaNode) {
                        dnaNode = sourceFam.nodes?.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
                    }
                    if (!codesNode) {
                        codesNode = sourceFam.nodes?.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
                    }
                }
                if (dnaNode && codesNode) break;
            }
        }

        const dimensions = dnaNode?.data.dimensions || [{ id: 'default', bitola: 0, comprimento: 0 }];
        const headCodes = codesNode?.data.headCodes || [{ id: 'default', code: '' }];

        // Pre-calculate paths for each dimension to avoid redundant trace algorithms
        const dimensionPaths = new Map<string, Set<string>>();
        
        (dimensions || []).forEach(dim => {
            // Calculate path once for this dimension
            const initialRes = evaluateProcess(familia, { bitola: dim.bitola, comprimento: dim.comprimento }, allInventoryItems, {}, config, undefined, maps);
            const activePath = initialRes.activePath;
            
            (headCodes || []).forEach(hc => {
                const vars = { bitola: dim.bitola, comprimento: dim.comprimento };
                const sVars: Record<string, string> = { 
                    headCode: hc.code, 
                    bitola: String(dim.bitola), 
                    comprimento: String(dim.comprimento), 
                    dimensao: `${dim.bitola}x${dim.comprimento}` 
                };
                // Support DNA custom columns (like FBITOLA) in templates
                Object.entries(dim).forEach(([k, v]) => {
                    if (k !== 'id') sVars[k] = String(v);
                });

                if (dim.diametro !== undefined) {
                    sVars.diametro = String(dim.diametro);
                }
                
                // Avaliamos o processo especificamente para este gerador
                // Passamos o activePath do initialRes (que foi calculado para esta dimensão)
                const res = evaluateProcess(familia, vars, allInventoryItems, sVars, config, activePath, maps);
                
                // Encontrar o custo específico deste gerador nos nós atualizados
                const updatedGenNode = res.nodes.find(n => n.id === genNode.id);
                const genCost = updatedGenNode?.data.cost || 0;
                
                // Aqui precisamos de uma forma de separar custo de fabricação e matéria prima para este gerador específico
                // Por simplicidade, vamos usar a proporção do custo total da família ou recalcular o trace reverso
                const individualReaches = new Set<string>();
                const q = [genNode.id];
                individualReaches.add(genNode.id);
                while(q.length > 0) {
                    const c = q.shift()!;
                    (familia.edges || []).filter(e => e.target === c).forEach(e => {
                        if (!individualReaches.has(e.source)) {
                            individualReaches.add(e.source);
                            q.push(e.source);
                        }
                    });
                }
                
                let genMaterial = 0;
                let genLabor = 0;
                res.nodes.forEach(n => {
                    // Verificamos se o nó está no caminho ativo e contribui para este gerador
                    if (individualReaches.has(n.id) && activePath.has(n.id) && n.id !== genNode.id) {
                        // Recalculamos o valor do nó para este contexto
                        const nodeVal = calculateNodeValue(n, allInventoryItems, sVars, vars, config, dim.id, maps);
                        genMaterial += nodeVal.material;
                        genLabor += nodeVal.labor;
                    }
                });

                let name = nameTemplate || '', sku = skuTemplate || '';
                Object.entries(sVars || {}).forEach(([k, v]) => {
                    name = name.replace(new RegExp(`{${k}}`, 'gi'), v);
                    sku = sku.replace(new RegExp(`{${k}}`, 'gi'), v);
                });
                
                if (sku) {
                    const upperSku = sku.toUpperCase();
                    if (products.some(p => p.sku === upperSku)) return;

                    const filteredBreakdown = res.costBreakdown.filter(b => individualReaches.has(b.nodeId));
                    products.push({ 
                        name, 
                        sku: upperSku, 
                        custoFabricacao: genLabor, 
                        custoMateriaPrima: genMaterial, 
                        defaultSourcing, 
                        costBreakdown: filteredBreakdown,
                        familiaId: familia.id
                    });
                }
            });
        });
    });
    
    return products;
};
