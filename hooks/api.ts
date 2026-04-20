
import { BackupData, FinancialSettings, Component, Kit, InventoryLog, FamiliaComponente, PurchaseOrder, ProductionOrder, ManufacturingOrder, CuttingOrder, PromotionalCampaign, UserProfile, ActivityLog, Customer, WorkStation, Consumable, StandardOperation, FinancialTransaction, FinancialAccount, FinancialCategory, ReceivingOrder, SupplierProductMapping, Task, Lead, Deal, ServiceStrategy } from '../types';
// @ts-ignore
import { INITIAL_FAMILIAS, INITIAL_COMPONENTS, INITIAL_KITS, INITIAL_INVENTORY_LOGS, INITIAL_WORKSTATIONS, INITIAL_CONSUMABLES, INITIAL_OPERATIONS } from '../data/initial-inventory';
import { db, auth, oldDb } from '../firebaseConfig';
import { ref, get, set, remove, child, update, onValue, off } from '@firebase/database';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirebaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirebaseError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirebaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  const errorMsg = JSON.stringify(errInfo);
  console.error('Firebase Error: ', errorMsg);
  throw new Error(errorMsg);
};

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
    companyName: 'AUTRO',
    cnpj: '00.000.000/0001-00',
    markup: 100,
    taxRegime: 'simples',
    originUF: 'SP',
    preferredFastenerFamiliaId: 'fam-fixadores', // Vincula o processo de parafusos por padrão
    irpj: 15,
    csll: 9,
    pis: 0.65,
    cofins: 3,
    ipi: 5,
    icms: 18,
    icmsSt: 0,
    fcp: 0,
    simplesNacional: 6,
    simplesNacionalAnnex: 'I',
    salesCommission: 0,
    freightCost: 0,
    administrativeCost: 0,
    financialCost: 0,
    paymentGatewayFee: 0,
    marketplaceFees: [],
};

const DB_KEYS = {
    seeded: 'seeded',
    components: 'components',
    kits: 'kits',
    inventoryLogs: 'inventoryLogs',
    familias: 'familias',
    purchaseOrders: 'purchaseOrders',
    poCounter: 'poCounter',
    productionOrders: 'productionOrders',
    prodCounter: 'prodCounter',
    manufacturingOrders: 'manufacturingOrders',
    moCounter: 'moCounter',
    cuttingOrders: 'cuttingOrders',
    coCounter: 'coCounter',
    financialSettings: 'financialSettings',
    userRoles: 'userRoles',
    rolePermissions: 'rolePermissions',
    promotionalCampaigns: 'promotionalCampaigns',
    activityLogs: 'activityLogs',
    customers: 'customers',
    workStations: 'workStations',
    consumables: 'consumables',
    standardOperations: 'standardOperations',
    financialTransactions: 'financialTransactions',
    financialAccounts: 'financialAccounts',
    financialCategories: 'financialCategories',
    receivingOrders: 'receivingOrders',
    supplierProductMappings: 'supplierProductMappings',
    receivingCounter: 'receivingCounter',
    tasks: 'tasks',
    leads: 'leads',
    deals: 'deals',
    strategies: 'strategies',
    lastModified: 'lastModified',
    lastModified_engineering: 'lastModified_engineering',
    lastModified_inventory: 'lastModified_inventory',
    localDrafts: 'localDrafts',
};

// --- MONITORING & PROTECTION SYSTEM ---
export interface FirebaseStats {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
    blockedOperations: number;
    lastOperations: { type: 'read' | 'write' | 'remove', key: string, timestamp: number, size: number }[];
}

const stats: FirebaseStats = {
    reads: 0,
    writes: 0,
    bytesRead: 0,
    bytesWritten: 0,
    blockedOperations: 0,
    lastOperations: []
};

const lastDataCache = new Map<string, string>();
const operationHistory = new Map<string, number[]>(); // Tracks timestamps of operations per key

/**
 * Verificação rigorosa para evitar Loops de Gravação e Consumo Excessivo
 */
const shouldBlockOperation = (type: 'read' | 'write', key: string): boolean => {
    const now = Date.now();
    const history = operationHistory.get(key) || [];
    
    // Limpa histórico antigo (mais de 1 minuto)
    const recentHistory = history.filter(t => t > now - 60000);
    
    // Gatilho 1: Proteção de Loop (mais de 5 gravações na mesma chave em 10 segundos)
    if (type === 'write') {
        const veryRecentWrites = recentHistory.filter(t => t > now - 10000);
        if (veryRecentWrites.length >= 5) {
            console.error(`[DataGuard] BLOQUEIO DE SEGURANÇA: Loop detectado na chave "${key}". Muitas gravações em curto intervalo.`);
            stats.blockedOperations++;
            return true;
        }
    }

    // Gatilho 2: Limite de Frequência (mais de 30 operações por minuto por chave)
    if (recentHistory.length >= 30) {
        console.error(`[DataGuard] BLOQUEIO DE SEGURANÇA: Limite de frequência excedido para "${key}".`);
        stats.blockedOperations++;
        return true;
    }

    recentHistory.push(now);
    operationHistory.set(key, recentHistory);
    return false;
};

