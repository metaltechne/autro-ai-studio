
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ReactFlow, { 
    ReactFlowProvider, 
    Background, 
    Controls, 
    PanOnScrollMode, 
    useReactFlow, 
    BackgroundVariant, 
    Panel
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import { ManufacturingHook, InventoryHook, ProcessNodeData, FamiliaComponente, ProcessCategory, View, ScannedQRCodeData, ManufacturingOrdersHook } from '../types';
import { Button } from './ui/Button';
// Fix: Removed non-existent HeadCodeTableNode and DimensionTableNode imports.
import { FabricationNode, MaterialNode, FinalNode, InventoryNode, VariableNode, ProductGeneratorNode, ExternalDataSourceNode, DNATableNode, MaterialMappingNode, CodificationTableNode, ServiceMappingNode, SubProcessMappingNode, UsinagemParafusoSextavadoNode } from './manufacturing/CustomNodes';
import CustomEdge from './manufacturing/CustomEdge';
import { Search, Plus, Settings, Copy, Trash2, Edit3, Layout, Layers, Box, Cpu, Database, ChevronRight, Info, AlertTriangle } from 'lucide-react';
import { evaluateProcess } from '../hooks/manufacturing-evaluator';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { GeneratedProductsModal } from './GeneratedProductsModal';
import { useToast } from '../hooks/useToast';
import { CreateProcessModal } from './CreateProcessModal';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ManufacturingSettingsModal } from './manufacturing/ManufacturingSettingsModal';
import { exportProcessToExcel } from '../services/manufacturingExcel';
import { ManufacturingBackupModal } from './manufacturing/ManufacturingBackupModal';
import { FileDown, DownloadCloud, Database as DatabaseIcon } from 'lucide-react';

interface ManufacturingViewProps {
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
    onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
    mode?: 'all' | ProcessCategory;
    manufacturingOrdersHook: ManufacturingOrdersHook;
}

// FIX: Node type mappings were updated to ensure all keys are correctly mapped to their respective node components.
const nodeTypes = {
    // Legacy mapping
    fabricationNode: FabricationNode,
    materialNode: MaterialNode,
    inventoryNode: InventoryNode,
    etapaFabricacaoNode: FabricationNode,
    materiaPrimaNode: MaterialNode,
    inventoryComponentNode: InventoryNode,
    dnaTableNode: DNATableNode,
    materialMappingNode: MaterialMappingNode,
    productGeneratorNode: ProductGeneratorNode,
    dimensionTableNode: DNATableNode,
    headCodeTableNode: CodificationTableNode,
    codificationTableNode: CodificationTableNode,
    serviceMappingNode: ServiceMappingNode,
    subProcessMappingNode: SubProcessMappingNode,
    finalNode: FinalNode,
    variableNode: VariableNode,
    externalDataSourceNode: ExternalDataSourceNode,
    
    // New/consistent mapping
    dnaTable: DNATableNode,
    codificationTable: CodificationTableNode,
    materialMapping: MaterialMappingNode,
    etapaFabricacao: FabricationNode,
    materiaPrima: MaterialNode,
    inventoryComponent: InventoryNode,
    productGenerator: ProductGeneratorNode,
    usinagemParafusoSextavado: UsinagemParafusoSextavadoNode,
    serviceMapping: ServiceMappingNode,
    subProcessMapping: SubProcessMappingNode,
    final: FinalNode,
    variable: VariableNode,
    externalDataSource: ExternalDataSourceNode,
};

const edgeTypes = {
    processEdge: CustomEdge,
    dataEdge: CustomEdge,
    default: CustomEdge,
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    dagreGraph.setGraph({ rankdir: direction, ranksep: 200, nodesep: 150 });
    
    nodes.forEach((node) => {
        const width = node.width || 320;
        const height = node.height || 250;
        dagreGraph.setNode(node.id, { width, height });
    });
    
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });
    
    dagre.layout(dagreGraph);
    
    return {
        nodes: nodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            const width = node.width || 320;
            const height = node.height || 250;
            return {
                ...node,
                position: {
                    x: nodeWithPosition.x - width / 2,
                    y: nodeWithPosition.y - height / 2,
                },
            };
        }),
        edges
    };
};

