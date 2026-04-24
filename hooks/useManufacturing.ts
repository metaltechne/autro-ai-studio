
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
    CostStep,
    AggregatedManufacturingRequirement,
    GenerationConfig,
    ProcessDimension,
    ProcessHeadCode
} from '../types';
import { applyNodeChanges, applyEdgeChanges, addEdge, Connection, EdgeChange, NodeChange, Node, Edge } from 'reactflow';
import { nanoid } from 'nanoid';
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
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [remoteLastModified, setRemoteLastModified] = useState<number | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [famData, wsData, consData, opsData] = await Promise.all([
                api.getFamilias(),
                api.getWorkStations(),
                api.getConsumables(),
                api.getStandardOperations()
            ]);

            const now = Date.now();
            setLastSync(now);
            setRemoteLastModified(now);

            // Check for local drafts
            const famDraft = api.getLocalDraft('familias');
            const wsDraft = api.getLocalDraft('workStations');
            const consDraft = api.getLocalDraft('consumables');
            const opsDraft = api.getLocalDraft('standardOperations');

            if (famDraft || wsDraft || consDraft || opsDraft) {
                console.log("[Manufacturing] Local drafts found, applying...");
                setIsDirty(true);
            }

            const finalFamData = famDraft?.data || famData;
            setFamilias(finalFamData);
            setWorkStations(wsDraft?.data || wsData);
            setConsumables(consDraft?.data || consData);
            setStandardOperations(opsDraft?.data || opsData);

            if (finalFamData.length > 0) {
                setActiveFamiliaId(prev => prev || finalFamData[0].id);
            }
        } catch (error) {
            console.error("Failed to load manufacturing data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Subscribe to remote changes
    useEffect(() => {
        const unsubscribe = api.subscribeToLastModified((timestamp) => {
            setRemoteLastModified(timestamp);
        }, 'engineering');
        return () => unsubscribe();
    }, []);

    const isOutdated = useMemo(() => {
        if (!lastSync || !remoteLastModified) return false;
        // Damos uma margem de 2 segundos para evitar falsos positivos de latência de rede
        return remoteLastModified > lastSync + 2000;
    }, [lastSync, remoteLastModified]);

    const saveChanges = useCallback(async () => {
        setSavingStatus('saving');
        setIsDirty(false);
        try {
            await Promise.all([
                api.saveFamilias(familias, true),
                api.saveWorkStations(workStations, true),
                api.saveConsumables(consumables, true),
                api.saveStandardOperations(standardOperations, true)
            ]);

            await api.updateLastModified('engineering');
            
            // Clear drafts after successful cloud save
            api.clearLocalDraft('familias');
            api.clearLocalDraft('workStations');
            api.clearLocalDraft('consumables');
            api.clearLocalDraft('standardOperations');

            setLastSync(Date.now());
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 2000);
        } catch (error) {
            console.error("Failed to save changes:", error);
            setSavingStatus('idle');
        }
    }, [familias, workStations, consumables, standardOperations]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                saveChanges();
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, saveChanges]);

    // Save to local draft whenever dirty
    useEffect(() => {
        if (isDirty) {
            const handler = setTimeout(() => {
                api.saveLocalDraft('familias', familias);
                api.saveLocalDraft('workStations', workStations);
                api.saveLocalDraft('consumables', consumables);
                api.saveLocalDraft('standardOperations', standardOperations);
            }, 2000); // Debounce by 2 seconds

            return () => clearTimeout(handler);
        }
    }, [isDirty, familias, workStations, consumables, standardOperations]);

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

    const onNodesChange = useCallback((familiaId: string) => (changes: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, nodes: applyNodeChanges(changes, f.nodes) } : f));
        setIsDirty(true);
    }, []);

    const onEdgesChange = useCallback((familiaId: string) => (changes: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, edges: applyEdgeChanges(changes, f.edges) } : f));
        setIsDirty(true);
    }, []);

    const onConnect = useCallback((familiaId: string) => (connection: any) => {
        setFamilias(prev => prev.map(f => f.id === familiaId ? { ...f, edges: addEdge(connection, f.edges) } : f));
        setIsDirty(true);
    }, []);

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
        (familias || []).forEach(f => {
            (f.nodes || []).forEach(n => {
                if ((n.data.type === 'headCodeTable' || n.data.type === 'codificationTable' || n.data.type === 'codificationTableNode') && n.data.headCodes) {
                    n.data.headCodes.forEach(hc => codes.add(hc.code));
                }
            });
        });
        return Array.from(codes).sort();
    }, [familias]);

    const analyzeManufacturingRun = useCallback((order: ManufacturingOrderItem[], allComponents: Component[], virtualComponents?: Component[], batchHeadCode?: string): ManufacturingAnalysis => {
        let totalCost = 0;
        const requirements: AggregatedManufacturingRequirement[] = [];
        const detailedBreakdown: CostStep[] = [];
        const manufacturingSteps: CostStep[] = [];

        (order || []).forEach(item => {
            const component = allComponents.find(c => c.id === item.componentId) || virtualComponents?.find(c => c.id === item.componentId);
            if (!component || !component.familiaId) return;
            const familia = familias.find(f => f.id === component.familiaId);
            if (!familia) return;
            const skuInfo = parseFastenerSku(component.sku);
            const pVars: Record<string, number> = {};
            const sVars: Record<string, string> = {};
            
            // Prioridade para o headCode do lote, se fornecido
            if (batchHeadCode) {
                sVars.headCode = batchHeadCode;
            }

            if (skuInfo) {
                pVars.bitola = skuInfo.bitola; pVars.comprimento = skuInfo.comprimento;
                sVars.bitola = String(skuInfo.bitola); sVars.comprimento = String(skuInfo.comprimento);
                if (!sVars.headCode) sVars.headCode = skuInfo.head; 
                sVars.dimensao = `${skuInfo.bitola}x${skuInfo.comprimento}`;
            }

            const evalRes = evaluateProcess(familia, pVars, allComponents, sVars, { workStations, operations: standardOperations, consumables, allFamilias: familias });
            const itemTotal = (evalRes.custoMateriaPrima + evalRes.custoFabricacao) * item.quantity;
            totalCost += itemTotal;

            detailedBreakdown.push({
                name: `${item.quantity}x ${component.name}`,
                type: 'product',
                cost: itemTotal,
                details: `SKU: ${component.sku}`
            });

            (evalRes.costBreakdown || []).forEach(step => {
                if (step.type === 'labor') {
                    manufacturingSteps.push({
                        name: `${item.quantity}x ${step.name} (${component.name})`,
                        type: 'labor',
                        cost: step.cost * item.quantity,
                        timeSeconds: (step.timeSeconds || 0) * item.quantity,
                        quantity: item.quantity,
                        details: `SKU: ${component.sku}`
                    });
                }
            });

            (evalRes.requirements || []).forEach((req: ProcessRequirement) => {
                const totalNeeded = req.quantity * item.quantity;
                const existing = requirements.find(r => r.id === req.id && r.keyName === sVars.headCode);
                const comp = allComponents.find(c => c.id === req.id);
                const stock = comp?.stock || 0;
                const familiaId = req.familiaId || comp?.familiaId;

                if (existing) {
                    existing.quantity += totalNeeded;
                    existing.shortage = Math.max(0, existing.quantity - existing.stock);
                    if (!existing.familiaId) existing.familiaId = familiaId;
                } else {
                    requirements.push({ 
                        id: req.id, 
                        name: req.name, 
                        type: req.type as any, 
                        quantity: totalNeeded, 
                        unit: req.unit, 
                        stock, 
                        shortage: Math.max(0, totalNeeded - stock),
                        familiaId,
                        keyName: sVars.headCode
                    });
                }
            });
        });
        return { isFeasible: requirements.every(r => r.shortage <= 0.001), totalCost, requirements, detailedBreakdown, manufacturingSteps };
    }, [familias, workStations, standardOperations, consumables]);

    return useMemo(() => ({
        familias, activeFamiliaId, setActiveFamiliaId, getActiveFamilia, addFamilia, updateFamiliaName, deleteFamilia, duplicateFamilia, saveMultipleFamilias: async (f: FamiliaComponente[]) => { setFamilias(f); setIsDirty(true); },
        addNode, updateNodeLabel: (fid: string, nid: string, label: string) => updateNodeData(fid, nid, { label }),
        updateNodeCost: (fid: string, nid: string, cost: number | string) => updateNodeData(fid, nid, { cost: typeof cost === 'string' ? parseFloat(cost) : cost }),
        updateNodeMaterialDetails: (fid: string, nid: string, details: any) => updateNodeData(fid, nid, details),
        updateNodeComponentDetails: (fid: string, nid: string, details: any) => updateNodeData(fid, nid, details),
        updateNodeGenerationConfig: (fid: string, nid: string, config: any) => {
            const f = familias.find(f => f.id === fid);
            const n = f?.nodes.find(n => n.id === nid);
            if (n) updateNodeData(fid, nid, { generationConfig: { ...(n.data.generationConfig || { nameTemplate: '', skuTemplate: '' }), ...config } });
        },
        updateNodeOperationDetails: (fid: string, nid: string, details: any) => updateNodeData(fid, nid, details),
        updateNodeMappingMode: (fid: string, nid: string, mode: any) => updateNodeData(fid, nid, { mappingMode: mode }),
        deleteNode, duplicateNode, onNodesChange, onEdgesChange, onConnect, addDimension, updateDimension, deleteDimension, updateDimensions: (fid: string, nid: string, dims: any) => updateNodeData(fid, nid, { dimensions: dims }),
        addHeadCode, updateHeadCode, deleteHeadCode, updateHeadCodes: (fid: string, nid: string, codes: any) => updateNodeData(fid, nid, { headCodes: codes }),
        disconnectHandle, getAllUniqueHeadCodes, analyzeManufacturingRun, workStations, consumables, standardOperations,
        saveWorkStations: async (ws: WorkStation[]) => { setWorkStations(ws); setIsDirty(true); },
        saveConsumables: async (c: Consumable[]) => { setConsumables(c); setIsDirty(true); },
        saveOperations: async (op: StandardOperation[]) => { 
            // Deduplicate by ID
            const uniqueOps = op.reduce((acc, current) => {
                const x = acc.find(item => item.id === current.id);
                if (!x) {
                    return acc.concat([current]);
                } else {
                    return acc;
                }
            }, [] as StandardOperation[]);
            setStandardOperations(uniqueOps); 
            setIsDirty(true); 
        },
        isLoading, isDirty, savingStatus, saveChanges, autoSaveEnabled, setAutoSaveEnabled, lastSync, isOutdated, refreshFromCloud: loadData
    }), [
        familias, activeFamiliaId, setActiveFamiliaId, getActiveFamilia, addFamilia, 
        updateFamiliaName, deleteFamilia, duplicateFamilia, addNode, updateNodeData, 
        deleteNode, duplicateNode, onNodesChange, onEdgesChange, onConnect, 
        addDimension, updateDimension, deleteDimension, addHeadCode, updateHeadCode, 
        deleteHeadCode, disconnectHandle, getAllUniqueHeadCodes, analyzeManufacturingRun, 
        workStations, consumables, standardOperations, isLoading, isDirty, 
        savingStatus, saveChanges, autoSaveEnabled, setAutoSaveEnabled, lastSync, isOutdated, loadData
    ]);
};