const logOperation = (type: 'read' | 'write' | 'remove', key: string, data: any) => {
    const size = data ? JSON.stringify(data).length : 0;
    if (type === 'read') {
        stats.reads++;
        stats.bytesRead += size;
    } else if (type === 'write') {
        stats.writes++;
        stats.bytesWritten += size;
    }
    
    stats.lastOperations.unshift({ type, key, timestamp: Date.now(), size });
    if (stats.lastOperations.length > 50) stats.lastOperations.pop();
    
    // Console warning for high frequency
    const recentOps = stats.lastOperations.filter(op => op.key === op.key && op.timestamp > Date.now() - 5000);
    const sameKeyOps = recentOps.filter(op => op.key === key);
    if (sameKeyOps.length > 10) {
        console.warn(`[FirebaseMonitor] High frequency ${type} detected for key: ${key}. ${sameKeyOps.length} operations in 5s.`);
    }
};

export const getFirebaseStats = () => ({ ...stats });
// --- END MONITORING SYSTEM ---

let storageMode: 'firebase' | 'localStorage' = 'firebase';
let permissionChecked = false;

const checkFirebasePermission = async () => {
    if (permissionChecked) return;
    try {
        const checkPromise = get(child(ref(db), DB_KEYS.seeded));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Timeout')), 5000));
        await Promise.race([checkPromise, timeoutPromise]);
        storageMode = 'firebase';
    } catch (e: any) {
        console.warn('Usando modo local por falha de conexão:', e);
        storageMode = 'localStorage';
    }
    permissionChecked = true;
};

const sanitizeFirebaseKey = (key: string): string => {
    if (!key) return 'unknown';
    // Firebase keys cannot contain . # $ / [ ]
    return String(key).replace(/[.#$\[\]/]/g, '_');
};

const sanitizeForFirebase = (data: any): any => {
    if (data === undefined) return null;
    if (typeof data === 'number') {
        if (!Number.isFinite(data) || Number.isNaN(data)) return 0; 
        return data;
    }
    if (data === null || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(item => sanitizeForFirebase(item));
    const sanitizedObject: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value !== undefined) sanitizedObject[key] = sanitizeForFirebase(value);
        }
    }
    return sanitizedObject;
};

const dbRef = ref(db);

export const updateLastModified = async (module?: 'engineering' | 'inventory') => {
    const timestamp = Date.now();
    const key = module === 'engineering' ? DB_KEYS.lastModified_engineering : 
                module === 'inventory' ? DB_KEYS.lastModified_inventory : 
                DB_KEYS.lastModified;

    if (storageMode === 'localStorage') {
        localStorage.setItem(key, JSON.stringify(timestamp));
    } else {
        await set(child(dbRef, key), timestamp);
    }
    
    // Also update global for backward compatibility
    if (module) {
        if (storageMode === 'localStorage') {
            localStorage.setItem(DB_KEYS.lastModified, JSON.stringify(timestamp));
        } else {
            await set(child(dbRef, DB_KEYS.lastModified), timestamp);
        }
    }
};

export const forceRebuildCorruptedProcesses = async (): Promise<'rebuilt' | 'no_issues'> => {
    return 'no_issues';
};

const getData = async <T>(key: string, defaultValue: T): Promise<T> => {
    if (shouldBlockOperation('read', key)) {
        const cached = lastDataCache.get(key);
        if (cached) return JSON.parse(cached);
        return defaultValue;
    }

    if (storageMode === 'localStorage') {
        const localData = localStorage.getItem(key);
        const parsed = localData ? JSON.parse(localData) : defaultValue;
        logOperation('read', `local:${key}`, parsed);
        return parsed;
    }
    try {
        const snapshot = await get(child(dbRef, key));
        let val = snapshot.exists() ? snapshot.val() : defaultValue;
        
        // DataGuard Delta Engine: Se salvamos como Object (Dicionário por ID) para economizar banda,
        // garantimos que o front-end receba de volta como Array.
        if (Array.isArray(defaultValue) && val && typeof val === 'object' && !Array.isArray(val)) {
            val = Object.values(val);
        }
        
        logOperation('read', key, val);
        
        // Cache for write protection
        lastDataCache.set(key, JSON.stringify(val));
        
        return val;
    } catch (e: any) {
        if (e.message?.includes('permission_denied')) {
            handleFirebaseError(e, OperationType.GET, key);
        }
        console.error(`Erro ao ler chave Firebase: ${key}`, e);
        return defaultValue;
    }
};

