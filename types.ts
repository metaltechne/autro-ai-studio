
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';

export enum View {
    SECTOR_DASHBOARD = 'SECTOR_DASHBOARD',
    OPERATIONAL_DASHBOARD = 'OPERATIONAL_DASHBOARD',
    FINANCIAL_DASHBOARD = 'FINANCIAL_DASHBOARD',
    COMPONENTS = 'COMPONENTS',
    KITS = 'KITS',
    KIT_DETAILS = 'KIT_DETAILS',
    KITS_BY_BRAND = 'KITS_BY_BRAND',
    MANUFACTURING = 'MANUFACTURING',
    RAW_MATERIALS = 'RAW_MATERIALS',
    PRODUCTION_PLANNER = 'PRODUCTION_PLANNER',
    PRODUCTION_ORDERS = 'PRODUCTION_ORDERS',
    PURCHASE_ORDERS = 'PURCHASE_ORDERS',
    MANUFACTURING_PLANNER = 'MANUFACTURING_PLANNER',
    MANUFACTURING_ORDERS = 'MANUFACTURING_ORDERS',
    MANUFACTURING_CALENDAR = 'MANUFACTURING_CALENDAR',
    PRODUCTION_FINANCIAL_FLOW = 'PRODUCTION_FINANCIAL_FLOW',
    INVENTORY_ANALYSIS = 'INVENTORY_ANALYSIS',
    PURCHASE_PRODUCTION_PLANNING = 'PURCHASE_PRODUCTION_PLANNING',
    SETTINGS = 'SETTINGS',
    PAYMENT_CALENDAR = 'PAYMENT_CALENDAR',
    LABEL_PRINTING = 'LABEL_PRINTING',
    STOCK_MOVEMENT = 'STOCK_MOVEMENT',
    ORDER_VERIFICATION = 'ORDER_VERIFICATION',
    SPREADSHEETS = 'SPREADSHEETS',
    AI_WORKER = 'AI_WORKER',
    ACTIVITY_LOG = 'ACTIVITY_LOG',
    INSPECTION_RECEIVING = 'INSPECTION_RECEIVING',
    FASTENER_CUTTING = 'FASTENER_CUTTING',
    CUTTING_ORDERS = 'CUTTING_ORDERS',
    USER_MANAGEMENT = 'USER_MANAGEMENT',
    SALES_ORDER_IMPORT = 'SALES_ORDER_IMPORT',
    CUSTOMERS = 'CUSTOMERS',
    MANUFACTURING_STRUCTURE = 'MANUFACTURING_STRUCTURE',
    MANUFACTURING_DASHBOARD = 'MANUFACTURING_DASHBOARD',
    MACHINE_DASHBOARD = 'MACHINE_DASHBOARD',
    MANUFACTURING_CONTROL_CENTER = 'MANUFACTURING_CONTROL_CENTER',
    SALES_FUNNEL = 'SALES_FUNNEL',
    SALES_DASHBOARD = 'SALES_DASHBOARD',
    WHATSAPP_CRM = 'WHATSAPP_CRM',
    CALLS_CRM = 'CALLS_CRM',
    CUSTOMER_SERVICE_DASHBOARD = 'CUSTOMER_SERVICE_DASHBOARD',
    KIT_ENGINEERING = 'KIT_ENGINEERING',
    TASKS = 'TASKS',
    MANUAL = 'MANUAL'
}

export type UserRole = 'Admin' | 'Gestor' | 'Vendedor' | 'Linha de Produção' | 'Fabricação' | 'Compras' | 'Financeiro';

export type RolePermissions = Record<UserRole, View[]>;

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
}

export enum TaskStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    OVERDUE = 'OVERDUE'
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    status: TaskStatus;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
    creatorId?: string;
    assignedTo?: string;
    relatedLeadId?: string;
    relatedDealId?: string;
    createdAt: string;
    completedAt?: string;
}

export interface ServiceStrategy {
    id: string;
    name: string;
    triggerEvent: 'NEW_LEAD' | 'DEAL_STAGE_CHANGED' | 'MANUAL';
    targetStage?: DealStage;
    delayDays: number;
    taskTitle: string;
    taskDescription: string;
    isActive: boolean;
}

export interface Component {
    id: string;
    name: string;
    sku: string;
    type: 'component' | 'raw_material';
    stock: number;
    reservedStock?: number;
    familiaId?: string;
    category?: string;
    sourcing?: 'manufactured' | 'purchased' | 'beneficiado' | 'semi_finished';
    custoFabricacao: number;
    custoMateriaPrima: number;
    materialCost?: number;
    fabricationCost?: number;
    cost?: number;
    purchaseCost?: number;
    purchaseUnit?: string;
    purchaseQuantity?: number;
    consumptionUnit?: string;
    unitCategory?: 'weight' | 'length' | 'count';
    density?: number;
    scrapPercentage?: number;
    leadTimeDays?: number;
}

export interface KitComponent {
    componentSku: string;
    quantity: number;
}

