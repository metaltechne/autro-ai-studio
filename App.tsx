
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OperationalDashboard } from './components/OperationalDashboard';
import { ComponentsView } from './components/ComponentsView';
import { KitsView } from './components/KitsView';
import { KitsByBrandView } from './components/KitsByBrandView';
import { useInventory } from './hooks/useInventory';
import { useManufacturing } from './hooks/useManufacturing';
import { SmartAssistant } from './components/SmartAssistant';
import { View, ScannedQRCodeData, UserRole, PromotionalCampaign } from './types';
import { AssemblyView } from './components/AssemblyView';
import { ManufacturingView } from './components/ManufacturingView';
import { RawMaterialsView } from './components/RawMaterialsView';
import { usePurchaseOrders } from './hooks/usePurchaseOrders';
import { ProductionOrdersView } from './components/ProductionOrdersView';
import { useAuth } from './contexts/AuthContext';
import { useProductionOrders } from './hooks/useProductionOrders';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { ManufacturingPlannerView } from './components/ManufacturingPlannerView';
import { useManufacturingOrders } from './hooks/useManufacturingOrders';
import { ManufacturingStructureView } from './components/ManufacturingStructureView';
import { ProductionFinancialFlowView } from './components/ProductionFinancialFlowView';
import { QRCodeScannerModal } from './components/ui/QRCodeScannerModal';
import { TechnicalSheetModal } from './components/ui/TechnicalSheetModal';
import { QRCodeDisplayModal } from './components/ui/QRCodeDisplayModal';
import { InventoryAnalysisView } from './components/InventoryAnalysisView';
import { ToastProvider } from './contexts/ToastContext';
import { useToast } from './hooks/useToast';
import { SettingsView } from './components/SettingsView';
import { PurchaseProductionPlanningView } from './components/PurchaseProductionPlanningView';
import { ActionItem, SpeedDial } from './components/ui/SpeedDial';
import { PaymentCalendarView } from './components/PaymentCalendarView';
import { FinancialsProvider, useFinancials } from './contexts/FinancialsContext';
import { LabelPrintingView } from './components/LabelPrintingView';
import { StockMovementView } from './components/StockMovementView';
import { OrderVerificationView } from './components/OrderVerificationView';
import { SpreadsheetView } from './components/SpreadsheetView';
import { ManufacturingOrdersView } from './components/ManufacturingOrdersView';
import { BottomNavBar } from './components/BottomNavBar';
import { MobileMenuView } from './components/MobileMenuView';
import { ActivityLogProvider, useActivityLog } from './contexts/ActivityLogContext';
import { AIWorkerView } from './components/AIWorkerView';
import { ActivityLogView } from './components/ActivityLogView';
import { DocumentScannerView } from './components/DocumentScannerView';
import { FastenerCuttingView } from './components/FastenerCuttingView';
import { useCuttingOrders } from './hooks/useCuttingOrders';
import { KitDetailView } from './components/KitDetailView';
import { OperatorMode } from './components/manufacturing/OperatorMode';
import { FinancialDashboardView } from './components/FinancialDashboardView';
import { SalesSimulatorView } from './components/SalesSimulatorView';
import { UserManagementView } from './components/UserManagementView';
import { usePurchasePlanner } from './hooks/usePurchasePlanner';
import { useProactiveAI } from './hooks/useProactiveAI';
import { SectorDashboard } from './components/dashboards/SectorDashboard';
import { SalesOrderImportView } from './components/SalesOrderImportView';
import { PricingSimulatorView } from './components/PricingSimulatorView';
import { LoginView } from './components/LoginView';
import * as api from './hooks/api';
import { CuttingOrdersView } from './components/CuttingOrdersView';
import { useCustomers } from './hooks/useCustomers';
import { CustomersView } from './components/CustomersView';
import { SyncConflictModal } from './components/SyncConflictModal';
import { MONTAGEM_CHAVE_S_FAMILIA, CORPO_CHAVE_PITO_FAMILIA, MONTAGEM_CHAVE_PITO_S_FAMILIA } from './data/initial-inventory';