const saveData = async <T>(key: string, value: T): Promise<void> => {
    const sanitizedValue = sanitizeForFirebase(value);
    const stringified = JSON.stringify(sanitizedValue);
    
    // Gatilho 3: Verificação de Igualdade Profunda (Evita gravar o que não mudou)
    if (lastDataCache.get(key) === stringified) {
        return;
    }

    // Gatilho 4: Proteção de Integridade e Loops
    if (shouldBlockOperation('write', key)) {
        throw new Error(`Operação em ${key} bloqueada temporariamente para economia de cota.`);
    }

    // Gatilho 5: Proteção de Tamanho de Payload (Bloquear se > 5MB - Evita gastos massivos)
    if (stringified.length > 5242880) {
        console.error(`[DataGuard] BLOQUEIO: Payload muito grande para ${key} (${Math.round(stringified.length/1024/1024)}MB).`);
        throw new Error(`DataGuard: O arquivo/dado (${Math.round(stringified.length/1024/1024)}MB) excede o limite de segurança de 5MB por operação.`);
    }

    // --- DATA INTEGRITY CHECK ---
    // If we are saving an empty array but the previous data was large (> 5 items),
    // this might be a UI glitch or accidental deletion. Log a warning.
    const oldDataRaw = lastDataCache.get(key);
    if (Array.isArray(sanitizedValue) && sanitizedValue.length === 0 && oldDataRaw) {
        const oldData = JSON.parse(oldDataRaw);
        if (Array.isArray(oldData) && oldData.length > 5) {
            console.error(`[DataIntegrity] Attempted to save empty array to ${key} when previous size was ${oldData.length}. Operation blocked for safety.`);
            throw new Error(`Integridade de dados: Tentativa de salvar lista vazia em ${key}.`);
        }
    }
    // --- END INTEGRITY CHECK ---
    
    if (storageMode === 'localStorage') {
        localStorage.setItem(key, stringified);
        lastDataCache.set(key, stringified);
        logOperation('write', `local:${key}`, sanitizedValue);
        await updateLastModified();
        return;
    }
    try {
        let isDeltaProcessed = false;
        
        // DataGuard Delta Engine (Somente atualiza os nós modificados, ao invés da lista inteira)
        if (oldDataRaw && Array.isArray(sanitizedValue) && sanitizedValue.every(item => item && item.id)) {
            const oldData = JSON.parse(oldDataRaw);
            if (Array.isArray(oldData)) {
                const updates: Record<string, any> = {};
                const currentIds = new Set(sanitizedValue.map(i => i.id));
                let changedCount = 0;

                // 1. Encontra itens removidos (envia null para deletar)
                oldData.forEach((oldItem: any) => {
                    if (oldItem && oldItem.id && !currentIds.has(oldItem.id)) {
                        updates[`${key}/${oldItem.id}`] = null;
                        changedCount++;
                    }
                });

                // 2. Encontra itens novos ou que sofreram alterações reais
                const oldItemMap = new Map(oldData.map((i: any) => [i.id, i]));
                sanitizedValue.forEach(newItem => {
                    const oldItem = oldItemMap.get(newItem.id);
                    if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                        updates[`${key}/${newItem.id}`] = newItem;
                        changedCount++;
                    }
                });

                if (changedCount > 0) {
                    console.log(`[DataGuard Delta] Sincronizando apenas ${changedCount} itens de ${sanitizedValue.length} totais na coleção ${key}.`);
                    await update(dbRef, updates);
                } else {
                    console.log(`[DataGuard Delta] Nenhum item precisou de sincronização real na coleção ${key}.`);
                }
                isDeltaProcessed = true;
            }
        }

        if (!isDeltaProcessed) {
            // Conversão da primeira gravação: Transforma Array de Objetos em Dicionário.
            if (Array.isArray(sanitizedValue) && sanitizedValue.length > 0 && sanitizedValue.every(item => item && item.id)) {
                console.log(`[DataGuard Delta] Convertendo Array nativo para Dicionário de Performance na coleção ${key}.`);
                const objectMap: Record<string, any> = {};
                sanitizedValue.forEach(item => { objectMap[item.id] = item; });
                await set(child(dbRef, key), objectMap);
            } else {
                // Comportamento normal para outros tipos de dados (settings, etc)
                await set(child(dbRef, key), sanitizedValue);
            }
        }

        lastDataCache.set(key, stringified);
        logOperation('write', key, sanitizedValue);
        await updateLastModified();
    } catch (e: any) {
         if (e.message?.includes('permission_denied')) {
             handleFirebaseError(e, OperationType.WRITE, key);
         }
         console.error(`Erro ao gravar chave Firebase: ${key}`, e);
         throw e; 
    }
};

const removeData = async (key: string): Promise<void> => {
    if (storageMode === 'localStorage') {
        localStorage.removeItem(key);
        return;
    }
    try {
        await remove(child(dbRef, key));
    } catch(e: any) {
         if (e.message?.includes('permission_denied')) {
             handleFirebaseError(e, OperationType.DELETE, key);
         }
         console.error(`Erro ao remover chave Firebase: ${key}`, e);
    }
};

