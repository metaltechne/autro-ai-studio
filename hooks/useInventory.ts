
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Component, Kit, ProductionScenario, InventoryHook, FamiliaComponente, InventoryLog, ProductionOrderItem, SyncReport, ComponentImportData, ProcessDimension, StockAdjustmentImportData, KitImportData, KitComponent, SubstitutionOption, ProductionScenarioShortage, ProductionOrder, ManufacturingOrder, FinancialSettings } from '../types';
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
        (order.selectedScenario.detailedRequirements || []).forEach(req => {
            const currentReserved = reservedMap.get(req.componentId) || 0;
            reservedMap.set(req.componentId, currentReserved + req.required);
        });
    });

    // Calcular Reservas de Ordens de Fabricação (Componentes)
    manOrders.filter(o => o.status === 'pendente' || o.status === 'em_producao').forEach(order => {
        (order.analysis.requirements || []).forEach(req => {
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
        const componentsWithStock = calculateAllStock(rawComponents, logs, prodOrders, manOrders);
        setComponents(componentsWithStock);
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


  const componentMap = useMemo(() => {
    const map = new Map<string, Component>();
    components.forEach(c => map.set(c.id, c));
    return map;
  }, [components]);

  const componentSkuMap = useMemo(() => {
    const map = new Map<string, Component>();
    components.forEach(c => map.set(c.sku, c));
    return map;
  }, [components]);

  const kitMap = useMemo(() => {
    const map = new Map<string, Kit>();
    kits.forEach(k => map.set(k.id, k));
    return map;
  }, [kits]);
  
  const kitSkuMap = useMemo(() => {
    const map = new Map<string, Kit>();
    kits.forEach(k => map.set(k.sku, k));
    return map;
  }, [kits]);

  const componentUsageMap = useMemo(() => {
    const usageMap = new Map<string, Kit[]>();
    components.forEach(c => usageMap.set(c.sku, []));
  
    kits.forEach(kit => {
        (kit.components || []).forEach(kitComponent => {
            const sku = kitComponent.componentSku;
            if (!usageMap.has(sku)) {
                usageMap.set(sku, []);
            }
            usageMap.get(sku)!.push(kit);
        });
    });

    return usageMap;
  }, [kits, components]);

  const findComponentById = useCallback((id: string) => componentMap.get(id), [componentMap]);
  const findComponentBySku = useCallback((sku: string) => componentSkuMap.get(sku), [componentSkuMap]);
  const findKitById = useCallback((id:string) => kitMap.get(id), [kitMap]);
  const findKitBySku = useCallback((sku: string) => kitSkuMap.get(sku), [kitSkuMap]);
  const getKitsUsingComponent = useCallback((componentSku: string) => componentUsageMap.get(componentSku) || [], [componentUsageMap]);


  const addComponent = useCallback(async (componentData: Omit<Component, 'id' | 'stock'>) => {
    try {
        const allFamilias = await api.getFamilias();
        const familiaMap = new Map(allFamilias.map(f => [f.id, f]));

        const newComponent: Component = { 
            id: `comp-${componentData.sku || nanoid()}`,
            stock: 0, 
            ...componentData,
        } as Component;
        
        if (!newComponent.sourcing && newComponent.familiaId) {
            const familia = familiaMap.get(newComponent.familiaId);
            newComponent.sourcing = familia?.sourcing || 'manufactured';
        } else if (!newComponent.sourcing) {
            newComponent.sourcing = 'manufactured';
        }

        const currentComponents = await api.getComponents();
        const newComponents = [...currentComponents, newComponent];
        await api.saveComponents(newComponents);
        await addActivityLog(`Componente criado: ${newComponent.name}`, { componentId: newComponent.id, sku: newComponent.sku });
        addToast('Componente adicionado com sucesso!', 'success');
        await loadData();
    } catch (e) {
        console.error("Failed to add component:", e);
        addToast('Erro ao adicionar componente.', 'error');
    }
  }, [addToast, addActivityLog, loadData]);
  
  const updateComponent = useCallback(async (updatedComponent: Component) => {
    try {
        const updatedComponentCopy = { ...updatedComponent };
        if (updatedComponentCopy.purchaseCost === undefined) {
            delete updatedComponentCopy.purchaseCost;
        }
        
        const currentComponents = await api.getComponents();
        const newComponents = currentComponents.map(c => c.id === updatedComponent.id ? updatedComponentCopy : c);
        await api.saveComponents(newComponents);
        await addActivityLog(`Componente atualizado: ${updatedComponent.name}`, { componentId: updatedComponent.id });
        addToast('Componente atualizado com sucesso!', 'success');
        await loadData();
    } catch(e) {
        console.error("Failed to update component:", e);
        addToast('Erro ao atualizar componente.', 'error');
    }
  }, [addToast, addActivityLog, loadData]);

  const updateMultipleComponents = useCallback(async (componentsToUpdate: Component[]) => {
      try {
          const currentComponents = await api.getComponents();
          const updateMap = new Map(componentsToUpdate.map(c => [c.id, c]));
          const newComponents = currentComponents.map(c => updateMap.get(c.id) || c);
          await api.saveComponents(newComponents);
          await addActivityLog(`Atualizou ${componentsToUpdate.length} componentes via planilha.`);
          await loadData();
      } catch (e) {
          console.error("Failed to batch update components:", e);
          addToast('Erro ao atualizar componentes em lote.', 'error');
          throw e;
      }
  }, [addToast, addActivityLog, loadData]);

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
      try {
          const currentComponents = await api.getComponents();
          const componentToDelete = currentComponents.find(c => c.id === componentId);
          if (!componentToDelete) return;
          
          const newComponents = currentComponents.filter(c => c.id !== componentId);
          await api.saveComponents(newComponents);
          
          const currentLogs = await api.getInventoryLogs();
          const newLogs = currentLogs.filter(log => log.componentId !== componentId);
          await api.saveInventoryLogs(newLogs);
          
          await addActivityLog(`Componente excluído: ${componentToDelete.name}`, { componentId });
          addToast('Componente excluído com sucesso!', 'success');
          await loadData();
      } catch(e) {
          console.error("Failed to delete component:", e);
          addToast('Erro ao excluir componente.', 'error');
      }
  }, [addToast, addActivityLog, loadData]);

  const addKit = useCallback(async (kitData: Omit<Kit, 'id'>) => {
      try {
          const newKit: Kit = { id: `kit-${nanoid()}`, ...kitData };
          const currentKits = await api.getKits();
          await api.saveKits([...currentKits, newKit]);
          await addActivityLog(`Kit criado: ${newKit.name}`, { kitId: newKit.id, sku: newKit.sku });
          addToast('Kit adicionado com sucesso!', 'success');
          await loadData();
      } catch(e) {
          console.error("Failed to add kit:", e);
          addToast('Erro ao adicionar kit.', 'error');
      }
  }, [addToast, addActivityLog, loadData]);

  const updateKit = useCallback(async (updatedKit: Kit) => {
      try {
          const currentKits = await api.getKits();
          const newKits = currentKits.map(k => k.id === updatedKit.id ? updatedKit : k);
          await api.saveKits(newKits);
          await addActivityLog(`Kit atualizado: ${updatedKit.name}`, { kitId: updatedKit.id });
          addToast('Kit atualizado com sucesso!', 'success');
          await loadData();
      } catch(e) {
          console.error("Failed to update kit:", e);
          addToast('Erro ao atualizar kit.', 'error');
      }
  }, [addToast, addActivityLog, loadData]);

  const addMultipleKits = useCallback(async (kitsToImport: KitImportData[]): Promise<{ successCount: number, errorCount: number }> => {
      try {
          const currentKits = await api.getKits();
          const currentKitSkus = new Set(currentKits.map(k => k.sku.toLowerCase()));
          const newKits: Kit[] = [];
          let errorCount = 0;

          for (const item of kitsToImport) {
              if (currentKitSkus.has(item.SKU.toLowerCase())) {
                  errorCount++;
                  continue;
              }
              
              const newKit: Kit = {
                  id: `kit-${item.SKU}`,
                  name: item['Nome do Kit'],
                  sku: item.SKU,
                  marca: item.Marca,
                  modelo: item.Modelo,
                  ano: item.Ano,
                  components: [],
                  requiredFasteners: [],
                  sellingPriceOverride: item['Preco de Venda (Opcional)'],
              };
              newKits.push(newKit);
              currentKitSkus.add(item.SKU.toLowerCase());
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
      try {
          const currentKits = await api.getKits();
          const kitToDelete = currentKits.find(k => k.id === kitId);
          if (!kitToDelete) return;
          const newKits = currentKits.filter(k => k.id !== kitId);
          await api.saveKits(newKits);
          await addActivityLog(`Kit excluído: ${kitToDelete.name}`, { kitId });
          addToast('Kit excluído com sucesso!', 'success');
          await loadData();
      } catch(e) {
          console.error("Failed to delete kit:", e);
          addToast('Erro ao excluir kit.', 'error');
      }
  }, [addToast, addActivityLog, loadData]);

  const getLogsForComponent = useCallback((componentId: string): InventoryLog[] => {
      return inventoryLogs.filter(log => log.componentId === componentId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryLogs]);
  
  const addInventoryLog = useCallback(async (logData: Omit<InventoryLog, 'id' | 'date'>) => {
      try {
          const newLog: InventoryLog = {
              ...logData,
              id: `log-${nanoid()}`,
              date: new Date().toISOString(),
          };
          const currentLogs = await api.getInventoryLogs();
          await api.saveInventoryLogs([...currentLogs, newLog]);
          const component = findComponentById(logData.componentId);
          await addActivityLog(`Movimentação de estoque: ${logData.quantity}x ${component?.name || 'desconhecido'}`, { logId: newLog.id });
          await loadData();
      } catch (e) {
          console.error("Failed to add inventory log:", e);
          addToast('Erro ao salvar movimentação de estoque.', 'error');
      }
  }, [addActivityLog, loadData, findComponentById]);

  
  const recalculateAllComponentCosts = useCallback(async (familias: FamiliaComponente[], allInventoryItems: Component[]): Promise<SyncReport> => {
    const report: SyncReport = { createdComponents: [], updatedComponents: [], deletedComponents: [] };
    let hasChanges = false;
    let newComponentList = [...allInventoryItems];

    const currentKits = await api.getKits();
    
    // Obter dados auxiliares para o gerador
    const [ws, cons, ops, prodOrders, manOrders] = await Promise.all([
        api.getWorkStations(),
        api.getConsumables(),
        api.getStandardOperations(),
        api.getProductionOrders(),
        api.getManufacturingOrders()
    ]);

    const allGeneratedProducts = new Map<string, { product: Component, familia: FamiliaComponente }>();
    
    // Ordena as famílias para processar dependências básicas primeiro
    const sortedFamilias = [...familias].sort((a, b) => {
        const bDependsOnA = b.nodes.some(n => n.data.sourceFamiliaId === a.id);
        const aDependsOnB = a.nodes.some(n => n.data.sourceFamiliaId === b.id);
        if (bDependsOnA && !aDependsOnB) return -1;
        if (aDependsOnB && !bDependsOnA) return 1;
        return 0;
    });

    // Executamos duas passagens para garantir que custos de sub-montagens sejam propagados corretamente
    for (let i = 0; i < 2; i++) {
        for (const familia of sortedFamilias) {
            if (familia.nodes?.some(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode')) {
                const generatedProducts = generateAllProductsForFamilia(familia, newComponentList, currentKits, {
                    workStations: ws,
                    consumables: cons,
                    operations: ops,
                    allFamilias: familias
                });

                generatedProducts.forEach(p => {
                    const component: Component = {
                        id: `comp-${p.sku}`,
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
                    
                    // Atualiza a lista local imediatamente para que a próxima família (ou próxima iteração) veja o custo novo
                    const existingIdx = newComponentList.findIndex(c => c.sku === p.sku);
                    if (existingIdx >= 0) {
                        newComponentList[existingIdx] = {
                            ...newComponentList[existingIdx],
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
        const componentsWithUpdatedStock = calculateAllStock(newComponentList, inventoryLogs, prodOrders, manOrders);
        setComponents(componentsWithUpdatedStock);
    }
    
    return report;
}, [addActivityLog, inventoryLogs, calculateAllStock]);
  
const analyzeProductionRun = useCallback((
    order: ProductionOrderItem[],
    additionalItems: { componentId: string, quantity: number }[],
    familias: FamiliaComponente[],
    allInventoryItems: Component[],
    settings: FinancialSettings,
    headCodeToSimulate?: string
): { scenarios: ProductionScenario[], virtualComponents: Component[] } => {
    
    const aggregatedKitComponents = new Map<string, number>(); 
    order.forEach(orderItem => {
        const kit = findKitById(orderItem.kitId);
        if (!kit) return;
        (kit.components || []).forEach(comp => {
            aggregatedKitComponents.set(comp.componentSku, (aggregatedKitComponents.get(comp.componentSku) || 0) + (comp.quantity * orderItem.quantity));
        });
    });

    (additionalItems || []).forEach((item: { componentId: string, quantity: number }) => {
        const component = findComponentById(item.componentId);
        if (component) {
            aggregatedKitComponents.set(component.sku, (aggregatedKitComponents.get(component.sku) || 0) + item.quantity);
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
    
    const preferredId = settings.preferredFastenerFamiliaId || 'fam-fixadores';
    const preferredFastenerFamilia = familias.find(f => f.id === preferredId);
    
    for (const headCode of headCodesToRun) {
        const scenarioRequirements = new Map(aggregatedKitComponents);
        
        if (preferredFastenerFamilia) {
            const generatorNode = (preferredFastenerFamilia.nodes || []).find(n => n.data.type === 'productGenerator');
            const skuTemplate = generatorNode?.data.generationConfig?.skuTemplate || 'FIX-S-{headCode}-M{bitola}x{comprimento}';
            
            order.forEach(orderItem => {
                const kit = findKitById(orderItem.kitId);
                if (!kit) return;
                
                const itemHeadCode = orderItem.fastenerHeadCode || headCode;
                
                (kit.requiredFasteners || []).forEach(fastener => {
                    const dimString = fastener.dimension.replace('mm', '');
                    const [bitola, comprimento] = dimString.split('x');
                    const fastenerSku = skuTemplate
                        .replace(/{headCode}/gi, itemHeadCode)
                        .replace(/{bitola}/gi, bitola)
                        .replace(/{comprimento}/gi, comprimento)
                        .replace(/{dimensao}/gi, dimString);
                    const totalQuantity = fastener.quantity * orderItem.quantity;
                    scenarioRequirements.set(fastenerSku, (scenarioRequirements.get(fastenerSku) || 0) + totalQuantity);
                });
            });
        }

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
                        headCode: headCode,
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
                        workStations: [], operations: [], consumables: [], allFamilias: familias
                    });
                    
                    let name = nameTemplate;
                    // SUBSTITUIÇÃO GLOBAL COMPLETA
                    Object.entries(stringVariables).forEach(([key, value]) => { 
                        name = name.replace(new RegExp(`{${key}}`, 'gi'), value); 
                    });
                    
                    const newComponent: Component = {
                        id: `comp-virtual-${sku}`, name, sku, stock: 0, type: 'component',
                        sourcing: familiaMatch.sourcing || 'manufactured', familiaId: familiaMatch.id,
                        custoFabricacao: result.custoFabricacao,
                        custoMateriaPrima: result.custoMateriaPrima,
                    } as Component;
                    virtualComponents.set(sku, newComponent);
                }
            }

            component = componentSkuMap.get(sku) || virtualComponents.get(sku);

            if (!component) {
                scenario.isPossible = false;
                scenario.shortages.push({ 
                    componentId: `unknown-${sku}`, 
                    componentName: `Componente Desconhecido (${sku})`, 
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

    (selectedScenario.detailedRequirements || []).forEach(req => {
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

    (order.orderItems || []).forEach(item => {
        const kit = findKitById(item.kitId);
        if (kit) {
            logs.push({
                componentId: `kit-prod-${kit.sku}`, 
                type: 'entrada',
                quantity: item.quantity,
                reason: 'conclusao_ordem_producao',
                notes: `Produzido para Ordem de Produção ${order.id}`
            });
        }
    });

    if (logs.length > 0) {
        await addMultipleInventoryLogs(logs);
    }

    await addActivityLog(`Ordem de Produção ${order.id} concluída e estoque atualizado.`);
    addToast(`Ordem ${order.id} concluída. Estoque foi atualizado.`, 'success');

}, [addMultipleInventoryLogs, addActivityLog, addToast, findKitById]);

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

    return {
        components,
        kits,
        inventoryLogs,
        isLoading,
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
        addInventoryLog,
        addMultipleInventoryLogs,
        getLogsForComponent,
        recalculateAllComponentCosts,
        createAndStockComponent,
        getKitsUsingComponent,
        getKits,
    };
};
