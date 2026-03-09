
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
    type: 'materiaPrima' | 'inventoryComponent';
}

export const getComponentCost = (component: Component): number => {
    if (component.sourcing === 'purchased' && component.purchaseCost) return component.purchaseCost;
    return (component.custoMateriaPrima || 0) + (component.custoFabricacao || 0);
};

export const calculateMaterialCost = (material: Component, quantity: number): number => {
    const divisor = (material.purchaseQuantity && material.purchaseQuantity > 0) ? material.purchaseQuantity : 1;
    const unitPrice = (material.purchaseCost || 0) / divisor;
    return unitPrice * quantity;
};

export const parseFastenerSku = (sku: string) => {
    const regex = /^FIX-([A-Z0-9-]+)-M(\d+)x(\d+)(?:MM)?$/i;
    const match = sku.match(regex);
    if (!match) return null;
    return {
        head: match[1],
        bitola: parseInt(match[2], 10),
        comprimento: parseInt(match[3], 10)
    };
};

const calculateNodeValue = (
    node: Node<ProcessNodeData>,
    allInventoryItems: Component[],
    allStringVariables: Record<string, string>,
    config?: EvalConfig,
    activeDimensionId?: string
) => {
    const data = node.data;
    let material = 0;
    let labor = 0;
    const requirements: ProcessRequirement[] = [];

    const baseMaterialMap = new Map(allInventoryItems.filter(i => i.type === 'raw_material').map(m => [m.id, m]));
    const componentSkuMap = new Map(allInventoryItems.map(c => [c.sku.toUpperCase(), c]));

    if ((data.type === 'materialMapping' || data.type === 'serviceMapping' || data.type === 'subProcessMapping') && data.dimensions) {
        const row = data.dimensions.find(d => d.id === activeDimensionId);
        if (row) {
            if (data.type === 'materialMapping' && row.baseMaterialId) {
                const mat = baseMaterialMap.get(row.baseMaterialId);
                if (mat) {
                    const qty = row.consumption || 1;
                    material = calculateMaterialCost(mat, mat.consumptionUnit === 'm' ? qty / 1000 : qty);
                    requirements.push({
                        id: mat.id, name: mat.name, sku: mat.sku,
                        quantity: mat.consumptionUnit === 'm' ? qty / 1000 : qty,
                        unit: mat.consumptionUnit || 'un', type: 'materiaPrima'
                    });
                }
            } else if (data.type === 'serviceMapping') {
                labor = Number(row.serviceCost) || 0;
            }
        }
    } else if (data.type === 'etapaFabricacao') {
        if (data.isExternalService) {
            labor = Number(data.externalServiceCost) || 0;
        } else {
            const op = config?.operations.find(o => o.id === data.operationId);
            const ws = config?.workStations.find(w => w.id === (data.manualOperatorId || op?.workStationId));
            const time = data.manualTimeSeconds !== undefined ? data.manualTimeSeconds : (op?.timeSeconds || 0);
            labor = (Number(time) / 3600) * (ws?.hourlyRate || 0);
            const consCost = (op?.operationConsumables || []).reduce((sum, oc) => {
                const c = config?.consumables.find(item => item.id === oc.consumableId);
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
        if (item) material = getComponentCost(item);
    } else if (data.type === 'materiaPrima' && data.baseMaterialId) {
        const mat = baseMaterialMap.get(data.baseMaterialId);
        if (mat) {
            const qty = data.consumption || 1;
            material = calculateMaterialCost(mat, mat.consumptionUnit === 'm' ? qty / 1000 : qty);
        }
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
    
    const dnaNode = familia.nodes.find(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable');
    let activeDimensionId: string | undefined = undefined;

    if (dnaNode?.data.dimensions) {
        const row = dnaNode.data.dimensions.find(d => d.bitola === allVariables.bitola && d.comprimento === allVariables.comprimento) || dnaNode.data.dimensions[0];
        if (row) {
            activeDimensionId = row.id;
            allStringVariables.bitola = String(row.bitola);
            allStringVariables.comprimento = String(row.comprimento);
            allStringVariables.dimensao = `${row.bitola}x${row.comprimento}`;
        }
    }

    const generatorNode = familia.nodes.find(n => n.data.type === 'productGenerator' || n.data.type === 'finalProduct');
    if (!generatorNode) return { custoMateriaPrima: 0, custoFabricacao: 0, nodes: familia.nodes, costBreakdown: [], requirements: [] };

    // ALGORITMO DE TRACE (SINAL DE CUSTO)
    const activeForward = new Set<string>();
    const startNodes = familia.nodes.filter(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable' || n.data.type === 'headCodeTable');
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
            const res = calculateNodeValue(node, allInventoryItems, allStringVariables, config, activeDimensionId);
            const nodeTotal = res.material + res.labor;
            if (nodeTotal > 0) {
                totalMaterial += res.material;
                totalLabor += res.labor;
                requirements.push(...res.requirements);
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
    const genNode = familia.nodes.find(n => n.data.type === 'productGenerator');
    if (!genNode?.data.generationConfig) return [];
    const { nameTemplate, skuTemplate, defaultSourcing } = genNode.data.generationConfig;
    const dnaNode = familia.nodes.find(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable');
    const codesNode = familia.nodes.find(n => n.data.type === 'headCodeTable' || n.data.type === 'codificationTable');
    const products: GeneratedProduct[] = [];
    const dimensions = dnaNode?.data.dimensions || [{ id: 'default', bitola: 0, comprimento: 0 }];
    const headCodes = codesNode?.data.headCodes || [{ id: 'default', code: '' }];

    headCodes.forEach(hc => {
        dimensions.forEach(dim => {
            const vars = { bitola: dim.bitola, comprimento: dim.comprimento };
            const sVars = { headCode: hc.code, bitola: String(dim.bitola), comprimento: String(dim.comprimento), dimensao: `${dim.bitola}x${dim.comprimento}` };
            const res = evaluateProcess(familia, vars, allInventoryItems, sVars, config);
            let name = nameTemplate, sku = skuTemplate;
            Object.entries(sVars).forEach(([k, v]) => {
                name = name.replace(new RegExp(`{${k}}`, 'gi'), v);
                sku = sku.replace(new RegExp(`{${k}}`, 'gi'), v);
            });
            products.push({ name, sku: sku.toUpperCase(), custoFabricacao: res.custoFabricacao, custoMateriaPrima: res.custoMateriaPrima, defaultSourcing, costBreakdown: res.costBreakdown });
        });
    });
    return products;
};