export interface Kit {
    id: string;
    name: string;
    sku: string;
    description?: string;
    marca: string;
    modelo: string;
    ano: string;
    components: KitComponent[];
    requiredFasteners: { dimension: string; quantity: number }[];
    compatibilityRules?: { condition: string; result: string }[];
    category?: string;
    sellingPriceOverride?: number;
    pricingStrategy?: 'markup' | 'override' | 'margin';
    selectedFamiliaId?: string;
}

export interface InventoryLog {
    id: string;
    componentId: string;
    type: 'entrada' | 'saída';
    quantity: number;
    date: string;
    reason: InventoryLogReason;
    notes?: string;
}

export type InventoryLogReason = 
    | 'compra_fornecedor' 
    | 'devolucao_cliente' 
    | 'ajuste_inventario_positivo' 
    | 'uso_producao_kit' 
    | 'venda_direta' 
    | 'ajuste_inventario_negativo' 
    | 'perda_dano' 
    | 'estoque_inicial' 
    | 'fabricacao_interna' 
    | 'corte_substituição' 
    | 'conclusao_ordem_producao' 
    | 'consumo_fabricacao' 
    | 'outro';

export type InventoryLogType = 'entrada' | 'saída';

export type ProcessCategory = 'manufacturing' | 'kit_assembly' | 'both';

export interface ProcessHeadCode {
    id: string;
    code: string;
    type?: string;
    description?: string;
}

export interface ProcessDimension {
    id: string;
    bitola: number;
    comprimento: number;
    diametro?: number;
    baseMaterialId?: string;
    bodyPieceMaterialId?: string;
    targetFamiliaId?: string;
    headMachiningCost?: number;
    bodyPieceCost?: number;
    consumption?: number;
    serviceCost?: number;
    code?: string;
}

export interface GenerationConfig {
    nameTemplate: string;
    skuTemplate: string;
    defaultSourcing?: Component['sourcing'];
}

export interface OperationConsumable {
    consumableId: string;
    quantity: number;
}

export interface WorkStation {
    id: string;
    name: string;
    hourlyRate: number;
    capacityHoursPerDay?: number;
}

export interface Consumable {
    id: string;
    name: string;
    unit: string;
    purchasePrice: number;
    monthlyConsumption: number;
    monthlyProduction: number;
    unitCost: number;
    category: string;
}

export interface StandardOperation {
    id: string;
    name: string;
    category: string;
    workStationId: string;
    timeSeconds: number;
    operationConsumables: OperationConsumable[];
}

export interface FamiliaComponente {
    id: string;
    nome: string;
    type?: string;
    sourcing: Component['sourcing'];
    category: ProcessCategory;
    masterProcessTag?: 'FIX-P' | 'FIX-S' | 'FIX-S EXT' | 'Generico';
    nodes: Node<ProcessNodeData>[];
    edges: Edge[];
}

export type CostCalculationMode = 'fixed' | 'time' | 'workstation';

export interface ProcessNodeData {
    label: string;
    cost: number;
    costCalculationMode?: CostCalculationMode;
    fixedCost?: number;
    type: 'etapaFabricacao' | 'materiaPrima' | 'inventoryComponent' | 'processVariable' | 'headCodeTable' | 'dimensionTable' | 'productGenerator' | 'finalProduct' | 'externalDataSource' | 'dnaTable' | 'materialMapping' | 'codificationTable' | 'serviceMapping' | 'subProcessMapping' | 'usinagemParafusoSextavado' | 'dnaTableNode' | 'productGeneratorNode' | 'codificationTableNode' | 'etapaFabricacaoNode' | 'materialMappingNode' | 'final';
    baseMaterialId?: string;
    consumption?: number;
    componentId?: string;
    componentIdTemplate?: string;
    sourceFamiliaId?: string;
    headCodes?: ProcessHeadCode[];
    dimensions?: ProcessDimension[];
    generationConfig?: GenerationConfig;
    sourceSku?: string;
    ignoreCost?: boolean;
    targetGenerators?: string[];
    tableMode?: 'fastener' | 'standard';
    mappingMode?: 'thread' | 'diameter';
    operationId?: string; 
    workStationId?: string;
    isExternalService?: boolean; 
    externalServiceCost?: number; 
    manualTimeSeconds?: number;
    manualOperatorId?: string; 
    manualConsumables?: OperationConsumable[];
    updateNodeLabel?: (label: string) => void;
    updateNodeCost?: (cost: number | string) => void;
    updateNodeMaterialDetails?: (details: any, components: Component[]) => void;
    updateNodeComponentDetails?: (details: any, components: Component[]) => void;
    updateNodeGenerationConfig?: (config: Partial<GenerationConfig>) => void;
    updateNodeVariable?: (details: any) => void;
    updateNodeExternalDataSource?: (details: any) => void;
    updateNodeIgnoreCost?: (ignore: boolean) => void;
    updateNodeTableMode?: (mode: 'fastener' | 'standard') => void;
    updateNodeMappingMode?: (mode: 'thread' | 'diameter') => void;
    updateNodeOperationDetails?: (details: { 
        operationId?: string; 
        costCalculationMode?: CostCalculationMode;
        fixedCost?: number;
        workStationId?: string;
        manualTimeSeconds?: number; 
        manualOperatorId?: string; 
        manualConsumables?: OperationConsumable[];
    }) => void;
    onViewGeneratedProducts?: () => void;
    addHeadCode?: (code?: string) => void;
    updateHeadCode?: (headCodeId: string, data: any) => void;
    deleteHeadCode?: (headCodeId: string, data: any) => void;
    addDimension?: () => void;
    updateDimension?: (dimensionId: string, data: any) => void;
    deleteDimension?: (dimensionId: string, data: any) => void;
    updateDimensions?: (dimensions: ProcessDimension[]) => void; 
    updateHeadCodes?: (headCodes: ProcessHeadCode[]) => void; 
    disconnectHandle?: (handleId: string) => void;
    getMaterialOptions?: () => Component[];
    getInventoryComponentOptions?: () => Component[];
    duplicateNode?: () => void;
    deleteNode?: () => void;
    operators?: WorkStation[]; 
    operations?: StandardOperation[];
    consumables?: Consumable[];
    allFamilias?: FamiliaComponente[]; 
    inventoryContext?: {
        components: Component[];
        updateComponent: (c: Component) => Promise<void>;
    };
}

