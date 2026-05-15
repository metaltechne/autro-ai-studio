
import { BackupData, FinancialSettings, Component, Kit, InventoryLog, FamiliaComponente, PurchaseOrder, ProductionOrder, ManufacturingOrder, CuttingOrder, PromotionalCampaign, UserProfile, ActivityLog, Customer, WorkStation, Consumable, StandardOperation, FinancialTransaction, FinancialAccount, FinancialCategory, ReceivingOrder, SupplierProductMapping } from '../types';
// @ts-ignore
import { INITIAL_FAMILIAS, INITIAL_COMPONENTS, INITIAL_KITS, INITIAL_INVENTORY_LOGS, INITIAL_WORKSTATIONS, INITIAL_CONSUMABLES, INITIAL_OPERATIONS } from '../data/initial-inventory';
import { db, auth } from '../firebaseConfig';
import { ref, get, set, remove, child, update, onValue, off, increment, query, orderByChild, orderByKey, limitToFirst, limitToLast, startAt } from '@firebase/database';

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
    preferredFastenerFamiliaId: 'fam-fixadores', 
    pis: 0.65,
    cofins: 3,
    icms: 18,
    simplesNacional: 6,
    simplesNacionalAnnex: 'I',
    salesCommission: 0,
    otherVariableCosts: 0,
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
const localUpdateTimestamps = new Map<string, number>(); // Tracks local write times

/**
 * Retorna o timestamp da última gravação LOCAL (nesta aba/sessão).
 * Usado para detectar se um sinal de mudança remota foi causado por nós mesmos.
 */
export const getLastLocalUpdate = (module?: 'engineering' | 'inventory') => {
    const key = module || 'global';
    return localUpdateTimestamps.get(key) || 0;
};

/**
 * Verificação rigorosa para evitar Loops de Gravação e Consumo Excessivo
 */
const shouldBlockOperation = (type: 'read' | 'write', key: string): boolean => {
    const now = Date.now();
    const history = operationHistory.get(key) || [];
    
    // Limpa histórico antigo (mais de 1 minuto)
    const recentHistory = history.filter(t => t > now - 60000);
    
    // Gatilho 1: Proteção de Loop (mais de 60 gravações na mesma chave em 10 segundos)
    if (type === 'write') {
        const veryRecentWrites = recentHistory.filter(t => t > now - 10000);
        if (veryRecentWrites.length >= 60) {
            console.error(`[DataGuard] BLOQUEIO DE SEGURANÇA: Loop detectado na chave "${key}". Muitas gravações em curto intervalo.`);
            stats.blockedOperations++;
            return true;
        }
    }

    // Gatilho 2: Limite de Frequência (mais de 200 operações por minuto por chave)
    if (recentHistory.length >= 200) {
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
        await set(child(dbRef, key), timestamp)
            .catch(e => console.warn("Erro ao sincronizar timestamp, continuando...", e));
    }

    localUpdateTimestamps.set(module || 'global', timestamp);
    
    // Also update global for backward compatibility
    if (module) {
        if (storageMode === 'localStorage') {
            localStorage.setItem(DB_KEYS.lastModified, JSON.stringify(timestamp));
        } else {
            await set(child(dbRef, DB_KEYS.lastModified), timestamp)
                .catch(e => console.warn("Erro ao sincronizar timestamp global, continuando...", e));
        }
    }
};

export const forceRebuildCorruptedProcesses = async (): Promise<'rebuilt' | 'no_issues'> => {
    return 'no_issues';
};

// Mapeamento de coleções para seus módulos de controle de timestamp
const COLLECTION_MODULES: { [key: string]: 'engineering' | 'inventory' | undefined } = {
    [DB_KEYS.familias]: 'engineering',
    [DB_KEYS.components]: 'engineering',
    [DB_KEYS.kits]: 'engineering',
    [DB_KEYS.standardOperations]: 'engineering',
    [DB_KEYS.workStations]: 'engineering',
    [DB_KEYS.consumables]: 'engineering',
    [DB_KEYS.inventoryLogs]: 'inventory',
    [DB_KEYS.productionOrders]: 'inventory',
    [DB_KEYS.manufacturingOrders]: 'inventory',
    [DB_KEYS.purchaseOrders]: 'inventory',
    [DB_KEYS.cuttingOrders]: 'inventory',
    [DB_KEYS.customers]: 'inventory',
    [DB_KEYS.financialTransactions]: 'inventory',
    [DB_KEYS.receivingOrders]: 'inventory',
    [DB_KEYS.activityLogs]: 'inventory',
    [DB_KEYS.promotionalCampaigns]: 'inventory',
};

