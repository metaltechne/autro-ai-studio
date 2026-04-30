
import { FamiliaComponente, Component, Kit, WorkStation, Consumable, StandardOperation, GeneratedProduct, ProcessNodeData, CostStep } from '../types';
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
    if ((component.sourcing === 'purchased' || component.type === 'raw_material') && component.purchaseCost) {
        const divisor = (component.purchaseQuantity && component.purchaseQuantity > 0) ? component.purchaseQuantity : 1;
        return component.purchaseCost / divisor;
    }
    return (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0);
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
    const data = node.data;
    let material = 0;
    let labor = 0;
    let timeSeconds = 0;
    const requirements: ProcessRequirement[] = [];

    const baseMaterialMap = maps?.baseMaterialMap || new Map((allInventoryItems || []).filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = maps?.componentSkuMap || new Map((allInventoryItems || []).filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c]));

    const type = (data.type as string) || '';
    const isMaterialMapping = type === 'materialMapping' || type === 'materialMappingNode';
    const isServiceMapping = type === 'serviceMapping' || type === 'serviceMappingNode';
    const isSubProcessMapping = type === 'subProcessMapping' || type === 'subProcessMappingNode';

    if ((isMaterialMapping || isServiceMapping || isSubProcessMapping) && data.dimensions) {
        // Find row by ID first, then by bitola/comprimento as fallback (case-insensitive)
        let row = data.dimensions.find(d => d.id === activeDimensionId);
        
        const normalizeValue = (s: string) => s.replace(',', '.').replace(/^m/i, '').trim();

        if (!row && (allVariables.bitola !== undefined || allStringVariables.bitola !== undefined)) {
             row = data.dimensions.find(d => {
                const dBitola = normalizeValue(String((d as any).bitola || (d as any).Bitola || ""));
                const dCompr = normalizeValue(String((d as any).comprimento || (d as any).Comprimento || ""));
                const vBitola = normalizeValue(String(allStringVariables.bitola || allStringVariables.Bitola || allVariables.bitola || ""));
                const vCompr = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || "0"));
                const matchC = (vCompr === "" || vCompr === "0") ? true : dCompr === vCompr;
                return dBitola === vBitola && matchC;
             });
        }
        
        // Even more flexible: check ANY key for bitola-like and comprimento-like names
        if (!row && (allVariables.bitola !== undefined || allStringVariables.bitola !== undefined)) {
            row = data.dimensions.find(d => {
                const bitolaKey = Object.keys(d).find(k => k.toLowerCase() === 'bitola');
                const comprKey = Object.keys(d).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp');
                
                if (!bitolaKey) return false;
                
                const dBitola = normalizeValue(String(d[bitolaKey] || ""));
                const dCompr = comprKey ? normalizeValue(String(d[comprKey] || "")) : "0";
                
                const vBitola = normalizeValue(String(allStringVariables.bitola || allStringVariables.Bitola || allVariables.bitola || ""));
                const vComprSafe = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || "0"));
                
                const matchC = (vComprSafe === "0" || vComprSafe === "") ? true : dCompr === vComprSafe;
                return dBitola === vBitola && matchC;
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
                // Add machining costs from row if present
                if (row.headMachiningCost) labor += Number(row.headMachiningCost) || 0;
                if (row.bodyPieceCost) labor += Number(row.bodyPieceCost) || 0;
            } else if (isServiceMapping) {
                labor = Number(row.serviceCost) || 0;
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
        if (mode === 'fixed') {
            labor = Number(data.fixedCost) || 0;
        } else if (mode === 'workstation') {
            const ws = config?.workStations?.find(w => w.id === data.workStationId);
            labor = ws?.hourlyRate || 0;
            timeSeconds = 3600; // 1 hour default for workstation mode if not specified
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
            return { material, labor, requirements, timeSeconds, subSteps };
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
        
        const item = targetSku ? componentSkuMap.get(targetSku.toUpperCase()) : undefined;
        const qty = data.consumption || 1;

        if (item) {
            material = getComponentCost(item) * qty;
            requirements.push({
                id: item.id,
                name: item.name,
                sku: item.sku,
                quantity: qty,
                unit: item.consumptionUnit || 'un',
                type: 'inventoryComponent',
                familiaId: item.familiaId
            });
        } else {
            // Se não encontrou o item físico, ainda assim adicionamos o requisito nominal para o planejamento
            requirements.push({
                id: targetSku || data.componentId || 'unknown',
                name: data.label || targetSku || 'Componente',
                sku: targetSku || 'N/A',
                quantity: qty,
                unit: 'un',
                type: 'inventoryComponent',
                familiaId: data.sourceFamiliaId
            });

            if (data.sourceFamiliaId && config?.allFamilias) {
                const sourceFam = config.allFamilias.find(f => f.id === data.sourceFamiliaId);
                
                if (sourceFam) {
                    console.log("Subprocess eval for", sourceFam.nome, mappedVariables, mappedStringVariables);
                    const subRes = evaluateProcess(sourceFam, mappedVariables, allInventoryItems, mappedStringVariables, config, undefined, maps, (depth || 0) + 1);
                    
                    // Se for um item fixo (não dinâmico), ele é considerado um "produto acabado" na explosão, 
                    // logo tudo vira custo de material. Se for dinâmico (Processo Vinculado), preservamos 
                    // a divisão de material e mão-de-obra para a composição final do pai.
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

                    // Propagate sub-process breakdown as sub-steps
                    const subSteps: CostStep[] = (subRes.costBreakdown || []).map(step => ({
                        ...step,
                        cost: step.cost * qty,
                        timeSeconds: step.timeSeconds ? step.timeSeconds * qty : undefined,
                        name: `[${sourceFam.nome}] ${step.name}`
                    }));
                    
                    return { material, labor, requirements, timeSeconds, subSteps };
                }
            }
        }
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
        }
    } else if (data.type === 'processVariable') {
        labor = Number(data.cost) || 0;
    }
    return { material, labor, requirements, timeSeconds, subSteps: [] as CostStep[] };
};