export interface ProductionOrder {
    id: string;
    createdAt: string;
    status: 'pendente' | 'em_montagem' | 'concluída' | 'cancelada';
    orderItems: ProductionOrderItem[];
    selectedScenario: ProductionScenario;
    virtualComponents: Component[];
    actualCost?: number;
    actualTimeSeconds?: number;
    notes?: string;
    customerId?: string;
    customerName?: string;
    scannedItems: Record<string, number>;
    substitutions: Record<string, { substitutedWithId: string; quantity: number }>;
    installments: Installment[];
    saleDetails?: SaleDetails;
}

export interface ProductionScenario {
    id?: string;
    fastenerHeadCode: string;
    isPossible: boolean;
    totalCost: number;
    costBreakdown: { materialCost: number, fabricationCost: number };
    inventoryValueConsumed: number;
    shortageValue: number;
    shortages: ProductionScenarioShortage[];
    detailedRequirements: {
        componentId: string;
        componentName: string;
        required: number;
        available: number;
        balance: number;
        unitCost: number;
        totalValueRequired: number;
    }[];
    substitutionsMade: {
        from: { name: string; sku: string };
        to: { name: string; sku: string };
        quantity: number;
    }[];
}

export interface ProductionScenarioShortage {
    componentId: string;
    componentName: string;
    required: number;
    available: number;
    shortage: number;
    unitCost: number;
    totalShortageValue: number;
    substitutionOptions?: SubstitutionOption[];
}

export interface SubstitutionOption {
    sourceComponent: Component;
    costOfCutting: number;
    sourceComponentAgeDays: number;
}

export interface AggregatedPart {
    name: string;
    sku: string;
    totalQuantity: number;
    totalValue: number;
}

export interface Installment {
    id: string;
    number: string;
    value: number;
    dueDate: string;
    status: 'pendente' | 'pago';
    supplierName?: string;
    notes?: string;
}

export interface SaleDetails {
    sellingPrice: number;
    profit: number;
    totalTaxes: number;
    taxBreakdown: { name: string; percentage: number; value: number }[];
    isOverridden: boolean;
    contributionMargin: number;
    contributionMarginPercentage: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    deliveryDate?: string;
    paymentMethod?: string;
    totalAmount?: number;
    discount?: number;
    shippingCost?: number;
    notes?: string[];
}

export interface ProductionOrderItem {
    id: string;
    kitId?: string;
    componentId?: string;
    type: 'kit' | 'component';
    quantity: number;
    fastenerHeadCode?: string;
    variant?: 'Padrão' | 'Fix-S' | 'Fix-P';
}

export interface ScannedQRCodeData {
    type: 'component' | 'kit';
    id: string;
}

export interface QuoteItem {
    kit: Kit;
    quantity: number;
    variant?: 'Padrão' | 'Fix-S' | 'Fix-P';
}

export interface PurchaseRecommendation {
    componentId: string;
    name: string;
    sku: string;
    sourcing: string;
    required: number;
    inStock: number;
    toOrder: number;
    abcClass: 'A' | 'B' | 'C';
}

export interface ProductionRecommendation {
    componentId: string;
    name: string;
    sku: string;
    required: number;
    inStock: number;
    toProduce: number;
    abcClass: 'A' | 'B' | 'C';
}

export interface CuttingRecommendation {
    sourceComponentId: string;
    targetComponentId: string;
    quantityToCut: number;
    costSaving: number;
    abcClass: 'A' | 'B' | 'C';
}