const ManufacturingCanvas: React.FC<{
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    totalCost: number;
    nodes: Node<ProcessNodeData>[];
    edges: Edge[];
    onViewGeneratedProducts: () => void;
    evaluationResult: any;
    dimensions: any[];
    selectedDimensionId: string | null;
    setSelectedDimensionId: (id: string) => void;
    selectedDimension: any;
}> = ({ manufacturing, inventory, totalCost, nodes, edges, onViewGeneratedProducts, evaluationResult, dimensions, selectedDimensionId, setSelectedDimensionId, selectedDimension }) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { project, setNodes, setEdges, fitView, getViewport, getNodes, screenToFlowPosition } = useReactFlow();
    const activeFamilia = manufacturing.getActiveFamilia();

    const onLayout = useCallback(() => {
        if (!activeFamilia) return;
        const currentNodes = getNodes();
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(currentNodes, edges);
        
        const changes = layoutedNodes.map(node => ({
            id: node.id,
            type: 'position' as const,
            position: node.position,
            positionAbsolute: node.position,
            dragging: false
        }));
        
        manufacturing.onNodesChange(activeFamilia.id)(changes);
        window.requestAnimationFrame(() => fitView());
    }, [getNodes, edges, fitView, activeFamilia, manufacturing]);

    const handleAddNode = (type: string) => {
        if (!activeFamilia) return;
        const position = { x: 100, y: 100 };
        manufacturing.addNode(activeFamilia.id, type, position);
    };

    const nodesWithHooks = useMemo(() => {
        if (!activeFamilia) return [];
        return nodes.map(node => {
             const enhancedData: ProcessNodeData = { 
                ...node.data,
                operators: manufacturing.workStations,
                consumables: manufacturing.consumables,
                operations: manufacturing.standardOperations,
                allFamilias: manufacturing.familias, 
                inventoryContext: {
                    components: inventory.components,
                    updateComponent: inventory.updateComponent
                },
                updateNodeLabel: (label: string) => manufacturing.updateNodeLabel(activeFamilia.id, node.id, label),
                updateNodeCost: (cost: number | string) => manufacturing.updateNodeCost(activeFamilia.id, node.id, cost),
                updateNodeMaterialDetails: (details: any) => manufacturing.updateNodeMaterialDetails(activeFamilia.id, node.id, details, inventory.components),
                updateNodeComponentDetails: (details: any) => manufacturing.updateNodeComponentDetails(activeFamilia.id, node.id, details, inventory.components),
                updateNodeGenerationConfig: (config: any) => manufacturing.updateNodeGenerationConfig(activeFamilia.id, node.id, config),
                updateNodeOperationDetails: (details: any) => manufacturing.updateNodeOperationDetails(activeFamilia.id, node.id, details),
                updateNodeMappingMode: (mode: 'thread' | 'diameter') => manufacturing.updateNodeMappingMode(activeFamilia.id, node.id, mode),
                onViewGeneratedProducts,
                addDimension: () => manufacturing.addDimension(activeFamilia.id, node.id),
                updateDimension: (did: string, d: any) => manufacturing.updateDimension(activeFamilia.id, node.id, did, d),
                deleteDimension: (did: string) => manufacturing.deleteDimension(activeFamilia.id, node.id, did),
                updateDimensions: (dims: any) => manufacturing.updateDimensions(activeFamilia.id, node.id, dims),
                addHeadCode: (code) => manufacturing.addHeadCode(activeFamilia.id, node.id, code),
                updateHeadCode: (hcid, d) => manufacturing.updateHeadCode(activeFamilia.id, node.id, hcid, d),
                deleteHeadCode: (hcid) => manufacturing.deleteHeadCode(activeFamilia.id, node.id, hcid),
                updateHeadCodes: (codes: any) => manufacturing.updateHeadCodes(activeFamilia.id, node.id, codes),
                disconnectHandle: (handleId: string) => manufacturing.disconnectHandle(activeFamilia.id, node.id, handleId),
                getMaterialOptions: () => inventory.components.filter(c => c.type === 'raw_material'),
                getInventoryComponentOptions: () => inventory.components.filter(c => c.type === 'component' && c.familiaId !== activeFamilia.id),
                duplicateNode: () => manufacturing.duplicateNode(activeFamilia.id, node.id),
                deleteNode: () => manufacturing.deleteNode(activeFamilia.id, node.id),
            };
            return { ...node, data: enhancedData }
        });
    }, [nodes, activeFamilia?.id, inventory.components, inventory.updateComponent, totalCost, onViewGeneratedProducts, manufacturing]);

    const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
    const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());

    const cycleEdges = useMemo(() => {
        const cycles = new Set<string>();
        const visited = new Set<string>();
        const recStack = new Set<string>();
        const edgeMap = new Map<string, string[]>();
        const edgeIdMap = new Map<string, string>();

        edges.forEach(e => {
            if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
            edgeMap.get(e.source)!.push(e.target);
            edgeIdMap.set(`${e.source}-${e.target}`, e.id);
        });

        const findCycle = (u: string, path: string[]) => {
            visited.add(u);
            recStack.add(u);
            path.push(u);

            const neighbors = edgeMap.get(u) || [];
            for (const v of neighbors) {
                if (!visited.has(v)) {
                    if (findCycle(v, path)) return true;
                } else if (recStack.has(v)) {
                    const cyclePath = path.slice(path.indexOf(v));
                    for (let i = 0; i < cyclePath.length; i++) {
                        const from = cyclePath[i];
                        const to = cyclePath[(i + 1) % cyclePath.length];
                        const eid = edgeIdMap.get(`${from}-${to}`);
                        if (eid) cycles.add(eid);
                    }
                    // Continue searching for other cycles
                }
            }

            recStack.delete(u);
            path.pop();
            return false;
        };

        nodes.forEach(n => {
            if (!visited.has(n.id)) findCycle(n.id, []);
        });

        return cycles;
    }, [nodes, edges]);

    const onNodeClick = useCallback((_: any, node: Node) => {
        const upstreamNodes = new Set<string>();
        const upstreamEdges = new Set<string>();
        
        const findUpstream = (nodeId: string) => {
            upstreamNodes.add(nodeId);
            edges.forEach(edge => {
                if (edge.target === nodeId) {
                    upstreamEdges.add(edge.id);
                    if (!upstreamNodes.has(edge.source)) {
                        findUpstream(edge.source);
                    }
                }
            });
        };

        findUpstream(node.id);
        setHighlightedNodes(upstreamNodes);
        setHighlightedEdges(upstreamEdges);
    }, [edges]);

    const onPaneClick = useCallback(() => {
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
    }, []);

    const styledNodes = useMemo(() => {
        return nodesWithHooks.map(node => ({
            ...node,
            style: {
                ...node.style,
                opacity: highlightedNodes.size > 0 && !highlightedNodes.has(node.id) ? 0.3 : 1,
                transition: 'opacity 0.3s ease-in-out'
            }
        }));
    }, [nodesWithHooks, highlightedNodes]);

    const styledEdges = useMemo(() => {
        return edges.map(edge => {
            const isCycle = cycleEdges.has(edge.id);
            return {
                ...edge,
                animated: highlightedEdges.has(edge.id) || isCycle,
                style: {
                    ...edge.style,
                    stroke: isCycle ? '#ef4444' : (highlightedEdges.has(edge.id) ? '#3b82f6' : '#cbd5e1'),
                    strokeWidth: isCycle ? 4 : (highlightedEdges.has(edge.id) ? 3 : 1),
                    opacity: highlightedNodes.size > 0 && !highlightedEdges.has(edge.id) && !isCycle ? 0.2 : 1,
                    transition: 'all 0.3s ease-in-out'
                }
            };
        });
    }, [edges, highlightedEdges, highlightedNodes, cycleEdges]);

    const onNodesChange = useCallback((changes: any) => {
        if (activeFamilia?.id) {
            manufacturing.onNodesChange(activeFamilia.id)(changes);
        }
    }, [activeFamilia?.id, manufacturing.onNodesChange]);

    const onEdgesChange = useCallback((changes: any) => {
        if (activeFamilia?.id) {
            manufacturing.onEdgesChange(activeFamilia.id)(changes);
        }
    }, [activeFamilia?.id, manufacturing.onEdgesChange]);

    const onConnect = useCallback((connection: any) => {
        if (activeFamilia?.id) {
            manufacturing.onConnect(activeFamilia.id)(connection);
        }
    }, [activeFamilia?.id, manufacturing.onConnect]);

    return (
        <div className="h-full w-full relative bg-slate-50 flex" ref={reactFlowWrapper}>
            {/* Sidebar de Ferramentas */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-30">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paleta de Componentes</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-6">
                    {/* Estrutura de Dados */}
                    <div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter mb-2 block">1. Estrutura & DNA</span>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleAddNode('dnaTable')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">DNA</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Tabela DNA</p>
                                    <p className="text-[8px] text-slate-400">Medidas e Bitolas</p>
                                </div>
                            </button>
                            <button onClick={() => handleAddNode('codificationTable')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">COD</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Tabela Códigos</p>
                                    <p className="text-[8px] text-slate-400">Sufixos e Variantes</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Custos e Insumos */}
                    <div>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter mb-2 block">2. Insumos & Custos</span>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleAddNode('materiaPrima')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">MP</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Matéria-Prima</p>
                                    <p className="text-[8px] text-slate-400">Insumo Direto</p>
                                </div>
                            </button>
                            <button onClick={() => handleAddNode('inventoryComponent')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">EST</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Item Estoque</p>
                                    <p className="text-[8px] text-slate-400">Componente Pronto</p>
                                </div>
                            </button>
                            <button onClick={() => handleAddNode('materialMapping')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">MAP</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Mapear Insumos</p>
                                    <p className="text-[8px] text-slate-400">Vincular ao DNA</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Processos */}
                    <div>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter mb-2 block">3. Operações</span>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleAddNode('etapaFabricacao')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">OP</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Etapa Processo</p>
                                    <p className="text-[8px] text-slate-400">Mão de Obra/Máquina</p>
                                </div>
                            </button>
                            <button onClick={() => handleAddNode('serviceMapping')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">SRV</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Serviço Externo</p>
                                    <p className="text-[8px] text-slate-400">Custo por Medida</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Finalização */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-orange-600 uppercase tracking-tighter block">4. Resultado</span>
                            <div className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[8px] font-black uppercase">Multi-Item</div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleAddNode('productGenerator')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">GEN</div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase">Gerador Final</p>
                                    <p className="text-[8px] text-slate-400">Cria Itens no Estoque</p>
                                </div>
                            </button>
                            <div className="p-2 bg-blue-50/50 rounded-xl border border-blue-100/50">
                                <p className="text-[8px] text-blue-600 font-bold leading-tight">
                                    <Info className="w-3 h-3 inline mr-1 mb-0.5" />
                                    Você pode adicionar vários geradores para criar sub-itens no mesmo canva.
                                </p>
                            </div>
                            <button onClick={() => handleAddNode('final')} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">SUM</div>
                                <div>
                                    <p className="text-[10px] font-black uppercase">Soma Total</p>
                                    <p className="text-[8px] opacity-60">Resultado Final</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Simular Variação</label>
                            <Select 
                                value={selectedDimensionId || dimensions[0]?.id || ''} 
                                onChange={(e) => setSelectedDimensionId(e.target.value)}
                                className="h-10 text-[10px] font-black uppercase"
                            >
                                {dimensions.length === 0 && <option value="">Nenhuma variação</option>}
                                {dimensions.map(d => (
                                    <option key={d.id} value={d.id}>
                                        M{d.bitola || 0} x {d.comprimento || 0}mm
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="pt-3 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Custo Estimado</span>
                                <span className="text-sm font-black text-emerald-600">{formatCurrency(totalCost)}</span>
                            </div>
                            <p className="text-[8px] text-slate-400 font-medium leading-tight italic">
                                * Custo baseado na variação selecionada acima.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative">
                {cycleEdges.size > 0 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-rose-600 text-white rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
                        <AlertTriangle size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">Ciclo Infinito Detectado no Fluxo!</span>
                    </div>
                )}
                <ReactFlow
                    nodes={styledNodes}
                    edges={styledEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    fitView
                    panOnScroll
                    panOnScrollMode={PanOnScrollMode.Free}
                    nodesDraggable={true}
                    nodesConnectable={true}
                    elementsSelectable={true}
                    style={{ width: '100%', height: '100%' }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
                    <Controls />
                    
                    {/* Legenda e Dicas */}
                    <Panel position="bottom-left" className="m-4">
                        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg space-y-2">
                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Dicas de Visualização</h5>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-blue-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-slate-600">Clique em um nó para destacar seu caminho</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-slate-200"></div>
                                <span className="text-[10px] font-bold text-slate-600">Badges nos blocos indicam o produto alvo</span>
                            </div>
                        </div>
                    </Panel>

                    <Panel position="top-right" className="m-4 flex flex-col gap-2">
                    <Button onClick={onLayout} variant="secondary" className="shadow-lg bg-white border-none flex items-center gap-2 h-11 px-4 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span className="text-xs font-black uppercase tracking-widest">Organizar Layout</span>
                    </Button>
                    
                    {/* Resumo Flutuante */}
                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl min-w-[240px]">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo de Engenharia</h4>
                            {selectedDimension && (
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    M{selectedDimension.bitola}x{selectedDimension.comprimento}
                                </span>
                            )}
                        </div>

                        {/* Lista de Produtos Gerados (se houver múltiplos) */}
                        {nodes.filter(n => n.data.type === 'productGenerator').length > 1 && (
                            <div className="mb-4 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Produtos no Canva:</span>
                                {nodes.filter(n => n.data.type === 'productGenerator').map(n => (
                                    <div key={n.id} className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-600 truncate max-w-[120px]">{n.data.label || 'Gerador'}</span>
                                        <span className="text-[9px] font-black text-slate-900">{formatCurrency(n.data.cost)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Materia-Prima:</span>
                                <span className="text-[11px] font-black text-slate-900">{formatCurrency(evaluationResult.custoMateriaPrima)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Fabricação:</span>
                                <span className="text-[11px] font-black text-slate-900">{formatCurrency(evaluationResult.custoFabricacao)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-900 uppercase">Custo Total:</span>
                                <span className="text-sm font-black text-emerald-600">{formatCurrency(totalCost)}</span>
                            </div>
                        </div>
                        
                        <Button 
                            onClick={onViewGeneratedProducts}
                            className="w-full mt-4 h-9 text-[10px] font-black uppercase tracking-widest bg-slate-900 hover:bg-black text-white rounded-xl"
                        >
                            Visualizar Todos Itens
                        </Button>
                    </div>
                </Panel>
                </ReactFlow>
            </div>
        </div>
    );
};

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({ manufacturing, inventory, setCurrentView, onShowQRCode, mode = 'all', manufacturingOrdersHook }) => {
    const { addToast } = useToast();
    const [isCreateProcessModalOpen, setIsCreateProcessModalOpen] = useState(false);
    const [isGeneratedProductsModalOpen, setIsGeneratedProductsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [processSearchTerm, setProcessSearchTerm] = useState('');
    const [renamingFamilia, setRenamingFamilia] = useState<FamiliaComponente | null>(null);
    const [newName, setNewName] = useState('');
    const [deletingFamilia, setDeletingFamilia] = useState<FamiliaComponente | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);

    const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
    const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
    const [isDiscardDraftConfirmOpen, setIsDiscardDraftConfirmOpen] = useState(false);

    const activeFamilia = manufacturing.getActiveFamilia();

    // Reset selected dimension when changing familia
    useEffect(() => {
        setSelectedDimensionId(null);
    }, [activeFamilia?.id]);

    const dnaNode = useMemo(() => {
        return activeFamilia?.nodes.find(n => 
            n.data.type === 'dnaTable' || 
            n.data.type === 'dnaTableNode' || 
            n.data.type === 'dimensionTable'
        );
    }, [activeFamilia]);

    const dimensions = useMemo(() => dnaNode?.data.dimensions || [], [dnaNode]);

    const selectedDimension = useMemo(() => {
        if (dimensions.length === 0) return null;
        if (selectedDimensionId) {
            const found = dimensions.find(d => d.id === selectedDimensionId);
            if (found) return found;
        }
        return dimensions[0];
    }, [dimensions, selectedDimensionId]);

    const evaluationResult = useMemo(() => {
        if (!activeFamilia) return { custoMateriaPrima: 0, custoFabricacao: 0, nodes: [], costBreakdown: [], requirements: [] };
        
        const variables: Record<string, number> = {};
        if (selectedDimension) {
            variables.bitola = selectedDimension.bitola;
            variables.comprimento = selectedDimension.comprimento;
        }

        return evaluateProcess(
            activeFamilia, 
            variables, 
            inventory.components, 
            {}, 
            {
                workStations: manufacturing.workStations,
                operations: manufacturing.standardOperations,
                consumables: manufacturing.consumables,
                allFamilias: manufacturing.familias 
            }
        );
    }, [activeFamilia, inventory.components, manufacturing.workStations, manufacturing.standardOperations, manufacturing.consumables, manufacturing.familias, selectedDimension]);

    const totalCost = evaluationResult.custoMateriaPrima + evaluationResult.custoFabricacao;

    const filteredFamilias = useMemo(() => {
        return manufacturing.familias
            .filter(f => f.nome.toLowerCase().includes(processSearchTerm.toLowerCase()))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [manufacturing.familias, processSearchTerm]);

    const handleRename = async () => {
        if (renamingFamilia && newName.trim()) {
            await manufacturing.updateFamiliaName(renamingFamilia.id, newName.trim());
            setRenamingFamilia(null);
            addToast("Processo renomeado com sucesso.", "success");
        }
    };

    const handleExportToExcel = async () => {
        if (!activeFamilia) return;
        try {
            await exportProcessToExcel(activeFamilia, evaluationResult.nodes, inventory.components);
            addToast('Planilha de processo exportada!', 'success');
        } catch (err) {
            console.error(err);
            addToast('Falha ao gerar Excel.', 'error');
        }
    };

    const handleSaveAndSync = async () => {
        if (manufacturing.isOutdated) {
            setIsSyncConfirmOpen(true);
            return;
        }
        await performSaveAndSync();
    };

    const performSaveAndSync = async () => {
        setIsSyncing(true);
        try {
            await manufacturing.saveChanges();
            const report = await inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components, {
                ws: manufacturing.workStations,
                cons: manufacturing.consumables,
                ops: manufacturing.standardOperations,
                kits: inventory.kits
            });
            const totalChanges = report.createdComponents.length + report.updatedComponents.length + report.deletedComponents.length;
            if (totalChanges > 0) {
                addToast(`Processo salvo na nuvem! ${report.createdComponents.length} novos itens gerados no estoque.`, "success");
            } else {
                addToast("Processo salvo na nuvem e estoque sincronizado.", "success");
            }
        } catch (e) {
            console.error(e);
            addToast("Falha ao salvar e sincronizar componentes.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDiscardDrafts = () => {
        setIsDiscardDraftConfirmOpen(true);
    };

    const handleRefreshFromCloud = () => {
        if (manufacturing.isDirty) {
            setIsRefreshConfirmOpen(true);
            return;
        }
        performRefreshFromCloud();
    };

    const performRefreshFromCloud = () => {
        localStorage.removeItem('localDrafts');
        manufacturing.refreshFromCloud();
        addToast("Dados atualizados da nuvem.", "success");
    };
    
    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between bg-white z-20">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <Select 
                            value={activeFamilia?.id || ''} 
                            onChange={(e) => manufacturing.setActiveFamiliaId(e.target.value)} 
                            className="w-72 pl-9 font-black text-slate-800 uppercase tracking-tighter border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 h-11 rounded-xl transition-all"
                        >
                            <option value="" disabled>-- Selecionar Processo --</option>
                            {manufacturing.familias.sort((a,b) => a.nome.localeCompare(b.nome)).map((f: any) => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </Select>
                    </div>
                    {activeFamilia && (
                         <div className="flex gap-1 border-l pl-3">
                            <button onClick={() => { setNewName(activeFamilia.nome); setRenamingFamilia(activeFamilia); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Renomear Processo">
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => { manufacturing.duplicateFamilia(activeFamilia.id); addToast("Processo duplicado.", "success"); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Duplicar Processo">
                                <Copy className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeletingFamilia(activeFamilia)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Excluir Processo">
                                <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs mr-2 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            {manufacturing.savingStatus === 'saving' && <span className="flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                            {manufacturing.savingStatus === 'saved' && <span className="text-green-600 font-bold">✓ Sincronizado</span>}
                            {manufacturing.lastSync && manufacturing.savingStatus === 'idle' && !manufacturing.isDirty && (
                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                                    Sincronizado às {new Date(manufacturing.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {manufacturing.isDirty && manufacturing.savingStatus === 'idle' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-600 font-bold animate-pulse flex items-center gap-1">
                                        <Database size={10} />
                                        Alterações Pendentes
                                    </span>
                                    <button 
                                        onClick={handleDiscardDrafts}
                                        className="text-[9px] text-red-400 hover:text-red-600 font-black uppercase underline decoration-red-400/30"
                                    >
                                        Descartar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => setIsBackupModalOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        Backup / Importar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setIsSettingsModalOpen(true)}>Central de Custos</Button>
                    <Button size="sm" onClick={() => setIsCreateProcessModalOpen(true)}>+ Novo Fluxo</Button>
                    
                    {activeFamilia && (
                        <div className="flex gap-2 border-l pl-2">
                             <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleExportToExcel}
                                className="flex items-center gap-2"
                             >
                                <FileDown className="w-3.5 h-3.5" />
                                Planilha do Fluxo
                             </Button>
                             <Button 
                                size="sm" 
                                variant={manufacturing.isDirty ? "primary" : "secondary"} 
                                onClick={handleSaveAndSync} 
                                disabled={isSyncing} 
                                className={`
                                    ${manufacturing.isDirty ? 'shadow-lg shadow-blue-500/20 animate-pulse' : ''}
                                    min-w-[140px] font-black uppercase tracking-widest text-[10px]
                                `}
                            >
                                {isSyncing ? 'Salvando...' : manufacturing.isDirty ? 'Salvar Alterações' : 'Sincronizado'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-grow relative bg-slate-50 overflow-hidden">
                {/* Alerta de Conflito/Atualização Remota */}
                {manufacturing.isOutdated && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                        <div className="bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-amber-400">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Versão Desatualizada</p>
                                <p className="text-[10px] font-bold opacity-90">Outro usuário salvou alterações na nuvem.</p>
                            </div>
                            <Button 
                                size="sm" 
                                onClick={handleRefreshFromCloud}
                                className="bg-white text-amber-600 hover:bg-amber-50 h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-none shadow-sm"
                            >
                                Atualizar Agora
                            </Button>
                        </div>
                    </div>
                )}

                {activeFamilia ? (
                    <ReactFlowProvider>
                        <ManufacturingCanvas 
                            manufacturing={manufacturing} inventory={inventory} totalCost={totalCost}
                            nodes={evaluationResult.nodes}
                            edges={activeFamilia.edges || []} onViewGeneratedProducts={() => setIsGeneratedProductsModalOpen(true)}
                            evaluationResult={evaluationResult}
                            dimensions={dimensions}
                            selectedDimensionId={selectedDimensionId}
                            setSelectedDimensionId={setSelectedDimensionId}
                            selectedDimension={selectedDimension}
                        />
                    </ReactFlowProvider>
                ) : (
                    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
                        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Engenharia de Processos</h3>
                                    <p className="text-slate-500 font-medium">Selecione ou crie um novo fluxo de fabricação para começar.</p>
                                </div>
                                <Button onClick={() => setIsCreateProcessModalOpen(true)} className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest shadow-2xl shadow-slate-200 flex items-center gap-3">
                                    <Plus className="w-5 h-5" />
                                    Novo Fluxo de Engenharia
                                </Button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input 
                                    placeholder="BUSCAR PROCESSO POR NOME..." 
                                    value={processSearchTerm}
                                    onChange={e => setProcessSearchTerm(e.target.value)}
                                    className="pl-12 h-16 text-lg font-black uppercase tracking-tight !rounded-2xl border-slate-200 shadow-sm focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-25rem)] pb-12 pr-2 custom-scrollbar">
                                {filteredFamilias.map(f => (
                                    <div 
                                        key={f.id} 
                                        onClick={() => manufacturing.setActiveFamiliaId(f.id)}
                                        className="group p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer transition-all flex flex-col justify-between min-h-[160px] relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <ChevronRight className="w-6 h-6 text-blue-500" />
                                        </div>
                                        
                                        <div>
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                                                <Layout className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                            </div>
                                            <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-tight group-hover:text-blue-600 transition-colors">{f.nome}</h4>
                                        </div>

                                        <div className="mt-4 flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                {f.nodes?.length || 0} Blocos
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                {f.edges?.length || 0} Conexões
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {filteredFamilias.length === 0 && (
                                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum processo encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {renamingFamilia && (
                <Modal isOpen={!!renamingFamilia} onClose={() => setRenamingFamilia(null)} title="Renomear Processo">
                    <div className="space-y-4">
                        <Input label="Novo Nome do Processo" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setRenamingFamilia(null)}>Cancelar</Button>
                            <Button onClick={handleRename}>Salvar</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {deletingFamilia && (
                <ConfirmationModal isOpen={!!deletingFamilia} onClose={() => setDeletingFamilia(null)} onConfirm={async () => { await manufacturing.deleteFamilia(deletingFamilia.id); setDeletingFamilia(null); addToast("Processo excluído.", "success"); }} title={`Excluir "${deletingFamilia.nome}"`}>
                    <p className="text-sm text-gray-600">Isso removerá permanentemente o fluxo de engenharia. Componentes vinculados não serão excluídos, mas seus custos não poderão mais ser sincronizados via fluxo.</p>
                </ConfirmationModal>
            )}

            <ManufacturingBackupModal 
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                manufacturing={manufacturing}
            />

            {isCreateProcessModalOpen && <CreateProcessModal existingFamilies={manufacturing.familias} isOpen={isCreateProcessModalOpen} onClose={() => setIsCreateProcessModalOpen(false)} onCreate={(name, type, category, data) => { manufacturing.addFamilia(name, type, category, data); setIsCreateProcessModalOpen(false); }} />}
            {activeFamilia && isGeneratedProductsModalOpen && <GeneratedProductsModal isOpen={isGeneratedProductsModalOpen} onClose={() => setIsGeneratedProductsModalOpen(false)} familia={activeFamilia} manufacturing={manufacturing} inventory={inventory} />}
            {isSettingsModalOpen && <ManufacturingSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} manufacturing={manufacturing} manufacturingOrdersHook={manufacturingOrdersHook} />}

            <ConfirmationModal
                isOpen={isSyncConfirmOpen}
                onClose={() => setIsSyncConfirmOpen(false)}
                onConfirm={async () => {
                    setIsSyncConfirmOpen(false);
                    await performSaveAndSync();
                }}
                title="Confirmar Sincronização"
            >
                <p>Atenção: Outro usuário salvou alterações na nuvem enquanto você trabalhava. Salvar agora irá sobrescrever as mudanças dele. Deseja continuar?</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isRefreshConfirmOpen}
                onClose={() => setIsRefreshConfirmOpen(false)}
                onConfirm={() => {
                    setIsRefreshConfirmOpen(false);
                    performRefreshFromCloud();
                }}
                title="Confirmar Atualização"
            >
                <p>Você tem alterações locais não salvas. Atualizar agora irá descartar seu rascunho. Continuar?</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isDiscardDraftConfirmOpen}
                onClose={() => setIsDiscardDraftConfirmOpen(false)}
                onConfirm={() => {
                    localStorage.removeItem('localDrafts');
                    window.location.reload();
                }}
                title="Descartar Alterações"
            >
                <p>Deseja descartar todas as alterações locais e recarregar da nuvem? Esta ação não pode ser desfeita.</p>
            </ConfirmationModal>
        </div>
    );
};
