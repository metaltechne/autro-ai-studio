
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Component, Kit, ProductionScenario, InventoryHook, FamiliaComponente, InventoryLog, ProductionOrderItem, SyncReport, ComponentImportData, ProcessDimension, StockAdjustmentImportData, KitImportData, KitComponent, SubstitutionOption, ProductionScenarioShortage, ProductionOrder, ManufacturingOrder, FinancialSettings, SaleItem, WorkStation, Consumable, StandardOperation } from '../types';
import { evaluateProcess, generateAllProductsForFamilia, getComponentCost, parseFastenerSku } from './manufacturing-evaluator';
import { nanoid } from 'nanoid';
import * as api from './api';
import { useToast } from './useToast';
import { useActivityLog } from '../contexts/ActivityLogContext';

export const useInventory = (): InventoryHook => {
  const [components, setComponents] = useState<Component[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [remoteLastModified, setRemoteLastModified] = useState<number | null>(null);

  const { addToast } = useToast();
  const { addActivityLog } = useActivityLog();

  const calculateAllStock = useCallback((allComponents: Component[], allLogs: InventoryLog[], prodOrders: ProductionOrder[], manOrders: ManufacturingOrder[]): Component[] => {
    const stockMap = new Map<string, number>();
    const reservedMap = new Map<string, number>();

    allLogs.forEach(log => {
        const currentStock = stockMap.get(log.componentId) || 0;
        const change = log.type === 'entrada' ? log.quantity : -log.quantity;
        stockMap.set(log.componentId, currentStock + change);
    });

    // Calcular Reservas de Ordens de Produção (Kits)
    prodOrders.filter(o => o.status === 'pendente' || o.status === 'em_montagem').forEach(order => {
        (order.selectedScenario?.detailedRequirements || []).forEach(req => {
            const currentReserved = reservedMap.get(req.componentId) || 0;
            reservedMap.set(req.componentId, currentReserved + req.required);
        });
    });

    // Calcular Reservas de Ordens de Fabricação (Componentes)
    manOrders.filter(o => o.status === 'pendente' || o.status === 'em_producao').forEach(order => {
        (order.analysis?.requirements || []).forEach(req => {
            const currentReserved = reservedMap.get(req.id) || 0;
            reservedMap.set(req.id, currentReserved + req.quantity);
        });
    });

    return allComponents.map(c => ({
        ...c,
        stock: stockMap.get(c.id) || 0,
        reservedStock: reservedMap.get(c.id) || 0,
    }));
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [componentsData, kitsData, logsData, prodOrders, manOrders] = await Promise.all([
            api.getComponents(),
            api.getKits(),
            api.getInventoryLogs(),
            api.getProductionOrders(),
            api.getManufacturingOrders()
        ]);

        const sanitizedKits = (kitsData || []).map(kit => ({
            ...kit,
            components: kit.components || [],
            requiredFasteners: kit.requiredFasteners || [],
        }));
        setKits(sanitizedKits);

        const logs = logsData || [];
        setInventoryLogs(logs);

        const rawComponents = componentsData || [];
        
        // Fix: Deduplicate by ID to prevent React key errors
        const uniqueComponentsMap = new Map<string, Component>();
        rawComponents.forEach(c => {
            if (c && c.id) uniqueComponentsMap.set(c.id, c);
        });
        const uniqueComponents = Array.from(uniqueComponentsMap.values());

        const componentsWithStock = calculateAllStock(uniqueComponents, logs, prodOrders, manOrders);
        
        const now = Date.now();
        setLastSync(now);
        setRemoteLastModified(now);

        // Check for local drafts
        const compDraft = api.getLocalDraft('components');
        const kitDraft = api.getLocalDraft('kits');
        const logsDraft = api.getLocalDraft('inventoryLogs');

        if (compDraft || kitDraft || logsDraft) {
            console.log("[Inventory] Aplicando rascunhos locais encontrados.");
            if (compDraft) setComponents(compDraft);
            else setComponents(componentsWithStock);
            
            if (kitDraft) setKits(kitDraft);
            else setKits(sanitizedKits);
            
            if (logsDraft) setInventoryLogs(logsDraft);
            else setInventoryLogs(logs);
            
            setIsDirty(true);
        } else {
            setComponents(componentsWithStock);
            setKits(sanitizedKits);
            setInventoryLogs(logs);
            setIsDirty(false);
        }
    } catch (error) {
        console.error("Failed to load inventory data:", error);
        addToast("Erro ao carregar dados do inventário.", 'error');
    } finally {
        setIsLoading(false);
    }
  }, [calculateAllStock, addToast]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to remote changes
  useEffect(() => {
    const unsubscribe = api.subscribeToLastModified((timestamp) => {
        setRemoteLastModified(timestamp);
    }, 'inventory');
    return () => unsubscribe();
  }, []);

  const isOutdated = useMemo(() => {
    if (!lastSync || !remoteLastModified) return false;
    return remoteLastModified > lastSync + 2000;
  }, [lastSync, remoteLastModified]);

  // Save drafts to localStorage
  useEffect(() => {
    if (isDirty) {
        api.saveLocalDraft('components', components);
        api.saveLocalDraft('kits', kits);
        api.saveLocalDraft('inventoryLogs', inventoryLogs);
    }
  }, [isDirty, components, kits, inventoryLogs]);

  const saveChanges = useCallback(async () => {
    setSavingStatus('saving');
    setIsDirty(false);
    try {
        await Promise.all([
            api.saveComponents(components, true),
            api.saveKits(kits, true),
            api.saveInventoryLogs(inventoryLogs, true)
        ]);

        await api.updateLastModified('inventory');

        api.clearLocalDraft('components');
        api.clearLocalDraft('kits');
        api.clearLocalDraft('inventoryLogs');

        setLastSync(Date.now());
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
        addToast("Alterações de estoque sincronizadas com a nuvem.", "success");
    } catch (error) {
        console.error("Erro ao salvar inventário:", error);
        setIsDirty(true);
        setSavingStatus('idle');
        addToast("Erro ao sincronizar com a nuvem.", "error");
    }
  }, [components, kits, inventoryLogs, addToast]);

  // Auto-save logic
  useEffect(() => {
    if (isDirty && autoSaveEnabled) {
        const timer = setTimeout(() => {
            saveChanges();
        }, 2000); // Debounce de 2 segundos
        return () => clearTimeout(timer);
    }
  }, [isDirty, saveChanges, autoSaveEnabled]);


  const componentMap = useMemo(() => {
    const map = new Map<string, Component>();
    components.forEach(c => map.set(c.id, c));
    return map;
  }, [components]);

  const componentSkuMap = useMemo(() => {
    const map = new Map<string, Component>();
    components.forEach(c => {
        if (c.sku) map.set(c.sku.toUpperCase(), c);
    });
    return map;
  }, [components]);

  const kitMap = useMemo(() => {
    const map = new Map<string, Kit>();
    kits.forEach(k => map.set(k.id, k));
    return map;
  }, [kits]);
  
  const kitSkuMap = useMemo(() => {
    const map = new Map<string, Kit>();
    kits.forEach(k => {
        if (k.sku) map.set(k.sku.toUpperCase(), k);
    });
    return map;
  }, [kits]);

  const componentUsageMap = useMemo(() => {
    const usageMap = new Map<string, Kit[]>();
    components.forEach(c => {
        if (c.sku) usageMap.set(c.sku.toUpperCase(), []);
    });
  
    kits.forEach(kit => {
        (kit.components || []).forEach(kitComponent => {
            if (kitComponent.componentSku) {
                const sku = kitComponent.componentSku.toUpperCase();
                if (!usageMap.has(sku)) {
                    usageMap.set(sku, []);
                }
                usageMap.get(sku)!.push(kit);
            }
        });
    });

    return usageMap;
  }, [kits, components]);

  const findComponentById = useCallback((id: string) => componentMap.get(id), [componentMap]);
  const findComponentBySku = useCallback((sku: string) => sku ? componentSkuMap.get(sku.toUpperCase()) : undefined, [componentSkuMap]);
  const findKitById = useCallback((id:string) => kitMap.get(id), [kitMap]);
  const findKitBySku = useCallback((sku: string) => sku ? kitSkuMap.get(sku.toUpperCase()) : undefined, [kitSkuMap]);
  const getKitsUsingComponent = useCallback((componentSku: string) => componentSku ? (componentUsageMap.get(componentSku.toUpperCase()) || []) : [], [componentUsageMap]);


  const addComponent = useCallback(async (componentData: Omit<Component, 'id' | 'stock'>): Promise<Component> => {
    const sanitizedSku = (componentData.sku || nanoid()).replace(/[.#$\[\]/]/g, '-');
    const newComponent: Component = { 
        id: `comp-${sanitizedSku}`,
        stock: 0, 
        ...componentData,
    } as Component;
    
    setComponents(prev => [...prev, newComponent]);
    setIsDirty(true);
    addToast('Componente adicionado ao rascunho local.', 'success');
    return newComponent;
  }, [addToast]);
  
  const updateComponent = useCallback(async (updatedComponent: Component) => {
    setComponents(prev => prev.map(c => c.id === updatedComponent.id ? updatedComponent : c));
    setIsDirty(true);
    addToast('Componente atualizado no rascunho.', 'success');
  }, [addToast]);

  const updateMultipleComponents = useCallback(async (componentsToUpdate: Component[]) => {
      const updateMap = new Map(componentsToUpdate.map(c => [c.id, c]));
      setComponents(prev => prev.map(c => updateMap.get(c.id) || c));
      setIsDirty(true);
      addToast(`${componentsToUpdate.length} componentes atualizados no rascunho.`, 'success');
  }, [addToast]);

  const addMultipleComponents = useCallback(async (componentsToImport: ComponentImportData[]): Promise<{ successCount: number; errorCount: number; }> => {
        try {
            const currentComponents = await api.getComponents();
            const currentLogs = await api.getInventoryLogs();
            const currentSkus = new Set(currentComponents.map(c => c.sku.toLowerCase()));
            const allFamilias = await api.getFamilias();
            const familiaMap = new Map(allFamilias.map(f => [f.id, f]));

            const newComponents: Component[] = [];
            const newLogs: Omit<InventoryLog, 'id'|'date'>[] = [];
            let errorCount = 0;
            let successCount = 0;

            for (const item of componentsToImport) {
                if (currentSkus.has(item.SKU.toLowerCase())) {
                    errorCount++;
                    continue;
                }
                
                const familia = familiaMap.get(item.familiaId);
                if (!familia) {
                    errorCount++;
                    continue;
                }

                const newId = `comp-${item.SKU}`;
                const newComponent: Component = {
                    id: newId,
                    name: item.Nome,
                    sku: item.SKU,
                    stock: 0, 
                    type: 'component',
                    familiaId: item.familiaId,
                    sourcing: familia.sourcing || 'manufactured',
                    custoFabricacao: 0, 
                    custoMateriaPrima: 0,
                };
                newComponents.push(newComponent);
                currentSkus.add(item.SKU.toLowerCase()); 
                
                if (item.Estoque_Inicial && item.Estoque_Inicial > 0) {
                    newLogs.push({
                        componentId: newId,
                        type: 'entrada',
                        quantity: item.Estoque_Inicial,
                        reason: 'estoque_inicial',
                        notes: 'Importação via planilha'
                    });
                }
                successCount++;
            }

            if (newComponents.length > 0) {
                await api.saveComponents([...currentComponents, ...newComponents]);
            }
            if (newLogs.length > 0) {
                 const logsWithIdAndDate = newLogs.map((log, i) => ({
                    ...log,
                    id: `log-import-${Date.now()}-${i}`,
                    date: new Date().toISOString()
                }));
                await api.saveInventoryLogs([...currentLogs, ...logsWithIdAndDate]);
            }
            
            if (newComponents.length > 0 || newLogs.length > 0) {
                 await addActivityLog(`Importou ${successCount} componentes via planilha.`);
                 await loadData(); 
            }
           
            return { successCount, errorCount };
        } catch (e) {
            console.error("Failed to batch import components:", e);
            addToast('Erro ao importar componentes.', 'error');
            return { successCount: 0, errorCount: componentsToImport.length };
        }
    }, [addToast, addActivityLog, loadData]);
    
  const addMultipleInventoryLogs = useCallback(async (logsData: Omit<InventoryLog, 'id' | 'date'>[]) => {
      try {
          const now = new Date().toISOString();
          const newLogs: InventoryLog[] = logsData.map(log => ({
              ...log,
              id: `log-multi-${nanoid(8)}`,
              date: now,
          }));
          const currentLogs = await api.getInventoryLogs();
          await api.saveInventoryLogs([...currentLogs, ...newLogs]);
          await addActivityLog(`Registrou ${newLogs.length} movimentações de estoque em lote.`);
          await loadData(); 
      } catch (e) {
          console.error("Failed to add multiple inventory logs:", e);
          addToast('Erro ao salvar múltiplas movimentações de estoque.', 'error');
      }
  }, [addActivityLog, loadData]);

    const adjustStockFromImport = useCallback(async (adjustments: StockAdjustmentImportData[]): Promise<{ successCount: number; errorCount: number; }> => {
        const logsToAdd: Omit<InventoryLog, 'id' | 'date'>[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (const adj of adjustments) {
            const component = findComponentBySku(adj.SKU);
            if (component) {
                const difference = adj.Estoque - component.stock;
                if (difference !== 0) {
                    logsToAdd.push({
                        componentId: component.id,
                        type: difference > 0 ? 'entrada' : 'saída',
                        quantity: Math.abs(difference),
                        reason: difference > 0 ? 'ajuste_inventario_positivo' : 'ajuste_inventario_negativo',
                        notes: 'Ajuste via importação de planilha de estoque.',
                    });
                }
                successCount++;
            } else {
                errorCount++;
            }
        }
        if (logsToAdd.length > 0) {
            await addMultipleInventoryLogs(logsToAdd);
            await addActivityLog(`Ajustou o estoque de ${successCount} componentes via planilha.`);
        }
        return { successCount, errorCount };
    }, [findComponentBySku, addMultipleInventoryLogs, addActivityLog]);

  const deleteComponent = useCallback(async (componentId: string) => {
      setComponents(prev => prev.filter(c => c.id !== componentId));
      setInventoryLogs(prev => prev.filter(log => log.componentId !== componentId));
      setIsDirty(true);
      addToast('Componente removido do rascunho.', 'success');
  }, [addToast]);

  const addKit = useCallback(async (kitData: Omit<Kit, 'id'>): Promise<Kit> => {
      const newKit: Kit = { id: `kit-${nanoid()}`, ...kitData };
      setKits(prev => [...prev, newKit]);
      setIsDirty(true);
      addToast('Kit adicionado ao rascunho.', 'success');
      return newKit;
  }, [addToast]);

  const updateKit = useCallback(async (updatedKit: Kit) => {
      setKits(prev => prev.map(k => k.id === updatedKit.id ? updatedKit : k));
      setIsDirty(true);
      addToast('Kit atualizado no rascunho.', 'success');
  }, [addToast]);

  const addMultipleKits = useCallback(async (kitsToImport: Kit[]): Promise<{ successCount: number, errorCount: number }> => {
      try {
          const currentKits = await api.getKits();
          const currentKitSkus = new Set(currentKits.map(k => k.sku?.toLowerCase()).filter(Boolean));
          const newKits: Kit[] = [];
          let errorCount = 0;

          for (const item of kitsToImport) {
              if (item.sku && currentKitSkus.has(item.sku.toLowerCase())) {
                  errorCount++;
                  continue;
              }
              newKits.push(item);
          }

          if (newKits.length > 0) {
              await api.saveKits([...currentKits, ...newKits]);
              await addActivityLog(`Importou ${newKits.length} kits via planilha.`);
              await loadData();
          }

          return { successCount: newKits.length, errorCount };
      } catch (e) {
          console.error("Failed to import kits:", e);
          addToast('Erro ao importar kits.', 'error');
          return { successCount: 0, errorCount: kitsToImport.length };
      }
  }, [addToast, addActivityLog, loadData]);

  const updateMultipleKits = useCallback(async (kitsToUpdate: Kit[]) => {
      try {
          const currentKits = await api.getKits();
          const updateMap = new Map(kitsToUpdate.map(k => [k.id, k]));
          const newKits = currentKits.map(k => updateMap.get(k.id) || k);
          await api.saveKits(newKits);
          await addActivityLog(`Atualizou ${kitsToUpdate.length} kits via planilha.`);
          await loadData();
      } catch (e) {
          console.error("Failed to batch update kits:", e);
          addToast('Erro ao atualizar kits em lote.', 'error');
          throw e;
      }
  }, [addToast, addActivityLog, loadData]);

  const deleteKit = useCallback(async (kitId: string) => {
      setKits(prev => prev.filter(k => k.id !== kitId));
      setIsDirty(true);
      addToast('Kit removido do rascunho.', 'success');
  }, [addToast]);

  const getLogsForComponent = useCallback((componentId: string): InventoryLog[] => {
      return inventoryLogs.filter(log => log.componentId === componentId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryLogs]);
  
  const addInventoryLog = useCallback(async (logData: Omit<InventoryLog, 'id' | 'date'>) => {
      const newLog: InventoryLog = {
          ...logData,
          id: `log-${nanoid()}`,
          date: new Date().toISOString(),
      };
      setInventoryLogs(prev => [...prev, newLog]);
      setIsDirty(true);
      addToast('Movimentação adicionada ao rascunho.', 'success');
  }, [addToast]);

  
    const recalculateAllComponentCosts = useCallback(async (familias: FamiliaComponente[], allInventoryItems: Component[], auxiliaryData?: { ws: WorkStation[], cons: Consumable[], ops: StandardOperation[], kits: Kit[] }): Promise<SyncReport> => {
    const report: SyncReport = { createdComponents: [], updatedComponents: [], deletedComponents: [] };
    let hasChanges = false;
    
    // Fix: Deduplicate by ID at the start to ensure clean state
    const uniqueMap = new Map<string, Component>();
    allInventoryItems.forEach(c => {
        if (c && c.id) uniqueMap.set(c.id, c);
    });
    let newComponentList = Array.from(uniqueMap.values());

    // Usar dados passados ou buscar se não fornecidos
    const currentKits = auxiliaryData?.kits || await api.getKits();
    const ws = auxiliaryData?.ws || await api.getWorkStations();
    const cons = auxiliaryData?.cons || await api.getConsumables();
    const ops = auxiliaryData?.ops || await api.getStandardOperations();
    
    const prodOrders = await api.getProductionOrders();
    const manOrders = await api.getManufacturingOrders();

    const allGeneratedProducts = new Map<string, { product: Component, familia: FamiliaComponente }>();
    
    // ALGORITMO PROFISSIONAL: Topological Sort para resolver dependências de custos
    const buildDependencyGraph = () => {
        const adj = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        
        familias.forEach(f => {
            adj.set(f.id, []);
            inDegree.set(f.id, 0);
        });

        familias.forEach(f => {
            const dependencies = new Set<string>();
            f.nodes.forEach(n => {
                if (n.data.sourceFamiliaId && familias.some(fam => fam.id === n.data.sourceFamiliaId)) {
                    dependencies.add(n.data.sourceFamiliaId);
                }
            });
            
            dependencies.forEach(depId => {
                adj.get(depId)?.push(f.id);
                inDegree.set(f.id, (inDegree.get(f.id) || 0) + 1);
            });
        });

        const queue: string[] = [];
        inDegree.forEach((degree, id) => {
            if (degree === 0) queue.push(id);
        });

        const sorted: string[] = [];
        while (queue.length > 0) {
            const u = queue.shift()!;
            sorted.push(u);
            adj.get(u)?.forEach(v => {
                inDegree.set(v, inDegree.get(v)! - 1);
                if (inDegree.get(v) === 0) queue.push(v);
            });
        }

        // Se o sorted for menor que familias, há um ciclo
        if (sorted.length < familias.length) {
            console.warn("[MRP] Ciclo detectado nas dependências de famílias. Usando ordem original.");
            return familias;
        }

        return sorted.map(id => familias.find(f => f.id === id)!);
    };

    const sortedFamilias = buildDependencyGraph();

    // Uma única passagem agora é suficiente se o grafo for acíclico
    for (const familia of sortedFamilias) {
        if (familia.nodes?.some(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode')) {
            const generatedProducts = generateAllProductsForFamilia(familia, newComponentList, currentKits, {
                workStations: ws,
                consumables: cons,
                operations: ops,
                allFamilias: familias
            });

            generatedProducts.forEach(p => {
                const sanitizedSku = p.sku.replace(/[.#$\[\]/]/g, '-');
                const component: Component = {
                    id: `comp-${sanitizedSku}`,
                    name: p.name,
                    sku: p.sku,
                    stock: 0,
                    type: 'component',
                    sourcing: p.defaultSourcing || 'manufactured',
                    familiaId: familia.id,
                    custoFabricacao: p.custoFabricacao,
                    custoMateriaPrima: p.custoMateriaPrima,
                };
                allGeneratedProducts.set(p.sku, { product: component, familia });
                
                // Fix: Check both SKU and ID to prevent duplicate keys in React
                const existingIdx = newComponentList.findIndex(c => c.sku === p.sku || c.id === component.id);
                if (existingIdx >= 0) {
                    newComponentList[existingIdx] = {
                        ...newComponentList[existingIdx],
                        id: component.id, // Ensure ID is consistent with SKU
                        sku: p.sku,
                        custoFabricacao: p.custoFabricacao,
                        custoMateriaPrima: p.custoMateriaPrima,
                        familiaId: familia.id,
                        name: p.name,
                        sourcing: p.defaultSourcing || 'manufactured'
                    };
                } else {
                    newComponentList.push(component);
                }
            });
        }
    }
    
    for (const [sku, { product, familia }] of allGeneratedProducts.entries()) {
        const existingComponent = allInventoryItems.find(c => c.sku === sku);
        if (!existingComponent) {
            // Já adicionamos ao newComponentList no loop acima, mas precisamos marcar para o report
            report.createdComponents.push(product);
            hasChanges = true;
        } else {
            const oldCost = getComponentCost(existingComponent);
            const newCost = getComponentCost(product);
            if (Math.abs(oldCost - newCost) > 0.01 || existingComponent.familiaId !== familia.id || existingComponent.name !== product.name || existingComponent.sourcing !== product.sourcing) {
                // O newComponentList já foi atualizado no loop acima, apenas registramos no report
                report.updatedComponents.push({ ...product, oldCost: oldCost, newCost: newCost });
                hasChanges = true;
            }
        }
    }

    const currentGeneratedSkus = new Set(allGeneratedProducts.keys());
    const componentsToDelete = newComponentList.filter(c => 
        c.familiaId && familias.some(f => f.id === c.familiaId && f.nodes?.some(n => n.data.type === 'productGenerator')) &&
        !currentGeneratedSkus.has(c.sku)
    );
    if (componentsToDelete.length > 0) {
        const idsToDelete = new Set(componentsToDelete.map(c => c.id));
        newComponentList = newComponentList.filter(c => !idsToDelete.has(c.id));
        report.deletedComponents = componentsToDelete;
        hasChanges = true;
    }
    
    if (hasChanges) {
        await api.saveComponents(newComponentList);
        await addActivityLog(`Sincronização de custos e SKUs concluída: ${report.createdComponents.length} criados, ${report.updatedComponents.length} atualizados.`);
        
        // Atualizar estado local e marcar como sincronizado
        const componentsWithUpdatedStock = calculateAllStock(newComponentList, inventoryLogs, prodOrders, manOrders);
        setComponents(componentsWithUpdatedStock);
        setLastSync(Date.now());
    }
    
    return report;
}, [addActivityLog, inventoryLogs, calculateAllStock]);
  
const analyzeProductionRun = useCallback((
    order: ProductionOrderItem[],
    additionalItems: { componentId: string, quantity: number }[],
    familias: FamiliaComponente[],
    allInventoryItems: Component[],
    settings: FinancialSettings,
    headCodeToSimulate?: string,
    auxiliaryData?: {
        workStations?: WorkStation[];
        operations?: StandardOperation[];
        consumables?: Consumable[];
    }
): { scenarios: ProductionScenario[], virtualComponents: Component[] } => {
    
    const aggregatedKitComponents = new Map<string, number>(); 
    // itemKeyNames removido pois o segredo está no nome/sku

    order.forEach(orderItem => {
        if (orderItem.type === 'kit') {
            const kit = findKitById(orderItem.id);
            if (!kit) return;
            (kit.components || []).forEach(comp => {
                aggregatedKitComponents.set(comp.componentSku, (aggregatedKitComponents.get(comp.componentSku) || 0) + (comp.quantity * orderItem.quantity));
            });
        } else {
            const component = findComponentById(orderItem.id);
            if (component) {
                const dictKey = component.sku;
                aggregatedKitComponents.set(dictKey, (aggregatedKitComponents.get(dictKey) || 0) + orderItem.quantity);
            }
        }
    });

    (additionalItems || []).forEach((item: { componentId: string, quantity: number }) => {
        const component = findComponentById(item.componentId);
        if (component) {
            const dictKey = component.sku;
            aggregatedKitComponents.set(dictKey, (aggregatedKitComponents.get(dictKey) || 0) + item.quantity);
        }
    });
    
    const allUniqueHeadCodes = (() => {
        const codes = new Set<string>();
        familias.forEach(f => {
            (f.nodes || []).forEach(n => {
                if (((n.data.type as string) === 'headCodeTable' || (n.data.type as string) === 'codificationTable' || (n.data.type as string) === 'codificationTableNode') && n.data.headCodes) {
                    (n.data.headCodes || []).forEach((hc: any) => {
                        if (hc.code) codes.add(hc.code);
                    });
                }
            });
        });
        return Array.from(codes).sort();
    })();

    const headCodesToRun = headCodeToSimulate ? [headCodeToSimulate] : (allUniqueHeadCodes.length > 0 ? allUniqueHeadCodes : ['']);
    
    const scenarios: ProductionScenario[] = [];
    const virtualComponents = new Map<string, Component>();
    const componentSkuMap = new Map(allInventoryItems.map(c => [c.sku, c]));
    
    const fastenerFamilia = familias.find(f => f.id === 'fam-fixadores');
    const fixSFamilia = familias.find(f => f.id === 'fam-MONTAGEM-FIX-S' || f.nome?.toLowerCase() === 'montagem fix-s');
    const fixPFamilia = familias.find(f => f.id === 'fam-MONTAGEM-FIX-P' || f.nome?.toLowerCase() === 'montagem fix-p');
    const porPFamilia = familias.find(f => f.id === 'fam-MONTAGEM-POR-P' || f.nome?.toLowerCase() === 'montagem por-p');
    
    for (const headCode of headCodesToRun) {
        const scenarioRequirements = new Map(aggregatedKitComponents);
        
        order.forEach(orderItem => {
            if (orderItem.type !== 'kit') return;
            const kit = findKitById(orderItem.id);
            if (!kit) return;
            
            const itemHeadCode = orderItem.fastenerHeadCode || headCode;
            
            (kit.requiredFasteners || []).forEach(fastener => {
                const dimString = fastener.dimension.replace('mm', '');
                const [bitola, comprimento] = dimString.split('x');
                const isNut = dimString.endsWith('x0') || dimString.includes('x0') || comprimento === '0';
                
                let familiaToUse = fastenerFamilia;
                
                if (isNut) {
                    familiaToUse = porPFamilia;
                    if (orderItem.selectedNutFamiliaId) {
                        familiaToUse = familias.find(f => f.id === orderItem.selectedNutFamiliaId) || familiaToUse;
                    } else if (kit.selectedNutFamiliaId) {
                        familiaToUse = familias.find(f => f.id === kit.selectedNutFamiliaId) || familiaToUse;
                    }
                } else {
                    if (orderItem.selectedFamiliaId) {
                        familiaToUse = familias.find(f => f.id === orderItem.selectedFamiliaId) || familiaToUse;
                    } else if (kit.selectedFamiliaId) {
                        familiaToUse = familias.find(f => f.id === kit.selectedFamiliaId) || familiaToUse;
                    } else if (orderItem.variant === 'Fix-S') {
                        familiaToUse = fixSFamilia;
                    } else if (orderItem.variant === 'Fix-P') {
                        familiaToUse = fixPFamilia;
                    } else {
                        familiaToUse = fixSFamilia; // Default to Fix-S if no variant specified
                    }
                }

                if (familiaToUse) {
                    const generatorNode = (familiaToUse.nodes || []).find(n => n.data.type === 'productGenerator');
                    let defaultTemplate = 'FIX-S-{headCode}-M{bitola}x{comprimento}';
                    
                    if (isNut) defaultTemplate = 'POR-P-{headCode}-M{bitola}x{comprimento}';
                    else if (familiaToUse === fixPFamilia || orderItem.variant === 'Fix-P') defaultTemplate = 'FIX-P-{headCode}-M{bitola}x{comprimento}';
                    else if (familiaToUse.nome && !familiaToUse.nome.includes('FIX-S')) {
                        // Fallback heuristico para nome de familia customizada sem template
                        defaultTemplate = `${familiaToUse.nome.replace('Montagem ', '')}-{headCode}-M{bitola}x{comprimento}`;
                    }
                    
                    const skuTemplate = generatorNode?.data.generationConfig?.skuTemplate || defaultTemplate;
                    
                    const fastenerSku = skuTemplate
                        .replace(/{headCode}/gi, itemHeadCode)
                        .replace(/{bitola}/gi, bitola)
                        .replace(/{comprimento}/gi, comprimento)
                        .replace(/{dimensao}/gi, dimString);
                    const totalQuantity = fastener.quantity * orderItem.quantity;
                    scenarioRequirements.set(fastenerSku, (scenarioRequirements.get(fastenerSku) || 0) + totalQuantity);
                } else {
                    let defaultTemplate = 'FIX-S-{headCode}-M{bitola}x{comprimento}';
                    if (isNut) defaultTemplate = 'POR-P-{headCode}-M{bitola}x{comprimento}';
                    else if (orderItem.variant === 'Fix-P') defaultTemplate = 'FIX-P-{headCode}-M{bitola}x{comprimento}';
                    
                    const skuTemplate = defaultTemplate;
                    const fastenerSku = skuTemplate
                        .replace(/{headCode}/gi, itemHeadCode)
                        .replace(/{bitola}/gi, bitola)
                        .replace(/{comprimento}/gi, comprimento)
                        .replace(/{dimensao}/gi, dimString);
                    const totalQuantity = fastener.quantity * orderItem.quantity;
                    scenarioRequirements.set(fastenerSku, (scenarioRequirements.get(fastenerSku) || 0) + totalQuantity);
                }
            });
        });

        const scenario: ProductionScenario = {
            isPossible: true, fastenerHeadCode: headCode || 'Análise Geral', totalCost: 0,
            costBreakdown: { materialCost: 0, fabricationCost: 0 },
            inventoryValueConsumed: 0, shortageValue: 0, shortages: [],
            detailedRequirements: [], substitutionsMade: [],
        };
        
        for (const [sku, required] of scenarioRequirements.entries()) {
            let component = componentSkuMap.get(sku);
            
            if (!component && !virtualComponents.has(sku)) {
                const familiaMatch = familias.find(f => {
                    const genNode = (f.nodes || []).find(n => n.data.type === 'productGenerator');
                    if (!genNode?.data.generationConfig?.skuTemplate) return false;
                    const template = genNode.data.generationConfig.skuTemplate;
                    const regexStr = `^${template.replace(/\{[^}]+\}/g, '(.+)')}$`;
                    return new RegExp(regexStr, 'i').test(sku);
                });
                
                if (familiaMatch) {
                    const genNode = (familiaMatch.nodes || []).find(n => n.data.type === 'productGenerator')!;
                    const nameTemplate = genNode.data.generationConfig!.nameTemplate;
                    
                    const skuInfo = parseFastenerSku(sku);
                    const stringVariables: Record<string, string> = {
                        headCode: headCode || '',
                        bitola: '',
                        comprimento: '',
                        dimensao: ''
                    };
                    const processVariables: Record<string, number> = {};
                    
                    if (skuInfo) {
                        processVariables['bitola'] = skuInfo.bitola;
                        processVariables['comprimento'] = skuInfo.comprimento;
                        stringVariables['bitola'] = String(skuInfo.bitola);
                        stringVariables['comprimento'] = String(skuInfo.comprimento);
                        stringVariables['dimensao'] = `${skuInfo.bitola}x${skuInfo.comprimento}`;
                        stringVariables['headCode'] = skuInfo.head;
                    }
                    
                    const result = evaluateProcess(familiaMatch, processVariables, allInventoryItems, stringVariables, {
                        workStations: auxiliaryData?.workStations || [], 
                        operations: auxiliaryData?.operations || [], 
                        consumables: auxiliaryData?.consumables || [], 
                        allFamilias: familias
                    });
                    
                    let name = nameTemplate;
                    // SUBSTITUIÇÃO GLOBAL COMPLETA
                    Object.entries(stringVariables).forEach(([key, value]) => { 
                        name = name.replace(new RegExp(`{${key}}`, 'gi'), value); 
                    });
                    
                    const newComponent: Component = {
                        id: `comp-virtual-${sku}`, name, sku, stock: 0, type: 'component',
                        sourcing: (result.custoFabricacao > 0) ? 'manufactured' : (familiaMatch.sourcing || 'manufactured'), 
                        familiaId: familiaMatch.id,
                        custoFabricacao: result.custoFabricacao,
                        custoMateriaPrima: result.custoMateriaPrima,
                    } as Component;
                    virtualComponents.set(sku, newComponent);
                }
            }

            component = componentSkuMap.get(sku) || virtualComponents.get(sku);

            if (!component) {
                let name = `Componente Desconhecido (${sku})`;
                if (sku.startsWith('FIX-S')) {
                    const parts = sku.split('-');
                    if (parts.length >= 4) name = `Fixador FIX-S ${parts[2]} ${parts[3]}`;
                } else if (sku.startsWith('POR-P')) {
                    const parts = sku.split('-');
                    if (parts.length >= 4) name = `Porca POR-P ${parts[2]} ${parts[3]}`;
                } else if (sku.startsWith('FIX-P')) {
                    const parts = sku.split('-');
                    if (parts.length >= 4) name = `Fixador FIX-P ${parts[2]} ${parts[3]}`;
                }

                scenario.isPossible = false;
                scenario.shortages.push({ 
                    componentId: `unknown-${sku}`, 
                    componentName: name, 
                    required, available: 0, shortage: required, unitCost: 0, totalShortageValue: 0
                });
                continue;
            }
            
            const unitCost = getComponentCost(component);
            const available = component.stock;
            const totalItemCost = required * unitCost;

            scenario.totalCost += totalItemCost;
            
            // FIX: Se for matéria prima ou comprado, o custo total vai para materialCost
            if (component.type === 'raw_material' || component.sourcing === 'purchased') {
                scenario.costBreakdown.materialCost += totalItemCost;
            } else {
                scenario.costBreakdown.materialCost += (component.custoMateriaPrima || 0) * required;
                scenario.costBreakdown.fabricationCost += (component.custoFabricacao || 0) * required;
            }
            
            scenario.detailedRequirements.push({ 
                componentId: component.id, componentName: component.name, 
                required, available, balance: available - required, 
                unitCost, totalValueRequired: totalItemCost
            });

            if (available < required) {
                scenario.isPossible = false;
                const shortage = required - available;
                scenario.shortageValue += shortage * unitCost;
                scenario.shortages.push({ 
                    componentId: component.id, componentName: component.name, 
                    required, available, shortage, unitCost, totalShortageValue: shortage * unitCost
                });
            }
        }
        
        scenarios.push(scenario);
    }
    
    return { scenarios, virtualComponents: Array.from(virtualComponents.values()) };

}, [findKitById, findComponentById]);

const executeProductionRun = useCallback(async (order: ProductionOrder) => {
    const { selectedScenario, virtualComponents } = order;
    const logs: Omit<InventoryLog, 'id' | 'date'>[] = [];

    const currentComponents = await api.getComponents();

    (selectedScenario?.detailedRequirements || []).forEach(req => {
        let targetComponentId = req.componentId;
        
        const isVirtualId = req.componentId.startsWith('comp-virtual-') || virtualComponents?.some(vc => vc.id === req.componentId);
        
        if (isVirtualId) {
            const virtualComp = virtualComponents.find(vc => vc.id === req.componentId);
            const sku = virtualComp?.sku || req.componentId.replace('comp-virtual-', '');
            
            const realComp = currentComponents.find(c => c.sku === sku);
            if (realComp) {
                targetComponentId = realComp.id;
            }
        }

        logs.push({
            componentId: targetComponentId,
            type: 'saída',
            quantity: req.required,
            reason: 'uso_producao_kit',
            notes: `Consumido para Ordem de Produção ${order.id}`
        });
    });

    for (const item of (order.orderItems || [])) {
        if (item.type !== 'kit') continue;
        const kit = findKitById(item.id);
        if (kit) {
            const kitSku = `${kit.sku}${item.variant && item.variant !== 'Padrão' ? `-${item.variant}` : ''}`;
            let kitComponent = currentComponents.find(c => c.sku === kitSku);
            
            if (!kitComponent) {
                const newComponentData = {
                    name: `${kit.name} ${item.variant && item.variant !== 'Padrão' ? `(${item.variant})` : ''}`,
                    sku: kitSku,
                    type: 'component' as 'component',
                    sourcing: 'manufactured' as 'manufactured',
                    minStock: 0,
                    custoFabricacao: 0,
                    custoMateriaPrima: 0
                };
                await addComponent(newComponentData);
                // Refresh current components after adding
                const updatedComponents = await api.getComponents();
                kitComponent = updatedComponents.find(c => c.sku === kitSku);
            }

            if (kitComponent) {
                logs.push({
                    componentId: kitComponent.id, 
                    type: 'entrada',
                    quantity: item.quantity,
                    reason: 'conclusao_ordem_producao',
                    notes: `Produzido para Ordem de Produção ${order.id}`
                });
            }
        }
    }

    if (logs.length > 0) {
        await addMultipleInventoryLogs(logs);
    }

    await addActivityLog(`Ordem de Produção ${order.id} concluída e estoque atualizado.`);
    addToast(`Ordem ${order.id} concluída. Estoque foi atualizado.`, 'success');

}, [addMultipleInventoryLogs, addActivityLog, addToast, findKitById, addComponent]);

const createAndStockComponent = useCallback(async (componentData: { sku: string; name: string; familiaId: string; }) => {
    const existing = findComponentBySku(componentData.sku);
    if(existing) {
        addToast(`Componente com SKU ${componentData.sku} já existe.`, 'info');
        return;
    }
    await addComponent({ ...componentData, type: 'component', custoFabricacao: 0, custoMateriaPrima: 0 });
}, [addComponent, findComponentBySku, addToast]);
    
const getKits = useCallback(async (): Promise<Kit[]> => {
    return await api.getKits();
}, []);

    const recordSale = useCallback(async (kitId: string, quantity: number, notes?: string) => {
        const kit = findKitById(kitId);
        if (!kit) return;

        const currentComponents = await api.getComponents();
        const kitComponent = currentComponents.find(c => c.sku === kit.sku);

        if (kitComponent) {
            await addInventoryLog({
                componentId: kitComponent.id,
                type: 'saída',
                quantity,
                reason: 'venda_direta',
                notes: notes || `Venda do kit ${kit.name}`
            });
            addToast(`Venda de ${quantity}x ${kit.name} registrada.`, 'success');
        } else {
            addToast(`Erro: Componente do kit ${kit.sku} não encontrado no estoque.`, 'error');
        }
    }, [findKitById, addInventoryLog, addToast]);

    const recordMultiSale = useCallback(async (items: SaleItem[], notes?: string) => {
        const currentComponents = await api.getComponents();
        const logsToCreate: Omit<InventoryLog, 'id' | 'date'>[] = [];
        let successCount = 0;

        for (const item of items) {
            if (item.type === 'kit') {
                const kit = kits.find(k => k.id === item.id);
                if (kit) {
                    const kitComponent = currentComponents.find(c => c.sku === kit.sku);
                    if (kitComponent) {
                        logsToCreate.push({
                            componentId: kitComponent.id,
                            type: 'saída',
                            quantity: item.quantity,
                            reason: 'venda_direta',
                            notes: notes || `Venda do kit ${kit.name}`
                        });
                        successCount++;
                    }
                }
            } else {
                const component = currentComponents.find(c => c.id === item.id);
                if (component) {
                    logsToCreate.push({
                        componentId: component.id,
                        type: 'saída',
                        quantity: item.quantity,
                        reason: 'venda_direta',
                        notes: notes || `Venda do item ${component.name}`
                    });
                    successCount++;
                }
            }
        }

        if (logsToCreate.length > 0) {
            await addMultipleInventoryLogs(logsToCreate);
            addToast(`Venda de ${successCount} itens registrada com sucesso.`, 'success');
        } else {
            addToast('Nenhum item válido para registrar venda.', 'warning');
        }
    }, [kits, addMultipleInventoryLogs, addToast]);

    const autoCategorizeAll = useCallback(async (): Promise<number> => {
        let count = 0;
        const updatedComponents = components.map(c => {
            if (c.category) return c;
            
            let cat = '';
            const sku = (c.sku || '').toUpperCase();
            const name = (c.name || '').toLowerCase();

            if (sku.includes('PAR-') || sku.includes('FIX-') || name.includes('parafuso') || name.includes('fixador') || name.includes(' par ') || name.startsWith('par ') || name.includes(' fix ') || name.startsWith('fix ')) cat = 'fixadores';
            else if (sku.includes('NUT-') || name.includes('porca') || sku.includes('POR-P') || sku.includes('POR-') || name.includes(' por ') || name.startsWith('por ')) cat = 'porcas';
            else if (sku.includes('COPO') || name.includes('copo')) cat = 'copos';
            else if (sku.includes('TAMPA') || name.includes('tampa')) cat = 'tampas';
            else if (name.includes('chave') || sku.includes('CHAVE')) cat = 'chaves';
            else if (c.type === 'raw_material' && !sku.includes('PAR-') && !sku.includes('FIX-') && !sku.includes('NUT-')) cat = 'insumos';
            else if (sku.includes('MANUAL') || name.includes('manual')) cat = 'manuais';
            else if (sku.includes('EMB-') && !sku.includes('COPO') && !sku.includes('TAMPA')) cat = 'embalagens';
            else cat = 'outros';

            if (cat) {
                count++;
                return { ...c, category: cat };
            }
            return c;
        });

        if (count > 0) {
            setComponents(updatedComponents);
            setIsDirty(true);
            addToast(`${count} componentes categorizados automaticamente.`, 'success');
        } else {
            addToast('Nenhum componente precisava de categorização.', 'info');
        }
        return count;
    }, [components, addToast]);

    return useMemo(() => ({
        components,
        kits,
        inventoryLogs,
        isLoading,
        isDirty,
        savingStatus,
        lastSync,
        isOutdated,
        autoSaveEnabled,
        setAutoSaveEnabled,
        refreshFromCloud: loadData,
        saveChanges,
        addComponent,
        updateComponent,
        updateMultipleComponents,
        addMultipleComponents,
        adjustStockFromImport,
        deleteComponent,
        addKit,
        updateKit,
        addMultipleKits,
        updateMultipleKits,
        deleteKit,
        findComponentById,
        findComponentBySku,
        findKitById,
        findKitBySku,
        analyzeProductionRun,
        executeProductionRun,
        recordSale,
        recordMultiSale,
        addInventoryLog,
        addMultipleInventoryLogs,
        getLogsForComponent,
        recalculateAllComponentCosts,
        createAndStockComponent,
        getKitsUsingComponent,
        getKits,
        autoCategorizeAll,
    }), [
        components, kits, inventoryLogs, isLoading, isDirty, savingStatus, autoSaveEnabled, lastSync, isOutdated, loadData, saveChanges,
        addComponent, updateComponent, updateMultipleComponents, addMultipleComponents, adjustStockFromImport, 
        deleteComponent, addKit, updateKit, addMultipleKits, updateMultipleKits, 
        deleteKit, findComponentById, findComponentBySku, findKitById, findKitBySku, 
        analyzeProductionRun, executeProductionRun, recordSale, recordMultiSale, 
        addInventoryLog, addMultipleInventoryLogs, getLogsForComponent, 
        recalculateAllComponentCosts, createAndStockComponent, getKitsUsingComponent, getKits, autoCategorizeAll
    ]);
};