export interface RawMaterialForecastItem {
    materialId: string;
    name: string;
    sku: string;
    unit: string;
    purchaseUnit: string;
    requiredForPlan: number;
    currentStock: number;
    netToBuy: number;
    totalCost: number;
}

export interface ManufacturingOrderItem {
    componentId: string;
    quantity: number;
    name?: string;
    sku?: string;
    status?: 'pendente' | 'em_producao' | 'aguardando_inspecao' | 'concluido';
    producedQuantity?: number;
}

export interface ManufacturingAnalysis {
    isFeasible: boolean;
    totalCost: number;
    requirements: AggregatedManufacturingRequirement[];
    detailedBreakdown?: CostStep[];
    manufacturingSteps?: CostStep[];
}

export interface AggregatedManufacturingRequirement {
    id: string;
    name: string;
    type: 'materiaPrima' | 'etapaFabricacao' | 'inventoryComponent' | string;
    quantity: number;
    unit: string;
    stock: number;
    shortage: number;
    familiaId?: string;
}

export interface ManufacturingTrackingStep {
    id: string;
    name: string;
    status: 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado';
    predictedCost: number;
    actualCost?: number;
    predictedTimeSeconds?: number;
    actualTimeSeconds?: number;
    quantity?: number;
    producedQuantity?: number;
    startDate?: string;
    endDate?: string;
    assignedTo?: string; // Operator or Machine
    blockedReason?: string; // Reason for blockage (Andon)
    generatedInputs?: { id: string; name: string; quantity: number }[];
}

export interface ManufacturingOrder {
    id: string;
    createdAt: string;
    status: 'pendente' | 'em_producao' | 'concluída' | 'cancelada';
    priority?: 'baixa' | 'normal' | 'alta' | 'urgente';
    type?: 'interna' | 'externa';
    startDate?: string;
    expectedDeliveryDate?: string;
    batchNumber?: string;
    supplierName?: string;
    notes?: string;
    orderItems: ManufacturingOrderItem[];
    analysis: ManufacturingAnalysis;
    predictedCost: number;
    actualCost?: number;
    actualTimeSeconds?: number;
    installments: Installment[];
    trackingSteps?: ManufacturingTrackingStep[];
    requirementsDeducted?: boolean;
}

export interface PurchaseOrder {
    id: string;
    createdAt: string;
    status: 'pendente' | 'concluída';
    items: PurchaseOrderItem[];
    expectedDeliveryDate?: string;
    supplierName?: string;
    notes?: string;
    installments: Installment[];
}

export interface PurchaseOrderItem {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
}

export interface CuttingOrder {
    id: string;
    createdAt: string;
    status: 'pendente' | 'em_andamento' | 'concluída';
    sourceComponentId: string;
    targetComponentId: string;
    scrapComponentId: string;
    quantity: number;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
}

export interface FinancialTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'receita' | 'despesa';
    category: string;
    status: 'pendente' | 'pago' | 'atrasado';
    paymentDate?: string;
    account?: string;
    relatedOrderId?: string;
    relatedOrderType?: 'purchase' | 'manufacturing' | 'sale';
}

export interface FinancialAccount {
    id: string;
    name: string;
    type: 'banco' | 'caixa' | 'cartao';
    balance: number;
}

export interface FinancialCategory {
    id: string;
    name: string;
    type: 'receita' | 'despesa';
    isFixed: boolean;
    parentCategory?: string;
}

export interface DREData {
    period: string;
    revenue: number;
    variableCosts: number;
    grossProfit: number;
    fixedCosts: number;
    ebitda: number;
    netProfit: number;
    breakdown: {
        category: string;
        amount: number;
        percentage: number;
    }[];
}

export interface FinancialSettings {
    companyName: string;
    cnpj: string;
    markup: number;
    taxRegime: 'simples' | 'presumido' | 'real';
    originUF: string;
    preferredFastenerFamiliaId?: string;
    irpj: number;
    csll: number;
    pis: number;
    cofins: number;
    ipi: number;
    icms: number;
    icmsSt: number;
    fcp: number;
    simplesNacional: number;
    simplesNacionalAnnex: string;
    salesCommission: number;
    freightCost: number;
    administrativeCost: number;
    financialCost: number;
    paymentGatewayFee: number;
    marketplaceFees: { id: string; name: string; fee: number }[];
}

export interface PromotionalCampaign {
    id: string;
    name: string;
    kitSku: string;
    startDate: string;
}

export interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details?: Record<string, any>;
}

export interface Customer {
    id: string;
    name: string;
    document?: string;
    phone?: string;
    email?: string;
    address?: string;
    createdAt: string;
    acquiredCodes?: { code: string; date: string }[];
}

export type CallStage = 'A Ligar' | 'Sem Resposta' | 'Em Contato' | 'Reunião Agendada' | 'Não Tem Interesse';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    createdAt: string;
    notes?: string;
    marketingOptIn?: boolean;
    tags?: string[];
    lastMarketingMessageAt?: string;
    callStage?: CallStage;
    lastInteractionAt?: string;
    whatsappWindowStatus?: 'open' | 'closed';
    lostDueToWindow?: boolean;
    assignedSellerId?: string;
    assignedByManagerId?: string;
}