const getData = async <T>(key: string, defaultValue: T): Promise<T> => {
    const ensureArray = (val: any) => {
        if (Array.isArray(defaultValue) && val && typeof val === 'object' && !Array.isArray(val)) {
            return Object.values(val) as T;
        }
        return val as T;
    };

    if (shouldBlockOperation('read', key)) {
        const cached = lastDataCache.get(key);
        if (cached) return ensureArray(JSON.parse(cached));
        return defaultValue;
    }

    if (storageMode === 'localStorage') {
        try {
            const localData = localStorage.getItem(key);
            const parsed = localData ? JSON.parse(localData) : defaultValue;
            const finalParsed = ensureArray(parsed);
            logOperation('read', `local:${key}`, finalParsed);
            return finalParsed;
        } catch (e) {
            console.error(`Erro ao ler localStorage para ${key}`, e);
            return defaultValue;
        }
    }

    try {
        // --- SMART CACHING LOGIC ---
        const module = COLLECTION_MODULES[key];
        const lastModifiedKey = module === 'engineering' ? DB_KEYS.lastModified_engineering : 
                               module === 'inventory' ? DB_KEYS.lastModified_inventory : 
                               DB_KEYS.lastModified;
        
        let localLastModified = null;
        let localCachedData = null;
        try {
            localLastModified = localStorage.getItem(`cache_ts_${key}`);
            localCachedData = localStorage.getItem(`cache_data_${key}`);
        } catch (e) {}

        if (localLastModified && localCachedData) {
            try {
                // Busca o timestamp do servidor com timeout de 3s
                const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout TS')), 3000));
                const serverTsSnapshot = await Promise.race([
                    get(child(dbRef, `${key}_lastModified`)),
                    timeoutPromise
                ]) as any;
                
                let serverTs = serverTsSnapshot.val();
                if (!serverTs) serverTs = 0; // Fallback se a chave _lastModified ainda não existir no Firebase
                
                if (serverTs <= JSON.parse(localLastModified)) {
                    console.log(`[DataGuard] Cache HIT para ${key} (Per-key TS).`);
                    const parsed = JSON.parse(localCachedData);
                    const finalParsed = ensureArray(parsed);
                    lastDataCache.set(key, localCachedData);
                    return finalParsed;
                }
            } catch (tsError) {
                console.warn(`[DataGuard] Falha ao verificar timestamp para ${key}, usando cache local...`, tsError);
                const parsed = JSON.parse(localCachedData);
                const finalParsed = ensureArray(parsed);
                lastDataCache.set(key, localCachedData);
                return finalParsed;
            }
        }

        // Se o cache falhou ou os dados mudaram, faz o download completo com timeout de 10s
        const timeoutDataPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout Data')), 10000));
        const snapshot = await Promise.race([
            get(child(dbRef, key)),
            timeoutDataPromise
        ]) as any;

        let val = snapshot.exists() ? snapshot.val() : defaultValue;
        val = ensureArray(val);
        
        const stringified = JSON.stringify(val);
        logOperation('read', key, val);
        
        // Atualiza Cache Local e Cache de Memória
        lastDataCache.set(key, stringified);
        try {
            localStorage.setItem(`cache_data_${key}`, stringified);
            const currentTsSnapshot = await get(child(dbRef, `${key}_lastModified`));
            const currentTs = currentTsSnapshot.val() || Date.now();
            localStorage.setItem(`cache_ts_${key}`, JSON.stringify(currentTs));
        } catch (storageError) {}
        
        return val;
    } catch (e: any) {
        console.error(`Erro crítico ao ler Firebase key "${key}":`, e);
        
        // Proteção contra re-seeding acidental: se falhou a leitura de 'seeded', lança erro real
        if (key === DB_KEYS.seeded) {
            throw new Error(`Falha crítica de conexão: Não foi possível verificar o estado do banco (${e.message})`);
        }

        // Fallback robusto: se falhou a leitura do Firebase mas temos cache, USA O CACHE
        try {
            const fallbackCached = localStorage.getItem(`cache_data_${key}`);
            if (fallbackCached) {
                console.warn(`[DataGuard] Usando cache de emergência para ${key} devido a falha de rede/timeout.`);
                return ensureArray(JSON.parse(fallbackCached));
            }
        } catch (cacheError) {}
        
        console.warn(`[DataGuard] RETORNANDO DEFAULT VALUE PARA ${key}. RISCO DE PERDA DE DADOS SE SALVO.`);
        return defaultValue;
    }
};

