
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
import dagre from 'https://esm.sh/dagre@0.8.5';
import { ManufacturingHook, InventoryHook, ProcessNodeData, FamiliaComponente, ProcessCategory, View, ScannedQRCodeData } from '../types';
import { Button } from './ui/Button';
// Fix: Removed non-existent HeadCodeTableNode and DimensionTableNode imports.
import { FabricationNode, MaterialNode, FinalNode, InventoryNode, VariableNode, ProductGeneratorNode, ExternalDataSourceNode, DNATableNode, MaterialMappingNode, CodificationTableNode, ServiceMappingNode, SubProcessMappingNode } from './manufacturing/CustomNodes';
import CustomEdge from './manufacturing/CustomEdge';
import { evaluateProcess } from '../hooks/manufacturing-evaluator';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { GeneratedProductsModal } from './GeneratedProductsModal';
import { useToast } from '../hooks/useToast';
import { CreateProcessModal } from './CreateProcessModal';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ManufacturingSettingsModal } from './manufacturing/ManufacturingSettingsModal';
import NodePalette from './manufacturing/NodePalette';

interface ManufacturingViewProps {
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
    onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
    mode?: 'all' | ProcessCategory;
}

// FIX: Node type mappings were updated to ensure all keys are correctly mapped to their respective node components.
const nodeTypes = {
    fabricationNode: FabricationNode,
    materialNode: MaterialNode,
    inventoryNode: InventoryNode,
    etapaFabricacaoNode: FabricationNode,
    materiaPrimaNode: MaterialNode,
    inventoryComponentNode: InventoryNode,
    dnaTableNode: DNATableNode,
    materialMappingNode: MaterialMappingNode,
    productGeneratorNode: ProductGeneratorNode,
    // Fix: Updated dimensionTableNode and headCodeTableNode to use existing components instead of missing ones.
    dimensionTableNode: DNATableNode,
    headCodeTableNode: CodificationTableNode,
    codificationTableNode: CodificationTableNode,
    serviceMappingNode: ServiceMappingNode,
    subProcessMappingNode: SubProcessMappingNode,
    finalNode: FinalNode,
    variableNode: VariableNode,
    externalDataSourceNode: ExternalDataSourceNode,
};

