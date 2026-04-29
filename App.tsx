
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
import { FirebaseUsageMonitor } from './components/FirebaseUsageMonitor';
import { ManufacturingOrdersView } from './components/ManufacturingOrdersView';
import { ManufacturingDashboardView } from './components/ManufacturingDashboardView';
import { MachineDashboardView } from './components/MachineDashboardView';
import { ManufacturingControlCenterView } from './components/ManufacturingControlCenterView';
import { ManufacturingCalendarView } from './components/ManufacturingCalendarView';
import { BottomNavBar } from './components/BottomNavBar';
import { MobileMenuView } from './components/MobileMenuView';
import { ActivityLogProvider, useActivityLog } from './contexts/ActivityLogContext';
import { RolePermissionsProvider, useRolePermissionsContext } from './contexts/RolePermissionsContext';
import { AIWorkerView } from './components/AIWorkerView';
import { ActivityLogView } from './components/ActivityLogView';
import { InspectionReceivingView } from './components/InspectionReceivingView';
import { FastenerCuttingView } from './components/FastenerCuttingView';
import { useCuttingOrders } from './hooks/useCuttingOrders';
import { KitDetailView } from './components/KitDetailView';
import { OperatorMode } from './components/manufacturing/OperatorMode';
import { FinancialDashboardView } from './components/FinancialDashboardView';
import { UserManagementView } from './components/UserManagementView';
import { usePurchasePlanner } from './hooks/usePurchasePlanner';
import { useProactiveAI } from './hooks/useProactiveAI';
import { SectorDashboard } from './components/dashboards/SectorDashboard';
import { SalesOrderImportView } from './components/SalesOrderImportView';
import { LoginView } from './components/LoginView';
import * as api from './hooks/api';
import { CuttingOrdersView } from './components/CuttingOrdersView';
import { useCustomers } from './hooks/useCustomers';
import { CustomersView } from './components/CustomersView';
import { SyncConflictModal } from './components/SyncConflictModal';
import { KitEngineeringView } from './components/KitEngineeringView';
import { ManualView } from './components/ManualView';
import { getLogoBase64ForPdf } from './data/assets';

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
    
    // Pre-fetch logo for fast PDF generation
    useEffect(() => {
        getLogoBase64ForPdf().catch(() => {});
    }, []);

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
    
    const { permissions } = useRolePermissionsContext();
    
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
            inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components, {
                ws: manufacturing.workStations,
                cons: manufacturing.consumables,
                ops: manufacturing.standardOperations,
                kits: inventory.kits
            });
        }
    }, [isDataLoading, inventory, manufacturing]);

    // Final loading gate before rendering the UI
    useEffect(() => {
        const runMigration = async () => {
            let migratedFamilias = false;
            let migratedComponents = false;

            const hasMoedaFixSV1 = manufacturing.familias.find(f => f.id === 'fam-FIX-S');
            if (hasMoedaFixSV1) {
                const sNode = hasMoedaFixSV1.nodes.find(n => n.id === 'n-mat-s')?.data;
                if (sNode && (sNode as any).baseMaterialId === 'comp-RM-MOEDA') {
                    const newFamilias = [...manufacturing.familias];
                    const famIds = ['fam-FIX-S', 'fam-FIX-P', 'fam-SEGREDO-CHAVE-S', 'fam-SEGREDO-FIX-P', 'fam-fixadores'];
                    const nodeIds = ['n-mat-s', 'n-mat-p', 'n-mat-segredo', 'n-mat-segredo-p', 'n-mat-fix'];
                    for (let i = 0; i < newFamilias.length; i++) {
                        const fam = newFamilias[i];
                        if (famIds.includes(fam.id)) {
                            fam.nodes = fam.nodes.map(n => {
                                if (nodeIds.includes(n.id)) {
                                    return { ...n, data: { ...n.data, baseMaterialId: 'comp-RM-CHAPA', label: 'Chapa (MP)', consumption: 0 } };
                                }
                                return n;
                            });
                        }
                    }
                    manufacturing.saveMultipleFamilias(newFamilias);
                    migratedFamilias = true;
                }
            }

            const hasChapa = inventory.components.find(c => c.id === 'comp-RM-CHAPA');
            if (!hasChapa) {
                const chapa: any = { id: 'comp-RM-CHAPA', name: 'Chapa (Matéria-Prima)', sku: 'RM-CHAPA', type: 'raw_material', stock: 0, purchaseCost: 0, custoFabricacao: 0, custoMateriaPrima: 0 };
                const newComps = [...inventory.components, chapa];
                await api.saveComponents(newComps);
                migratedComponents = true;
            }

            if ((migratedFamilias || migratedComponents) && inventory.components.length > 0) {
                console.log("Migração de chapa concluída.");
                addToast("Migração de matérias-primas (Chapa) aplicada com sucesso! Atualize a página se os dados não aparecerem.", "success");
            }
        };

        if (!isDataLoading && inventory.components && manufacturing.familias) {
            runMigration();
        }
    }, [isDataLoading, manufacturing.familias, inventory.components, manufacturing.saveMultipleFamilias, addToast]);

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

    const ProtectedView: React.FC<{ children: React.ReactNode, allowedRoles: UserRole[], viewId?: View }> = ({ children, allowedRoles, viewId }) => {
        const { permissions } = useRolePermissionsContext();
        
        // If viewId is provided, check dynamic permissions. Otherwise fallback to allowedRoles.
        const hasPermission = role && (
            viewId 
                ? permissions[role]?.includes(viewId) 
                : allowedRoles.includes(role)
        );

        if (hasPermission) {
            return <>{children}</>;
        }
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold text-red-600">Acesso Negado</h2>
                <p className="text-gray-600 mt-2">Você não tem permissão para acessar esta página.</p>
            </div>
        );
    };

    const hasPermission = role && (permissions[role]?.includes(currentView) || currentView === View.KIT_DETAILS || role === 'Admin');

    const viewMap: { [key in View]?: React.ReactNode } = {
        [View.SECTOR_DASHBOARD]: <SectorDashboard inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} productionOrdersHook={productionOrdersHook} cuttingOrdersHook={cuttingOrdersHook} plannerHook={plannerHook} />,
        [View.OPERATIONAL_DASHBOARD]: <OperationalDashboard inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} setComponentFilter={setComponentFilter} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} productionOrdersHook={productionOrdersHook} promotionalCampaigns={promotionalCampaigns} isMobile={isMobile} setIsOperatorModeOpen={setIsOperatorModeOpen} />,
        [View.FINANCIAL_DASHBOARD]: <FinancialDashboardView inventory={inventory} purchaseOrdersHook={purchaseOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} manufacturing={manufacturing} />,
        [View.COMPONENTS]: <ComponentsView inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} initialFilter={componentFilter} onClearFilter={clearComponentFilter} />,
        [View.KITS]: <KitsView inventory={inventory} manufacturing={manufacturing} onShowQRCode={setQrCodeToDisplay} onViewDetails={handleViewKitDetails} />,
        [View.KIT_ENGINEERING]: <KitEngineeringView inventory={inventory} manufacturing={manufacturing} />,
        [View.KIT_DETAILS]: detailedKitId && <KitDetailView kitId={detailedKitId} inventory={inventory} manufacturing={manufacturing} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} />,
        [View.KITS_BY_BRAND]: <KitsByBrandView inventory={inventory} manufacturing={manufacturing} />,
        [View.MANUFACTURING]: <ManufacturingView manufacturing={manufacturing} inventory={inventory} setCurrentView={setCurrentView} onShowQRCode={setQrCodeToDisplay} mode="all" manufacturingOrdersHook={manufacturingOrdersHook} />,
        [View.RAW_MATERIALS]: <RawMaterialsView inventory={inventory} onShowQRCode={setQrCodeToDisplay} />,
        [View.PRODUCTION_PLANNER]: <AssemblyView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} setCurrentView={setCurrentView} createAndStockComponent={inventory.createAndStockComponent} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} />,
        [View.PRODUCTION_ORDERS]: <ProductionOrdersView productionOrdersHook={productionOrdersHook} purchaseOrdersHook={purchaseOrdersHook} inventory={inventory} createAndStockComponent={inventory.createAndStockComponent} customersHook={customersHook} />,
        [View.PURCHASE_ORDERS]: <PurchaseOrdersView purchaseOrdersHook={purchaseOrdersHook} inventory={inventory} />,
        [View.MANUFACTURING_PLANNER]: <ManufacturingPlannerView manufacturing={manufacturing} inventory={inventory} manufacturingOrdersHook={manufacturingOrdersHook} purchaseOrdersHook={purchaseOrdersHook} setCurrentView={setCurrentView} />,
        [View.MANUFACTURING_ORDERS]: <ManufacturingOrdersView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} />,
        [View.MANUFACTURING_DASHBOARD]: <ManufacturingDashboardView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} setCurrentView={setCurrentView} />,
        [View.MACHINE_DASHBOARD]: <MachineDashboardView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} />,
        [View.MANUFACTURING_CONTROL_CENTER]: <ManufacturingControlCenterView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} setCurrentView={setCurrentView} />,
        [View.MANUFACTURING_CALENDAR]: <ManufacturingCalendarView manufacturingOrdersHook={manufacturingOrdersHook} />,
        [View.MANUFACTURING_STRUCTURE]: <ManufacturingStructureView manufacturing={manufacturing} />,
        [View.PRODUCTION_FINANCIAL_FLOW]: <ProductionFinancialFlowView manufacturingOrdersHook={manufacturingOrdersHook} inventory={inventory} manufacturing={manufacturing} />,
        [View.INVENTORY_ANALYSIS]: <InventoryAnalysisView inventory={inventory} productionOrdersHook={productionOrdersHook} manufacturing={manufacturing} />,
        [View.PURCHASE_PRODUCTION_PLANNING]: <PurchaseProductionPlanningView plannerHook={plannerHook} inventory={inventory} />,
        [View.SETTINGS]: <ProtectedView allowedRoles={['Admin']} viewId={View.SETTINGS}><SettingsView inventory={inventory} manufacturing={manufacturing} campaigns={promotionalCampaigns} /></ProtectedView>,
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
        [View.INSPECTION_RECEIVING]: <InspectionReceivingView inventory={inventory} manufacturingOrdersHook={manufacturingOrdersHook} />,
        [View.FASTENER_CUTTING]: <FastenerCuttingView inventory={inventory} cuttingOrdersHook={cuttingOrdersHook} />,
        [View.CUTTING_ORDERS]: <CuttingOrdersView cuttingOrdersHook={cuttingOrdersHook} inventory={inventory} setCurrentView={setCurrentView} />,
        [View.USER_MANAGEMENT]: <ProtectedView allowedRoles={['Admin']} viewId={View.USER_MANAGEMENT}><UserManagementView /></ProtectedView>,
        [View.SALES_ORDER_IMPORT]: <SalesOrderImportView inventory={inventory} manufacturing={manufacturing} productionOrdersHook={productionOrdersHook} cuttingOrdersHook={cuttingOrdersHook} manufacturingOrdersHook={manufacturingOrdersHook} setCurrentView={setCurrentView} customersHook={customersHook} purchaseOrdersHook={purchaseOrdersHook} />,
        [View.CUSTOMERS]: <CustomersView customersHook={customersHook} productionOrdersHook={productionOrdersHook} inventory={inventory} />,
        [View.MANUAL]: <ManualView />,
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
                <div className="flex flex-1 overflow-hidden w-full h-full relative">
                    <Sidebar currentView={currentView} setCurrentView={setCurrentView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header currentView={currentView} />
                        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
                            {!hasPermission ? (
                                <div className="text-center p-8">
                                    <h2 className="text-2xl font-bold text-red-600">Acesso Negado</h2>
                                    <p className="text-gray-600 mt-2">Você não tem permissão para acessar esta página.</p>
                                </div>
                            ) : (
                                viewMap[currentView] || viewMap[View.SECTOR_DASHBOARD]
                            )}
                        </main>
                    </div>
                </div>
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
        <RolePermissionsProvider>
            <FinancialsProvider>
                <ActivityLogProvider>
                    <MainApplication />
                </ActivityLogProvider>
            </FinancialsProvider>
        </RolePermissionsProvider>
    );
};


const App: React.FC = () => (
    <ToastProvider>
        <AppContent />
        <FirebaseUsageMonitor />
    </ToastProvider>
);

export default App;