const saveData = async <T>(key: string, value: T, bypassIntegrity = false): Promise<void> => {
    const sanitizedValue = sanitizeForFirebase(value);
    const stringified = JSON.stringify(sanitizedValue);
    
    console.log(`[DataGuard] Tentando salvar em ${key}. Payload length: ${stringified.length} bytes.`);
    
    // Gatilho 3: Verificação de Igualdade Profunda (Evita gravar o que não mudou)
    if (lastDataCache.get(key) === stringified) {
        console.log(`[DataGuard] Dados em ${key} não mudaram.`);
        return;
    }

    // Gatilho 4: Proteção de Integridade e Loops
    if (shouldBlockOperation('write', key)) {
        throw new Error(`Operação em ${key} bloqueada temporariamente para economia de cota.`);
    }

    // Gatilho 5: Proteção de Tamanho de Payload (Bloquear se > 5MB - Evita gastos massivos)
    if (stringified.length > 5242880) {
        throw new Error(`DataGuard: O arquivo/dado (${Math.round(stringified.length/1024/1024)}MB) excede o limite de segurança de 5MB por operação.`);
    }

    // --- DATA INTEGRITY CHECK ---
    const oldDataRaw = lastDataCache.get(key);
    if (!bypassIntegrity && Array.isArray(sanitizedValue) && sanitizedValue.length === 0 && oldDataRaw) {
        const oldData = JSON.parse(oldDataRaw);
        // Só bloqueia se a queda for muito drástica e não for intencional (ex: de > 20 para 0)
        if (Array.isArray(oldData) && oldData.length > 20) {
            console.error(`[DataIntegrity] Attempted to save empty array to ${key} when previous size was ${oldData.length}. Operation blocked for safety.`);
            throw new Error(`Integridade de dados: Tentativa de salvar lista vazia em ${key}. Use a função de limpeza se desejar apagar tudo.`);
        }
    }
    // --- END INTEGRITY CHECK ---
    
    // Auto-detect module for timestamping
    const module = COLLECTION_MODULES[key];
    
    // Update local caches IMMEDIATELY
    localStorage.setItem(`cache_data_${key}`, stringified);
    const ts = Date.now();
    localStorage.setItem(`cache_ts_${key}`, JSON.stringify(ts));
    lastDataCache.set(key, stringified);

    if (storageMode === 'localStorage') {
            logOperation('write', `local:${key}`, sanitizedValue);
            await updateLastModified(module);
            return;
        }
    try {
        let isDeltaProcessed = false;
        
        console.log(`[DataGuard] Tentando salvar chave: ${key}, valor: ${Object.keys(sanitizedValue || {}).slice(0, 5)}...`);
        console.log(`[DataGuard] Usuário conectado: ${auth.currentUser?.email || 'Nenhum'}`);
        
        // DataGuard: Precisamos garantir que o Firebase use Dicionários no lugar de Arrays.
        // Se ainda não garantimos a conversão, fazemos o SET completo.
        const isConvertedKey = `converted_dict_${key}`;
        const hasConverted = localStorage.getItem(isConvertedKey);

        if (oldDataRaw && Array.isArray(sanitizedValue) && sanitizedValue.every(item => item && item.id) && hasConverted) {
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
            // Conversão Obrigatória: Transforma Array de Objetos em Dicionário no Firebase.
            if (Array.isArray(sanitizedValue) && sanitizedValue.length > 0 && sanitizedValue.every(item => item && item.id)) {
                console.log(`[DataGuard] Fazendo o SET completo para garantir conversão para Dicionário na coleção ${key}.`);
                const objectMap: Record<string, any> = {};
                sanitizedValue.forEach(item => { objectMap[item.id] = item; });
                await set(child(dbRef, key), objectMap);
                localStorage.setItem(isConvertedKey, "true");
            } else {
                // Comportamento normal para outros tipos de dados (settings, etc)
                await set(child(dbRef, key), sanitizedValue);
            }
        }

        lastDataCache.set(key, stringified);
        try {
            // CRITICAL FIX: Update local storage cache IMMEDIATELY after successful Firebase write
            // This prevents getData from returning stale data on page reload.
            localStorage.setItem(`cache_data_${key}`, stringified);
            const ts = Date.now();
            
            // Set per-key timestamp in Firebase so other clients know EXACTLY which collection changed
            await set(child(dbRef, `${key}_lastModified`), ts);
            localStorage.setItem(`cache_ts_${key}`, JSON.stringify(ts));
        } catch (storageError) {}

        logOperation('write', key, sanitizedValue);
        // Keep triggering module modification so the UI `isOutdated` detects a change and fetches deltas
        await updateLastModified(module);
    } catch (e: any) {
         console.error(`[DataGuard] ERRO AO SALVAR ${key}:`, e);
         if (e.message?.includes('permission_denied')) {
             handleFirebaseError(e, OperationType.WRITE, key);
         }
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
        const module = COLLECTION_MODULES[key];
        await updateLastModified(module);
    } catch(e: any) {
         if (e.message?.includes('permission_denied')) {
             handleFirebaseError(e, OperationType.DELETE, key);
         }
         console.error(`Erro ao remover chave Firebase: ${key}`, e);
    }
};

