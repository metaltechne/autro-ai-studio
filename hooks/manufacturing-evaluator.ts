
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
        const row = data.dimensions.find(d => d.id === activeDimensionId);
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
                if (row.headMachiningCost) labor += row.headMachiningCost;
                if (row.bodyPieceCost) labor += row.bodyPieceCost;
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
            const ws = config?.workStations?.find(w => w.id === (data.manualOperatorId || op?.workStationId));
            const time = data.manualTimeSeconds !== undefined ? data.manualTimeSeconds : (op?.timeSeconds || 0);
            timeSeconds = Number(time);
            labor = (timeSeconds / 3600) * (ws?.hourlyRate || 0);
            const consCost = (op?.operationConsumables || []).reduce((sum, oc) => {
                const c = config?.consumables?.find(item => item.id === oc.consumableId);
                if (c) {
                    requirements.push({
                        id: c.id,
                        name: c.name,
                        sku: c.id, // Using ID as SKU for consumables if not available
                        quantity: oc.quantity || 0,
                        unit: c.unit,
                        type: 'inventoryComponent' // Treating as inventory component for requirement tracking
                    });
                }
                return sum + ((oc.quantity || 0) * (c?.unitCost || 0));
            }, 0);
            labor += consCost;
        }
    } else if (data.type === 'inventoryComponent') {
        let targetSku = data.componentIdTemplate || "";
        if (targetSku) {
            Object.entries(allStringVariables || {}).forEach(([k, v]) => targetSku = targetSku.replace(new RegExp(`{${k}}`, 'gi'), v));
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
                    const subRes = evaluateProcess(sourceFam, allVariables, allInventoryItems, allStringVariables, config, undefined, maps, (depth || 0) + 1);
                    material = (subRes.custoMateriaPrima + subRes.custoFabricacao) * qty;
                    timeSeconds = subRes.totalTimeSeconds * qty;
                    // Multiplicamos os requisitos da explosão pela quantidade necessária deste componente
                    requirements.push(...subRes.requirements.map(r => ({ ...r, quantity: r.quantity * qty })));
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
    return { material, labor, requirements, timeSeconds };
};

// --- MEMOIZATION SYSTEM ---
const evalCache = new Map<string, any>();
const MAX_CACHE_SIZE = 500;

const getCacheKey = (familia: FamiliaComponente, variables: any, stringVariables: any) => {
    // Include edges and node data in cache key to invalidate on structural changes,
    // but exclude node positions to keep cache valid during drag and drop.
    const structureHash = JSON.stringify({
        edges: familia.edges,
        nodesData: familia.nodes?.map(n => n.data)
    });
    return `${familia.id}-${JSON.stringify(variables)}-${JSON.stringify(stringVariables)}-${structureHash}`;
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
    const cacheKey = getCacheKey(familia, variables, stringVariables);
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

    const allVariables = { ...variables };
    const allStringVariables = { ...stringVariables };
    
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
        const row = dnaNode.data.dimensions.find(d => d.bitola === allVariables.bitola && d.comprimento === allVariables.comprimento) 
                  || (Object.keys(variables).length === 0 ? dnaNode.data.dimensions[0] : null);
        
        if (row) {
            activeDimensionId = row.id;
            // Popula variáveis da linha, mas preserva valores que vieram explicitamente de fora
            Object.entries(row || {}).forEach(([key, value]) => {
                if (allVariables[key] === undefined && typeof value === 'number') allVariables[key] = value;
                if (allStringVariables[key] === undefined) allStringVariables[key] = String(value);
            });
            
            // Variáveis de exibição formatadas
            if (!allStringVariables.bitola) allStringVariables.bitola = String(row.bitola);
            if (!allStringVariables.comprimento) allStringVariables.comprimento = String(row.comprimento);
            
            // Formatação inteligente da dimensão (evita x0 em itens sem comprimento)
            const compVal = parseFloat(allStringVariables.comprimento);
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
            if (allVariables.bitola !== undefined) allStringVariables.bitola = String(allVariables.bitola);
            if (allVariables.comprimento !== undefined) allStringVariables.comprimento = String(allVariables.comprimento);
            
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
        const hc = codesNode.data.headCodes.find((c: any) => c.code === allStringVariables.headCode) 
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
    
    if (generatorNodes.length === 0) return { custoMateriaPrima: 0, custoFabricacao: 0, totalTimeSeconds: 0, nodes: familia.nodes || [], costBreakdown: [], requirements: [], activePath: new Set<string>() };

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
        const backwardQueue = [...generatorNodes.map(n => n.id)];
        generatorNodes.forEach(n => reachesGenerator.add(n.id));
        
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
        const isGenerator = generatorNodes.some(gn => gn.id === node.id);
        
        // Determinar para quais geradores este nó contribui
        const targets: string[] = [];
        generatorNodes.forEach(gn => {
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
                targets.push(gn.data.label || 'Produto');
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
                breakdown.push({ nodeId: node.id, name: node.data.label, type: (res.labor > 0 || res.timeSeconds! > 0) ? 'labor' : 'material', cost: nodeTotal, timeSeconds: res.timeSeconds });
                nodeCostMap.set(node.id, nodeTotal);
            }
        }
    });

    const updatedNodes = (familia.nodes || []).map(node => {
        let displayCost = nodeCostMap.get(node.id) || 0;
        const isGenerator = generatorNodes.some(gn => gn.id === node.id);
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
                if (individualReaches.has(n.id) && n.id !== node.id && finalActivePath.has(n.id)) {
                    const res = calculateNodeValue(n, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
                    genMaterial += res.material;
                    genLabor += res.labor;
                }
            });
            displayCost = genMaterial + genLabor;
        }
        
        return { ...node, data: { ...node.data, cost: displayCost, targetGenerators: targets } };
    });

    // O custo total da família para fins de exibição no cabeçalho será o do ÚLTIMO gerador (geralmente o produto final)
    // ou a soma se forem independentes. Vamos usar o custo do gerador que não tem saídas para outros geradores.
    const finalGenerators = generatorNodes.filter(gn => 
        !(familia.edges || []).some(e => e.source === gn.id && generatorNodes.some(other => other.id === e.target))
    );
    
    let reportMaterial = 0;
    let reportLabor = 0;
    
    if (finalGenerators.length > 0) {
        finalGenerators.forEach(fg => {
            const nodeWithCost = updatedNodes.find(un => un.id === fg.id);
            // Aqui simplificamos: o custo total reportado é a soma dos geradores "finais"
            // Se houver apenas um, é o custo dele.
            const individualReaches = new Set<string>();
            const q = [fg.id];
            individualReaches.add(fg.id);
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
                if (individualReaches.has(n.id) && n.id !== fg.id && finalActivePath.has(n.id)) {
                    const res = calculateNodeValue(n, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId, maps, depth);
                    reportMaterial += res.material;
                    reportLabor += res.labor;
                }
            });
        });
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
                    if (individualReaches.has(n.id) && n.id !== genNode.id) {
                        // Recalculamos o valor do nó para este contexto
                        const nodeVal = calculateNodeValue(n, allInventoryItems, sVars, vars, config, dim.id, maps);
                        genMaterial += nodeVal.material;
                        genLabor += nodeVal.labor;
                    }
                });

                let name = nameTemplate, sku = skuTemplate;
                Object.entries(sVars || {}).forEach(([k, v]) => {
                    name = name.replace(new RegExp(`{${k}}`, 'gi'), v);
                    sku = sku.replace(new RegExp(`{${k}}`, 'gi'), v);
                });
                
                if (sku) {
                    products.push({ 
                        name, 
                        sku: sku?.toUpperCase() || '', 
                        custoFabricacao: genLabor, 
                        custoMateriaPrima: genMaterial, 
                        defaultSourcing, 
                        costBreakdown: res.costBreakdown.filter(b => individualReaches.has(b.nodeId)),
                        familiaId: familia.id
                    });
                }
            });
        });
    });
    
    return products;
};