export const initializeDatabase = async (): Promise<{status: 'ok' | 'conflict', localDate?: Date, firebaseDate?: Date}> => {
    await checkFirebasePermission();
    
    const seeded = await getData(DB_KEYS.seeded, false);
    if (seeded) return { status: 'ok' };

    console.log("Iniciando banco de dados...");

    // Tenta migrar os dados do banco antigo
    let oldData: any = null;
    try {
        const oldSnapshot = await get(ref(oldDb));
        if (oldSnapshot.exists()) {
            oldData = oldSnapshot.val();
            console.log("Dados encontrados no banco antigo, iniciando migração...");
        }
    } catch (e) {
        console.warn("Não foi possível ler do banco antigo:", e);
    }

    if (oldData && oldData.seeded) {
        // Migra os dados do banco antigo
        for (const key of Object.keys(DB_KEYS)) {
            // @ts-ignore
            const dbKey = DB_KEYS[key];
            if (oldData[dbKey] !== undefined) {
                await saveData(dbKey, oldData[dbKey]);
            }
        }
        console.log("Migração concluída com sucesso.");
        return { status: 'ok' };
    }

    console.log("Nenhum dado antigo encontrado, iniciando com dados padrão...");

    const initialData: BackupData = {
        components: INITIAL_COMPONENTS,
        kits: INITIAL_KITS,
        inventoryLogs: INITIAL_INVENTORY_LOGS,
        familias: INITIAL_FAMILIAS,
        purchaseOrders: [],
        poCounter: 1,
        productionOrders: [],
        prodCounter: 1,
        manufacturingOrders: [],
        moCounter: 1,
        cuttingOrders: [],
        coCounter: 1,
        financialSettings: DEFAULT_FINANCIAL_SETTINGS,
        userRoles: [{ uid: 'firebase-admin-placeholder', email: 'antonio.marcos@autro.com.br', role: 'Admin' }],
        promotionalCampaigns: [],
        activityLogs: [],
        customers: [],
        workStations: INITIAL_WORKSTATIONS,
        consumables: INITIAL_CONSUMABLES,
        standardOperations: INITIAL_OPERATIONS,
        financialTransactions: [],
        financialAccounts: [],
        financialCategories: [],
        receivingOrders: [],
        supplierProductMappings: [],
        receivingCounter: 1,
        seeded: true,
        lastModified: Date.now(),
    };
    
    for (const key of Object.keys(DB_KEYS)) {
        // @ts-ignore
        if (initialData[key] !== undefined) {
            // @ts-ignore
            await saveData(DB_KEYS[key], initialData[key]);
        }
    }
    
    return { status: 'ok' };
};