const edgeTypes = {
    processEdge: CustomEdge,
    dataEdge: CustomEdge,
    default: CustomEdge,
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    const nodeWidth = 320; 
    const nodeHeight = 250; 
    dagreGraph.setGraph({ rankdir: direction });
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });
    dagre.layout(dagreGraph);
    return {
        nodes: nodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            return {
                ...node,
                position: {
                    x: nodeWithPosition.x - nodeWidth / 2,
                    y: nodeWithPosition.y - nodeHeight / 2,
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
}> = ({ manufacturing, inventory, totalCost, nodes, edges, onViewGeneratedProducts }) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { project, setNodes, setEdges, fitView, getViewport } = useReactFlow();
    const activeFamilia = manufacturing.getActiveFamilia();

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        window.requestAnimationFrame(() => fitView());
    }, [nodes, edges, setNodes, setEdges, fitView]);

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

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        if (!activeFamilia || !reactFlowWrapper.current) return;
        const dropTypeStr = event.dataTransfer.getData('application/reactflow');
        if (!dropTypeStr) return;

        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = project({ x: event.clientX - reactFlowBounds.left, y: event.clientY - reactFlowBounds.top });

        if (dropTypeStr.startsWith('standardOpNode:')) {
            const operationId = dropTypeStr.split(':')[1];
            manufacturing.addNode(activeFamilia.id, 'etapaFabricacao', position, operationId);
        } else {
            manufacturing.addNode(activeFamilia.id, dropTypeStr, position);
        }
    }, [activeFamilia, manufacturing, project]);

    const onAddNodeManually = useCallback((type: string) => {
        if (!activeFamilia || !reactFlowWrapper.current) return;
        
        const { x, y, zoom } = getViewport();
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        
        const centerX = (rect.width / 2 - x) / zoom;
        const centerY = (rect.height / 2 - y) / zoom;
        const position = { x: centerX, y: centerY };

        if (type.startsWith('standardOpNode:')) {
            const operationId = type.split(':')[1];
            manufacturing.addNode(activeFamilia.id, 'etapaFabricacao', position, operationId);
        } else {
            manufacturing.addNode(activeFamilia.id, type, position);
        }
    }, [activeFamilia, manufacturing, getViewport]);

    return (
        <div className="h-full w-full relative bg-slate-50" ref={reactFlowWrapper} onDrop={onDrop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
             <Panel position="top-right" className="m-4 flex gap-2">
                <Button onClick={onLayout} variant="secondary" className="shadow-lg bg-white border-none flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-autro-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    Organizar Fluxo
                </Button>
            </Panel>
            <ReactFlow
                nodes={nodesWithHooks}
                edges={activeFamilia?.edges || []}
                onNodesChange={activeFamilia ? manufacturing.onNodesChange(activeFamilia.id) : undefined}
                onEdgesChange={activeFamilia ? manufacturing.onEdgesChange(activeFamilia.id) : undefined}
                onConnect={activeFamilia ? manufacturing.onConnect(activeFamilia.id) : undefined}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                panOnScroll
                panOnScrollMode={PanOnScrollMode.Free}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#CBD5E1" />
                <Controls />
                {activeFamilia && (
                    <NodePalette 
                        mode="all" 
                        standardOperations={manufacturing.standardOperations} 
                        onAddNode={onAddNodeManually} 
                    />
                )}
            </ReactFlow>
        </div>
    );
};

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({ manufacturing, inventory, setCurrentView, onShowQRCode, mode = 'all' }) => {
    const { addToast } = useToast();
    const [isCreateProcessModalOpen, setIsCreateProcessModalOpen] = useState(false);
    const [isGeneratedProductsModalOpen, setIsGeneratedProductsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [renamingFamilia, setRenamingFamilia] = useState<FamiliaComponente | null>(null);
    const [newName, setNewName] = useState('');
    const [deletingFamilia, setDeletingFamilia] = useState<FamiliaComponente | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const activeFamilia = manufacturing.getActiveFamilia();
    
    const evaluationResult = useMemo(() => {
        if (!activeFamilia) return { custoMateriaPrima: 0, custoFabricacao: 0, nodes: [], costBreakdown: [] };
        return evaluateProcess(
            activeFamilia, 
            {}, 
            inventory.components, 
            {}, 
            {
                workStations: manufacturing.workStations,
                operations: manufacturing.standardOperations,
                consumables: manufacturing.consumables,
                allFamilias: manufacturing.familias 
            }
        );
    }, [activeFamilia, inventory.components, manufacturing.workStations, manufacturing.standardOperations, manufacturing.consumables, manufacturing.familias]);

    const totalCost = evaluationResult.custoMateriaPrima + evaluationResult.custoFabricacao;

    const handleRename = async () => {
        if (renamingFamilia && newName.trim()) {
            await manufacturing.updateFamiliaName(renamingFamilia.id, newName.trim());
            setRenamingFamilia(null);
            addToast("Processo renomeado com sucesso.", "success");
        }
    };

    const handleSaveAndSync = async () => {
        setIsSyncing(true);
        try {
            await manufacturing.saveChanges();
            const report = await inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components);
            const totalChanges = report.createdComponents.length + report.updatedComponents.length + report.deletedComponents.length;
            if (totalChanges > 0) {
                addToast(`Processo salvo! ${report.createdComponents.length} novos itens gerados no estoque.`, "success");
            } else {
                addToast("Processo salvo e estoque sincronizado.", "success");
            }
        } catch (e) {
            console.error(e);
            addToast("Falha ao salvar e sincronizar componentes.", "error");
        } finally {
            setIsSyncing(false);
        }
    };
    
    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between bg-white z-20">
                <div className="flex items-center gap-3">
                     <Select value={activeFamilia?.id || ''} onChange={(e) => manufacturing.setActiveFamiliaId(e.target.value)} className="w-64 font-bold text-slate-800">
                        <option value="" disabled>-- Selecionar Processo --</option>
                        {manufacturing.familias.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </Select>
                    {activeFamilia && (
                         <div className="flex gap-1 border-l pl-3">
                            <button onClick={() => { setNewName(activeFamilia.nome); setRenamingFamilia(activeFamilia); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Renomear Processo">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => { manufacturing.duplicateFamilia(activeFamilia.id); addToast("Processo duplicado.", "success"); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Duplicar Processo">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 h8a2 2 0 002-2v-2" /></svg>
                            </button>
                            <button onClick={() => setDeletingFamilia(activeFamilia)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Excluir Processo">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                         </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs mr-2 flex items-center gap-1.5">
                        {manufacturing.savingStatus === 'saving' && <span className="flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                        {manufacturing.savingStatus === 'saved' && <span className="text-green-600 font-bold">✓ Salvo</span>}
                        {manufacturing.isDirty && manufacturing.savingStatus === 'idle' && <span className="text-yellow-600 font-bold animate-bounce">● Alterações Pendentes</span>}
                    </div>

                    <Button size="sm" variant="secondary" onClick={() => setIsSettingsModalOpen(true)}>Central de Custos</Button>
                    <Button size="sm" onClick={() => setIsCreateProcessModalOpen(true)}>+ Novo Fluxo</Button>
                    
                    {activeFamilia && (
                        <div className="flex gap-2 border-l pl-2">
                             <Button 
                                size="sm" 
                                variant="primary" 
                                onClick={handleSaveAndSync} 
                                disabled={isSyncing || (!manufacturing.isDirty && !isSyncing)} 
                                className={manufacturing.isDirty ? 'animate-pulse' : ''}
                            >
                                {isSyncing ? 'Sincronizando...' : 'Salvar e Gerar Itens'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-grow relative bg-slate-50 overflow-hidden">
                {activeFamilia ? (
                    <ReactFlowProvider>
                        <ManufacturingCanvas 
                            manufacturing={manufacturing} inventory={inventory} totalCost={totalCost}
                            nodes={evaluationResult.nodes}
                            edges={activeFamilia.edges || []} onViewGeneratedProducts={() => setIsGeneratedProductsModalOpen(true)}
                        />
                    </ReactFlowProvider>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <svg className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        <h3 className="text-xl font-bold text-slate-500">Engenharia de Processos</h3>
                        <p className="max-w-xs mt-2">Escolha um processo ou crie um novo para definir o DNA e custos dos seu produtos.</p>
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

            {isCreateProcessModalOpen && <CreateProcessModal isOpen={isCreateProcessModalOpen} onClose={() => setIsCreateProcessModalOpen(false)} onCreate={(name, type, category, data) => { manufacturing.addFamilia(name, type, category, data); setIsCreateProcessModalOpen(false); }} />}
            {activeFamilia && isGeneratedProductsModalOpen && <GeneratedProductsModal isOpen={isGeneratedProductsModalOpen} onClose={() => setIsGeneratedProductsModalOpen(false)} familia={activeFamilia} manufacturing={manufacturing} inventory={inventory} />}
            {isSettingsModalOpen && <ManufacturingSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} manufacturing={manufacturing} />}
        </div>
    );
};