const AppLoader: React.FC<{message?: string}> = ({ message = 'Carregando...' }) => (
    <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg text-gray-600">{message}</p>
        </div>
    </div>
);

// This component holds the main application logic and UI.
// It is only rendered AFTER authentication, DB init, and all data hooks are ready.
const MainApplication: React.FC = () => {
    const { role, user } = useAuth();
    const { isLoading: financialsLoading } = useFinancials();
    const { isLoading: activityLogLoading } = useActivityLog();
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const [currentView, setCurrentView] = useState<View>(View.SECTOR_DASHBOARD);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [scannedData, setScannedData] = useState<ScannedQRCodeData | null>(null);
    const [qrCodeToDisplay, setQrCodeToDisplay] = useState<{ title: string; data: ScannedQRCodeData } | null>(null);
    const [componentFilter, setComponentFilter] = useState<{ type: 'low-stock' } | null>(null);
    const [isOperatorModeOpen, setIsOperatorModeOpen] = useState(false);
    const { addToast } = useToast();
    const [detailedKitId, setDetailedKitId] = useState<string | null>(null);
    const [promotionalCampaigns, setPromotionalCampaigns] = useState<PromotionalCampaign[]>([]);
    
    // All data hooks are instantiated here.
    const inventory = useInventory();
    const manufacturing = useManufacturing();
    const purchaseOrdersHook = usePurchaseOrders({ addMultipleInventoryLogs: inventory.addMultipleInventoryLogs, inventoryHook: inventory });
    const productionOrdersHook = useProductionOrders({ executeProductionRun: inventory.executeProductionRun });
    const manufacturingOrdersHook = useManufacturingOrders({ addMultipleInventoryLogs: inventory.addMultipleInventoryLogs });
    const cuttingOrdersHook = useCuttingOrders({ inventoryHook: inventory });
    const plannerHook = usePurchasePlanner(inventory, manufacturing, productionOrdersHook, manufacturingOrdersHook, purchaseOrdersHook, cuttingOrdersHook);
    const customersHook = useCustomers();
    
    // This is the single, unified data loading check.
    const isDataLoading = inventory.isLoading || manufacturing.isLoading || purchaseOrdersHook.isLoading || productionOrdersHook.isLoading || manufacturingOrdersHook.isLoading || cuttingOrdersHook.isLoading || plannerHook.isLoading || customersHook.isLoading || financialsLoading || activityLogLoading;

    useEffect(() => {
        const fetchCampaigns = async () => {
            const campaignsData = await api.getPromotionalCampaigns();
            setPromotionalCampaigns(campaignsData);
        };
        if (!isDataLoading) {
            fetchCampaigns();
        }
    }, [isDataLoading]);

    // Welcome Toast Effect
    useEffect(() => {
        if (!isDataLoading && user) {
            const hasGreeted = sessionStorage.getItem('autro_welcome_shown');
            if (!hasGreeted) {
                const name = user.email ? user.email.split('@')[0] : 'Usuário';
                const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                addToast(`Olá, ${formattedName}! O sistema está pronto.`, 'success');
                sessionStorage.setItem('autro_welcome_shown', 'true');
            }
        }
    }, [isDataLoading, user, addToast]);

    useProactiveAI({ inventory, productionOrdersHook, manufacturingOrdersHook, manufacturing, addToast });

    const initialCostSyncDone = useRef(false);
    useEffect(() => {
        if (!isDataLoading && !initialCostSyncDone.current && inventory.components.length > 0 && manufacturing.familias.length > 0) {
            initialCostSyncDone.current = true;
            inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components);
        }
    }, [isDataLoading, inventory, manufacturing]);

    // Final loading gate before rendering the UI
    useEffect(() => {
        const injectCorpoUsinado = async () => {
            if (isDataLoading) return;
            
            const comps = await api.getComponents();
            const fams = await api.getFamilias();
            
            let changedComps = false;
            let changedFams = false;

            // Remove duplicate families that might have been created by the infinite loop bug
            const uniqueFams: any[] = [];
            const famIds = new Set();
            for (const f of fams) {
                if (!famIds.has(f.id)) {
                    uniqueFams.push(f);
                    famIds.add(f.id);
                } else {
                    changedFams = true;
                }
            }
            // Re-assign fams to uniqueFams
            fams.length = 0;
            fams.push(...uniqueFams);

            const newComps = [...comps];
            
            const barra15 = { id: 'comp-RM-BARRA-15-8', name: 'Barra de Aço 15.8mm (6m)', sku: 'RM-BARRA-15.8', type: 'raw_material', stock: 100, purchaseCost: 50.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6, sourcing: 'purchased' };
            const barra19 = { id: 'comp-RM-BARRA-19-05', name: 'Barra de Aço 19.05mm (6m)', sku: 'RM-BARRA-19.05', type: 'raw_material', stock: 100, purchaseCost: 70.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6, sourcing: 'purchased' };
            const barra22 = { id: 'comp-RM-BARRA-22-22', name: 'Barra de Aço 22.22mm (6m)', sku: 'RM-BARRA-22.22', type: 'raw_material', stock: 100, purchaseCost: 90.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6, sourcing: 'purchased' };

            if (!comps.find(c => c.id === 'comp-RM-BARRA-15-8')) { newComps.push(barra15 as any); changedComps = true; }
            if (!comps.find(c => c.id === 'comp-RM-BARRA-19-05')) { newComps.push(barra19 as any); changedComps = true; }
            if (!comps.find(c => c.id === 'comp-RM-BARRA-22-22')) { newComps.push(barra22 as any); changedComps = true; }

            if (changedComps) {
                await api.saveComponents(newComps);
            }

            if (!fams.find(f => f.id === 'fam-CORPO-USINADO')) {
                const newFam = {
                    id: 'fam-CORPO-USINADO',
                    nome: 'Usinagem Corpo Usinado',
                    type: 'corpo_usinado',
                    sourcing: 'manufactured',
                    category: 'manufacturing',
                    nodes: [
                        { id: 'n-dna-cu', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: [
                            { id: 'dim-cu-5', bitola: 5, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-15-8', consumption: 0.05 },
                            { id: 'dim-cu-6', bitola: 6, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-15-8', consumption: 0.05 },
                            { id: 'dim-cu-8', bitola: 8, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-19-05', consumption: 0.05 },
                            { id: 'dim-cu-10', bitola: 10, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-22-22', consumption: 0.05 },
                            { id: 'dim-cu-12', bitola: 12, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-22-22', consumption: 0.05 }
                        ] }, position: { x: 100, y: 100 } },
                        { id: 'n-mat-cu', type: 'materialMappingNode', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: [
                            { id: 'dim-cu-5', bitola: 5, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-15-8', consumption: 0.05 },
                            { id: 'dim-cu-6', bitola: 6, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-15-8', consumption: 0.05 },
                            { id: 'dim-cu-8', bitola: 8, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-19-05', consumption: 0.05 },
                            { id: 'dim-cu-10', bitola: 10, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-22-22', consumption: 0.05 },
                            { id: 'dim-cu-12', bitola: 12, comprimento: 0, baseMaterialId: 'comp-RM-BARRA-22-22', consumption: 0.05 }
                        ] }, position: { x: 300, y: 100 } },
                        { id: 'n-cod-cu', type: 'codificationTableNode', data: { label: 'Tipo de Corpo', cost: 0, type: 'codificationTable', headCodes: [
                            { id: 'hc-fix-p', code: 'FIX-P' },
                            { id: 'hc-por-p', code: 'POR-P' }
                        ] }, position: { x: 300, y: 250 } },
                        { id: 'n-usinagem-cu', type: 'etapaFabricacaoNode', data: { label: 'Usinagem CNC', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
                        { id: 'n-gen-cu', type: 'productGeneratorNode', data: { label: 'Gerador Corpo Usinado', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Corpo Usinado {headCode} M{bitola}', skuTemplate: 'CORPO-USIN-{headCode}-M{bitola}' } }, position: { x: 700, y: 100 } },
                    ],
                    edges: [
                        { id: 'e-dna-mat-cu', source: 'n-dna-cu', target: 'n-mat-cu', type: 'dataEdge' },
                        { id: 'e-dna-cod-cu', source: 'n-dna-cu', target: 'n-cod-cu', type: 'dataEdge' },
                        { id: 'e-mat-usinagem-cu', source: 'n-mat-cu', target: 'n-usinagem-cu', type: 'dataEdge' },
                        { id: 'e-cod-usinagem-cu', source: 'n-cod-cu', target: 'n-usinagem-cu', type: 'dataEdge' },
                        { id: 'e-usinagem-gen-cu', source: 'n-usinagem-cu', target: 'n-gen-cu', type: 'dataEdge' }
                    ]
                };
                fams.push(newFam as any);
                changedFams = true;
            }

            // Inject Montagem FIX-S
            if (!fams.find(f => f.id === 'fam-MONTAGEM-FIX-S')) {
                const newFamS = {
                    id: 'fam-MONTAGEM-FIX-S',
                    nome: 'Montagem FIX-S',
                    type: 'fix_s',
                    sourcing: 'manufactured',
                    category: 'manufacturing',
                    nodes: [
                        { id: 'n-inv-moeda-s', type: 'inventoryComponent', data: { label: 'Moeda FIX-S', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-S-22.22-{headCode}', sourceFamiliaId: 'fam-FIX-S' }, position: { x: 100, y: 100 } },
                        { id: 'n-inv-par-s', type: 'inventoryComponent', data: { label: 'Parafuso Usinado', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'PAR-USIN-FIX-S-M{bitola}X{comprimento}', sourceFamiliaId: 'fam-USINAGEM-PARAFUSO' }, position: { x: 100, y: 300 } },
                        { id: 'n-solda-s', type: 'etapaFabricacaoNode', data: { label: 'Solda Inox', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 200 } },
                        { id: 'n-gen-mont-s', type: 'productGeneratorNode', data: { label: 'Gerador FIX-S', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'FIX-S {headCode} M{bitola}x{comprimento}', skuTemplate: 'FIX-S-{headCode}-M{bitola}X{comprimento}' } }, position: { x: 700, y: 200 } },
                    ],
                    edges: [
                        { id: 'e-moeda-solda-s', source: 'n-inv-moeda-s', target: 'n-solda-s', type: 'dataEdge' },
                        { id: 'e-par-solda-s', source: 'n-inv-par-s', target: 'n-solda-s', type: 'dataEdge' },
                        { id: 'e-solda-gen-s', source: 'n-solda-s', target: 'n-gen-mont-s', type: 'dataEdge' }
                    ]
                };
                fams.push(newFamS as any);
                changedFams = true;
            }

            // Inject Montagem FIX-P
            if (!fams.find(f => f.id === 'fam-MONTAGEM-FIX-P')) {
                const newFamP = {
                    id: 'fam-MONTAGEM-FIX-P',
                    nome: 'Montagem FIX-P',
                    type: 'fix_p',
                    sourcing: 'manufactured',
                    category: 'manufacturing',
                    nodes: [
                        { id: 'n-inv-moeda-p', type: 'inventoryComponent', data: { label: 'Moeda FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-P-{diametro}-{headCode}', sourceFamiliaId: 'fam-FIX-P' }, position: { x: 100, y: 50 } },
                        { id: 'n-inv-corpo-p', type: 'inventoryComponent', data: { label: 'Corpo Usinado FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'CORPO-USIN-FIX-P-M{bitola}', sourceFamiliaId: 'fam-CORPO-USINADO' }, position: { x: 100, y: 200 } },
                        { id: 'n-inv-barra-p', type: 'inventoryComponent', data: { label: 'Barra Usinada', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'BARRA-USIN-FIX-P-M{bitola}X{comprimento}', sourceFamiliaId: 'fam-USINAGEM-BARRA' }, position: { x: 100, y: 350 } },
                        { id: 'n-solda-p1', type: 'etapaFabricacaoNode', data: { label: 'Solda Moeda+Corpo', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 100 } },
                        { id: 'n-solda-p2', type: 'etapaFabricacaoNode', data: { label: 'Solda Corpo+Barra', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 300 } },
                        { id: 'n-gen-mont-p', type: 'productGeneratorNode', data: { label: 'Gerador FIX-P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'FIX-P {headCode} M{bitola}x{comprimento}', skuTemplate: 'FIX-P-{headCode}-M{bitola}X{comprimento}' } }, position: { x: 700, y: 200 } },
                    ],
                    edges: [
                        { id: 'e-moeda-solda-p1', source: 'n-inv-moeda-p', target: 'n-solda-p1', type: 'dataEdge' },
                        { id: 'e-corpo-solda-p1', source: 'n-inv-corpo-p', target: 'n-solda-p1', type: 'dataEdge' },
                        { id: 'e-solda-p1-p2', source: 'n-solda-p1', target: 'n-solda-p2', type: 'dataEdge' },
                        { id: 'e-barra-solda-p2', source: 'n-inv-barra-p', target: 'n-solda-p2', type: 'dataEdge' },
                        { id: 'e-solda-gen-p', source: 'n-solda-p2', target: 'n-gen-mont-p', type: 'dataEdge' }
                    ]
                };
                fams.push(newFamP as any);
                changedFams = true;
            }

            // Inject Montagem POR-P
            if (!fams.find(f => f.id === 'fam-MONTAGEM-POR-P')) {
                const getDiametro = (bitola: number) => {
                    if (bitola <= 6) return 15.8;
                    if (bitola === 8) return 19.05;
                    return 22.22;
                };
                const dimsPor = [
                    { id: 'dim-m5-0', bitola: 5, comprimento: 0 },
                    { id: 'dim-m6-0', bitola: 6, comprimento: 0 },
                    { id: 'dim-m8-0', bitola: 8, comprimento: 0 },
                    { id: 'dim-m10-0', bitola: 10, comprimento: 0 },
                    { id: 'dim-m12-0', bitola: 12, comprimento: 0 }
                ].map(d => ({ ...d, diametro: getDiametro(d.bitola) }));
                const newFamPor = {
                    id: 'fam-MONTAGEM-POR-P',
                    nome: 'Montagem POR-P',
                    type: 'por_p',
                    sourcing: 'manufactured',
                    category: 'manufacturing',
                    nodes: [
                        { id: 'n-dna-mont-por', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: dimsPor }, position: { x: 100, y: 100 } },
                        { id: 'n-inv-moeda-por', type: 'inventoryComponent', data: { label: 'Moeda FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-P-{diametro}-{headCode}', sourceFamiliaId: 'fam-FIX-P' }, position: { x: 100, y: 300 } },
                        { id: 'n-inv-corpo-por', type: 'inventoryComponent', data: { label: 'Corpo Usinado POR-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'CORPO-USIN-POR-P-M{bitola}', sourceFamiliaId: 'fam-CORPO-USINADO' }, position: { x: 100, y: 500 } },
                        { id: 'n-solda-por', type: 'etapaFabricacaoNode', data: { label: 'Solda Inox', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 400 } },
                        { id: 'n-gen-mont-por', type: 'productGeneratorNode', data: { label: 'Gerador POR-P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'POR-P {headCode} M{bitola}', skuTemplate: 'POR-P-{headCode}-M{bitola}' } }, position: { x: 700, y: 400 } },
                    ],
                    edges: [
                        { id: 'e-moeda-solda-por', source: 'n-inv-moeda-por', target: 'n-solda-por', type: 'dataEdge' },
                        { id: 'e-corpo-solda-por', source: 'n-inv-corpo-por', target: 'n-solda-por', type: 'dataEdge' },
                        { id: 'e-solda-gen-por', source: 'n-solda-por', target: 'n-gen-mont-por', type: 'dataEdge' }
                    ]
                };
                fams.push(newFamPor as any);
                changedFams = true;
            }

            // Inject Chave T (FIX-S)
            if (!fams.find(f => f.id === 'fam-chave-t-s')) {
                fams.push(MONTAGEM_CHAVE_S_FAMILIA as any);
                changedFams = true;
            }

            // Inject Corpo Chave Pito
            if (!fams.find(f => f.id === 'fam-CORPO-CHAVE-PITO')) {
                fams.push(CORPO_CHAVE_PITO_FAMILIA as any);
                changedFams = true;
            }

            // Inject Chave Pito (FIX-S)
            if (!fams.find(f => f.id === 'fam-chave-pito-s')) {
                fams.push(MONTAGEM_CHAVE_PITO_S_FAMILIA as any);
                changedFams = true;
            }

            if (changedFams) {
                await api.saveFamilias(fams);
            }

            if (changedComps || changedFams) {
                window.location.reload();
            }
        };
        injectCorpoUsinado();
    }, [isDataLoading]);

    if (isDataLoading) {
        return <AppLoader message="Carregando dados da empresa..." />;
    }

    const onScanSuccess = (decodedText: string) => {
        try {
            const data = JSON.parse(decodedText) as ScannedQRCodeData;
            if (data && data.type && data.id) {
                setScannedData(data);
            } else {
                addToast("QR Code inválido.", 'error');
            }
        } catch (e) {
            console.error("Invalid QR code data", e);
            addToast("QR Code inválido ou não pertence a este sistema.", 'error');
        }
    };

    const clearComponentFilter = () => setComponentFilter(null);
    const handleViewKitDetails = (kitId: string) => {
        setDetailedKitId(kitId);
        setCurrentView(View.KIT_DETAILS);
    };

    const ProtectedView: React.FC<{ children: React.ReactNode, allowedRoles: UserRole[] }> = ({ children, allowedRoles }) => {
        if (role && allowedRoles.includes(role)) {
            return <>{children}</>;
        }
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold text-red-600">Acesso Negado</h2>
                <p className="text-gray-600 mt-2">Você não tem permissão para acessar esta página.</p>
            </div>
        );
    };

    const viewMap: { [key in View]?: React.ReactNode } = {
        [View.SECTOR_DASHBOARD]: <SectorDashboard inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} productionOrdersHook={productionOrdersHook} cuttingOrdersHook={cuttingOrdersHook} plannerHook={plannerHook} />,
        [View.OPERATIONAL_DASHBOARD]: <OperationalDashboard inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} setComponentFilter={setComponentFilter} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} productionOrdersHook={productionOrdersHook} promotionalCampaigns={promotionalCampaigns} isMobile={isMobile} setIsOperatorModeOpen={setIsOperatorModeOpen} />,
        [View.FINANCIAL_DASHBOARD]: <FinancialDashboardView inventory={inventory} purchaseOrdersHook={purchaseOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} manufacturing={manufacturing} />,
        [View.COMPONENTS]: <ComponentsView inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} initialFilter={componentFilter} onClearFilter={clearComponentFilter} />,
        [View.KITS]: <KitsView inventory={inventory} manufacturing={manufacturing} onShowQRCode={setQrCodeToDisplay} onViewDetails={handleViewKitDetails} />,
        [View.KIT_DETAILS]: detailedKitId && <KitDetailView kitId={detailedKitId} inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} />,
        [View.KITS_BY_BRAND]: <KitsByBrandView inventory={inventory} manufacturing={manufacturing} />,
        [View.MANUFACTURING]: <ManufacturingView manufacturing={manufacturing} inventory={inventory} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} mode="all" />,
        [View.RAW_MATERIALS]: <RawMaterialsView inventory={inventory} onShowQRCode={setQrCodeToDisplay} />,
        [View.PRODUCTION_PLANNER]: <AssemblyView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} setCurrentView={setCurrentView} createAndStockComponent={inventory.createAndStockComponent} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} />,
        [View.PRODUCTION_ORDERS]: <ProductionOrdersView productionOrdersHook={productionOrdersHook} purchaseOrdersHook={purchaseOrdersHook} inventory={inventory} createAndStockComponent={inventory.createAndStockComponent} customersHook={customersHook} />,
        [View.PURCHASE_ORDERS]: <PurchaseOrdersView purchaseOrdersHook={purchaseOrdersHook} inventory={inventory} />,
        [View.MANUFACTURING_PLANNER]: <ManufacturingPlannerView manufacturing={manufacturing} inventory={inventory} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} setCurrentView={setCurrentView} />,
        [View.MANUFACTURING_ORDERS]: <ManufacturingOrdersView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} />,
        [View.MANUFACTURING_STRUCTURE]: <ManufacturingStructureView manufacturing={manufacturing} />,
        [View.PRODUCTION_FINANCIAL_FLOW]: <ProductionFinancialFlowView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} manufacturing={manufacturing} />,
        [View.INVENTORY_ANALYSIS]: <InventoryAnalysisView inventory={inventory} productionOrdersHook={productionOrdersHook} manufacturing={manufacturing} />,
        [View.PURCHASE_PRODUCTION_PLANNING]: <PurchaseProductionPlanningView plannerHook={plannerHook} inventory={inventory} />,
        [View.SETTINGS]: <ProtectedView allowedRoles={['Admin']}><SettingsView inventory={inventory} manufacturing={manufacturing} campaigns={promotionalCampaigns} /></ProtectedView>,
        [View.PAYMENT_CALENDAR]: <PaymentCalendarView manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} inventory={inventory} />,
        [View.LABEL_PRINTING]: <LabelPrintingView inventory={inventory} />,
        [View.STOCK_MOVEMENT]: <StockMovementView inventory={inventory} />,
        [View.ORDER_VERIFICATION]: <OrderVerificationView productionOrdersHook={productionOrdersHook} inventory={inventory} />,
        [View.SPREADSHEETS]: <SpreadsheetView 
            inventory={inventory} 
            manufacturing={manufacturing} 
            customersHook={customersHook}
            purchaseOrdersHook={purchaseOrdersHook}
            productionOrdersHook={productionOrdersHook}
            manufacturingOrdersHook={manufacturingOrdersHook}
            cuttingOrdersHook={cuttingOrdersHook}
            setCurrentView={setCurrentView} 
        />,
        [View.AI_WORKER]: <AIWorkerView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} plannerHook={plannerHook} />,
        [View.ACTIVITY_LOG]: <ActivityLogView />,
        [View.DOCUMENT_SCANNER]: <DocumentScannerView purchaseOrdersHook={purchaseOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} />,
        [View.FASTENER_CUTTING]: <FastenerCuttingView inventory={inventory} cuttingOrdersHook={cuttingOrdersHook} />,
        [View.CUTTING_ORDERS]: <CuttingOrdersView cuttingOrdersHook={cuttingOrdersHook} inventory={inventory} setCurrentView={setCurrentView} />,
        [View.SALES_SIMULATOR]: <SalesSimulatorView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} setCurrentView={setCurrentView} isMobile={isMobile} />,
        [View.USER_MANAGEMENT]: <ProtectedView allowedRoles={['Admin']}><UserManagementView /></ProtectedView>,
        [View.SALES_ORDER_IMPORT]: <SalesOrderImportView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} setCurrentView={setCurrentView} customersHook={customersHook} purchaseOrdersHook={purchaseOrdersHook} />,
        [View.PRICING_SIMULATOR]: <PricingSimulatorView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} />,
        [View.CUSTOMERS]: <CustomersView customersHook={customersHook} productionOrdersHook={productionOrdersHook} inventory={inventory} />,
    };

    const speedDialActions: ActionItem[] = [
        {
            label: "Modo Operador",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
            onClick: () => setIsOperatorModeOpen(true),
        },
        {
            label: "Assistente IA",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
            onClick: () => setIsAssistantOpen(true),
        },
        {
            label: "Escanear QR Code",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
            onClick: () => setIsScannerOpen(true),
        },
    ];

    return (
        <div className="relative flex h-screen bg-transparent font-sans">
            {isOperatorModeOpen ? (
                <OperatorMode 
                    manufacturingOrdersHook={manufacturingOrdersHook}
                    inventory={inventory}
                    workStations={manufacturing.workStations}
                    onClose={() => setIsOperatorModeOpen(false)}
                />
            ) : (
                <>
                    <Sidebar currentView={currentView} setCurrentView={setCurrentView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header currentView={currentView} />
                        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
                            {viewMap[currentView] || viewMap[View.SECTOR_DASHBOARD]}
                        </main>
                    </div>
                </>
            )}
            <SmartAssistant inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} plannerHook={plannerHook} isOpen={isAssistantOpen} setIsOpen={setIsAssistantOpen} />
            <SpeedDial actions={speedDialActions} isMobile={isMobile} />
            {isScannerOpen && <QRCodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={onScanSuccess} />}
            {scannedData && <TechnicalSheetModal isOpen={!!scannedData} onClose={() => setScannedData(null)} scannedData={scannedData} inventory={inventory} manufacturing={manufacturing} />}
            {qrCodeToDisplay && <QRCodeDisplayModal isOpen={!!qrCodeToDisplay} onClose={() => setQrCodeToDisplay(null)} title={qrCodeToDisplay.title} data={qrCodeToDisplay.data} />}
            <BottomNavBar currentView={currentView} setCurrentView={setCurrentView} onOpenMenu={() => setIsMobileMenuOpen(true)} />
            <MobileMenuView isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} currentView={currentView} setCurrentView={setCurrentView} />
        </div>
    );
};