export type DealStage = 'Novo Lead' | 'Em Contato' | 'Proposta Enviada' | 'Negociação' | 'Ganho' | 'Perdido';

export interface DealTaxDetail {
    name: string;
    value: number;
}

export interface DealVehicleDetail {
    description: string;
    code: string;
    keyCount: number;
}

export interface Deal {
    id: string;
    leadId: string;
    title: string;
    value: number;
    taxValue?: number;
    taxDetails?: DealTaxDetail[];
    shippingValue?: number;
    stage: DealStage;
    createdAt: string;
    updatedAt: string;
    expectedCloseDate?: string;
    probability?: number;
    notes?: string;
    activities?: DealActivity[];
    items?: SaleItem[];
    vehicleDetails?: DealVehicleDetail[];
    assignedSellerId?: string;
    assignedByManagerId?: string;
}

export interface DealActivity {
    id: string;
    dealId: string;
    type: 'note' | 'call' | 'email' | 'meeting' | 'whatsapp';
    description: string;
    date: string;
    userId: string;
}

export interface SupplierProductMapping {
    id: string;
    supplierCnpj: string;
    supplierProductName: string;
    supplierProductCode: string;
    internalComponentId: string;
    lastUpdated: string;
}

export interface ReceivingOrder {
    id: string;
    nfeNumber: string;
    supplierName: string;
    supplierCnpj: string;
    date: string;
    items: ReceivingItem[];
    status: 'pendente' | 'concluido' | 'parcial';
    notes?: string;
}

export interface ReceivingItem {
    id: string;
    supplierProductCode: string;
    supplierProductName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    internalComponentId?: string; // Correlated component
    inspectionStatus: 'pendente' | 'aprovado' | 'reprovado';
    inspectionNotes?: string;
    receivedQuantity?: number;
}

export interface BackupData {
    components: Component[];
    kits: Kit[];
    inventoryLogs: InventoryLog[];
    familias: FamiliaComponente[];
    purchaseOrders: PurchaseOrder[];
    poCounter: number;
    productionOrders: ProductionOrder[];
    prodCounter: number;
    manufacturingOrders: ManufacturingOrder[];
    moCounter: number;
    cuttingOrders: CuttingOrder[];
    coCounter: number;
    financialSettings: FinancialSettings;
    userRoles: UserProfile[];
    rolePermissions?: any;
    promotionalCampaigns: PromotionalCampaign[];
    activityLogs: ActivityLog[];
    customers: Customer[];
    workStations: WorkStation[];
    consumables: Consumable[];
    standardOperations: StandardOperation[];
    financialTransactions: FinancialTransaction[];
    financialAccounts: FinancialAccount[];
    financialCategories: FinancialCategory[];
    receivingOrders: ReceivingOrder[];
    supplierProductMappings: SupplierProductMapping[];
    receivingCounter: number;
    tasks?: Task[];
    leads?: Lead[];
    deals?: Deal[];
    strategies?: ServiceStrategy[];
    seeded: boolean;
    lastModified: number;
}

export interface AIAction {
    functionName: string;
    params: any;
    displayText: string;
    requiresConfirmation: boolean;
}

export interface MissingKitData {
    sku: string;
    name: string;
    csvComposition: KitComposition;
    marca: string;
    modelo: string;
    ano: string;
}

export interface KitComposition {
    components: KitComponent[];
    requiredFasteners: { dimension: string; quantity: number }[];
}

export interface SyncReport {
    createdComponents: Component[];
    updatedComponents: { id: string; name: string; oldCost: number; newCost: number }[];
    deletedComponents: Component[];
}

export interface ComponentImportData {
    Nome: string;
    SKU: string;
    familiaId: string;
    Estoque_Inicial?: number;
}

export interface StockAdjustmentImportData {
    SKU: string;
    Estoque: number;
}

export interface KitImportData {
    'Nome do Kit': string;
    SKU: string;
    Marca: string;
    Modelo: string;
    Ano: string;
    'Componentes (SKU:Qtd)': string;
    'Fixadores (Dimensao:Qtd)': string;
    'Preco de Venda (Opcional)'?: number;
}

export interface KitCostBreakdownItem {
    id?: string;
    name: string;
    sku: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    type: 'Componente' | 'Fixador' | 'Chave';
    familiaId?: string;
    familiaName?: string;
    costBreakdown?: CostStep[];
}

export interface KitCostDetails {
    totalCost: number;
    materialCost: number;
    fabricationCost: number;
    breakdown: KitCostBreakdownItem[];
    saleDetails: SaleDetails;
    keyName?: string;
    options?: {
        [key: string]: {
            totalCost: number;
            materialCost: number;
            fabricationCost: number;
            saleDetails: SaleDetails;
            keyName?: string;
            breakdown: KitCostBreakdownItem[];
        }
    };
}

