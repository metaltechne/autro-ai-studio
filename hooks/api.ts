
import { BackupData, FinancialSettings, Component, Kit, InventoryLog, FamiliaComponente, PurchaseOrder, ProductionOrder, ManufacturingOrder, CuttingOrder, PromotionalCampaign, UserProfile, ActivityLog, Customer, WorkStation, Consumable, StandardOperation, FinancialTransaction, FinancialAccount, FinancialCategory, ReceivingOrder, SupplierProductMapping } from '../types';
// @ts-ignore
import { INITIAL_FAMILIAS, INITIAL_COMPONENTS, INITIAL_KITS, INITIAL_INVENTORY_LOGS, INITIAL_WORKSTATIONS, INITIAL_CONSUMABLES, INITIAL_OPERATIONS } from '../data/initial-inventory';
import { supabase } from '../supabaseConfig';

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
    lastModified: 'lastModified',
};

// 🎯 MODO PADRÃO: localStorage (economiza Firebase gratuito)
// Para usar Firebase, chame forceUseSupabase() manualmente
let storageMode: 'supabase' | 'localStorage' = 'localStorage';
let permissionChecked = false;

// Contador de operações para métricas
let readCount = 0;
let writeCount = 0;
let lastResetTime = Date.now();

export const getUsageStats = () => {
    const hoursSinceReset = (Date.now() - lastResetTime) / (1000 * 60 * 60);
    return {
        reads: readCount,
        writes: writeCount,
        totalOps: readCount + writeCount,
        hoursSinceReset: hoursSinceReset.toFixed(1),
    };
};

export const resetUsageStats = () => {
    readCount = 0;
    writeCount = 0;
    lastResetTime = Date.now();
};

// Força o uso do Supabase (para sincronização manual)
export const forceUseSupabase = () => {
    console.log('🔄 Alternando para modo Supabase (sincronização)');
    storageMode = 'supabase';
};

// Alias para compatibilidade com componentes existentes
export const forceUseFirebase = forceUseSupabase;

// Força o uso do localStorage (padrão)
export const forceUseLocalStorage = () => {
    console.log('💾 Alternando para modo localStorage');
    storageMode = 'localStorage';
};

// Retorna o modo atual
export const getStorageMode = () => storageMode;

const checkSupabasePermission = async () => {
    // Por padrão, usa localStorage para economia
    // Supabase só é usado se o usuário explicitamente pedir sincronização
    if (permissionChecked) return;
    
    // Verifica se há flag de forçar Supabase
    const forceSupabase = localStorage.getItem('forceSupabase');
    if (forceSupabase === 'true') {
        try {
            const { data, error } = await supabase.from('app_data').select('seeded').eq('id', 'main').single();
            if (error) throw error;
            storageMode = 'supabase';
            console.log('✅ Conectado ao Supabase (modo forçado)');
        } catch (e: any) {
            console.warn('❌ Falha ao conectar Supabase, usando localStorage:', e);
            storageMode = 'localStorage';
        }
    } else {
        // Modo padrão: localStorage
        console.log('💾 Usando localStorage (modo padrão)');
        storageMode = 'localStorage';
    }
    permissionChecked = true;
};

const sanitizeForSupabase = (data: any): any => {
    if (data === undefined) return null;
    if (typeof data === 'number') {
        if (!Number.isFinite(data) || Number.isNaN(data)) return 0; 
        return data;
    }
    if (data === null || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(item => sanitizeForSupabase(item));
    const sanitizedObject: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value !== undefined) sanitizedObject[key] = sanitizeForSupabase(value);
        }
    }
    return sanitizedObject;
};

// Mapeamento das chaves para nomes de coluna no Supabase
const DB_KEYS_MAP: Record<string, string> = {
    seeded: 'seeded',
    components: 'components',
    kits: 'kits',
    inventoryLogs: 'inventorylogs',
    familias: 'familias',
    purchaseOrders: 'purchaseorders',
    poCounter: 'pocounter',
    productionOrders: 'productionorders',
    prodCounter: 'prodcounter',
    manufacturingOrders: 'manufacturingorders',
    moCounter: 'mocounter',
    cuttingOrders: 'cuttingorders',
    coCounter: 'cocounter',
    financialSettings: 'financialsettings',
    userRoles: 'userroles',
    rolePermissions: 'rolepermissions',
    promotionalCampaigns: 'promotionalcampaigns',
    activityLogs: 'activitylogs',
    customers: 'customers',
    workStations: 'workstations',
    consumables: 'consumables',
    standardOperations: 'standardoperations',
    financialTransactions: 'financialtransactions',
    financialAccounts: 'financialaccounts',
    financialCategories: 'financialcategories',
    receivingOrders: 'receivingorders',
    supplierProductMappings: 'supplierproductmappings',
    receivingCounter: 'receivingcounter',
    tasks: 'tasks',
    lastModified: 'lastmodified',
};

