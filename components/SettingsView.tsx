import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ConfirmationModal } from './ui/ConfirmationModal';
import * as api from '../hooks/api';
import { useToast } from '../hooks/useToast';
import { BackupData, FinancialSettings, InventoryHook, PromotionalCampaign, ManufacturingHook, Kit, FamiliaComponente, View, UserRole } from '../types';
import { Input } from './ui/Input';
import { useFinancials } from '../contexts/FinancialsContext';
import { BRAZIL_UFS } from '../contexts/FinancialsContext';
import { Select } from './ui/Select';
import { nanoid } from 'nanoid';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';

interface SettingsViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    campaigns: PromotionalCampaign[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ inventory, manufacturing, campaigns }) => {
    const { addToast } = useToast();
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isImportingKits, setIsImportingKits] = useState(false);
    const [backupFileContent, setBackupFileContent] = useState<BackupData | null>(null);
    const [kitsToImport, setKitsToImport] = useState<Kit[] | null>(null);
    const [activeBackupTab, setActiveBackupTab] = useState<'full' | 'process' | 'transitional' | 'kits'>('full');
    const { settings, saveSettings, isLoading: isFinancialsLoading } = useFinancials();
    const [financialForm, setFinancialForm] = useState<FinancialSettings | null>(null);

    const { permissions, updatePermissions, isLoading: isPermissionsLoading } = useRolePermissions();
    const [selectedRole, setSelectedRole] = useState<UserRole>('Vendedor');
    const [tempPermissions, setTempPermissions] = useState<View[]>([]);

    const [processBackupContent, setProcessBackupContent] = useState<Partial<BackupData> | null>(null);
    const [transitionalBackupContent, setTransitionalBackupContent] = useState<Partial<BackupData> | null>(null);
    const [isRestoringPart, setIsRestoringPart] = useState(false);
    
    const [newMarketplace, setNewMarketplace] = useState({ name: '', fee: '' });

    useEffect(() => {
        if (permissions && permissions[selectedRole]) {
            setTempPermissions(permissions[selectedRole]);
        }
    }, [permissions, selectedRole]);

    const handleTogglePermission = (view: View) => {
        setTempPermissions(prev => 
            prev.includes(view) ? prev.filter(v => v !== view) : [...prev, view]
        );
    };

    const handleSavePermissions = async () => {
        try {
            await updatePermissions(selectedRole, tempPermissions);
            addToast(`Permissões do cargo ${selectedRole} atualizadas!`, 'success');
        } catch (e) {
            addToast('Erro ao salvar permissões.', 'error');
        }
    };
    
    // Campaign State
    const [newCampaign, setNewCampaign] = useState<{ name: string; kitSku: string; startDate: string }>({ name: '', kitSku: '', startDate: new Date().toISOString().split('T')[0] });
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

    // Reset State
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isConfirmingFullReset, setIsConfirmingFullReset] = useState(false);
    const [isPerformingFullReset, setIsPerformingFullReset] = useState(false);

    // Maintenance State
    const [isRebuilding, setIsRebuilding] = useState(false);
    useEffect(() => {
        if (settings) {
            setFinancialForm(settings);
        }
    }, [settings]);

    const generatorFamilias = useMemo(() => {
        const all = (manufacturing.familias || []).filter(f => 
            f.nodes?.some(n => n.data.type === 'productGenerator')
        );

        // Se já tiverem tags, respeitamos
        if (all.some(f => !!f.masterProcessTag)) {
            return all.filter(f => !!f.masterProcessTag);
        }

        // Se não tiverem tags, filtramos itens que parecem ser finais
        return all.filter(f => {
            const nome = f.nome?.toUpperCase() || '';
            // Escondemos sub-processos óbvios se não tiverem tag
            const isSubProcess = nome.includes('CABO') || nome.includes('HASTE') || nome.includes('SEGREDO') || nome.includes('CORPO CHAVE');
            return !isSubProcess;
        });
    }, [manufacturing.familias]);

    const groupedFamilies = useMemo(() => {
        const groups: Record<string, FamiliaComponente[]> = {
            'FIX-P': [],
            'FIX-S': [],
            'FIX-S EXT': [],
            'Generico': []
        };
        
        generatorFamilias.forEach(f => {
            const tag = f.masterProcessTag;
            if (tag && groups[tag]) {
                groups[tag].push(f);
            } else {
                // Auto-categorização baseada no nome se não houver tag
                const nome = f.nome?.toUpperCase() || '';
                if (nome.includes('FIX-S EXT') || nome.includes('FIX S EXT')) {
                    groups['FIX-S EXT'].push(f);
                } else if (nome.includes('FIX-S') || nome.includes('FIX S')) {
                    groups['FIX-S'].push(f);
                } else if (nome.includes('FIX-P') || nome.includes('FIX P') || nome.includes('POR-P') || nome.includes('POR P')) {
                    groups['FIX-P'].push(f);
                } else {
                    groups['Generico'].push(f);
                }
            }
        });
        return groups;
    }, [generatorFamilias]);

    const handleFinancialChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumber = e.target.type === 'number';
        setFinancialForm(prev => prev ? { ...prev, [name]: isNumber ? parseFloat(value) || 0 : value } : null);
    };

    const handleSaveFinancials = () => {
        if (financialForm) {
            saveSettings(financialForm);
        }
    };
    
    const handleMarketplaceChange = (id: string, field: 'name' | 'fee', value: string | number) => {
        setFinancialForm(prev => prev ? {
            ...prev,
            marketplaceFees: (prev.marketplaceFees || []).map(m => m.id === id ? { ...m, [field]: value } : m)
        } : null);
    };

    const handleAddMarketplace = () => {
        if (!newMarketplace.name || !newMarketplace.fee) {
            addToast("Preencha o nome e a taxa do marketplace.", 'error');
            return;
        }
        const newFee = { id: nanoid(), name: newMarketplace.name, fee: parseFloat(newMarketplace.fee) };
        setFinancialForm(prev => prev ? { ...prev, marketplaceFees: [...(prev.marketplaceFees || []), newFee] } : null);
        setNewMarketplace({ name: '', fee: '' });
    };

    const handleRemoveMarketplace = (id: string) => {
        setFinancialForm(prev => prev ? { ...prev, marketplaceFees: (prev.marketplaceFees || []).filter(m => m.id !== id) } : null);
    };

    const handleDownloadBackup = async (type: 'full' | 'process' | 'transitional' = 'full') => {
        setIsDownloading(true);
        const typeLabel = type === 'full' ? 'Completo' : type === 'process' ? 'de Processos' : 'Transacional';
        addToast(`Preparando o backup ${typeLabel}...`, 'info');
        try {
            const allData = await api.getAllData();
            let dataToSave: any = allData;

            if (type === 'process') {
                dataToSave = {
                    familias: allData.familias,
                    workStations: allData.workStations,
                    consumables: allData.consumables,
                    standardOperations: allData.standardOperations,
                    lastModified: Date.now(),
                    backupType: 'process'
                };
            } else if (type === 'transitional') {
                dataToSave = {
                    purchaseOrders: allData.purchaseOrders,
                    poCounter: allData.poCounter,
                    productionOrders: allData.productionOrders,
                    prodCounter: allData.prodCounter,
                    manufacturingOrders: allData.manufacturingOrders,
                    moCounter: allData.moCounter,
                    cuttingOrders: allData.cuttingOrders,
                    coCounter: allData.coCounter,
                    inventoryLogs: allData.inventoryLogs,
                    activityLogs: allData.activityLogs,
                    financialTransactions: allData.financialTransactions,
                    receivingOrders: allData.receivingOrders,
                    receivingCounter: allData.receivingCounter,
                    tasks: allData.tasks,
                    leads: allData.leads,
                    deals: allData.deals,
                    lastModified: Date.now(),
                    backupType: 'transitional'
                };
            }

            const jsonString = JSON.stringify(dataToSave, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            const fileName = type === 'full' ? `autro_backup_${date}.json` : `autro_backup_${type}_${date}.json`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast(`Backup ${typeLabel} baixado com sucesso!`, 'success');
        } catch (error) {
            console.error('Failed to download backup:', error);
            addToast('Falha ao criar o backup.', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleRestoreClick = () => {
        restoreInputRef.current?.click();
    };

    const handleKitImportClick = () => {
        restoreInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') throw new Error('O arquivo não é um arquivo de texto válido.');

                const parsedData = JSON.parse(content) as BackupData;
                
                if (activeBackupTab === 'full') {
                    // Simple validation to check if it looks like our backup file
                    if (
                        parsedData.hasOwnProperty('components') &&
                        parsedData.hasOwnProperty('kits') &&
                        parsedData.hasOwnProperty('inventoryLogs')
                    ) {
                        setBackupFileContent(parsedData);
                    } else {
                        throw new Error('O arquivo não parece ser um backup completo válido.');
                    }
                } else if (activeBackupTab === 'process') {
                    if (parsedData.hasOwnProperty('familias')) {
                        setProcessBackupContent(parsedData);
                    } else {
                        throw new Error('O arquivo não contém dados de processos válidos.');
                    }
                } else if (activeBackupTab === 'transitional') {
                    if (parsedData.hasOwnProperty('productionOrders') || parsedData.hasOwnProperty('inventoryLogs')) {
                        setTransitionalBackupContent(parsedData);
                    } else {
                        throw new Error('O arquivo não contém dados transacionais válidos.');
                    }
                } else {
                    // Import only kits
                    if (parsedData.hasOwnProperty('kits') && Array.isArray(parsedData.kits)) {
                        setKitsToImport(parsedData.kits);
                    } else {
                        throw new Error('O arquivo não contém dados de kits válidos.');
                    }
                }
            } catch (error: any) {
                addToast(error.message || 'Arquivo de backup inválido ou corrompido.', 'error');
                setBackupFileContent(null);
                setKitsToImport(null);
                setProcessBackupContent(null);
                setTransitionalBackupContent(null);
            }
        };
        reader.onerror = () => {
             addToast('Falha ao ler o arquivo.', 'error');
             setBackupFileContent(null);
             setKitsToImport(null);
             setProcessBackupContent(null);
             setTransitionalBackupContent(null);
        }
        reader.readAsText(file);
        
        event.target.value = '';
    };

    const handleConfirmPartialRestore = async (type: 'process' | 'transitional') => {
        const content = type === 'process' ? processBackupContent : transitionalBackupContent;
        if (!content) return;
        
        setIsRestoringPart(true);
        try {
            // No modo Firebase, usamos update para não apagar o resto das chaves
            // No modo local, salvamos chave a chave
            const allKeys = Object.keys(content);
            const validKeys = ['familias', 'workStations', 'consumables', 'standardOperations', 'purchaseOrders', 'poCounter', 'productionOrders', 'prodCounter', 'manufacturingOrders', 'moCounter', 'cuttingOrders', 'coCounter', 'inventoryLogs', 'activityLogs', 'financialTransactions', 'receivingOrders', 'receivingCounter', 'tasks', 'leads', 'deals'];
            
            for (const key of allKeys) {
                if (validKeys.includes(key)) {
                    // @ts-ignore
                    await api.saveData(key, content[key]);
                }
            }

            addToast(`${type === 'process' ? 'Processos' : 'Dados transacionais'} restaurados com sucesso!`, 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error(`Failed to restore ${type} data:`, error);
            addToast('Falha ao restaurar os dados.', 'error');
        } finally {
            setIsRestoringPart(false);
            setProcessBackupContent(null);
            setTransitionalBackupContent(null);
        }
    };

    const handleConfirmRestore = async () => {
        if (!backupFileContent) return;
        setIsRestoring(true);
        try {
            await api.restoreAllData(backupFileContent);
            addToast('Dados restaurados com sucesso! A página será recarregada.', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Failed to restore data:', error);
            addToast('Falha ao restaurar os dados.', 'error');
            setIsRestoring(false);
            setBackupFileContent(null);
        }
    };

    const handleConfirmKitsImport = async () => {
        if (!kitsToImport) return;
        setIsImportingKits(true);
        try {
            const currentKits = await api.getKits();
            const mergedKits = [...currentKits];
            
            kitsToImport.forEach(newKit => {
                const existingIndex = mergedKits.findIndex(k => k.sku === newKit.sku);
                if (existingIndex >= 0) {
                    mergedKits[existingIndex] = newKit;
                } else {
                    mergedKits.push(newKit);
                }
            });

            await api.saveKits(mergedKits);
            addToast(`${kitsToImport.length} kits importados/atualizados com sucesso! A página será recarregada.`, 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Failed to import kits:', error);
            addToast('Falha ao importar os kits.', 'error');
            setIsImportingKits(false);
            setKitsToImport(null);
        }
    };
    
    // --- Campaign Functions ---
    const handleCreateCampaign = async () => {
        if (!newCampaign.name || !newCampaign.kitSku || !newCampaign.startDate) {
            addToast('Preencha todos os campos da campanha.', 'error');
            return;
        }
        setIsCreatingCampaign(true);
        try {
            const campaignToAdd: PromotionalCampaign = { id: `camp-${nanoid(8)}`, ...newCampaign };
            const updatedCampaigns = [...campaigns, campaignToAdd];
            await api.savePromotionalCampaigns(updatedCampaigns);
            addToast('Campanha criada com sucesso! A página será recarregada para aplicá-la.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch(e) {
            addToast('Erro ao criar campanha.', 'error');
        } finally {
            setIsCreatingCampaign(false);
        }
    };

    const handleConfirmDeleteCampaign = async () => {
        if (!deletingCampaignId) return;
        try {
            const currentCampaigns = await api.getPromotionalCampaigns();
            const newCampaigns = currentCampaigns.filter(c => c.id !== deletingCampaignId);
            await api.savePromotionalCampaigns(newCampaigns);
            addToast('Campanha excluída com sucesso! A página será recarregada.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            addToast('Erro ao excluir campanha.', 'error');
        } finally {
            setDeletingCampaignId(null);
        }
    };

    const handleConfirmReset = async () => {
        setIsResetting(true);
        try {
            await api.clearTransactionalData();
            addToast('Todos os dados transacionais foram limpos. A página será recarregada.', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Failed to reset data:', error);
            addToast('Falha ao limpar os dados.', 'error');
            setIsResetting(false);
            setIsConfirmingReset(false);
        }
    };

    const handleConfirmFullReset = async () => {
        setIsPerformingFullReset(true);
        try {
            await api.resetAndSeedDatabase();
            addToast('Sistema resetado com sucesso! A página será recarregada.', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Failed to reset database:', error);
            addToast('Falha ao resetar o sistema.', 'error');
        } finally {
            setIsPerformingFullReset(false);
            setIsConfirmingFullReset(false);
        }
    };


    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Configurações</h2>
            <div className="space-y-6 max-w-4xl mx-auto">
                 <Card>
                    <h3 className="text-xl font-semibold text-black mb-2">Gerenciamento de Campanhas Promocionais</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Crie campanhas de vendas com ciclo de vida de 3 meses (Vendas, Escoamento, Promoção) que serão exibidas no dashboard.
                    </p>
                    <div className="space-y-4 p-4 border rounded-md">
                        <h4 className="font-semibold text-black">Nova Campanha</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Kit da Campanha" value={newCampaign.kitSku} onChange={e => setNewCampaign(p => ({ ...p, kitSku: e.target.value }))}>
                                <option value="" disabled>Selecione um kit...</option>
                                {inventory.kits.map(k => <option key={k.sku} value={k.sku}>{k.name} ({k.sku})</option>)}
                            </Select>
                            <Input label="Nome da Campanha" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Promoção de Inverno" />
                            <Input label="Data de Início" type="date" value={newCampaign.startDate} onChange={e => setNewCampaign(p => ({ ...p, startDate: e.target.value }))} />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}>{isCreatingCampaign ? 'Criando...' : 'Criar Campanha'}</Button>
                        </div>
                    </div>
                    <div className="mt-6">
                        <h4 className="font-semibold text-black">Campanhas Ativas e Anteriores</h4>
                        <ul className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                            {campaigns.map(c => {
                                const kit = inventory.findKitBySku(c.kitSku);
                                return (
                                <li key={c.id} className="p-2 border rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-black">{c.name}</p>
                                        <p className="text-sm text-gray-600">Kit: {kit?.name || c.kitSku} | Início: {new Date(c.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                                    </div>
                                    <Button size="sm" variant="danger" onClick={() => setDeletingCampaignId(c.id)}>Excluir</Button>
                                </li>
                            )})}
                        </ul>
                    </div>
                </Card>
                <Card>
                    <h3 className="text-xl font-semibold text-black mb-2 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-autro-blue" />
                        Gerenciamento de Permissões por Cargo
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Personalize quais telas e funcionalidades cada perfil de usuário pode acessar.
                    </p>

                    {isPermissionsLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-autro-blue"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-end gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex-1">
                                    <Select 
                                        label="Selecione o Cargo para Editar" 
                                        value={selectedRole} 
                                        onChange={e => setSelectedRole(e.target.value as UserRole)}
                                        className="font-bold"
                                    >
                                        <option value="Admin">Administrador</option>
                                        <option value="Gestor">Gestor</option>
                                        <option value="Vendedor">Vendedor</option>
                                        <option value="Linha de Produção">Linha de Produção</option>
                                        <option value="Fabricação">Fabricação</option>
                                        <option value="Compras">Compras</option>
                                        <option value="Financeiro">Financeiro</option>
                                    </Select>
                                </div>
                                <Button onClick={handleSavePermissions} variant="primary" className="md:w-48">
                                    Salvar Alterações
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(() => {
                                    const grouped = {
                                        'Dashboards': [View.SECTOR_DASHBOARD, View.OPERATIONAL_DASHBOARD, View.FINANCIAL_DASHBOARD, View.MANUFACTURING_DASHBOARD, View.MACHINE_DASHBOARD, View.CUSTOMER_SERVICE_DASHBOARD, View.SALES_DASHBOARD, View.ACTIVITY_LOG],
                                        'Gestão de Estoque': [View.COMPONENTS, View.KITS, View.KITS_BY_BRAND, View.KIT_DETAILS, View.RAW_MATERIALS, View.INVENTORY_ANALYSIS, View.STOCK_MOVEMENT, View.INSPECTION_RECEIVING, View.LABEL_PRINTING, View.SPREADSHEETS],
                                        'Produção e Engenharia': [View.MANUFACTURING, View.PRODUCTION_PLANNER, View.PRODUCTION_ORDERS, View.MANUFACTURING_PLANNER, View.MANUFACTURING_ORDERS, View.MANUFACTURING_CALENDAR, View.FASTENER_CUTTING, View.CUTTING_ORDERS, View.MANUFACTURING_STRUCTURE, View.MANUFACTURING_CONTROL_CENTER, View.KIT_ENGINEERING, View.ORDER_VERIFICATION],
                                        'Comercial e CRM': [View.SALES_ORDER_IMPORT, View.CUSTOMERS, View.SALES_FUNNEL, View.WHATSAPP_CRM, View.CALLS_CRM, View.TASKS],
                                        'Suprimentos e Financeiro': [View.PRODUCTION_FINANCIAL_FLOW, View.PURCHASE_PRODUCTION_PLANNING, View.PAYMENT_CALENDAR, View.PURCHASE_ORDERS],
                                        'Configurações e Sistema': [View.SETTINGS, View.USER_MANAGEMENT, View.AI_WORKER, View.MANUAL]
                                    };

                                    const allUsedViews = new Set(Object.values(grouped).flat());
                                    const missingViews = Object.values(View).filter(v => !allUsedViews.has(v));

                                    if (missingViews.length > 0) {
                                        // @ts-ignore
                                        grouped['Outros'] = missingViews;
                                    }

                                    return Object.entries(grouped).map(([category, views]) => (
                                        <div key={category} className="space-y-3">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">{category}</h4>
                                            <div className="space-y-2">
                                                {views.map(view => (
                                                    <label key={view} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 rounded text-autro-blue transition-all"
                                                            checked={tempPermissions.includes(view)}
                                                            onChange={() => handleTogglePermission(view)}
                                                        />
                                                        <span className="text-xs font-bold text-slate-700 capitalize">
                                                            {view.replace(/_/g, ' ').toLowerCase()}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </Card>

                 <Card>
                    <h3 className="text-xl font-semibold text-black mb-2">Configurações Fiscais e de Venda</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Defina os parâmetros da sua empresa para o cálculo de impostos e preços.
                    </p>
                    {isFinancialsLoading || !financialForm ? (
                        <p>Carregando configurações...</p>
                    ) : (
                        <div className="space-y-8">
                            {/* Production Settings */}
                            <div className="border-b pb-6">
                                <h4 className="font-semibold text-lg text-black mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-autro-blue rounded-full"></div>
                                    Produção e Inteligência de Processos
                                </h4>
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                            <div className="max-w-md">
                                                <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Processo de Fabricação Mestre</h5>
                                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                    Este processo define a "receita" padrão para calcular custos e baixar itens do estoque quando você adiciona fixadores (parafusos/porcas) em kits de forma dinâmica.
                                                </p>
                                            </div>
                                            <div className="w-full md:w-64">
                                                <Select 
                                                    name="preferredFastenerFamiliaId" 
                                                    value={financialForm.preferredFastenerFamiliaId || ''} 
                                                    onChange={handleFinancialChange}
                                                    className="font-bold border-2 border-slate-300 focus:border-autro-blue"
                                                >
                                                    <option value="">Selecione um processo...</option>
                                                    {Object.entries(groupedFamilies).map(([tag, families]) => {
                                                        const fams = families as FamiliaComponente[];
                                                        return fams.length > 0 && (
                                                            <optgroup key={tag} label={tag === 'Generico' ? 'Outros Processos (Genérico)' : `Linha ${tag}`}>
                                                                {fams.map(f => (
                                                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                                                ))}
                                                            </optgroup>
                                                        );
                                                    })}
                                                </Select>
                                            </div>
                                        </div>

                                        {financialForm.preferredFastenerFamiliaId && (
                                            <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </div>
                                                <div className="flex-grow">
                                                    <p className="text-xs font-black text-slate-900 uppercase">Configuração Ativa</p>
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        Ao montar kits, o sistema usará automaticamente os tempos de operação, postos de trabalho e insumos definidos no processo <span className="text-autro-blue font-bold">"{generatorFamilias.find(f => f.id === financialForm.preferredFastenerFamiliaId)?.nome}"</span>.
                                                    </p>
                                                    <div className="mt-3 flex gap-4">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Custo Dinâmico Ativo</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Baixa de Estoque Automática</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Company Info */}
                            <div className="border-b pb-6">
                                <h4 className="font-semibold text-lg text-black mb-3">Dados da Empresa</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Nome da Empresa" name="companyName" value={financialForm.companyName} onChange={handleFinancialChange} />
                                    <Input label="CNPJ" name="cnpj" value={financialForm.cnpj} onChange={handleFinancialChange} />
                                </div>
                            </div>
                            
                            {/* Tax Regime */}
                            <div className="border-b pb-6">
                                <h4 className="font-semibold text-lg text-black mb-3">Regime Tributário</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <Select label="Regime Tributário" name="taxRegime" value={financialForm.taxRegime} onChange={handleFinancialChange}>
                                        <option value="simples">Simples Nacional</option>
                                        <option value="presumido">Lucro Presumido</option>
                                        <option value="real">Lucro Real</option>
                                    </Select>
                                    <Select label="Estado de Origem (UF)" name="originUF" value={financialForm.originUF} onChange={handleFinancialChange}>
                                        {BRAZIL_UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                    </Select>
                                </div>
                            </div>

                            {/* Federal Taxes */}
                            <div className={`border-b pb-6 ${financialForm.taxRegime === 'simples' && 'opacity-50'}`}>
                                <h4 className="font-semibold text-lg text-black mb-3">Impostos Federais (Lucro Presumido/Real)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <Input label="IRPJ (%)" name="irpj" type="number" value={financialForm.irpj} onChange={handleFinancialChange} disabled={financialForm.taxRegime === 'simples'} />
                                    <Input label="CSLL (%)" name="csll" type="number" value={financialForm.csll} onChange={handleFinancialChange} disabled={financialForm.taxRegime === 'simples'} />
                                    <Input label="PIS (%)" name="pis" type="number" value={financialForm.pis} onChange={handleFinancialChange} disabled={financialForm.taxRegime === 'simples'} />
                                    <Input label="COFINS (%)" name="cofins" type="number" value={financialForm.cofins} onChange={handleFinancialChange} disabled={financialForm.taxRegime === 'simples'} />
                                    <Input label="IPI (%)" name="ipi" type="number" value={financialForm.ipi} onChange={handleFinancialChange} disabled={financialForm.taxRegime === 'simples'} />
                                </div>
                            </div>
                            
                            {/* State Taxes */}
                            <div className="border-b pb-6">
                                <h4 className="font-semibold text-lg text-black mb-3">Impostos Estaduais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input label="ICMS Interno Padrão (%)" name="icms" type="number" value={financialForm.icms} onChange={handleFinancialChange} />
                                    <Input label="ICMS-ST Padrão (%)" name="icmsSt" type="number" value={financialForm.icmsSt} onChange={handleFinancialChange} />
                                    <Input label="FCP (%)" name="fcp" type="number" value={financialForm.fcp} onChange={handleFinancialChange} />
                                </div>
                            </div>
                            
                             {/* Simples Nacional */}
                            <div className={`border-b pb-6 ${financialForm.taxRegime !== 'simples' && 'opacity-50'}`}>
                                <h4 className="font-semibold text-lg text-black mb-3">Simples Nacional</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select label="Anexo do Simples" name="simplesNacionalAnnex" value={financialForm.simplesNacionalAnnex} onChange={handleFinancialChange} disabled={financialForm.taxRegime !== 'simples'}>
                                        <option value="I">Anexo I - Comércio</option>
                                        <option value="II">Anexo II - Indústria</option>
                                        <option value="III">Anexo III - Serviços</option>
                                        <option value="IV">Anexo IV - Serviços</option>
                                        <option value="V">Anexo V - Serviços</option>
                                    </Select>
                                     <Input label="Alíquota (%)" name="simplesNacional" type="number" value={financialForm.simplesNacional} onChange={handleFinancialChange} disabled={financialForm.taxRegime !== 'simples'} />
                                </div>
                            </div>

                            {/* Costs and Fees */}
                             <div className="border-b pb-6">
                                <h4 className="font-semibold text-lg text-black mb-3">Custos e Taxas Operacionais (% sobre a Receita)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <Input label="Markup Padrão (%)" name="markup" type="number" value={financialForm.markup} onChange={handleFinancialChange} />
                                    <Input label="Comissão de Venda (%)" name="salesCommission" type="number" value={financialForm.salesCommission} onChange={handleFinancialChange} />
                                    <Input label="Custo de Frete (%)" name="freightCost" type="number" value={financialForm.freightCost} onChange={handleFinancialChange} />
                                    <Input label="Custo Administrativo (%)" name="administrativeCost" type="number" value={financialForm.administrativeCost} onChange={handleFinancialChange} />
                                     <Input label="Custo Financeiro (%)" name="financialCost" type="number" value={financialForm.financialCost} onChange={handleFinancialChange} />
                                     <Input label="Taxa Meio Pagamento (%)" name="paymentGatewayFee" type="number" value={financialForm.paymentGatewayFee} onChange={handleFinancialChange} />
                                </div>
                            </div>


                            <div>
                                <h4 className="text-lg font-semibold text-black mb-2">Taxas de Marketplace</h4>
                                <div className="space-y-2">
                                    {(financialForm.marketplaceFees || []).map(m => (
                                        <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-6"><Input value={m.name} onChange={e => handleMarketplaceChange(m.id, 'name', e.target.value)} /></div>
                                            <div className="col-span-4"><Input type="number" value={m.fee} onChange={e => handleMarketplaceChange(m.id, 'fee', parseFloat(e.target.value) || 0)} /></div>
                                            <div className="col-span-2"><Button variant="danger" onClick={() => handleRemoveMarketplace(m.id)} className="w-full">X</Button></div>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t">
                                        <div className="col-span-6"><Input placeholder="Nome do Marketplace" value={newMarketplace.name} onChange={e => setNewMarketplace(p => ({...p, name: e.target.value}))} /></div>
                                        <div className="col-span-4"><Input type="number" placeholder="Taxa %" value={newMarketplace.fee} onChange={e => setNewMarketplace(p => ({...p, fee: e.target.value}))} /></div>
                                        <div className="col-span-2"><Button onClick={handleAddMarketplace} variant="secondary" className="w-full">Adicionar</Button></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end pt-4 border-t mt-4">
                                <Button onClick={handleSaveFinancials}>Salvar Configurações</Button>
                            </div>
                        </div>
                    )}
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold text-black mb-2">Configurações de IA</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        A chave de API do Google Gemini agora é gerenciada por variáveis de ambiente no servidor e não pode ser configurada aqui.
                    </p>
                </Card>
                <Card>
                    <h3 className="text-xl font-semibold text-black mb-2">Backup e Restauração de Dados</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Gerencie seus dados baixando backups completos ou importando partes específicas de arquivos de backup anteriores.
                    </p>

                    <div className="flex border-b mb-6 overflow-x-auto whitespace-nowrap">
                        <button 
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeBackupTab === 'full' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveBackupTab('full')}
                        >
                            Backup Completo
                        </button>
                        <button 
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeBackupTab === 'process' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveBackupTab('process')}
                        >
                            Backup de Processos
                        </button>
                        <button 
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeBackupTab === 'transitional' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveBackupTab('transitional')}
                        >
                            Backup Transacional
                        </button>
                        <button 
                            className={`px-4 py-2 font-medium text-sm transition-colors ${activeBackupTab === 'kits' ? 'text-autro-blue border-b-2 border-autro-blue' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveBackupTab('kits')}
                        >
                            Importar Apenas Kits
                        </button>
                    </div>

                    {activeBackupTab === 'full' && (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={() => handleDownloadBackup('full')}
                                disabled={isDownloading}
                                className="flex-1"
                            >
                                {isDownloading ? 'Gerando...' : 'Baixar Backup Completo'}
                            </Button>
                            <Button
                                onClick={handleRestoreClick}
                                variant="secondary"
                                className="flex-1"
                                disabled={isRestoring}
                            >
                                Restaurar Backup Completo
                            </Button>
                        </div>
                    )}

                    {activeBackupTab === 'process' && (
                        <div className="space-y-4">
                             <p className="text-sm text-gray-600">
                                Inclui: Famílias de Processos, Postos de Trabalho, Insumos e Operações Padrão.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    onClick={() => handleDownloadBackup('process')}
                                    disabled={isDownloading}
                                    className="flex-1"
                                >
                                    {isDownloading ? 'Gerando...' : 'Baixar Backup de Processos'}
                                </Button>
                                <Button
                                    onClick={handleRestoreClick}
                                    variant="secondary"
                                    className="flex-1"
                                    disabled={isRestoringPart}
                                >
                                    Restaurar Backup de Processos
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeBackupTab === 'transitional' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Inclui: Todas as Ordens (Compra, Produção, Fabricação, Corte), Movimentações de Estoque, Logs de Atividade e Transações Financeiras.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    onClick={() => handleDownloadBackup('transitional')}
                                    disabled={isDownloading}
                                    className="flex-1"
                                >
                                    {isDownloading ? 'Gerando...' : 'Baixar Backup Transacional'}
                                </Button>
                                <Button
                                    onClick={handleRestoreClick}
                                    variant="secondary"
                                    className="flex-1"
                                    disabled={isRestoringPart}
                                >
                                    Restaurar Backup Transacional
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeBackupTab === 'kits' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Selecione um arquivo de backup padrão para extrair e importar apenas os kits. Isso irá mesclar os kits do arquivo com os kits atuais (kits com o mesmo SKU serão atualizados).
                            </p>
                            <Button
                                onClick={handleKitImportClick}
                                variant="secondary"
                                className="w-full sm:w-auto"
                                disabled={isImportingKits}
                            >
                                Selecionar Arquivo para Importar Kits
                            </Button>
                        </div>
                    )}

                    <input
                        type="file"
                        accept=".json"
                        ref={restoreInputRef}
                        onChange={handleFileSelected}
                        className="hidden"
                    />
                </Card>

                <Card className="border-red-500">
                    <h3 className="text-xl font-semibold text-red-600 mb-2">Zona de Perigo</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Ações perigosas que afetam os dados do sistema. Use com extremo cuidado.
                    </p>

                    <div className="border-t pt-4">
                        <h4 className="font-semibold text-black">1. Reparar Processos Padrão Corrompidos</h4>
                        <p className="text-sm text-gray-500 my-2">
                            Use esta opção para aplicar a nova estrutura de famílias (FIX-S e FIX-P) e remover processos antigos.
                        </p>
                        <Button onClick={async () => {
                            await api.applyCustomFamilyCleanup();
                            addToast('Famílias atualizadas! A página será recarregada.', 'success');
                            setTimeout(() => window.location.reload(), 1500);
                        }} variant="secondary">
                            Aplicar Limpeza de Famílias
                        </Button>
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <h4 className="font-semibold text-black">2. Limpar Dados Transacionais</h4>
                        <p className="text-sm text-gray-500 my-2">
                           Apaga TODAS as ordens e movimentações de estoque. Use para reiniciar o período fiscal. Seus componentes, kits e processos serão mantidos.
                        </p>
                        <Button onClick={() => setIsConfirmingReset(true)} variant="danger">
                            Limpar Dados Transacionais
                        </Button>
                    </div>
                     <div className="border-t pt-4 mt-4">
                        <h4 className="font-semibold text-black">3. Reset Total do Sistema (Solução Final)</h4>
                        <p className="text-sm text-gray-500 my-2">
                            Esta é a solução final. Apaga TUDO (exceto usuários) e restaura o sistema para as configurações de fábrica. Use se a reparação de processos falhar ou se quiser começar do zero.
                        </p>
                        <Button onClick={() => setIsConfirmingFullReset(true)} variant="danger">
                           Reset Total do Sistema (Voltar à Fábrica)
                        </Button>
                    </div>
                </Card>
            </div>

            <ConfirmationModal
                isOpen={!!deletingCampaignId}
                onClose={() => setDeletingCampaignId(null)}
                onConfirm={handleConfirmDeleteCampaign}
                title="Excluir Campanha"
            >
                Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.
            </ConfirmationModal>

            {backupFileContent && (
                <ConfirmationModal
                    isOpen={!!backupFileContent}
                    onClose={() => setBackupFileContent(null)}
                    onConfirm={handleConfirmRestore}
                    title="Confirmar Restauração de Dados"
                    isConfirming={isRestoring}
                    confirmText="Sim, Restaurar e Substituir Tudo"
                    variant="danger"
                >
                    <div className="text-left space-y-4">
                        <div className="p-3 bg-red-50 border border-red-100 rounded-md">
                            <p className="font-bold text-red-700 text-sm">ATENÇÃO: AÇÃO IRREVERSÍVEL!</p>
                            <p className="text-xs text-red-600 mt-1">
                                Você está prestes a substituir <span className="font-bold underline">TODOS</span> os dados atuais do sistema pelo conteúdo do arquivo de backup.
                            </p>
                        </div>

                        {backupFileContent && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Conteúdo do Backup:</h4>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-600">Componentes:</span>
                                        <span className="font-mono font-bold text-autro-blue">{backupFileContent.components?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-600">Kits:</span>
                                        <span className="font-mono font-bold text-autro-blue">{backupFileContent.kits?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-600">Processos:</span>
                                        <span className="font-mono font-bold text-autro-blue">{backupFileContent.familias?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="text-gray-600">Ordens:</span>
                                        <span className="font-mono font-bold text-autro-blue">
                                            {(backupFileContent.purchaseOrders?.length || 0) + 
                                             (backupFileContent.productionOrders?.length || 0) + 
                                             (backupFileContent.manufacturingOrders?.length || 0)}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-4 italic">
                                    Data do Backup: {backupFileContent.lastModified ? new Date(backupFileContent.lastModified).toLocaleString('pt-BR') : 'Desconhecida'}
                                </p>
                            </div>
                        )}

                        <p className="text-sm text-gray-700 font-medium text-center">
                           Tem certeza que deseja continuar?
                        </p>
                    </div>
                </ConfirmationModal>
            )}

            {processBackupContent && (
                <ConfirmationModal
                    isOpen={!!processBackupContent}
                    onClose={() => setProcessBackupContent(null)}
                    onConfirm={() => handleConfirmPartialRestore('process')}
                    title="Confirmar Restauração de Processos"
                    isConfirming={isRestoringPart}
                    confirmText="Sim, Restaurar Processos"
                    variant="danger"
                >
                    <div className="text-left space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-md">
                            <p className="font-bold text-amber-700 text-sm">AVISO: SOBREPOSIÇÃO DE DADOS</p>
                             <p className="text-xs text-amber-600 mt-1">
                                Esta ação irá substituir todas as suas Famílias de Processos, Postos de Trabalho, Insumos e Operações pelos dados do backup.
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Itens identificados:</h4>
                             <ul className="text-sm space-y-1">
                                <li>Famílias: {processBackupContent.familias?.length || 0}</li>
                                <li>Postos: {processBackupContent.workStations?.length || 0}</li>
                                <li>Insumos: {processBackupContent.consumables?.length || 0}</li>
                             </ul>
                        </div>
                        <p className="text-sm text-gray-700 text-center">Deseja continuar?</p>
                    </div>
                </ConfirmationModal>
            )}

            {transitionalBackupContent && (
                <ConfirmationModal
                    isOpen={!!transitionalBackupContent}
                    onClose={() => setTransitionalBackupContent(null)}
                    onConfirm={() => handleConfirmPartialRestore('transitional')}
                    title="Confirmar Restauração Transacional"
                    isConfirming={isRestoringPart}
                    confirmText="Sim, Restaurar Dados Transacionais"
                    variant="danger"
                >
                    <div className="text-left space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-md">
                            <p className="font-bold text-amber-700 text-sm">AVISO: SOBREPOSIÇÃO DE DADOS</p>
                             <p className="text-xs text-amber-600 mt-1">
                                Esta ação irá substituir todas as suas Ordens, Históricos de Estoque e Logs pelos dados do backup. Componentes e Kits serão mantidos.
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                             <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Itens identificados:</h4>
                             <ul className="text-sm space-y-1">
                                <li>Ordens de Produção: {transitionalBackupContent.productionOrders?.length || 0}</li>
                                <li>Logs de Estoque: {transitionalBackupContent.inventoryLogs?.length || 0}</li>
                                <li>Logs de Atividade: {transitionalBackupContent.activityLogs?.length || 0}</li>
                             </ul>
                        </div>
                        <p className="text-sm text-gray-700 text-center">Deseja continuar?</p>
                    </div>
                </ConfirmationModal>
            )}

            {kitsToImport && (
                <ConfirmationModal
                    isOpen={!!kitsToImport}
                    onClose={() => setKitsToImport(null)}
                    onConfirm={handleConfirmKitsImport}
                    title="Confirmar Importação de Kits"
                    isConfirming={isImportingKits}
                    confirmText="Sim, Importar Kits"
                    variant="primary"
                >
                    <div className="text-left space-y-4">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                            <p className="font-bold text-blue-700 text-sm">IMPORTAÇÃO PARCIAL</p>
                            <p className="text-xs text-blue-600 mt-1">
                                Você está prestes a importar <span className="font-bold underline">{kitsToImport.length}</span> kits do arquivo de backup.
                            </p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-700">
                                Esta ação irá:
                            </p>
                            <ul className="list-disc list-inside text-xs text-gray-600 mt-2 space-y-1">
                                <li>Adicionar novos kits que não existem no sistema</li>
                                <li>Atualizar kits existentes que possuem o mesmo SKU</li>
                                <li><span className="font-bold">Manter</span> todos os outros dados (componentes, ordens, etc.) intactos</li>
                            </ul>
                        </div>

                        <p className="text-sm text-gray-700 font-medium text-center">
                           Deseja prosseguir com a importação dos kits?
                        </p>
                    </div>
                </ConfirmationModal>
            )}

            <ConfirmationModal
                isOpen={isConfirmingReset}
                onClose={() => setIsConfirmingReset(false)}
                onConfirm={handleConfirmReset}
                title="Confirmar Limpeza de Dados"
                isConfirming={isResetting}
                confirmText="Sim, Excluir Todos os Dados"
            >
                <div className="text-left space-y-3">
                    <p className="font-bold text-red-600">ATENÇÃO: AÇÃO IRREVERSÍVEL!</p>
                    <p className="text-sm text-gray-700">
                        Você está prestes a apagar permanentemente os seguintes dados:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                        <li>Todas as Ordens de Compra</li>
                        <li>Todas as Ordens de Produção (Montagem)</li>
                        <li>Todas as Ordens de Fabricação</li>
                        <li>Todas as Ordens de Corte</li>
                        <li>Todo o Histórico de Movimentação de Estoque</li>
                        <li>Todo o Log de Atividades</li>
                    </ul>
                     <p className="text-sm text-gray-700 font-semibold">
                       Isso efetivamente reiniciará seu estoque para zero.
                    </p>
                    <p className="text-sm text-gray-700">
                       Tem certeza absoluta que deseja continuar?
                    </p>
                </div>
            </ConfirmationModal>

             <ConfirmationModal
                isOpen={isConfirmingFullReset}
                onClose={() => setIsConfirmingFullReset(false)}
                onConfirm={handleConfirmFullReset}
                title="Confirmar Reset Completo do Sistema"
                isConfirming={isPerformingFullReset}
                confirmText="Sim, Apagar Tudo e Reiniciar"
            >
                <div className="text-left space-y-3">
                    <p className="font-bold text-red-600">ATENÇÃO: AÇÃO IRREVERSÍVEL!</p>
                    <p className="text-sm text-gray-700">
                        Você está prestes a apagar permanentemente <span className="font-bold">TODOS</span> os dados do sistema, exceto os usuários. O sistema voltará ao seu estado inicial de fábrica.
                    </p>
                     <p className="text-sm text-gray-700 font-semibold">
                       Isto é útil para corrigir dados de base corrompidos.
                    </p>
                    <p className="text-sm text-gray-700">
                       Tem certeza absoluta que deseja continuar?
                    </p>
                </div>
            </ConfirmationModal>
        </div>
    );
};