export interface CostStep {
    id?: string;
    nodeId?: string;
    name: string;
    type: string;
    cost: number;
    timeSeconds?: number;
    quantity?: number;
    details?: string;
}

export interface GeneratedProduct {
    name: string;
    sku: string;
    custoMateriaPrima: number;
    custoFabricacao: number;
    costBreakdown: CostStep[];
    defaultSourcing: Component['sourcing'];
    familiaId: string;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type: Toast['type']) => void;
    removeToast: (id: string) => void;
}

export interface ABCAnalysisItem {
    componentId: string;
    name: string;
    sku: string;
    consumptionValue: number;
    cumulativePercentage: number;
    classification: 'A' | 'B' | 'C';
}

export interface ReorderPointItem {
    componentId: string;
    name: string;
    sku: string;
    currentStock: number;
    reorderPoint: number;
    dailyConsumption: number;
    suggestedOrderQty: number;
}

export interface KitDemandForecastItem {
    kitId: string;
    name: string;
    sku: string;
    pastSales: number;
    forecastNext30Days: number;
}

export interface PlanningAnalysis {
    productionPlan: ProductionRecommendation[];
    purchasePlan: PurchaseRecommendation[];
}

export interface MaterialRequirementItem {
    componentId: string;
    name: string;
    sku: string;
    type: Component['type'];
    unit: string;
    currentStock: number;
    projectedDemand: number;
    balance: number;
    status: 'ok' | 'warning' | 'critical';
    coveragePercent: number;
}

export interface DashboardWidget {
    id: string;
    title: string;
    type: 'kpi' | 'bar' | 'line' | 'pie' | 'alerts' | 'topComponents';
    metric?: KpiMetric | ChartMetric;
    dimension?: ChartDimension;
}

export interface KpiWidgetConfig extends DashboardWidget {
    type: 'kpi';
    metric: KpiMetric;
}

export interface ChartWidgetConfig extends DashboardWidget {
    type: 'bar' | 'line' | 'pie';
    dimension: ChartDimension;
    metric: ChartMetric;
}

export type KpiMetric = 'inventoryValue' | 'pendingProduction' | 'pendingManufacturing' | 'pendingPurchase';
export type ChartDimension = 'kitBrand' | 'poStatus' | 'monthYear';
export type ChartMetric = 'kitCount' | 'kitCost' | 'kitSaleValue' | 'poCount';

export interface SessionItem {
    component: Component;
    quantity: number;
}

export interface SaleItem {
    id: string;
    kitId?: string;
    componentId?: string;
    type: 'kit' | 'component';
    quantity: number;
}

export interface InventoryHook {
    components: Component[];
    kits: Kit[];
    inventoryLogs: InventoryLog[];
    isLoading: boolean;
    isDirty: boolean;
    savingStatus: 'idle' | 'saving' | 'saved';
    lastSync: number;
    isOutdated: boolean;
    autoSaveEnabled: boolean;
    setAutoSaveEnabled: (enabled: boolean) => void;
    refreshFromCloud: () => Promise<void>;
    saveChanges: () => Promise<void>;
    addComponent: (componentData: Omit<Component, 'id' | 'stock'>) => Promise<Component>;
    updateComponent: (updatedComponent: Component) => Promise<void>;
    updateMultipleComponents: (componentsToUpdate: Component[]) => Promise<void>;
    addMultipleComponents: (componentsToImport: ComponentImportData[]) => Promise<{ successCount: number; errorCount: number; }>;
    adjustStockFromImport: (adjustments: StockAdjustmentImportData[]) => Promise<{ successCount: number; errorCount: number; }>;
    deleteComponent: (componentId: string) => Promise<void>;
    addKit: (kitData: Omit<Kit, 'id'>) => Promise<Kit>;
    updateKit: (updatedKit: Kit) => Promise<void>;
    addMultipleKits: (kitsToImport: KitImportData[] | Kit[]) => Promise<{ successCount: number, errorCount: number }>;
    updateMultipleKits: (kitsToUpdate: Kit[]) => Promise<void>;
    deleteKit: (kitId: string) => Promise<void>;
    findComponentById: (id: string) => Component | undefined;
    findComponentBySku: (sku: string) => Component | undefined;
    findKitById: (id: string) => Kit | undefined;
    findKitBySku: (sku: string) => Kit | undefined;
    analyzeProductionRun: (order: ProductionOrderItem[], additionalItems: { componentId: string, quantity: number }[], familias: FamiliaComponente[], allInventoryItems: Component[], settings: FinancialSettings, headCodeToSimulate?: string) => { scenarios: ProductionScenario[], virtualComponents: Component[] };
    executeProductionRun: (order: ProductionOrder) => Promise<void>;
    recordSale: (kitId: string, quantity: number, notes?: string) => Promise<void>;
    recordMultiSale: (items: SaleItem[], notes?: string) => Promise<void>;
    addInventoryLog: (logData: Omit<InventoryLog, 'id' | 'date'>) => Promise<void>;
    addMultipleInventoryLogs: (logsData: Omit<InventoryLog, 'id' | 'date'>[]) => Promise<void>;
    getLogsForComponent: (componentId: string) => InventoryLog[];
    recalculateAllComponentCosts: (familias: FamiliaComponente[], allInventoryItems: Component[], auxiliaryData?: { ws: WorkStation[], cons: Consumable[], ops: StandardOperation[], kits: Kit[] }) => Promise<SyncReport>;
    createAndStockComponent: (componentData: { sku: string; name: string; familiaId: string; }) => Promise<void>;
    getKitsUsingComponent: (componentSku: string) => Kit[];
    getKits: () => Promise<Kit[]>;
    familias?: FamiliaComponente[];
}