// --- MEMOIZATION SYSTEM ---
const evalCache = new Map<string, any>();
const MAX_CACHE_SIZE = 500;

const getCacheKey = (familia: FamiliaComponente, variables: any, stringVariables: any, config?: EvalConfig) => {
    // Include edges and node data in cache key to invalidate on structural changes,
    // but exclude node positions to keep cache valid during drag and drop.
    const structureHash = JSON.stringify({
        edges: familia.edges,
        nodesData: familia.nodes?.map(n => n.data)
    });
    
    // Also hash the config (costs, hourly rates, etc) to invalidate when those change
    const configHash = config ? JSON.stringify({
        opCount: config.operations?.length,
        ops: config.operations?.map(o => ({ id: o.id, time: o.timeSeconds, cons: o.operationConsumables })),
        ws: config.workStations?.map(w => ({ id: w.id, rate: w.hourlyRate })),
        cons: config.consumables?.map(c => ({ id: c.id, cost: c.unitCost }))
    }) : '';

    return `${familia.id}-${JSON.stringify(variables)}-${JSON.stringify(stringVariables)}-${structureHash}-${configHash}`;
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
        console.error(`[Evaluator] Circular dependency detected in family: ${familia.nome}`);
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

    if (dnaNode?.data.dimensions && dnaNode.data.dimensions.length > 0) {
        // Tenta encontrar a linha correspondente às variáveis de entrada.
        // Se não houver variáveis (ex: visualização inicial no designer), usa a primeira linha como padrão.
        const normalizeValue = (s: string) => s.replace(',', '.').replace(/^m/i, '').trim();
        const vBitola = normalizeValue(String(allStringVariables.bitola || allStringVariables.Bitola || allVariables.bitola || (allVariables as any).Bitola || ""));
        const vCompr = normalizeValue(String(allStringVariables.comprimento || allStringVariables.Comprimento || allVariables.comprimento || (allVariables as any).Comprimento || ""));

        let row = dnaNode.data.dimensions.find(d => {
            const dBitola = normalizeValue(String((d as any).bitola || (d as any).Bitola || ""));
            const dCompr = normalizeValue(String((d as any).comprimento || (d as any).Comprimento || ""));
            const matchC = (vCompr === "" || vCompr === "0") ? true : dCompr === vCompr;
            return dBitola === vBitola && matchC;
        });

        // Even more flexible search for bitola/comprimento
        if (!row && vBitola) {
            row = dnaNode.data.dimensions.find(d => {
                const bitolaKey = Object.keys(d).find(k => k.toLowerCase() === 'bitola');
                const comprKey = Object.keys(d).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp');
                
                if (!bitolaKey) return false;
                
                const db = normalizeValue(String(d[bitolaKey] || ""));
                const dc = comprKey ? normalizeValue(String(d[comprKey] || "")) : "0";
                
                const vComprSafe = (vCompr || "0");
                const matchCompr = vComprSafe === "0" ? true : dc === vComprSafe;
                
                return db === vBitola && matchCompr;
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
                    allStringVariables[lowerKey] = String(value ?? '');
                }
            });
            
            // Variáveis de exibição formatadas - Força bitola e comprimento em minúsculo no mapa
            const bitolaKey = Object.keys(row).find(k => k.toLowerCase() === 'bitola') || 'bitola';
            const compKey = Object.keys(row).find(k => k.toLowerCase() === 'comprimento' || k.toLowerCase() === 'comp') || 'comprimento';
            
            allStringVariables.bitola = String(row[bitolaKey] || "");
            allStringVariables.comprimento = String(row[compKey] || "");
            
            // Formatação inteligente da dimensão (evita x0 em itens sem comprimento)
            const compVal = parseFloat(allStringVariables.comprimento || "0");
            if (compVal === 0 || isNaN(compVal)) {
                allStringVariables.dimensao = `M${allStringVariables.bitola}`;
            } else {
                allStringVariables.dimensao = `M${allStringVariables.bitola}x${allStringVariables.comprimento}`;
            }

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
            const res = calculateNodeValue(node, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
            const nodeTotal = res.material + res.labor;
            totalMaterial += res.material;
            totalLabor += res.labor;
            totalTimeSeconds += (res.timeSeconds || 0);
            requirements.push(...res.requirements);
            if (nodeTotal > 0 || res.timeSeconds! > 0) {
                console.log(`Pushing to breakdown initially: ${node.data.label} = ${nodeTotal} (material: ${res.material}, labor: ${res.labor})`);
                breakdown.push({ nodeId: node.id, name: node.data.label, type: (res.labor > 0 || res.timeSeconds! > 0) ? 'labor' : 'material', cost: nodeTotal, timeSeconds: res.timeSeconds });
                
                // Add sub-steps (like consumables) to the breakdown
                if ((res as any).subSteps && (res as any).subSteps.length > 0) {
                    (res as any).subSteps.forEach((ss: CostStep) => {
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

    console.log(`Initial evaluateProcess complete. Breakdown length: ${breakdown.length}`);

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
                    const res = calculateNodeValue(n, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
                    genMaterial += res.material;
                    genLabor += res.labor;
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
                    const res = calculateNodeValue(n, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
                    reportMaterial += res.material;
                    reportLabor += res.labor;
                }
            });
        });
    } else {
        // Fallback robusto: se não houver terminais claros, usamos a soma de tudo que foi calculado no loop de processamento
        reportMaterial = totalMaterial;
        reportLabor = totalLabor;
    }

    const result = { 
        custoMateriaPrima: reportMaterial || totalMaterial, 
        custoFabricacao: reportLabor || totalLabor, 
        totalTimeSeconds, 
        nodes: updatedNodes, 
        costBreakdown: breakdown, 
        requirements,
        activePath: finalActivePath
    };
    
    console.log("EvaluateProcess Returning for", familia.nome, result.custoMateriaPrima, result.custoFabricacao, "Path:", Array.from(finalActivePath));

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
                        console.log(`NodeVal for ${n.id} with dim ${dim.id}: mat: ${nodeVal.material} lab: ${nodeVal.labor}`);
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
                    const filteredBreakdown = res.costBreakdown.filter(b => individualReaches.has(b.nodeId));
                    console.log(`Generated SK: ${sku}. genLabor=${genLabor}, genMaterial=${genMaterial}. Breakdown count: ${filteredBreakdown.length}`);
                    products.push({ 
                        name, 
                        sku: sku?.toUpperCase() || '', 
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
