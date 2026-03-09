
import { BackupData, FinancialSettings, Component, Kit, InventoryLog, FamiliaComponente, PurchaseOrder, ProductionOrder, ManufacturingOrder, CuttingOrder, PromotionalCampaign, UserProfile, ActivityLog, Customer, WorkStation, Consumable, StandardOperation } from '../types';
// @ts-ignore
import { INITIAL_FAMILIAS, INITIAL_COMPONENTS, INITIAL_KITS, INITIAL_INVENTORY_LOGS, INITIAL_WORKSTATIONS, INITIAL_CONSUMABLES, INITIAL_OPERATIONS } from '../data/initial-inventory';
import { db } from '../firebaseConfig';
import { ref, get, set, remove, child } from '@firebase/database';

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
    promotionalCampaigns: 'promotionalCampaigns',
    activityLogs: 'activityLogs',
    customers: 'customers',
    workStations: 'workStations',
    consumables: 'consumables',
    standardOperations: 'standardOperations',
    lastModified: 'lastModified',
};

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

const updateLastModified = async () => {
    const timestamp = Date.now();
    if (storageMode === 'localStorage') {
        localStorage.setItem(DB_KEYS.lastModified, JSON.stringify(timestamp));
    } else {
        await set(child(dbRef, DB_KEYS.lastModified), timestamp);
    }
};

const getData = async <T>(key: string, defaultValue: T): Promise<T> => {
    if (storageMode === 'localStorage') {
        const localData = localStorage.getItem(key);
        return localData ? JSON.parse(localData) : defaultValue;
    }
    try {
        const snapshot = await get(child(dbRef, key));
        return snapshot.exists() ? snapshot.val() : defaultValue;
    } catch (e) {
        console.error(`Erro ao ler chave Firebase: ${key}`, e);
        return defaultValue;
    }
};

const saveData = async <T>(key: string, value: T): Promise<void> => {
    const sanitizedValue = sanitizeForFirebase(value);
    if (storageMode === 'localStorage') {
        localStorage.setItem(key, JSON.stringify(sanitizedValue));
        await updateLastModified();
        return;
    }
    try {
        await set(child(dbRef, key), sanitizedValue);
        await updateLastModified();
    } catch (e) {
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
    } catch(e) {
         console.error(`Erro ao remover chave Firebase: ${key}`, e);
    }
};

export const initializeDatabase = async (): Promise<{status: 'ok' | 'conflict', localDate?: Date, firebaseDate?: Date}> => {
    await checkFirebasePermission();
    
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
    return data.map((c: any) => ({
        ...c,
        stock: c.stock || 0,
        custoFabricacao: c.custoFabricacao || 0,
        custoMateriaPrima: c.custoMateriaPrima || 0
    }));
};
export const saveComponents = async (components: Component[]): Promise<void> => saveData(DB_KEYS.components, components);

export const getKits = async (): Promise<Kit[]> => {
    const data = await getData(DB_KEYS.kits, []);
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
    return data.map((f: any) => ({
        ...f,
        nodes: f.nodes || [],
        edges: f.edges || []
    }));
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

export const forceRebuildCorruptedProcesses = async (): Promise<'rebuilt' | 'no_issues' | 'error'> => {
    try {
        const currentFamilias = await getFamilias();
        let wasModified = false;
        let updatedFamilias = [...currentFamilias];
        updatedFamilias = updatedFamilias.map(familia => {
             const template = INITIAL_FAMILIAS.find((f: FamiliaComponente) => f.id === familia.id);
             if (template) {
                 if (JSON.stringify({ nodes: familia.nodes, edges: familia.edges }) !== JSON.stringify({ nodes: template.nodes, edges: template.edges })) {
                     wasModified = true;
                     return { ...familia, nodes: template.nodes, edges: template.edges };
                 }
             }
             return familia;
        });
        const currentIds = new Set(updatedFamilias.map(f => f.id));
        INITIAL_FAMILIAS.forEach((template: FamiliaComponente) => {
            if (!currentIds.has(template.id)) {
                updatedFamilias.push(template);
                wasModified = true;
            }
        });
        if (wasModified) {
            await saveFamilias(updatedFamilias);
            return 'rebuilt';
        }
        return 'no_issues';
    } catch (e) { return 'error'; }
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
    if (storageMode !== 'firebase') return;
    const localData = await getLocalData();
    if (!localData || !localData.seeded) return;
    await restoreAllData(localData);
    clearLocalData();
};