export const initializeDatabase = async (): Promise<{status: 'ok' | 'conflict', localDate?: Date, firebaseDate?: Date}> => {
    await checkFirebasePermission();
    
    try {
        console.log("Verificando se banco de dados já está inicializado...");
        const seeded = await getData(DB_KEYS.seeded, false);
        if (seeded) {
            console.log("Banco de dados já inicializado.");
            return { status: 'ok' };
        }
    } catch (e: any) {
        console.error("Erro ao verificar inicialização do banco. Abortando seeding para proteger integridade.", e);
        // Retornamos conflito ou erro para que o app saiba que não deve prosseguir
        return { status: 'conflict' };
    }
    
    console.log("Iniciando banco de dados pela primeira vez...");

    console.log("Iniciando com dados padrão...");

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

export const updateStockAtomically = async (componentId: string, delta: number): Promise<void> => {
    if (storageMode === 'localStorage') {
        const components = await getComponents();
        const newComponents = (components || []).map(c => 
            c.id === componentId ? { ...c, stock: (c.stock || 0) + delta } : c
        );
        await saveComponents(newComponents);
        return;
    }

    // Para evitar problemas caso o Firebase ainda esteja armazenando como Array,
    // garantimos a leitura rápida para atualizar integralmente ou via delta.
    const isConvertedKey = `converted_dict_${DB_KEYS.components}`;
    const hasConverted = localStorage.getItem(isConvertedKey);

    if (hasConverted) {
        // Com o DataGuard Delta Engine, a chave no Firebase é EXATAMENTE o componentId.
        // Assim, atualizamos diretamente o estoque na chave correta.
        const updates: Record<string, any> = {};
        updates[`${DB_KEYS.components}/${componentId}/stock`] = increment(delta);
        
        try {
            await update(dbRef, updates);
            
            // Per-key timestamp para o cache 
            const ts = Date.now();
            await set(child(dbRef, `${DB_KEYS.components}_lastModified`), ts);
            
            // Bump timestamp module
            await updateLastModified('engineering'); 
            await updateLastModified('inventory');

            // Atualiza cache local para refletir na UI imediatamente
            const currentDataRaw = lastDataCache.get(DB_KEYS.components);
            if (currentDataRaw) {
                const data = JSON.parse(currentDataRaw);
                const rawArray = Array.isArray(data) ? data : Object.values(data);
                const updated = rawArray.map((c: any) => 
                    c.id === componentId ? { ...c, stock: (c.stock || 0) + delta } : c
                );
                const stringified = JSON.stringify(updated);
                lastDataCache.set(DB_KEYS.components, stringified);
                try {
                    localStorage.setItem(`cache_data_${DB_KEYS.components}`, stringified);
                    localStorage.setItem(`cache_ts_${DB_KEYS.components}`, JSON.stringify(ts));
                } catch (e) {}
            }
            return; // Sucesso com delta
        } catch (error) {
            console.error("Erro ao aplicar updateStockAtomically com delta, fará fallback:", error);
        }
    }

    // Fallback completo e seguro: Lemos e salvamos o array/dicionário todo usando `saveComponents`.
    // Isso forçará a conversão e garantirá a consistência.
    const components = await getComponents();
    const newComponents = (components || []).map(c => 
        c.id === componentId ? { ...c, stock: (c.stock || 0) + delta } : c
    );
    await saveComponents(newComponents);
};

export const getComponents = async (): Promise<Component[]> => {
    const data = await getData(DB_KEYS.components, []);
    
    // Suporte para transição de Array para Map no Firebase
    const rawArray = Array.isArray(data) ? data : Object.values(data);
    
    // Migration: Update purchaseCost from INITIAL_COMPONENTS if it's 0 or missing
    // AND inject missing components from INITIAL_COMPONENTS
    let needsUpdate = false;
    const migratedData = rawArray.map((c: any) => {
        // Migration: Tenta encontrar no INITIAL_COMPONENTS pelo SKU ou pelo ID
        const initialComp = INITIAL_COMPONENTS.find(ic => ic.sku === c.sku || ic.id === c.id);
        
        let merged = { ...c };

        if (initialComp) {
            // Sync missing core fields but DO NOT overwrite user-edited data if it exists and is valid
            if (!c.sku) merged.sku = initialComp.sku;
            if (!c.name) merged.name = initialComp.name;
            
            // Corrige custos SOMENTE se estiverem INDEFINIDOS no banco
            // Permitimos 0 se o usuário explicitamente zerou o custo
            if ((c.purchaseCost === undefined || c.purchaseCost === null) && initialComp.purchaseCost) {
                needsUpdate = true;
                merged.purchaseCost = initialComp.purchaseCost;
            }

            // Sync rounding strategy if missing
            if (!c.purchaseRounding && initialComp.purchaseRounding) {
                needsUpdate = true;
                merged.purchaseRounding = initialComp.purchaseRounding;
            }
            
            // Sync default metadata if not present
            if (c.purchaseQuantity === undefined && initialComp.purchaseQuantity) merged.purchaseQuantity = initialComp.purchaseQuantity;
            if (c.purchaseUnit === undefined && initialComp.purchaseUnit) merged.purchaseUnit = initialComp.purchaseUnit;
            if (c.consumptionUnit === undefined && initialComp.consumptionUnit) merged.consumptionUnit = initialComp.consumptionUnit;
        }
        
        // Corrige type para component se sourcing for manufactured
        // MAS respeita se o usuário marcou como 'purchased' (ex: comprar item que poderia ser fabricado)
        const isActuallyManufactured = c.sourcing === 'manufactured' && (c.custoFabricacao !== undefined && c.custoFabricacao > 0);
        if (isActuallyManufactured && c.type !== 'component') {
            needsUpdate = true;
            merged.type = 'component';
        }
        
        return {
            ...merged,
            stock: c.stock || 0,
            custoFabricacao: c.custoFabricacao || 0,
            custoMateriaPrima: c.custoMateriaPrima || 0
        };
    });

    // Inject missing components
    for (const initialComp of INITIAL_COMPONENTS) {
        if (!migratedData.find((c: any) => c.sku === initialComp.sku || c.id === initialComp.id)) {
            migratedData.push(initialComp);
            needsUpdate = true;
        }
    }

    // Fix: Alterar sourcing para 'purchased' em componentes gerados por famílias de corte a laser
    const laserFamilies = ['fam-FIX-S', 'fam-FIX-P', 'fam-SEGREDO-FIX-P', 'fam-SEGREDO-CHAVE-S', 'fam-FIX-P-SVD', 'fam-SEGREDO-FIX-P-SVD'];
    let laserFixed = false;
    const finalData = migratedData.map(c => {
        if (laserFamilies.includes(c.familiaId) && c.sourcing !== 'purchased') {
            laserFixed = true;
            return { ...c, sourcing: 'purchased' };
        }
        return c;
    });

    if (laserFixed) needsUpdate = true;

    // Deduplicate once more before saving/returning
    const uniqueFinalMap = new Map<string, any>();
    finalData.forEach((c: any) => { if (c && c.id) uniqueFinalMap.set(c.id, c); });
    const finalCleanData = Array.from(uniqueFinalMap.values());

    if (needsUpdate) {
        console.log(`[Migration] Sincronizando ${finalCleanData.length} componentes após migração/ajuste.`);
        await saveComponents(finalCleanData);
    }

    return finalCleanData;
};

export const saveComponents = async (components: Component[], skipTimestamp = false): Promise<void> => {
    await saveData(DB_KEYS.components, components);
    if (!skipTimestamp) await updateLastModified('inventory');
};

export const getKits = async (): Promise<Kit[]> => {
    console.log("[API] Buscando kits...");
    const data = await getData(DB_KEYS.kits, []);
    
    let rawArray = Array.isArray(data) ? data : Object.values(data);
    
    // Filtra possíveis nulos ou indefinidos que podem vir do Firebase
    rawArray = rawArray.filter(k => k !== null && k !== undefined);

    if (rawArray.length === 0 && INITIAL_KITS && INITIAL_KITS.length > 0) {
        console.warn("[API] Nenhum kit encontrado. Inicializando com dados iniciais.");
        await saveKits(INITIAL_KITS);
        return INITIAL_KITS;
    }

    console.log(`[API] ${rawArray.length} kits carregados.`);
    return rawArray.map((k: any) => ({
        ...k,
        components: k.components || [],
        requiredFasteners: k.requiredFasteners || []
    }));
};

export const saveKits = async (kits: Kit[], skipTimestamp = false): Promise<void> => {
    await saveData(DB_KEYS.kits, kits);
    if (!skipTimestamp) await updateLastModified('inventory');
};

export const getInventoryLogs = async (limit?: number): Promise<InventoryLog[]> => {
    if (limit) {
        const q = query(child(dbRef, DB_KEYS.inventoryLogs), limitToLast(limit));
        const snapshot = await get(q);
        const val = snapshot.exists() ? snapshot.val() : {};
        return Object.values(val) as InventoryLog[];
    }
    const data: any = await getData(DB_KEYS.inventoryLogs, []);
    return Array.isArray(data) ? data : (data ? Object.values(data) : []);
};
export const saveInventoryLogs = async (logs: InventoryLog[], skipTimestamp = false): Promise<void> => {
    try {
        if (Array.isArray(logs)) {
            const capped = logs.slice(-500);
            await saveData(DB_KEYS.inventoryLogs, capped);
        } else {
            await saveData(DB_KEYS.inventoryLogs, logs);
        }
        
        if (!skipTimestamp) await updateLastModified('inventory');
    } catch (e) {
        console.error("Erro ao salvar logs de inventário:", e);
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

    // Fix: Alterar sourcing para 'purchased' em famílias com corte a laser
    const laserFixedFamilias = fixedFamilias.map(f => {
        let isLaser = false;
        f.nodes.forEach((n: any) => {
            if (n.data?.operationId === 'op-corte-laser') {
                isLaser = true;
            }
        });
        
        if (isLaser && f.sourcing !== 'purchased') {
            needsSave = true;
            return {
                ...f,
                sourcing: 'purchased',
                nodes: f.nodes.map((n: any) => {
                    if (n.type === 'productGeneratorNode' || n.type === 'productGenerator') {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                generationConfig: {
                                    ...n.data.generationConfig,
                                    defaultSourcing: 'purchased'
                                }
                            }
                        };
                    }
                    return n;
                })
            };
        }
        return f;
    });

    if (needsSave) {
        console.log("Auto-corrigindo consumo da família fam-USINAGEM-BARRA ou restaurando família COPO...");
        saveFamilias(laserFixedFamilias);
    }

    // Injeta famílias que foram adicionadas no sistema base e ainda não existem no banco do usuário
    let injected = false;
    for (const initialFam of INITIAL_FAMILIAS) {
        if (!laserFixedFamilias.find((f: any) => f.id === initialFam.id)) {
            console.log(`Auto-injetando família ausente: ${initialFam.id}`);
            laserFixedFamilias.push(initialFam);
            injected = true;
        }
    }
    
    if (injected) {
        saveFamilias(laserFixedFamilias);
    }

    return laserFixedFamilias;
};
export const saveFamilias = async (familias: FamiliaComponente[], skipTimestamp = false): Promise<void> => {
    await saveData(DB_KEYS.familias, familias);
    if (!skipTimestamp) await updateLastModified('engineering');
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

export const getActivityLogs = async (limit?: number): Promise<ActivityLog[]> => {
    if (limit) {
        const q = query(child(dbRef, DB_KEYS.activityLogs), limitToLast(limit));
        const snapshot = await get(q);
        const val = snapshot.exists() ? snapshot.val() : {};
        return Object.values(val) as ActivityLog[];
    }
    const data: any = await getData(DB_KEYS.activityLogs, []);
    return Array.isArray(data) ? data : (data ? Object.values(data) : []);
};
export const saveActivityLogs = async (logs: ActivityLog[]): Promise<void> => {
    try {
        if (Array.isArray(logs)) {
            const capped = logs.map((log, index) => ({
                ...log,
                id: log.id || `act-${Date.now()}-${index}`
            })).slice(-300);
            await saveData(DB_KEYS.activityLogs, capped);
        } else {
            await saveData(DB_KEYS.activityLogs, logs);
        }
    } catch (e) {
        console.error("Erro ao salvar logs de atividade:", e);
    }
};

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
    await saveData(DB_KEYS.workStations, data);
    if (!skipTimestamp) await updateLastModified('engineering');
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
    await saveData(DB_KEYS.consumables, data);
    if (!skipTimestamp) await updateLastModified('engineering');
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
    await saveData(DB_KEYS.standardOperations, data);
    if (!skipTimestamp) await updateLastModified('engineering');
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
    await Promise.all(transactionalKeys.map(key => saveData(key, [], true)));
    await Promise.all([saveData(DB_KEYS.poCounter, 1, true), saveData(DB_KEYS.prodCounter, 1, true), saveData(DB_KEYS.moCounter, 1, true), saveData(DB_KEYS.coCounter, 1, true)]);
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

export const forceComponentSKUMigration = async (): Promise<void> => {
    // Força a limpeza de rascunhos locais que podem estar travando SKUs antigos
    clearLocalDraft('components');
    clearLocalDraft('kits');
    clearLocalDraft('familias');
    
    // Força a recarga e migração
    const components = await getComponents();
    await getKits(); // Migração de kits se necessário
    
    console.log(`[SKU Migration] Forçada re-sincronização de ${components.length} componentes.`);
    window.location.reload();
};

/**
 * Função extrema para resetar dados corrompidos localmente.
 */
export const hardResetData = async () => {
    localStorage.removeItem(DB_KEYS.localDrafts);
    window.location.reload();
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
    try {
        const drafts = JSON.parse(localStorage.getItem(DB_KEYS.localDrafts) || '{}');
        drafts[key] = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(DB_KEYS.localDrafts, JSON.stringify(drafts));
    } catch (e) {
        console.warn(`[DataGuard] Falha ao salvar rascunho local para ${key}. Cota do localStorage excedida.`);
        // Tenta limpar drafts antigos se falhar
        if (e instanceof Error && e.name === 'QuotaExceededError') {
            localStorage.removeItem(DB_KEYS.localDrafts);
        }
    }
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
