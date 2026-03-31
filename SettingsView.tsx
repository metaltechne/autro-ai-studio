
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import * as api from './hooks/api';
import { useToast } from './hooks/useToast';
import { BackupData, FinancialSettings, InventoryHook, PromotionalCampaign, ManufacturingHook } from './types';
import { Input } from './components/ui/Input';
import { useFinancials } from './contexts/FinancialsContext';
import { BRAZIL_UFS } from './contexts/FinancialsContext';
import { Select } from './components/ui/Select';
import { nanoid } from 'nanoid';

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
    const [backupFileContent, setBackupFileContent] = useState<BackupData | null>(null);
    const { settings, saveSettings, isLoading: isFinancialsLoading } = useFinancials();
    const [financialForm, setFinancialForm] = useState<FinancialSettings | null>(null);

    const [newMarketplace, setNewMarketplace] = useState({ name: '', fee: '' });
    
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
        return manufacturing.familias.filter(f => f.nodes?.some(n => n.data.type === 'productGenerator'));
    }, [manufacturing.familias]);

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

    const handleDownloadBackup = async () => {
        setIsDownloading(true);
        addToast('Preparando o backup...', 'info');
        try {
            const allData = await api.getAllData();
            const jsonString = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            a.download = `autro_backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast('Backup baixado com sucesso!', 'success');
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

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') throw new Error('O arquivo não é um arquivo de texto válido.');

                const parsedData = JSON.parse(content) as BackupData;
                
                // Simple validation to check if it looks like our backup file
                if (
                    parsedData.hasOwnProperty('components') &&
                    parsedData.hasOwnProperty('kits') &&
                    parsedData.hasOwnProperty('inventoryLogs')
                ) {
                    setBackupFileContent(parsedData);
                } else {
                    throw new Error('O arquivo não parece ser um backup válido.');
                }
            } catch (error: any) {
                addToast(error.message || 'Arquivo de backup inválido ou corrompido.', 'error');
                setBackupFileContent(null);
            }
        };
        reader.onerror = () => {
             addToast('Falha ao ler o arquivo.', 'error');
             setBackupFileContent(null);
        }
        reader.readAsText(file);
        
        event.target.value = '';
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
    
    // --- Campaign Functions ---
    const handleCreateCampaign = async () => {
        if (!newCampaign.name || !newCampaign.kitSku || !newCampaign.startDate) {
            addToast('Preencha todos os campos da campanha.', 'error');
            return;
        }
        setIsCreatingCampaign(true);
        try {
            const campaignToAdd: PromotionalCampaign = { id: `camp-${nanoid(8)}`, ...newCampaign };
            const currentCampaigns = await api.getPromotionalCampaigns();
            const updatedCampaigns = [...currentCampaigns, campaignToAdd];
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

    const handleForceRebuild = async () => {
        setIsRebuilding(true);
        try {
            const result = await api.forceRebuildCorruptedProcesses();
            if (result === 'rebuilt') {
                addToast('Processos corrompidos foram reconstruídos! A página será recarregada.', 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else if (result === 'no_issues') {
                addToast('Nenhum processo corrompido encontrado para reconstruir.', 'info');
            } else {
                throw new Error("API call to rebuild failed");
            }
        } catch (error) {
            addToast('Ocorreu um erro ao tentar reconstruir os processos.', 'error');
        } finally {
            setIsRebuilding(false);
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
                                <h4 className="font-semibold text-lg text-black mb-3">Produção e Processos</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <Select 
                                        label="Processo Padrão para Fixadores" 
                                        name="preferredFastenerFamiliaId" 
                                        value={financialForm.preferredFastenerFamiliaId || ''} 
                                        onChange={handleFinancialChange}
                                        className="col-span-2"
                                    >
                                        <option value="">Selecione um processo...</option>
                                        {generatorFamilias.map(f => (
                                            <option key={f.id} value={f.id}>{f.nome}</option>
                                        ))}
                                    </Select>
                                    <p className="text-xs text-gray-500 col-span-2">
                                        Define qual receita será usada para calcular custos e baixar estoque de fixadores em kits (ex: usar "FIX-P" ou "Beneficiamento").
                                    </p>
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
                        Faça o download de todos os dados do sistema para um único arquivo. Use este arquivo para restaurar o sistema a um estado anterior.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                         <Button
                            onClick={handleDownloadBackup}
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
                            Restaurar a partir de um Arquivo
                        </Button>
                        <input
                            type="file"
                            accept=".json"
                            ref={restoreInputRef}
                            onChange={handleFileSelected}
                            className="hidden"
                        />
                    </div>
                </Card>

                <Card className="border-red-500">
                    <h3 className="text-xl font-semibold text-red-600 mb-2">Zona de Perigo</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Ações perigosas que afetam os dados do sistema. Use com extremo cuidado.
                    </p>

                    <div className="border-t pt-4">
                        <h4 className="font-semibold text-black">1. Reparar Processos Padrão Corrompidos</h4>
                        <p className="text-sm text-gray-500 my-2">
                            Use esta opção primeiro se processos como 'FIX-P' ou 'POR-P' pararam de funcionar após restaurar um backup. Isso tentará consertá-los sem apagar outros dados.
                        </p>
                        <Button onClick={handleForceRebuild} variant="secondary" disabled={isRebuilding}>
                            {isRebuilding ? 'Reparando...' : 'Reparar Processos'}
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
                    <div className="text-left space-y-3">
                        <p className="font-bold text-red-600">ATENÇÃO: AÇÃO IRREVERSÍVEL!</p>
                        <p className="text-sm text-gray-700">
                            Você está prestes a substituir <span className="font-bold">TODOS</span> os dados atuais do sistema pelo conteúdo do arquivo de backup.
                        </p>
                        <p className="text-sm text-gray-700">
                           Tem certeza que deseja continuar?
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