// Cache local dos dados do Supabase
let supabaseCache: Record<string, any> = {};

export const updateLastModified = async () => {
    const timestamp = Date.now();
    if (storageMode === 'localStorage') {
        localStorage.setItem(DB_KEYS.lastModified, JSON.stringify(timestamp));
    } else {
        supabaseCache[DB_KEYS.lastModified] = timestamp;
        await supabase.from('app_data').upsert({ id: 'main', lastmodified: timestamp, updated_at: new Date().toISOString() });
    }
};

export const forceRebuildCorruptedProcesses = async (): Promise<'rebuilt' | 'no_issues'> => {
    return 'no_issues';
};

// Carrega todos os dados do Supabase para o cache
const loadSupabaseData = async () => {
    try {
        const { data, error } = await supabase.from('app_data').select('*').eq('id', 'main').single();
        if (error) throw error;
        if (data) {
            supabaseCache = {
                seeded: data.seeded,
                components: data.components || [],
                kits: data.kits || [],
                inventoryLogs: data.inventorylogs || [],
                familias: data.familias || [],
                purchaseOrders: data.purchaseorders || [],
                poCounter: data.pocounter || 1,
                productionOrders: data.productionorders || [],
                prodCounter: data.prodcounter || 1,
                manufacturingOrders: data.manufacturingorders || [],
                moCounter: data.mocounter || 1,
                cuttingOrders: data.cuttingorders || [],
                coCounter: data.cocounter || 1,
                financialSettings: data.financialsettings || {},
                userRoles: data.userroles || [],
                rolePermissions: data.rolepermissions || [],
                promotionalCampaigns: data.promotionalcampaigns || [],
                activityLogs: data.activitylogs || [],
                customers: data.customers || [],
                workStations: data.workstations || [],
                consumables: data.consumables || [],
                standardOperations: data.standardoperations || [],
                financialTransactions: data.financialtransactions || [],
                financialAccounts: data.financialaccounts || [],
                financialCategories: data.financialcategories || [],
                receivingOrders: data.receivingorders || [],
                supplierProductMappings: data.supplierproductmappings || [],
                receivingCounter: data.receivingcounter || 1,
                tasks: data.tasks || [],
                lastModified: data.lastmodified || 0,
            };
        }
    } catch (e) {
        console.error('Erro ao carregar dados do Supabase:', e);
    }
};

const getData = async <T>(key: string, defaultValue: T): Promise<T> => {
    readCount++;
    if (storageMode === 'localStorage') {
        const localData = localStorage.getItem(key);
        return localData ? JSON.parse(localData) : defaultValue;
    }
    // Modo Supabase
    if (Object.keys(supabaseCache).length === 0) {
        await loadSupabaseData();
    }
    return supabaseCache[key] !== undefined ? supabaseCache[key] : defaultValue;
};

const saveData = async <T>(key: string, value: T): Promise<void> => {
    writeCount++;
    const sanitizedValue = sanitizeForSupabase(value);
    if (storageMode === 'localStorage') {
        localStorage.setItem(key, JSON.stringify(sanitizedValue));
        await updateLastModified();
        return;
    }
    // Modo Supabase
    try {
        supabaseCache[key] = sanitizedValue;
        const dbKey = DB_KEYS_MAP[key] || key;
        await supabase.from('app_data').upsert({ id: 'main', [dbKey]: sanitizedValue, updated_at: new Date().toISOString() });
        await updateLastModified();
    } catch (e) {
        console.error(`Erro ao salvar no Supabase: ${key}`, e);
        throw e;
    }
};

const removeData = async (key: string): Promise<void> => {
    if (storageMode === 'localStorage') {
        localStorage.removeItem(key);
        return;
    }
    try {
        supabaseCache[key] = null;
        const dbKey = DB_KEYS_MAP[key] || key;
        await supabase.from('app_data').upsert({ id: 'main', [dbKey]: null, updated_at: new Date().toISOString() });
    } catch (e) {
        console.error(`Erro ao remover do Supabase: ${key}`, e);
    }
};