// This component acts as a gatekeeper for authentication and database initialization.
const AppContent: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [dbStatus, setDbStatus] = useState<'initializing' | 'conflict' | 'ready'>('initializing');
    const [conflictDetails, setConflictDetails] = useState<{ localDate: Date, firebaseDate: Date } | null>(null);

    useEffect(() => {
        let isMounted = true;
        
        const initDB = async () => {
            if (user && !authLoading) {
                // Failsafe timeout in case Firebase hangs
                const timer = setTimeout(() => {
                    if (isMounted && dbStatus === 'initializing') {
                        console.warn("DB init timed out, forcing ready state.");
                        setDbStatus('ready');
                    }
                }, 5000);

                try {
                    const result = await api.initializeDatabase();
                    if (isMounted) {
                        if (result.status === 'conflict' && result.localDate && result.firebaseDate) {
                            setConflictDetails({ localDate: result.localDate, firebaseDate: result.firebaseDate });
                            setDbStatus('conflict');
                        } else {
                            setDbStatus('ready');
                        }
                    }
                } catch (e) {
                    console.error("DB Init failed", e);
                    if (isMounted) setDbStatus('ready');
                } finally {
                    clearTimeout(timer);
                }
            } else if (!user && !authLoading) {
                if (isMounted) setDbStatus('ready');
            }
        };
        initDB();
        
        return () => { isMounted = false; };
    }, [authLoading, user]);
    
    const handleConflictResolution = async (decision: 'local' | 'server') => {
        if (decision === 'local') {
            await api.overwriteFirebaseWithLocal();
        } else { // server
            api.clearLocalData();
        }
        // Reload the app to restart the initialization process cleanly
        window.location.reload();
    };

    // This is the sequential loading gate.
    if (authLoading || dbStatus === 'initializing') {
        let message = 'Verificando autenticação...';
        if (!authLoading && dbStatus === 'initializing' && user) {
            message = 'Inicializando sistema...';
        }
        return <AppLoader message={message} />;
    }

    if (dbStatus === 'conflict' && conflictDetails) {
        return <SyncConflictModal 
            localDate={conflictDetails.localDate} 
            firebaseDate={conflictDetails.firebaseDate} 
            onResolve={handleConflictResolution} 
        />;
    }

    if (!user) {
        return <LoginView />;
    }

    // Once all checks pass, render the providers which will in turn render the MainApplication
    // This structure ensures a sequential load: Auth -> DB Init -> Data Providers -> Main App
    return (
        <FinancialsProvider>
            <ActivityLogProvider>
                <MainApplication />
            </ActivityLogProvider>
        </FinancialsProvider>
    );
};


const App: React.FC = () => (
    <ToastProvider>
        <AppContent />
    </ToastProvider>
);

export default App;