export interface ManufacturingHook {
    familias: FamiliaComponente[];
    activeFamiliaId: string | null;
    setActiveFamiliaId: (id: string | null) => void;
    getActiveFamilia: () => FamiliaComponente | undefined;
    addFamilia: (nome: string, type: 'simple' | 'generator', category: ProcessCategory, templateData?: any) => Promise<void>;
    updateFamiliaName: (id: string, nome: string) => Promise<void>;
    deleteFamilia: (id: string) => Promise<void>;
    duplicateFamilia: (id: string) => Promise<void>;
    saveMultipleFamilias: (f: FamiliaComponente[]) => Promise<void>;
    addNode: (familiaId: string, type: string, position: { x: number; y: number }, operationId?: string) => void;
    updateNodeLabel: (fid: string, nid: string, label: string) => void;
    updateNodeCost: (fid: string, nid: string, cost: number | string) => void;
    updateNodeMaterialDetails: (fid: string, nid: string, details: any, components: Component[]) => void;
    updateNodeComponentDetails: (fid: string, nid: string, details: any, components: Component[]) => void;
    updateNodeGenerationConfig: (fid: string, nid: string, config: Partial<GenerationConfig>) => void;
    updateNodeOperationDetails: (fid: string, nid: string, details: any) => void;
    updateNodeMappingMode: (fid: string, nid: string, mode: 'thread' | 'diameter') => void;
    deleteNode: (fid: string, nid: string) => void;
    duplicateNode: (fid: string, nid: string) => void;
    onNodesChange: (familiaId: string) => (changes: any) => void;
    onEdgesChange: (familiaId: string) => (changes: any) => void;
    onConnect: (familiaId: string) => (connection: any) => void;
    addDimension: (familiaId: string, nodeId: string) => void;
    updateDimension: (fid: string, nid: string, did: string, d: any) => void;
    deleteDimension: (fid: string, nid: string, did: string) => void;
    updateDimensions: (fid: string, nid: string, dims: ProcessDimension[]) => void;
    addHeadCode: (familiaId: string, nodeId: string, code?: string) => void;
    updateHeadCode: (familiaId: string, nodeId: string, headCodeId: string, data: any) => void;
    deleteHeadCode: (familiaId: string, nodeId: string, headCodeId: string) => void;
    updateHeadCodes: (fid: string, nid: string, codes: ProcessHeadCode[]) => void;
    disconnectHandle: (fid: string, nid: string, handleId: string) => void;
    getAllUniqueHeadCodes: () => string[];
    analyzeManufacturingRun: (order: ManufacturingOrderItem[], allComponents: Component[], virtualComponents?: Component[]) => ManufacturingAnalysis;
    workStations: WorkStation[];
    consumables: Consumable[];
    standardOperations: StandardOperation[];
    saveWorkStations: (ws: WorkStation[]) => Promise<void>;
    saveConsumables: (c: Consumable[]) => Promise<void>;
    saveOperations: (op: StandardOperation[]) => Promise<void>;
    isLoading: boolean;
    isDirty: boolean;
    savingStatus: 'idle' | 'saving' | 'saved';
    lastSync: number;
    isOutdated: boolean;
    refreshFromCloud: () => Promise<void>;
    saveChanges: () => Promise<void>;
    autoSaveEnabled: boolean;
    setAutoSaveEnabled: (enabled: boolean) => void;
}

export interface ProductionOrdersHook {
    productionOrders: ProductionOrder[];
    isLoading: boolean;
    addProductionOrder: (data: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>) => Promise<string | null>;
    updateProductionOrderStatus: (orderId: string, status: ProductionOrder['status']) => Promise<void>;
    updateMultipleProductionOrders: (ordersToUpdate: ProductionOrder[]) => Promise<void>;
    updateScannedItems: (orderId: string, scannedItems: Record<string, number>) => Promise<void>;
    updateOrderFulfillment: (orderId: string, updates: { scannedItems: Record<string, number>; substitutions: Record<string, { substitutedWithId: string; quantity: number; }> }) => Promise<void>;
    deleteProductionOrder: (orderId: string) => Promise<void>;
    updateProductionOrderInstallments: (orderId: string, installments: Installment[]) => Promise<void>;
    updateProductionOrderTracking: (orderId: string, tracking: { actualCost?: number; actualTimeSeconds?: number }) => Promise<void>;
}

