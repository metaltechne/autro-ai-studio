
import { FamiliaComponente, Component, Kit, WorkStation, Consumable, StandardOperation, GeneratedProduct, ProcessNodeData } from '../types';
import type { Node, Edge } from 'reactflow';

export interface EvalConfig {
    workStations: WorkStation[];
    consumables: Consumable[];
    operations: StandardOperation[];
    allFamilias: FamiliaComponente[];
}

export interface CostStep {
    nodeId: string;
    name: string;
    type: string;
    cost: number;
    details?: string;
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
    activeDimensionId?: string
) => {
    const data = node.data;
    let material = 0;
    let labor = 0;
    const requirements: ProcessRequirement[] = [];

    const baseMaterialMap = new Map(allInventoryItems.filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = new Map(allInventoryItems.map(c => [c.sku.toUpperCase(), c]));

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
                const targetFamilia = config.allFamilias.find(f => f.id === row.targetFamiliaId);
                if (targetFamilia) {
                    const subRes = evaluateProcess(targetFamilia, allVariables, allInventoryItems, allStringVariables, config);
                    material = subRes.custoMateriaPrima;
                    labor = subRes.custoFabricacao;
                    requirements.push(...subRes.requirements);
                }
            }
        }
    } else if (type === 'etapaFabricacao' || type === 'etapaFabricacaoNode') {
        const mode = data.costCalculationMode || 'time';
        if (mode === 'fixed') {
            labor = Number(data.fixedCost) || 0;
        } else if (mode === 'workstation') {
            const ws = config?.workStations.find(w => w.id === data.workStationId);
            labor = ws?.hourlyRate || 0;
        } else { // time mode
            const op = config?.operations.find(o => o.id === data.operationId);
            const ws = config?.workStations.find(w => w.id === (data.manualOperatorId || op?.workStationId));
            const time = data.manualTimeSeconds !== undefined ? data.manualTimeSeconds : (op?.timeSeconds || 0);
            labor = (Number(time) / 3600) * (ws?.hourlyRate || 0);
            const consCost = (op?.operationConsumables || []).reduce((sum, oc) => {
                const c = config?.consumables.find(item => item.id === oc.consumableId);
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
            Object.entries(allStringVariables).forEach(([k, v]) => targetSku = targetSku.replace(new RegExp(`{${k}}`, 'gi'), v));
        } else if (data.componentId) {
            targetSku = allInventoryItems.find(i => i.id === data.componentId)?.sku || "";
        }
        
        const item = componentSkuMap.get(targetSku.toUpperCase());
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
                    const subRes = evaluateProcess(sourceFam, allVariables, allInventoryItems, allStringVariables, config);
                    material = (subRes.custoMateriaPrima + subRes.custoFabricacao) * qty;
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
    return { material, labor, requirements };
};

export const evaluateProcess = (
    familia: FamiliaComponente,
    variables: Record<string, number>,
    allInventoryItems: Component[],
    stringVariables: Record<string, string> = {},
    config?: EvalConfig
): { custoMateriaPrima: number; custoFabricacao: number; nodes: Node<ProcessNodeData>[]; costBreakdown: CostStep[]; requirements: ProcessRequirement[] } => {
    
    const allVariables = { ...variables };
    const allStringVariables = { ...stringVariables };
    
    let dnaNode = familia.nodes.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
    let codesNode = familia.nodes.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');

    // Herança de contexto: Se a família não tem DNA ou Códigos (comum em montagens), 
    // tenta buscar nos componentes de inventário que apontam para outras famílias.
    if ((!dnaNode || !codesNode) && config?.allFamilias) {
        const invNodes = familia.nodes.filter(n => n.data.type === 'inventoryComponent' && n.data.sourceFamiliaId);
        for (const node of invNodes) {
            const sourceFam = config.allFamilias.find(f => f.id === node.data.sourceFamiliaId);
            if (sourceFam) {
                if (!dnaNode) dnaNode = sourceFam.nodes.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dnaTableNode');
                if (!codesNode) codesNode = sourceFam.nodes.find(n => (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
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
            Object.entries(row).forEach(([key, value]) => {
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
        }
    }

    if (codesNode?.data.headCodes && codesNode.data.headCodes.length > 0) {
        const hc = codesNode.data.headCodes.find((c: any) => c.code === allStringVariables.headCode) 
                 || (allStringVariables.headCode ? null : codesNode.data.headCodes[0]);
        if (hc) {
            allStringVariables.headCode = hc.code;
        }
    }

    const generatorNode = familia.nodes.find(n => (n.data.type as string) === 'productGenerator' || (n.data.type as string) === 'finalProduct' || (n.data.type as string) === 'productGeneratorNode');
    if (!generatorNode) return { custoMateriaPrima: 0, custoFabricacao: 0, nodes: familia.nodes, costBreakdown: [], requirements: [] };

    // ALGORITMO DE TRACE (SINAL DE CUSTO)
    const activeForward = new Set<string>();
    
    // Identifica pontos de partida: tabelas de configuração OU nós sem entradas (raízes do processo)
    const startNodes = familia.nodes.filter(n => {
        const type = n.data.type as string;
        const isConfigTable = ['dnaTable', 'dimensionTable', 'dnaTableNode', 'headCodeTable', 'codificationTable', 'codificationTableNode'].includes(type);
        if (isConfigTable) return true;
        
        // Se não for tabela, mas não tiver entradas, também é um ponto de partida (ex: componentes de inventário em montagens)
        const hasIncomingEdges = familia.edges.some(e => e.target === n.id);
        return !hasIncomingEdges;
    });

    const queue = [...startNodes.map(n => n.id)];
    startNodes.forEach(n => activeForward.add(n.id));

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const outgoingEdges = familia.edges.filter(e => e.source === currentId);
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
    const backwardQueue = [generatorNode.id];
    reachesGenerator.add(generatorNode.id);
    while (backwardQueue.length > 0) {
        const curr = backwardQueue.shift()!;
        familia.edges.filter(e => e.target === curr).forEach(e => {
            if (!reachesGenerator.has(e.source)) {
                reachesGenerator.add(e.source);
                backwardQueue.push(e.source);
            }
        });
    }

    const finalActivePath = new Set([...activeForward].filter(id => reachesGenerator.has(id)));
    let totalMaterial = 0;
    let totalLabor = 0;
    const requirements: ProcessRequirement[] = [];
    const breakdown: CostStep[] = [];
    const nodeCostMap = new Map<string, number>();

    familia.nodes.forEach(node => {
        if (finalActivePath.has(node.id) && node.id !== generatorNode.id) {
            const res = calculateNodeValue(node, allInventoryItems, allStringVariables, allVariables, config, activeDimensionId);
            const nodeTotal = res.material + res.labor;
            totalMaterial += res.material;
            totalLabor += res.labor;
            requirements.push(...res.requirements);
            if (nodeTotal > 0) {
                breakdown.push({ nodeId: node.id, name: node.data.label, type: res.labor > 0 ? 'labor' : 'material', cost: nodeTotal });
                nodeCostMap.set(node.id, nodeTotal);
            }
        }
    });

    const updatedNodes = familia.nodes.map(node => {
        let displayCost = nodeCostMap.get(node.id) || 0;
        if (node.id === generatorNode.id) displayCost = totalMaterial + totalLabor;
        return { ...node, data: { ...node.data, cost: displayCost } };
    });

    return { custoMateriaPrima: totalMaterial, custoFabricacao: totalLabor, nodes: updatedNodes, costBreakdown: breakdown, requirements };
};

export const generateAllProductsForFamilia = (
    familia: FamiliaComponente,
    allInventoryItems: Component[],
    kits: Kit[],
    config: EvalConfig
): GeneratedProduct[] => {
    const genNode = familia.nodes.find(n => (n.data.type as string) === 'productGenerator' || (n.data.type as string) === 'productGeneratorNode');
    if (!genNode?.data.generationConfig) return [];
    const { nameTemplate, skuTemplate, defaultSourcing } = genNode.data.generationConfig;
    
    let dnaNode = familia.nodes.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
    let codesNode = familia.nodes.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
    
    if (!dnaNode || !codesNode) {
        const inheritNodes = familia.nodes.filter(n => n.data.type === 'inventoryComponent' && n.data.sourceFamiliaId);
        for (const node of inheritNodes) {
            const sourceFam = config.allFamilias.find(f => f.id === node.data.sourceFamiliaId);
            if (sourceFam) {
                if (!dnaNode) {
                    dnaNode = sourceFam.nodes.find(n => (n.data.type as string) === 'dnaTable' || (n.data.type as string) === 'dimensionTable' || (n.data.type as string) === 'dnaTableNode');
                }
                if (!codesNode) {
                    codesNode = sourceFam.nodes.find(n => (n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode');
                }
            }
            if (dnaNode && codesNode) break;
        }
    }

    const products: GeneratedProduct[] = [];
    const dimensions = dnaNode?.data.dimensions || [{ id: 'default', bitola: 0, comprimento: 0 }];
    const headCodes = codesNode?.data.headCodes || [{ id: 'default', code: '' }];

    headCodes.forEach(hc => {
        dimensions.forEach(dim => {
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
            const res = evaluateProcess(familia, vars, allInventoryItems, sVars, config);
            let name = nameTemplate, sku = skuTemplate;
            Object.entries(sVars).forEach(([k, v]) => {
                name = name.replace(new RegExp(`{${k}}`, 'gi'), v);
                sku = sku.replace(new RegExp(`{${k}}`, 'gi'), v);
            });
            products.push({ 
                name, 
                sku: sku.toUpperCase(), 
                custoFabricacao: res.custoFabricacao, 
                custoMateriaPrima: res.custoMateriaPrima, 
                defaultSourcing, 
                costBreakdown: res.costBreakdown,
                familiaId: familia.id
            });
        });
    });
    return products;
};
