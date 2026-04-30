
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { InventoryHook, Component, ManufacturingHook, View, ScannedQRCodeData, FamiliaComponente } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { InventoryLogModal } from './InventoryLogModal';
import { InventoryHistoryModal } from './InventoryHistoryModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { ComponentProcessDetailModal } from './ComponentProcessDetailModal';
import { Pagination } from './ui/Pagination';
import { InlineQRCode } from './ui/InlineQRCode';
import { EmptyState } from './ui/EmptyState';
import { ComponentUsageModal } from './ComponentUsageModal';
import { usePermissions } from '../hooks/usePermissions';
import { ComponentEditModal } from './ComponentEditModal';
import { getComponentCost } from '../hooks/manufacturing-evaluator';
import { useToast } from '../hooks/useToast';
import { Database, AlertTriangle, RefreshCw, Cloud } from 'lucide-react';

const ITEMS_PER_PAGE = 25;
const LOW_STOCK_THRESHOLD = 10;

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ComponentsView: React.FC<ComponentsViewProps> = ({ inventory, manufacturing, setCurrentView, onShowQRCode, initialFilter, onClearFilter }) => {
    const { 
        components, addComponent, updateComponent, deleteComponent, addInventoryLog, 
        getLogsForComponent, getKitsUsingComponent, recalculateAllComponentCosts,
        isDirty, savingStatus, saveChanges, lastSync, isOutdated, refreshFromCloud
    } = inventory;
    const { familias, setActiveFamiliaId } = manufacturing;
    const { canViewCosts } = usePermissions();
    const { addToast } = useToast();

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [filterTab, setFilterTab] = useState<'all' | 'low' | 'process'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Modals states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    // Fix: Added missing editingComponent state to resolve "Cannot find name 'editingComponent'" and "Cannot find name 'setEditingComponent'" errors.
    const [editingComponent, setEditingComponent] = useState<Component | null>(null);
    const [deletingComponent, setDeletingComponent] = useState<Component | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [processDetailComponent, setProcessDetailComponent] = useState<Component | null>(null);
    const [usageComponent, setUsageComponent] = useState<Component | null>(null);
    const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
    const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
    const [isDiscardDraftConfirmOpen, setIsDiscardDraftConfirmOpen] = useState(false);

    const processControlledFamiliaIds = useMemo(() => 
        new Set(familias.filter(f => f.nodes?.some(n => n.data.type === 'productGenerator')).map(f => f.id)), 
    [familias]);

    const filteredComponents = useMemo(() => {
        let results = components.filter(c => c.type === 'component');
        
        if (filterTab === 'low') results = results.filter(c => c.stock <= LOW_STOCK_THRESHOLD);
        if (filterTab === 'process') results = results.filter(c => !!c.familiaId && processControlledFamiliaIds.has(c.familiaId));

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(c => (c.name || '').toLowerCase().includes(lower) || (c.sku || '').toLowerCase().includes(lower));
        }
        
        return results.sort((a,b) => a.name.localeCompare(b.name));
    }, [components, searchTerm, filterTab, processControlledFamiliaIds]);

    const paginatedComponents = filteredComponents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredComponents.length / ITEMS_PER_PAGE);

    const handleQuickStock = async (component: Component, delta: number) => {
        if (component.stock + delta < 0) return;
        await addInventoryLog({
            componentId: component.id,
            type: delta > 0 ? 'entrada' : 'saída',
            quantity: Math.abs(delta),
            reason: delta > 0 ? 'ajuste_inventario_positivo' : 'ajuste_inventario_negativo',
            notes: 'Ajuste rápido via menu de componentes'
        });
    };

    const handleSync = async () => {
        if (isOutdated) {
            setIsSyncConfirmOpen(true);
            return;
        }
        await saveChanges();
    };

    const handleRefresh = () => {
        if (isDirty) {
            setIsRefreshConfirmOpen(true);
            return;
        }
        localStorage.removeItem('localDrafts');
        refreshFromCloud();
    };

    const StatusBadge = ({ stock }: { stock: number }) => {
        if (stock <= 0) return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Sem Estoque</span>;
        if (stock <= LOW_STOCK_THRESHOLD) return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Estoque Baixo</span>;
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Saudável</span>;
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Central de Componentes</h2>
                        {isOutdated && (
                            <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase animate-pulse border border-amber-200">
                                <AlertTriangle size={12} />
                                Versão Desatualizada
                                <button onClick={handleRefresh} className="underline ml-1 hover:text-amber-900">Atualizar</button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-slate-500 font-medium">Gestão tática de itens processados e acabados.</p>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-1.5">
                            {savingStatus === 'saving' && <span className="flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                            {savingStatus === 'saved' && <span className="text-green-600 text-[10px] font-black uppercase">✓ Sincronizado</span>}
                            {lastSync && savingStatus === 'idle' && !isDirty && (
                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                                    Sincronizado às {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {isDirty && savingStatus === 'idle' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-600 text-[10px] font-black uppercase animate-pulse flex items-center gap-1">
                                        <Database size={10} />
                                        Rascunho Ativo
                                    </span>
                                    <button 
                                        onClick={() => setIsDiscardDraftConfirmOpen(true)}
                                        className="text-[9px] text-red-400 hover:text-red-600 font-black uppercase underline"
                                    >
                                        Descartar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <Button 
                            onClick={handleSync} 
                            disabled={savingStatus === 'saving'}
                            className="h-11 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 flex items-center gap-2"
                        >
                            <Cloud size={16} />
                            {savingStatus === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    )}
                    <Button 
                        onClick={async () => {
                            await recalculateAllComponentCosts(manufacturing.familias, inventory.components, {
                                ws: manufacturing.workStations,
                                cons: manufacturing.consumables,
                                ops: manufacturing.standardOperations,
                                kits: inventory.kits
                            });
                            addToast('Todos os custos de componentes foram recalculados.', 'success');
                        }} 
                        variant="secondary" 
                        className="h-11 border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        Recalcular Custos
                    </Button>
                    <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-autro-primary' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-autro-primary' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                    </div>
                    <Button onClick={() => setIsAddModalOpen(true)} className="h-11 shadow-lg shadow-blue-500/20">+ Novo Componente</Button>
                </div>
            </header>

            <Card className="bg-slate-50 border-slate-200">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
                        {[
                            { id: 'all', label: 'Tudo' },
                            { id: 'low', label: 'Estoque Baixo' },
                            { id: 'process', label: 'Pelo Processo' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setFilterTab(tab.id as any)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-grow max-w-md relative">
                        <Input 
                            placeholder="Buscar por nome ou SKU..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="pl-10 !bg-white"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </Card>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedComponents.map(c => {
                        const isProcessControlled = processControlledFamiliaIds.has(c.familiaId || '');
                        return (
                            <Card key={c.id} className={`flex flex-col h-full border-t-4 ${isProcessControlled ? 'border-t-purple-500' : 'border-t-slate-900'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 flex-grow">
                                        <h4 className="font-black text-slate-900 leading-tight line-clamp-2 uppercase tracking-tighter" title={c.name}>{c.name}</h4>
                                        <p className="text-[10px] font-mono text-slate-400 uppercase font-bold">{c.sku}</p>
                                    </div>
                                    <StatusBadge stock={c.stock} />
                                </div>
                                
                                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl mb-4">
                                    <div className="flex-grow">
                                        <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Estoque Disponível</span>
                                        <span className="text-2xl font-black text-slate-900">{c.stock}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleQuickStock(c, -1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 font-bold transition-colors shadow-sm">-</button>
                                        <button onClick={() => handleQuickStock(c, 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 font-bold transition-colors shadow-sm">+</button>
                                    </div>
                                </div>

                                {canViewCosts && (
                                    <div className="text-xs space-y-1 mb-4 border-b border-slate-100 pb-4">
                                        <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase tracking-tighter">Custo Un.</span><span className="text-slate-900 font-bold">{formatCurrency(getComponentCost(c))}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase tracking-tighter">Valor Total</span><span className="text-autro-primary font-black">{formatCurrency(getComponentCost(c) * c.stock)}</span></div>
                                    </div>
                                )}

                                <div className="mt-auto grid grid-cols-2 gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => { setSelectedComponent(c); setIsLogModalOpen(true); }}>Movimentar</Button>
                                    <Button variant="secondary" size="sm" onClick={() => { setEditingComponent(c); setIsEditModalOpen(true); }}>Editar</Button>
                                    <Button variant="ghost" size="sm" className="col-span-2" onClick={() => { setSelectedComponent(c); setIsHistoryModalOpen(true); }}>Ver Histórico</Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-300 uppercase tracking-widest">Identificação / SKU</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Estoque</th>
                                    {canViewCosts && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">Custo Un.</th>}
                                    {canViewCosts && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">Valor Total</th>}
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">Gestão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {paginatedComponents.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-black text-slate-900 uppercase text-xs">{c.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400 font-bold">{c.sku}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge stock={c.stock} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleQuickStock(c, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-rose-500 hover:text-white transition-all font-bold">-</button>
                                                <span className="text-sm font-black text-slate-900 w-8 text-center">{c.stock}</span>
                                                <button onClick={() => handleQuickStock(c, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-emerald-500 hover:text-white transition-all font-bold">+</button>
                                            </div>
                                        </td>
                                        {canViewCosts && <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">{formatCurrency(getComponentCost(c))}</td>}
                                        {canViewCosts && <td className="px-6 py-4 text-right text-sm font-black text-autro-primary">{formatCurrency(getComponentCost(c) * c.stock)}</td>}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setSelectedComponent(c); setIsHistoryModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900" title="Histórico"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                                                <button onClick={() => { setEditingComponent(c); setIsEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900" title="Editar"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg></button>
                                                <button onClick={() => setDeletingComponent(c)} className="p-2 text-slate-400 hover:text-rose-600" title="Excluir"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

            {/* Modals - Reutilizando os existentes para manter funcionalidade */}
            {isAddModalOpen && <ComponentAddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={addComponent} familias={familias} />}
            {isEditModalOpen && editingComponent && <ComponentEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={updateComponent} componentToEdit={editingComponent} familias={familias} />}
            {isLogModalOpen && selectedComponent && <InventoryLogModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} component={selectedComponent} onSave={addInventoryLog} />}
            {isHistoryModalOpen && selectedComponent && <InventoryHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} component={selectedComponent} logs={getLogsForComponent(selectedComponent.id)} />}
            {deletingComponent && (
                <ConfirmationModal isOpen={!!deletingComponent} onClose={() => setDeletingComponent(null)} onConfirm={async () => { await deleteComponent(deletingComponent.id); setDeletingComponent(null); }} title={`Excluir Componente`}>
                    <p className="text-sm font-medium">Deseja remover permanentemente o componente <span className="font-black">"{deletingComponent.name}"</span>?</p>
                </ConfirmationModal>
            )}

            <ConfirmationModal
                isOpen={isSyncConfirmOpen}
                onClose={() => setIsSyncConfirmOpen(false)}
                onConfirm={async () => {
                    setIsSyncConfirmOpen(false);
                    await saveChanges();
                }}
                title="Confirmar Sincronização"
            >
                <p>Atenção: Outro usuário alterou o estoque na nuvem. Salvar agora pode sobrescrever mudanças dele. Deseja continuar?</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isRefreshConfirmOpen}
                onClose={() => setIsRefreshConfirmOpen(false)}
                onConfirm={() => {
                    setIsRefreshConfirmOpen(false);
                    localStorage.removeItem('localDrafts');
                    refreshFromCloud();
                }}
                title="Confirmar Atualização"
            >
                <p>Você tem alterações locais não salvas. Atualizar agora irá descartar seu rascunho. Continuar?</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isDiscardDraftConfirmOpen}
                onClose={() => setIsDiscardDraftConfirmOpen(false)}
                onConfirm={() => {
                    localStorage.removeItem('localDrafts');
                    window.location.reload();
                }}
                title="Descartar Rascunho"
            >
                <p>Tem certeza que deseja descartar o rascunho local? Esta ação não pode ser desfeita.</p>
            </ConfirmationModal>
        </div>
    );
};

// Interfaces auxiliares mantidas por compatibilidade (devem ser exportadas ou estar no types)
interface ComponentsViewProps {
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  setCurrentView: (view: View) => void;
  onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
  initialFilter: { type: 'low-stock' } | null;
  onClearFilter: () => void;
}

const ComponentAddModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (component: Omit<Component, 'id' | 'stock'>) => Promise<any>;
    familias: ManufacturingHook['familias'];
}> = ({ isOpen, onClose, onSave, familias }) => {
    const [data, setData] = useState<Partial<Component>>({ name: '', sku: '', familiaId: '', type: 'component', custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'manufactured' });
    
    const availableFamiliasGrouped = useMemo(() => {
        const all = (familias || []).filter(f => 
            f.nodes?.some(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode')
        );

        let filtered = all;
        if (all.some(f => !!f.masterProcessTag)) {
            filtered = all.filter(f => !!f.masterProcessTag);
        } else {
            filtered = all.filter(f => {
                const nome = f.nome?.toUpperCase() || '';
                const isSubProcess = nome.includes('CABO') || nome.includes('HASTE') || nome.includes('SEGREDO') || nome.includes('CORPO CHAVE');
                return !isSubProcess;
            });
        }

        const groups: Record<string, FamiliaComponente[]> = {
            'Montagem Final (FIX-P)': [],
            'Montagem Estrutural (FIX-S)': [],
            'Montagem Estrutural (FIX-S EXT)': [],
            'Processos Genéricos': [],
            'Outros': []
        };

        filtered.forEach(f => {
            let tag: string = f.masterProcessTag || 'Generico';
            let groupName = 'Processos Genéricos';
            
            if (tag === 'FIX-P') groupName = 'Montagem Final (FIX-P)';
            else if (tag === 'FIX-S') groupName = 'Montagem Estrutural (FIX-S)';
            else if (tag === 'FIX-S EXT') groupName = 'Montagem Estrutural (FIX-S EXT)';
            else if (tag === 'Generico') groupName = 'Processos Genéricos';

            if (groups[groupName]) groups[groupName].push(f);
            else groups['Outros'].push(f);
        });

        return groups;
    }, [familias]);

    const handleSave = async () => {
        if (!data.name || !data.sku || !data.familiaId) return alert('Campos obrigatórios faltando.');
        await onSave(data as Omit<Component, 'id' | 'stock'>);
        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Novo Componente">
            <div className="space-y-4">
                <Input label="Nome do Componente" value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                <Input label="SKU" value={data.sku} onChange={e => setData({...data, sku: e.target.value})} />
                <Select label="Família / Fluxo" value={data.familiaId} onChange={e => setData({...data, familiaId: e.target.value})}>
                    <option value="">Selecione...</option>
                    {(Object.entries(availableFamiliasGrouped) as [string, FamiliaComponente[]][]).map(([group, fams]) => (
                        fams.length > 0 && (
                            <optgroup key={group} label={group}>
                                {fams.map(f => (
                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                ))}
                            </optgroup>
                        )
                    ))}
                </Select>
                <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></div>
            </div>
        </Modal>
    );
};