export interface PurchaseOrdersHook {
    purchaseOrders: PurchaseOrder[];
    isLoading: boolean;
    addPurchaseOrder: (recommendations: PurchaseRecommendation[], expectedDeliveryDate: string) => Promise<string | null>;
    savePurchaseOrder: (order: PurchaseOrder) => Promise<void>;
    updateOrderStatus: (orderId: string, status: PurchaseOrder['status']) => Promise<void>;
    updateMultiplePurchaseOrders: (ordersToUpdate: PurchaseOrder[]) => Promise<void>;
    updatePurchaseOrderInstallments: (orderId: string, installments: Installment[]) => Promise<void>;
    deletePurchaseOrder: (orderId: string) => Promise<void>;
}

export interface ManufacturingOrdersHook {
    manufacturingOrders: ManufacturingOrder[];
    isLoading: boolean;
    addManufacturingOrder: (orderItems: ManufacturingOrderItem[], analysis: ManufacturingAnalysis, extraData?: Partial<ManufacturingOrder>) => Promise<string | null>;
    updateManufacturingOrderStatus: (orderId: string, status: ManufacturingOrder['status']) => Promise<void>;
    updateMultipleManufacturingOrders: (ordersToUpdate: ManufacturingOrder[]) => Promise<void>;
    updateManufacturingOrderInstallments: (orderId: string, installments: Installment[]) => Promise<void>;
    updateManufacturingOrderAnalysis: (orderId: string, analysis: ManufacturingAnalysis) => Promise<void>;
    updateManufacturingOrderTracking: (orderId: string, tracking: { actualCost?: number; actualTimeSeconds?: number }) => Promise<void>;
    updateManufacturingOrder: (orderId: string, updates: Partial<ManufacturingOrder>) => Promise<void>;
    updateManufacturingOrderItemStatus: (orderId: string, componentId: string, status: ManufacturingOrderItem['status']) => Promise<void>;
    updateManufacturingOrderItems: (orderId: string, orderItems: ManufacturingOrderItem[]) => Promise<void>;
    finalizeManufacturingItemInspection: (orderId: string, componentId: string, approvedQuantity: number, rejectedQuantity: number) => Promise<void>;
    deleteManufacturingOrder: (orderId: string) => Promise<void>;
}

export interface CuttingOrdersHook {
    cuttingOrders: CuttingOrder[];
    isLoading: boolean;
    addCuttingOrder: (sourceId: string, targetId: string, quantity: number) => Promise<string | null>;
    startCuttingOrder: (orderId: string, scannedSourceId: string) => Promise<boolean>;
    finishCuttingOrder: (orderId: string, scannedTargetId: string) => Promise<boolean>;
    addMultipleCuttingOrders: (recommendations: CuttingRecommendation[]) => Promise<void>;
    updateCuttingOrder: (orderId: string, updates: Partial<Pick<CuttingOrder, 'quantity'>>) => Promise<void>;
    updateMultipleCuttingOrders: (ordersToUpdate: CuttingOrder[]) => Promise<void>;
    deleteCuttingOrder: (orderId: string) => Promise<void>;
}

export interface PurchasePlannerHook {
    isLoading: boolean;
    cuttingRecommendations: CuttingRecommendation[];
    productionPlan: ProductionRecommendation[];
    purchasePlan: PurchaseRecommendation[];
    rawMaterialForecast: RawMaterialForecastItem[];
    generateCuttingOrders: (recommendations: CuttingRecommendation[]) => Promise<void>;
    generateManufacturingOrders: (recommendations: ProductionRecommendation[]) => Promise<void>;
    generatePurchaseOrders: (recommendations: PurchaseRecommendation[]) => Promise<void>;
}

export interface InventoryAnalysisHook {
    abcAnalysis: ABCAnalysisItem[];
    kitDemandForecast: KitDemandForecastItem[];
    reorderPointAlerts: ReorderPointItem[];
    planningAnalysis: PlanningAnalysis;
    materialRequirements: MaterialRequirementItem[];
}

export interface ActivityLogHook {
    activityLogs: ActivityLog[];
    addActivityLog: (action: string, details?: Record<string, any>) => Promise<void>;
    isLoading: boolean;
}

export interface AIWorkerViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    plannerHook: PurchasePlannerHook;
}

export interface AllDashboardProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    cuttingOrdersHook: CuttingOrdersHook;
    plannerHook: PurchasePlannerHook;
    setCurrentView: (view: View) => void;
}

export interface CustomersHook {
    customers: Customer[];
    isLoading: boolean;
    addCustomer: (customerData: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer | null>;
    updateCustomer: (updatedCustomer: Customer) => Promise<void>;
    updateMultipleCustomers: (customersToUpdate: Customer[]) => Promise<void>;
    deleteCustomer: (customerId: string) => Promise<void>;
    findCustomerById: (id: string) => Customer | undefined;
}