export const initializeDatabase = async (): Promise<{status: 'ok' | 'conflict', localDate?: Date, firebaseDate?: Date}> => {
    await checkSupabasePermission();
    
    const seeded = await getData(DB_KEYS.seeded, false);
    if (seeded) return { status: 'ok' };

    console.log("Iniciando banco de dados com dados padrão...");

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
    
    // Migration: Update purchaseCost from INITIAL_COMPONENTS if it's 0 or missing
    // AND inject missing components from INITIAL_COMPONENTS
    let needsUpdate = false;
    const migratedData = data.map((c: any) => {
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
        await saveData(DB_KEYS.components, migratedData);
    }

    return migratedData;
};
export const saveComponents = async (components: Component[]): Promise<void> => saveData(DB_KEYS.components, components);

export const getKits = async (): Promise<Kit[]> => {
    const data = await getData(DB_KEYS.kits, []);
    
    if (data.length === 0 && INITIAL_KITS && INITIAL_KITS.length > 0) {
        await saveData(DB_KEYS.kits, INITIAL_KITS);
        return INITIAL_KITS;
    }

    return data.map((k: any) => ({
        ...k,
        components: k.components || [],
        requiredFasteners: k.requiredFasteners || []
    }));
};
export const saveKits = async (kits: Kit[]): Promise<void> => saveData(DB_KEYS.kits, kits);

export const getInventoryLogs = async (): Promise<InventoryLog[]> => getData(DB_KEYS.inventoryLogs, []);
export const saveInventoryLogs = async (logs: InventoryLog[]): Promise<void> => saveData(DB_KEYS.inventoryLogs, logs);

export const getFamilias = async (): Promise<FamiliaComponente[]> => {
    const data = await getData(DB_KEYS.familias, []);
    const familias = data.map((f: any) => ({
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

    // Garantir que a família COPO exista se não estiver na lista
    if (!fixedFamilias.find(f => f.id === 'fam-MONTAGEM-COPO')) {
        const initialCopo = INITIAL_FAMILIAS.find(f => f.id === 'fam-MONTAGEM-COPO');
        if (initialCopo) {
            fixedFamilias.push(initialCopo);
            saveFamilias(fixedFamilias);
        }
    }

    return fixedFamilias;
};
export const saveFamilias = async (familias: FamiliaComponente[]): Promise<void> => saveData(DB_KEYS.familias, familias);

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

export const getWorkStations = async (): Promise<WorkStation[]> => getData(DB_KEYS.workStations, []);
export const saveWorkStations = async (data: WorkStation[]): Promise<void> => saveData(DB_KEYS.workStations, data);

export const getConsumables = async (): Promise<Consumable[]> => getData(DB_KEYS.consumables, []);
export const saveConsumables = async (data: Consumable[]): Promise<void> => saveData(DB_KEYS.consumables, data);

export const getStandardOperations = async (): Promise<StandardOperation[]> => getData(DB_KEYS.standardOperations, []);
export const saveStandardOperations = async (data: StandardOperation[]): Promise<void> => saveData(DB_KEYS.standardOperations, data);

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

export const getAllData = async (): Promise<BackupData> => {
    if (storageMode === 'supabase') {
        await loadSupabaseData();
        return supabaseCache as BackupData;
    } else {
        return getLocalData();
    }
};

export const restoreAllData = async (data: BackupData): Promise<void> => {
    const dataToRestore = { ...data, lastModified: data.lastModified || Date.now() };
    if (data.familias && Array.isArray(data.familias)) {
        dataToRestore.familias = data.familias.map(familia => ({ ...familia, nodes: familia.nodes || [], edges: familia.edges || [] }));
    }
    if (storageMode === 'supabase') {
        const sanitizedData = sanitizeForSupabase(dataToRestore);
        await supabase.from('app_data').upsert({ id: 'main', ...sanitizedData, updated_at: new Date().toISOString() });
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
    if (storageMode === 'supabase') {
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

export const overwriteFirebaseWithLocal = async (): Promise<void> => {
    if (storageMode !== 'supabase') return;
    const localData = await getLocalData();
    if (!localData || !localData.seeded) return;
    await restoreAllData(localData);
    clearLocalData();
};