export const getComponents = async (): Promise<Component[]> => {
    const data = await getData(DB_KEYS.components, []);
    
    // Suporte para transição de Array para Map no Firebase
    const rawArray = Array.isArray(data) ? data : Object.values(data);
    
    // Migration: Update purchaseCost from INITIAL_COMPONENTS if it's 0 or missing
    // AND inject missing components from INITIAL_COMPONENTS
    let needsUpdate = false;
    const migratedData = rawArray.map((c: any) => {
        const initialComp = INITIAL_COMPONENTS.find(ic => ic.sku === c.sku);
        if (initialComp && (!c.purchaseCost || c.purchaseCost === 0) && initialComp.purchaseCost) {
            needsUpdate = true;
            return { ...c, purchaseCost: initialComp.purchaseCost };
        }
        return {
            ...c,
            stock: c.stock || 0,
            custoFabricacao: c.custoFabricacao || 0,
            custoMateriaPrima: c.custoMateriaPrima || 0
        };
    });

    // Inject missing components
    for (const initialComp of INITIAL_COMPONENTS) {
        if (!migratedData.find((c: any) => c.sku === initialComp.sku)) {
            migratedData.push(initialComp);
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        await saveComponents(migratedData);
    }

    return migratedData;
};

export const saveComponents = async (components: Component[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.components, components);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.components);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: Component[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    // 1. Identificar mudanças e adições
    components.forEach(comp => {
        const oldComp = oldArray.find(c => c.id === comp.id);
        if (!oldComp || JSON.stringify(comp) !== JSON.stringify(oldComp)) {
            updates[`${DB_KEYS.components}/${sanitizeFirebaseKey(comp.id)}`] = sanitizeForFirebase(comp);
            hasChanges = true;
            changeCount++;
        }
    });

    // 2. Identificar exclusões
    oldArray.forEach(oldComp => {
        if (!components.find(c => c.id === oldComp.id)) {
            updates[`${DB_KEYS.components}/${sanitizeFirebaseKey(oldComp.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        // Gatilho de Proteção para Update Delta
        if (shouldBlockOperation('write', DB_KEYS.familias)) {
            console.warn("[DataGuard] Update Delta para Familias bloqueado por segurança.");
            return;
        }

        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.components, JSON.stringify(components));
        logOperation('write', `${DB_KEYS.components} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('inventory');
    }
};

export const getKits = async (): Promise<Kit[]> => {
    const data = await getData(DB_KEYS.kits, []);
    
    const rawArray = Array.isArray(data) ? data : Object.values(data);

    if (rawArray.length === 0 && INITIAL_KITS && INITIAL_KITS.length > 0) {
        await saveKits(INITIAL_KITS);
        return INITIAL_KITS;
    }

    return rawArray.map((k: any) => ({
        ...k,
        components: k.components || [],
        requiredFasteners: k.requiredFasteners || []
    }));
};

export const saveKits = async (kits: Kit[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.kits, kits);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.kits);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: Kit[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    kits.forEach(kit => {
        const oldKit = oldArray.find(k => k.id === kit.id);
        if (!oldKit || JSON.stringify(kit) !== JSON.stringify(oldKit)) {
            updates[`${DB_KEYS.kits}/${sanitizeFirebaseKey(kit.id)}`] = sanitizeForFirebase(kit);
            hasChanges = true;
            changeCount++;
        }
    });

    oldArray.forEach(oldKit => {
        if (!kits.find(k => k.id === oldKit.id)) {
            updates[`${DB_KEYS.kits}/${sanitizeFirebaseKey(oldKit.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.kits, JSON.stringify(kits));
        logOperation('write', `${DB_KEYS.kits} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('inventory');
    }
};

export const getInventoryLogs = async (): Promise<InventoryLog[]> => getData(DB_KEYS.inventoryLogs, []);
export const saveInventoryLogs = async (logs: InventoryLog[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.inventoryLogs, logs);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.inventoryLogs);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: InventoryLog[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    // Para logs, geralmente só adicionamos. Mas vamos usar delta para ser consistente.
    // Como logs podem ser muitos, limitamos o delta aos últimos 100 ou usamos set se for muito grande.
    if (logs.length - oldArray.length > 50) {
        return saveData(DB_KEYS.inventoryLogs, logs);
    }

    logs.forEach(log => {
        const exists = oldArray.some(l => l.id === log.id);
        if (!exists) {
            updates[`${DB_KEYS.inventoryLogs}/${sanitizeFirebaseKey(log.id)}`] = sanitizeForFirebase(log);
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.inventoryLogs, JSON.stringify(logs));
        logOperation('write', `${DB_KEYS.inventoryLogs} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('inventory');
    }
};

export const getFamilias = async (): Promise<FamiliaComponente[]> => {
    const data = await getData(DB_KEYS.familias, []);
    
    const rawArray = Array.isArray(data) ? data : Object.values(data);

    if (rawArray.length === 0 && INITIAL_FAMILIAS && INITIAL_FAMILIAS.length > 0) {
        await saveFamilias(INITIAL_FAMILIAS);
        return INITIAL_FAMILIAS;
    }
    
    const familias = rawArray.map((f: any) => ({
        ...f,
        nodes: f.nodes || [],
        edges: f.edges || []
    }));

    // Fix temporário para corrigir o consumo da barra roscada (mm para metros) e incluir porcas em fam-fixadores
    let needsSave = false;
    const fixedFamilias = familias.map(f => {
        if (f.id === 'fam-USINAGEM-BARRA') {
            const nodes = f.nodes.map(n => {
                if (n.data.dimensions) {
                    let dimFixed = false;
                    const dims = n.data.dimensions.map(d => {
                        if (d.consumption > 1) {
                            dimFixed = true;
                            needsSave = true;
                            return { ...d, consumption: d.consumption / 1000 };
                        }
                        return d;
                    });
                    if (dimFixed) return { ...n, data: { ...n.data, dimensions: dims } };
                }
                return n;
            });
            return { ...f, nodes };
        }
        if (f.id === 'fam-fixadores') {
            const initialFixadores = INITIAL_FAMILIAS.find(ifam => ifam.id === 'fam-fixadores');
            if (initialFixadores) {
                const dnaNode = f.nodes.find((n: any) => n.id === 'n-dna-fix');
                const initialDnaNode = initialFixadores.nodes.find(n => n.id === 'n-dna-fix');
                
                if (dnaNode && initialDnaNode && dnaNode.data.dimensions.length < initialDnaNode.data.dimensions.length) {
                    needsSave = true;
                    return { ...f, nodes: initialFixadores.nodes };
                }
            }
        }
        if (f.id === 'fam-MONTAGEM-COPO') {
            const initialCopo = INITIAL_FAMILIAS.find(ifam => ifam.id === 'fam-MONTAGEM-COPO');
            if (initialCopo) {
                const finalNode = f.nodes.find((n: any) => n.id === 'n-final-copo');
                if (!finalNode) {
                    needsSave = true;
                    return initialCopo;
                }
            }
        }
        return f;
    });

    if (needsSave) {
        console.log("Auto-corrigindo consumo da família fam-USINAGEM-BARRA ou restaurando família COPO...");
        saveFamilias(fixedFamilias);
    }

    // Injeta famílias que foram adicionadas no sistema base e ainda não existem no banco do usuário
    let injected = false;
    for (const initialFam of INITIAL_FAMILIAS) {
        if (!fixedFamilias.find(f => f.id === initialFam.id)) {
            console.log(`Auto-injetando família ausente: ${initialFam.id}`);
            fixedFamilias.push(initialFam);
            injected = true;
        }
    }
    
    if (injected) {
        saveFamilias(fixedFamilias);
    }

    return fixedFamilias;
};
export const saveFamilias = async (familias: FamiliaComponente[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.familias, familias);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.familias);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: FamiliaComponente[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    familias.forEach(f => {
        const oldF = oldArray.find(old => old.id === f.id);
        if (!oldF || JSON.stringify(f) !== JSON.stringify(oldF)) {
            updates[`${DB_KEYS.familias}/${sanitizeFirebaseKey(f.id)}`] = sanitizeForFirebase(f);
            hasChanges = true;
            changeCount++;
        }
    });

    oldArray.forEach(oldF => {
        if (!familias.find(f => f.id === oldF.id)) {
            updates[`${DB_KEYS.familias}/${sanitizeFirebaseKey(oldF.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.familias, JSON.stringify(familias));
        logOperation('write', `${DB_KEYS.familias} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('engineering');
    }
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => getData(DB_KEYS.purchaseOrders, []);
export const getPoCounter = async (): Promise<number> => getData(DB_KEYS.poCounter, 1);
export const savePurchaseOrders = async (orders: PurchaseOrder[], counter?: number): Promise<void> => {
    await saveData(DB_KEYS.purchaseOrders, orders);
    if (counter) await saveData(DB_KEYS.poCounter, counter);
};

export const getProductionOrders = async (): Promise<ProductionOrder[]> => getData(DB_KEYS.productionOrders, []);
export const getProductionOrderCounter = async (): Promise<number> => getData(DB_KEYS.prodCounter, 1);
export const saveProductionOrders = async (orders: ProductionOrder[], counter?: number): Promise<void> => {
    await saveData(DB_KEYS.productionOrders, orders);
    if (counter) await saveData(DB_KEYS.prodCounter, counter);
};

export const getManufacturingOrders = async (): Promise<ManufacturingOrder[]> => getData(DB_KEYS.manufacturingOrders, []);
export const getManufacturingOrderCounter = async (): Promise<number> => getData(DB_KEYS.moCounter, 1);
export const saveManufacturingOrders = async (orders: ManufacturingOrder[], counter?: number): Promise<void> => {
    await saveData(DB_KEYS.manufacturingOrders, orders);
    if (counter) await saveData(DB_KEYS.moCounter, counter);
};

export const getCuttingOrders = async (): Promise<CuttingOrder[]> => getData(DB_KEYS.cuttingOrders, []);
export const getCoCounter = async (): Promise<number> => getData(DB_KEYS.coCounter, 1);
export const saveCuttingOrders = async (orders: CuttingOrder[], counter?: number): Promise<void> => {
    await saveData(DB_KEYS.cuttingOrders, orders);
    if (counter) await saveData(DB_KEYS.coCounter, counter);
};

export const getFinancialSettings = async (): Promise<FinancialSettings> => getData(DB_KEYS.financialSettings, DEFAULT_FINANCIAL_SETTINGS);
export const saveFinancialSettings = async (settings: FinancialSettings): Promise<void> => saveData(DB_KEYS.financialSettings, settings);

export const getPromotionalCampaigns = async (): Promise<PromotionalCampaign[]> => getData(DB_KEYS.promotionalCampaigns, []);
export const savePromotionalCampaigns = async (campaigns: PromotionalCampaign[]): Promise<void> => saveData(DB_KEYS.promotionalCampaigns, campaigns);

export const getUserRoles = async (): Promise<UserProfile[]> => getData(DB_KEYS.userRoles, []);
export const saveUserRoles = async (roles: UserProfile[]): Promise<void> => saveData(DB_KEYS.userRoles, roles);

export const getRolePermissions = async (defaultPerms: any): Promise<any> => getData(DB_KEYS.rolePermissions, defaultPerms);
export const saveRolePermissions = async (permissions: any): Promise<void> => saveData(DB_KEYS.rolePermissions, permissions);

export const getActivityLogs = async (): Promise<ActivityLog[]> => getData(DB_KEYS.activityLogs, []);
export const saveActivityLogs = async (logs: ActivityLog[]): Promise<void> => saveData(DB_KEYS.activityLogs, logs);

export const getCustomers = async (): Promise<Customer[]> => getData(DB_KEYS.customers, []);
export const saveCustomers = async (customers: Customer[]): Promise<void> => saveData(DB_KEYS.customers, customers);

export const getWorkStations = async (): Promise<WorkStation[]> => {
    const data = await getData(DB_KEYS.workStations, []);
    const rawArray = Array.isArray(data) ? data : (data ? Object.values(data) : []);
    
    // Deduplicate by ID
    const array = rawArray.reduce((acc: WorkStation[], current: any) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    if (array.length === 0 && INITIAL_WORKSTATIONS && INITIAL_WORKSTATIONS.length > 0) {
        await saveWorkStations(INITIAL_WORKSTATIONS);
        return INITIAL_WORKSTATIONS;
    }
    return array as WorkStation[];
};
export const saveWorkStations = async (data: WorkStation[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.workStations, data);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.workStations);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: WorkStation[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    data.forEach(item => {
        const oldItem = oldArray.find(old => old.id === item.id);
        if (!oldItem || JSON.stringify(item) !== JSON.stringify(oldItem)) {
            updates[`${DB_KEYS.workStations}/${sanitizeFirebaseKey(item.id)}`] = sanitizeForFirebase(item);
            hasChanges = true;
            changeCount++;
        }
    });

    oldArray.forEach(oldItem => {
        if (!data.find(item => item.id === oldItem.id)) {
            updates[`${DB_KEYS.workStations}/${sanitizeFirebaseKey(oldItem.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.workStations, JSON.stringify(data));
        logOperation('write', `${DB_KEYS.workStations} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('engineering');
    }
};

export const getConsumables = async (): Promise<Consumable[]> => {
    const data = await getData(DB_KEYS.consumables, []);
    const rawArray = Array.isArray(data) ? data : (data ? Object.values(data) : []);
    
    // Deduplicate by ID
    const array = rawArray.reduce((acc: Consumable[], current: any) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    if (array.length === 0 && INITIAL_CONSUMABLES && INITIAL_CONSUMABLES.length > 0) {
        await saveConsumables(INITIAL_CONSUMABLES);
        return INITIAL_CONSUMABLES;
    }
    return array as Consumable[];
};
export const saveConsumables = async (data: Consumable[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.consumables, data);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.consumables);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: Consumable[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    data.forEach(item => {
        const oldItem = oldArray.find(old => old.id === item.id);
        if (!oldItem || JSON.stringify(item) !== JSON.stringify(oldItem)) {
            updates[`${DB_KEYS.consumables}/${sanitizeFirebaseKey(item.id)}`] = sanitizeForFirebase(item);
            hasChanges = true;
            changeCount++;
        }
    });

    oldArray.forEach(oldItem => {
        if (!data.find(item => item.id === oldItem.id)) {
            updates[`${DB_KEYS.consumables}/${sanitizeFirebaseKey(oldItem.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.consumables, JSON.stringify(data));
        logOperation('write', `${DB_KEYS.consumables} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('engineering');
    }
};

export const getStandardOperations = async (): Promise<StandardOperation[]> => {
    const data = await getData(DB_KEYS.standardOperations, []);
    const rawArray = Array.isArray(data) ? data : (data ? Object.values(data) : []);

    // Deduplicate by ID
    const array = rawArray.reduce((acc: StandardOperation[], current: any) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    if (array.length === 0 && INITIAL_OPERATIONS && INITIAL_OPERATIONS.length > 0) {
        await saveStandardOperations(INITIAL_OPERATIONS);
        return INITIAL_OPERATIONS;
    }
    return array as StandardOperation[];
};
export const saveStandardOperations = async (data: StandardOperation[], skipTimestamp = false): Promise<void> => {
    if (storageMode === 'localStorage') {
        return saveData(DB_KEYS.standardOperations, data);
    }

    const oldDataRaw = lastDataCache.get(DB_KEYS.standardOperations);
    const oldData: any = oldDataRaw ? JSON.parse(oldDataRaw) : null;
    const oldArray: StandardOperation[] = Array.isArray(oldData) ? oldData : (oldData ? Object.values(oldData) : []);
    
    const updates: any = {};
    let hasChanges = false;
    let changeCount = 0;

    data.forEach(item => {
        const oldItem = oldArray.find(old => old.id === item.id);
        if (!oldItem || JSON.stringify(item) !== JSON.stringify(oldItem)) {
            updates[`${DB_KEYS.standardOperations}/${sanitizeFirebaseKey(item.id)}`] = sanitizeForFirebase(item);
            hasChanges = true;
            changeCount++;
        }
    });

    oldArray.forEach(oldItem => {
        if (!data.find(item => item.id === oldItem.id)) {
            updates[`${DB_KEYS.standardOperations}/${sanitizeFirebaseKey(oldItem.id)}`] = null;
            hasChanges = true;
            changeCount++;
        }
    });

    if (hasChanges) {
        await update(dbRef, updates);
        lastDataCache.set(DB_KEYS.standardOperations, JSON.stringify(data));
        logOperation('write', `${DB_KEYS.standardOperations} (delta: ${changeCount})`, updates);
        if (!skipTimestamp) await updateLastModified('engineering');
    }
};

export const getFinancialTransactions = async (): Promise<FinancialTransaction[]> => getData(DB_KEYS.financialTransactions, []);
export const saveFinancialTransactions = async (data: FinancialTransaction[]): Promise<void> => saveData(DB_KEYS.financialTransactions, data);

export const getFinancialAccounts = async (): Promise<FinancialAccount[]> => getData(DB_KEYS.financialAccounts, []);
export const saveFinancialAccounts = async (data: FinancialAccount[]): Promise<void> => saveData(DB_KEYS.financialAccounts, data);

export const getFinancialCategories = async (): Promise<FinancialCategory[]> => getData(DB_KEYS.financialCategories, []);
export const saveFinancialCategories = async (data: FinancialCategory[]): Promise<void> => saveData(DB_KEYS.financialCategories, data);

export const getReceivingOrders = async (): Promise<ReceivingOrder[]> => getData(DB_KEYS.receivingOrders, []);
export const getReceivingCounter = async (): Promise<number> => getData(DB_KEYS.receivingCounter, 1);
export const saveReceivingOrders = async (orders: ReceivingOrder[], counter?: number): Promise<void> => {
    await saveData(DB_KEYS.receivingOrders, orders);
    if (counter) await saveData(DB_KEYS.receivingCounter, counter);
};

export const getSupplierProductMappings = async (): Promise<SupplierProductMapping[]> => getData(DB_KEYS.supplierProductMappings, []);
export const saveSupplierProductMappings = async (mappings: SupplierProductMapping[]): Promise<void> => saveData(DB_KEYS.supplierProductMappings, mappings);

export const getTasks = async (): Promise<Task[]> => getData(DB_KEYS.tasks, []);
export const saveTasks = async (tasks: Task[]): Promise<void> => saveData(DB_KEYS.tasks, tasks);

export const getLeads = async (): Promise<Lead[]> => getData(DB_KEYS.leads, []);
export const saveLeads = async (leads: Lead[]): Promise<void> => saveData(DB_KEYS.leads, leads);

export const getDeals = async (): Promise<Deal[]> => getData(DB_KEYS.deals, []);
export const saveDeals = async (deals: Deal[]): Promise<void> => saveData(DB_KEYS.deals, deals);

export const getStrategies = async (): Promise<ServiceStrategy[]> => getData(DB_KEYS.strategies, []);
export const saveStrategies = async (strategies: ServiceStrategy[]): Promise<void> => saveData(DB_KEYS.strategies, strategies);

export const getAllData = async (): Promise<BackupData> => {
    if (storageMode === 'firebase') {
        const snapshot = await get(dbRef);
        return snapshot.exists() ? snapshot.val() : ({} as BackupData);
    } else {
        return getLocalData();
    }
};

export const restoreAllData = async (data: BackupData): Promise<void> => {
    const dataToRestore = { ...data, lastModified: data.lastModified || Date.now() };
    if (data.familias && Array.isArray(data.familias)) {
        dataToRestore.familias = data.familias.map(familia => ({ ...familia, nodes: familia.nodes || [], edges: familia.edges || [] }));
    }
    if (storageMode === 'firebase') {
        const sanitizedData = sanitizeForFirebase(dataToRestore);
        await set(dbRef, sanitizedData);
    } else {
        localStorage.clear();
        for (const key of Object.keys(DB_KEYS)) {
            // @ts-ignore
            if (dataToRestore[key] !== undefined) localStorage.setItem(DB_KEYS[key], JSON.stringify(dataToRestore[key]));
        }
    }
};

export const clearTransactionalData = async (): Promise<void> => {
    const transactionalKeys = [DB_KEYS.purchaseOrders, DB_KEYS.productionOrders, DB_KEYS.manufacturingOrders, DB_KEYS.cuttingOrders, DB_KEYS.inventoryLogs, DB_KEYS.activityLogs];
    await Promise.all(transactionalKeys.map(key => saveData(key, [])));
    await Promise.all([saveData(DB_KEYS.poCounter, 1), saveData(DB_KEYS.prodCounter, 1), saveData(DB_KEYS.moCounter, 1), saveData(DB_KEYS.coCounter, 1)]);
};

export const resetAndSeedDatabase = async (): Promise<void> => {
    const userRoles = await getUserRoles();
    const allKeys = Object.values(DB_KEYS);
    if (storageMode === 'firebase') {
        for (const key of allKeys) await removeData(key);
    } else {
        localStorage.clear();
    }
    localStorage.removeItem(DB_KEYS.seeded);
    localStorage.removeItem(DB_KEYS.lastModified);
    await initializeDatabase();
    if (userRoles && userRoles.length > 0) await saveUserRoles(userRoles);
};

export const applyCustomFamilyCleanup = async (): Promise<void> => {
    const currentFamilias = await getFamilias();
    const newFamilias = INITIAL_FAMILIAS;
    await saveFamilias(newFamilias);
};

export const getLocalData = async (): Promise<BackupData> => {
    const data: Partial<BackupData> = {};
    for (const key of Object.values(DB_KEYS)) {
        const item = localStorage.getItem(key);
        if (item) (data as any)[key] = JSON.parse(item);
    }
    return data as BackupData;
};

export const clearLocalData = (): void => {
    for (const key of Object.values(DB_KEYS)) localStorage.removeItem(key);
};

// --- LOCAL DRAFT SYSTEM ---
export const saveLocalDraft = (key: string, data: any) => {
    const drafts = JSON.parse(localStorage.getItem(DB_KEYS.localDrafts) || '{}');
    drafts[key] = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(DB_KEYS.localDrafts, JSON.stringify(drafts));
};

export const getLocalDraft = (key: string): any | null => {
    const drafts = JSON.parse(localStorage.getItem(DB_KEYS.localDrafts) || '{}');
    return drafts[key] || null;
};

export const clearLocalDraft = (key: string) => {
    const drafts = JSON.parse(localStorage.getItem(DB_KEYS.localDrafts) || '{}');
    delete drafts[key];
    localStorage.setItem(DB_KEYS.localDrafts, JSON.stringify(drafts));
};

export const hasAnyLocalDraft = (): boolean => {
    const drafts = JSON.parse(localStorage.getItem(DB_KEYS.localDrafts) || '{}');
    return Object.keys(drafts).length > 0;
};

export const subscribeToLastModified = (callback: (timestamp: number) => void, module?: 'engineering' | 'inventory') => {
    if (storageMode !== 'firebase') return () => {};
    const key = module === 'engineering' ? DB_KEYS.lastModified_engineering : 
                module === 'inventory' ? DB_KEYS.lastModified_inventory : 
                DB_KEYS.lastModified;
    const lastModifiedRef = child(dbRef, key);
    const listener = onValue(lastModifiedRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });
    return () => off(lastModifiedRef, 'value', listener);
};
// --- END LOCAL DRAFT SYSTEM ---

export const overwriteFirebaseWithLocal = async (): Promise<void> => {
    if (storageMode !== 'firebase') return;
    const localData = await getLocalData();
    if (!localData || !localData.seeded) return;
    await restoreAllData(localData);
    clearLocalData();
};
