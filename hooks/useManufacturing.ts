
import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    FamiliaComponente, 
    ManufacturingHook, 
    ProcessCategory, 
    ProcessNodeData, 
    WorkStation, 
    Consumable, 
    StandardOperation, 
    Component, 
    ManufacturingOrderItem, 
    ManufacturingAnalysis, 
    AggregatedManufacturingRequirement,
    GenerationConfig,
    ProcessDimension,
    ProcessHeadCode
} from '../types';
import { applyNodeChanges, applyEdgeChanges, addEdge, Connection, EdgeChange, NodeChange, Node, Edge } from 'reactflow';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';
import * as api from './api';
import { evaluateProcess, parseFastenerSku, ProcessRequirement } from './manufacturing-evaluator';

export const useManufacturing = (): ManufacturingHook => {
    const [familias, setFamilias] = useState<FamiliaComponente[]>([]);
    const [workStations, setWorkStations] = useState<WorkStation[]>([]);
    const [consumables, setConsumables] = useState<Consumable[]>([]);
    const [standardOperations, setStandardOperations] = useState<StandardOperation[]>([]);
    const [activeFamiliaId, setActiveFamiliaId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [famData, wsData, consData, opsData] = await Promise.all([
                api.getFamilias(),
                api.getWorkStations(),
                api.getConsumables(),
                api.getStandardOperations()
            ]);
            setFamilias(famData);
            setWorkStations(wsData);
            setConsumables(consData);
            setStandardOperations(opsData);
            if (famData.length > 0 && !activeFamiliaId) {
                setActiveFamiliaId(famData[0].id);
            }
        } catch (error) {
            console.error("Failed to load manufacturing data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [activeFamiliaId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveChanges = useCallback(async () => {
        setSavingStatus('saving');
        try {
            await Promise.all([
                api.saveFamilias(familias),
                api.saveWorkStations(workStations),
                api.saveConsumables(consumables),
                api.saveStandardOperations(standardOperations)
            ]);
            setIsDirty(false);
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 2000);
        } catch (error) {
            console.error("Failed to save changes:", error);
            setSavingStatus('idle');
        }
    }, [familias, workStations, consumables, standardOperations]);

    const getActiveFamilia = useCallback(() => familias.find(f => f.id === activeFamiliaId), [familias, activeFamiliaId]);

    const addFamilia = useCallback(async (nome: string, type: 'simple' | 'generator', category: ProcessCategory, templateData?: any) => {
        const newFamilia: FamiliaComponente = {
            id: `fam-${nanoid(8)}`,
            nome,
            category,
            sourcing: 'manufactured',
            nodes: templateData?.nodes || [],
            edges: templateData?.edges || []
        };
        setFamilias(prev => [...prev, newFamilia]);
        setActiveFamiliaId(newFamilia.id);
        setIsDirty(true);
    }, []);

    const updateFamiliaName = useCallback(async (id: string, nome: string) => {
        setFamilias(prev => prev.map(f => f.id === id ? { ...f, nome } : f));
        setIsDirty(true);
    }, []);

    const deleteFamilia = useCallback(async (id: string) => {
        setFamilias(prev => prev.filter(f => f.id !== id));
        if (activeFamiliaId === id) setActiveFamiliaId(null);
        setIsDirty(true);
    }, [activeFamiliaId]);

    const duplicateFamilia = useCallback(async (id: string) => {
        const source = familias.find(f => f.id === id);
        if (!source) return;
        const copy: FamiliaComponente = {
            ...source,
            id: `fam-${nanoid(8)}`,
            nome: `${source.nome} (Cópia)`
        };
        setFamilias(prev => [...prev, copy]);
        setIsDirty(true);
    }, [familias]);

    const syncMappingNodesWithDNA = useCallback((nodes: Node<ProcessNodeData>[]) => {
        const dnaNode = nodes.find(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable');
        if (!dnaNode || !dnaNode.data.dimensions) return nodes;
        const dnaDimensions = dnaNode.data.dimensions;
        return nodes.map(node => {
            if (['materialMapping', 'serviceMapping', 'subProcessMapping'].includes(node.data.type)) {
                const currentMapping = node.data.dimensions || [];
                const syncedMapping = dnaDimensions.map(dnaDim => {
                    const existing = currentMapping.find(m => m.id === dnaDim.id);
                    return {
                        ...dnaDim,
                        baseMaterialId: existing?.baseMaterialId || '',
                        targetFamiliaId: existing?.targetFamiliaId || '',
                        serviceCost: existing?.serviceCost || 0,
                        consumption: existing?.consumption !== undefined ? existing.consumption : (dnaDim.consumption || dnaDim.comprimento || 0)
                    };
                });
                return { ...node, data: { ...node.data, dimensions: syncedMapping } };
            }
            return node;
        });
    }, []);

    const updateNodeData = useCallback((familiaId: string, nodeId: string, data: Partial<ProcessNodeData>) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            let newNodes = f.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n);
            const changedNode = newNodes.find(n => n.id === nodeId);
            if (['dnaTable', 'dimensionTable', 'materialMapping', 'serviceMapping', 'subProcessMapping'].includes(changedNode?.data.type || '')) {
                newNodes = syncMappingNodesWithDNA(newNodes);
            }
            return { ...f, nodes: newNodes };
        }));
        setIsDirty(true);
    }, [syncMappingNodesWithDNA]);

    const addNode = useCallback((familiaId: string, type: string, position: { x: number; y: number }, operationId?: string) => {
        const newNode: Node<ProcessNodeData> = {
            id: nanoid(),
            type: `${type}Node`,
            position,
            data: { label: `Novo ${type}`, cost: 0, type: type as any, operationId }
        };
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            let updatedNodes = [...f.nodes, newNode];
            if (['materialMapping', 'serviceMapping', 'subProcessMapping'].includes(type)) updatedNodes = syncMappingNodesWithDNA(updatedNodes);
            return { ...f, nodes: updatedNodes };
        }));
        setIsDirty(true);
    }, [syncMappingNodesWithDNA]);

    const onNodesChange = (familiaId: string) => (changes: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, nodes: applyNodeChanges(changes, f.nodes) } : f));
        setIsDirty(true);
    };

    const onEdgesChange = (familiaId: string) => (changes: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, edges: applyEdgeChanges(changes, f.edges) } : f));
        setIsDirty(true);
    };

    const onConnect = (familiaId: string) => (connection: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, edges: addEdge(connection, f.edges) } : f));
        setIsDirty(true);
    };

    const deleteNode = useCallback((familiaId: string, nodeId: string) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? {
            ...f,
            nodes: f.nodes.filter(n => n.id !== nodeId),
            edges: f.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
        } : f));
        setIsDirty(true);
    }, []);

    const duplicateNode = useCallback((familiaId: string, nodeId: string) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            const sourceNode = f.nodes.find(n => n.id === nodeId);
            if (!sourceNode) return f;
            const copy: Node<ProcessNodeData> = {
                ...sourceNode,
                id: nanoid(),
                position: { x: sourceNode.position.x + 50, y: sourceNode.position.y + 50 },
                data: JSON.parse(JSON.stringify(sourceNode.data)), // Cópia idêntica dos dados (Custo, Operador, etc)
                selected: false
            };
            return { ...f, nodes: [...f.nodes, copy] };
        }));
        setIsDirty(true);
    }, []);

    const addDimension = useCallback((familiaId: string, nodeId: string) => {
        const newDim: ProcessDimension = { id: nanoid(), bitola: 0, comprimento: 0 };
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            const newNodes = f.nodes.map(n => {
                if (n.id !== nodeId) return n;
                return { ...n, data: { ...n.data, dimensions: [...(n.data.dimensions || []), newDim] } };
            });
            return { ...f, nodes: syncMappingNodesWithDNA(newNodes) };
        }));
        setIsDirty(true);
    }, [syncMappingNodesWithDNA]);

    const updateDimension = useCallback((familiaId: string, nodeId: string, dimensionId: string, data: any) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            const newNodes = f.nodes.map(n => {
                if (n.id !== nodeId) return n;
                return {
                    ...n,
                    data: {
                        ...n.data,
                        dimensions: (n.data.dimensions || []).map(d => d.id === dimensionId ? { ...d, ...data } : d)
                    }
                };
            });
            return { ...f, nodes: syncMappingNodesWithDNA(newNodes) };
        }));
        setIsDirty(true);
    }, [syncMappingNodesWithDNA]);

    const deleteDimension = useCallback((familiaId: string, nodeId: string, dimensionId: string) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            const newNodes = f.nodes.map(n => {
                if (n.id !== nodeId) return n;
                return {
                    ...n,
                    data: {
                        ...n.data,
                        dimensions: (n.data.dimensions || []).filter(d => d.id !== dimensionId)
                    }
                };
            });
            return { ...f, nodes: syncMappingNodesWithDNA(newNodes) };
        }));
        setIsDirty(true);
    }, [syncMappingNodesWithDNA]);

    const addHeadCode = useCallback((familiaId: string, nodeId: string, code?: string) => {
        const newHC = { id: nanoid(), code: code || '' };
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            return {
                ...f,
                nodes: f.nodes.map(n => {
                    if (n.id !== nodeId) return n;
                    return { ...n, data: { ...n.data, headCodes: [...(n.data.headCodes || []), newHC] } };
                })
            };
        }));
        setIsDirty(true);
    }, []);

    const updateHeadCode = useCallback((familiaId: string, nodeId: string, headCodeId: string, data: any) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            return {
                ...f,
                nodes: f.nodes.map(n => {
                    if (n.id !== nodeId) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            headCodes: (n.data.headCodes || []).map(hc => hc.id === headCodeId ? { ...hc, ...data } : hc)
                        }
                    };
                })
            };
        }));
        setIsDirty(true);
    }, []);

    const deleteHeadCode = useCallback((familiaId: string, nodeId: string, headCodeId: string) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            return {
                ...f,
                nodes: f.nodes.map(n => {
                    if (n.id !== nodeId) return n;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            headCodes: (n.data.headCodes || []).filter(hc => hc.id !== headCodeId)
                        }
                    };
                })
            };
        }));
        setIsDirty(true);
    }, []);

    const disconnectHandle = useCallback((familiaId: string, nodeId: string, handleId: string) => {
        setFamilias(prev => prev.map(f => {
            if (f.id !== familiaId) return f;
            return {
                ...f,
                edges: f.edges.filter(e => !(e.source === nodeId && e.sourceHandle === handleId))
            };
        }));
        setIsDirty(true);
    }, []);

    const getAllUniqueHeadCodes = useCallback(() => {
        const codes = new Set<string>();
        familias.forEach(f => {
            f.nodes.forEach(n => {
                if (n.data.type === 'headCodeTable' && n.data.headCodes) {
                    n.data.headCodes.forEach(hc => codes.add(hc.code));
                }
            });
        });
        return Array.from(codes).sort();
    }, [familias]);

    const analyzeManufacturingRun = useCallback((order: ManufacturingOrderItem[], allComponents: Component[], virtualComponents?: Component[]): ManufacturingAnalysis => {
        let totalCost = 0;
        const requirements: AggregatedManufacturingRequirement[] = [];
        order.forEach(item => {
            const component = allComponents.find(c => c.id === item.componentId) || virtualComponents?.find(c => c.id === item.componentId);
            if (!component || !component.familiaId) return;
            const familia = familias.find(f => f.id === component.familiaId);
            if (!familia) return;
            const skuInfo = parseFastenerSku(component.sku);
            const pVars: Record<string, number> = {};
            const sVars: Record<string, string> = {};
            if (skuInfo) {
                pVars.bitola = skuInfo.bitola; pVars.comprimento = skuInfo.comprimento;
                sVars.bitola = String(skuInfo.bitola); sVars.comprimento = String(skuInfo.comprimento);
                sVars.headCode = skuInfo.head; sVars.dimensao = `${skuInfo.bitola}x${skuInfo.comprimento}`;
            }
            const evalRes = evaluateProcess(familia, pVars, allComponents, sVars, { workStations, operations: standardOperations, consumables, allFamilias: familias });
            totalCost += (evalRes.custoMateriaPrima + evalRes.custoFabricacao) * item.quantity;
            evalRes.requirements.forEach((req: ProcessRequirement) => {
                const totalNeeded = req.quantity * item.quantity;
                const existing = requirements.find(r => r.id === req.id);
                const comp = allComponents.find(c => c.id === req.id);
                const stock = comp?.stock || 0;
                if (existing) {
                    existing.quantity += totalNeeded;
                    existing.shortage = Math.max(0, existing.quantity - existing.stock);
                } else {
                    requirements.push({ id: req.id, name: req.name, type: req.type as any, quantity: totalNeeded, unit: req.unit, stock, shortage: Math.max(0, totalNeeded - stock) });
                }
            });
        });
        return { isFeasible: requirements.every(r => r.shortage <= 0.001), totalCost, requirements };
    }, [familias, workStations, standardOperations, consumables]);

    return {
        familias, activeFamiliaId, setActiveFamiliaId, getActiveFamilia, addFamilia, updateFamiliaName, deleteFamilia, duplicateFamilia, saveMultipleFamilias: async (f) => { setFamilias(f); setIsDirty(true); },
        addNode, updateNodeLabel: (fid, nid, label) => updateNodeData(fid, nid, { label }),
        updateNodeCost: (fid, nid, cost) => updateNodeData(fid, nid, { cost: typeof cost === 'string' ? parseFloat(cost) : cost }),
        updateNodeMaterialDetails: (fid, nid, details) => updateNodeData(fid, nid, details),
        updateNodeComponentDetails: (fid, nid, details) => updateNodeData(fid, nid, details),
        updateNodeGenerationConfig: (fid, nid, config) => {
            const f = familias.find(f => f.id === fid);
            const n = f?.nodes.find(n => n.id === nid);
            if (n) updateNodeData(fid, nid, { generationConfig: { ...(n.data.generationConfig || { nameTemplate: '', skuTemplate: '' }), ...config } });
        },
        updateNodeOperationDetails: (fid, nid, details) => updateNodeData(fid, nid, details),
        updateNodeMappingMode: (fid, nid, mode) => updateNodeData(fid, nid, { mappingMode: mode }),
        deleteNode, duplicateNode, onNodesChange, onEdgesChange, onConnect, addDimension, updateDimension, deleteDimension, updateDimensions: (fid, nid, dims) => updateNodeData(fid, nid, { dimensions: dims }),
        addHeadCode, updateHeadCode, deleteHeadCode, updateHeadCodes: (fid, nid, codes) => updateNodeData(fid, nid, { headCodes: codes }),
        disconnectHandle, getAllUniqueHeadCodes, analyzeManufacturingRun, workStations, consumables, standardOperations,
        saveWorkStations: async (ws) => { setWorkStations(ws); setIsDirty(true); },
        saveConsumables: async (c) => { setConsumables(c); setIsDirty(true); },
        saveOperations: async (op) => { setStandardOperations(op); setIsDirty(true); },
        isLoading, isDirty, savingStatus, saveChanges
    };
};
