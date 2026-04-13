
import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Component, InventoryHook, ScannedQRCodeData } from '../types';
import { InventoryLogModal } from './InventoryLogModal';
import * as api from '../hooks/api';
import { InventoryHistoryModal } from './InventoryHistoryModal';
import { Pagination } from './ui/Pagination';
import { EmptyState } from './ui/EmptyState';
import { getComponentCost } from '../hooks/manufacturing-evaluator';
import { useToast } from '../hooks/useToast';

const ITEMS_PER_PAGE = 25;
const LOW_STOCK_THRESHOLD = 5;

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const RawMaterialsView: React.FC<RawMaterialsViewProps> = ({ inventory, onShowQRCode }) => {
    const { components, addComponent, updateComponent, deleteComponent, addInventoryLog, getLogsForComponent } = inventory;
    const { addToast } = useToast();

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryTab, setCategoryTab] = useState<'all' | 'weight' | 'length' | 'count'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Component | null>(null);
    const [selectedMaterial, setSelectedMaterial] = useState<Component | null>(null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [deletingMaterial, setDeletingMaterial] = useState<Component | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSaveToFirebase = async () => {
        setIsSyncing(true);
        try {
            await api.forceUseSupabase();
            const localData = await api.getLocalData();
            await api.restoreAllData(localData);
            await api.forceUseLocalStorage();
            addToast('Dados salvos no Supabase!', 'success');
        } catch (error) {
            console.error('Save error:', error);
            addToast('Erro ao salvar no Firebase.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const rawMaterials = useMemo(() =>
        components.filter(c => c.type === 'raw_material')
            .sort((a, b) => a.name.localeCompare(b.name)),
        [components]
    );

    const filteredMaterials = useMemo(() => {
        let results = rawMaterials;
        if (categoryTab !== 'all') results = results.filter(m => m.unitCategory === categoryTab);
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(m => (m.name || '').toLowerCase().includes(lower) || (m.sku || '').toLowerCase().includes(lower));
        }
        return results;
    }, [rawMaterials, searchTerm, categoryTab]);

    const paginatedMaterials = filteredMaterials.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);

    const handleQuickStock = async (material: Component, delta: number) => {
        if (material.stock + delta < 0) return;
        await addInventoryLog({
            componentId: material.id,
            type: delta > 0 ? 'entrada' : 'saída',
            quantity: Math.abs(delta),
            reason: delta > 0 ? 'ajuste_inventario_positivo' : 'ajuste_inventario_negativo',
            notes: 'Ajuste rápido via menu de matérias-primas'
        });
        addToast(`${material.name}: Estoque atualizado.`, 'success');
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Matérias-Primas</h2>
                    <p className="text-slate-500 font-medium">Controle de insumos brutos e suprimentos de base.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSaveToFirebase} disabled={isSyncing} variant="primary">
                        {isSyncing ? 'Salvando...' : '💾 Salvar'}
                    </Button>
                    <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-autro-primary' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-autro-primary' : 'text-slate-400'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="h-11 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 border-none">Cadastrar Material</Button>
                </div>
            </header>

            <Card className="bg-slate-50 border-slate-200">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'weight', label: 'Peso' },
                            { id: 'length', label: 'Comprimento' },
                            { id: 'count', label: 'Unidades' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setCategoryTab(tab.id as any)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${categoryTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-grow max-w-md relative">
                        <Input 
                            placeholder="Buscar material bruto..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="pl-10 !bg-white"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </Card>

            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-300 uppercase tracking-widest">Matéria-Prima / SKU</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Categoria</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Estoque Atual</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">Custo de Compra</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {paginatedMaterials.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="font-black text-slate-900 uppercase text-xs">{m.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400 font-bold">{m.sku}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter">
                                            {m.unitCategory === 'weight' ? 'Peso (Kg)' : m.unitCategory === 'length' ? 'Comp. (M)' : 'Contagem'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-3">
                                            <button onClick={() => handleQuickStock(m, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-rose-500 hover:text-white transition-all font-bold">-</button>
                                            <span className={`text-sm font-black w-14 text-center ${m.stock <= LOW_STOCK_THRESHOLD ? 'text-rose-600' : 'text-slate-900'}`}>{m.stock} {m.purchaseUnit}</span>
                                            <button onClick={() => handleQuickStock(m, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-emerald-500 hover:text-white transition-all font-bold">+</button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-xs font-bold text-slate-900">{formatCurrency(getComponentCost(m))} / {m.purchaseUnit}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Último Custo</p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingMaterial(m); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg></button>
                                            <button onClick={() => setDeletingMaterial(m)} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

            {/* Modals - Reutilizando lógica existente */}
            {isModalOpen && <MaterialModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingMaterial(null); }} onSave={editingMaterial ? updateComponent : addComponent} materialToEdit={editingMaterial} />}
            {isLogModalOpen && selectedMaterial && <InventoryLogModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} component={selectedMaterial} onSave={addInventoryLog} />}
            {isHistoryModalOpen && selectedMaterial && <InventoryHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} component={selectedMaterial} logs={getLogsForComponent(selectedMaterial.id)} />}
            {deletingMaterial && (
                <ConfirmationModal isOpen={!!deletingMaterial} onClose={() => setDeletingMaterial(null)} onConfirm={async () => { await deleteComponent(deletingMaterial.id); setDeletingMaterial(null); }} title="Remover Matéria-Prima">
                    <p className="text-sm font-medium">Excluir <span className="font-black">"{deletingMaterial.name}"</span> do banco de dados?</p>
                </ConfirmationModal>
            )}
        </div>
    );
};

interface RawMaterialsViewProps {
    inventory: InventoryHook;
    onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
}

const MaterialModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (material: any) => Promise<void>;
    materialToEdit: Component | null;
}> = ({ isOpen, onClose, onSave, materialToEdit }) => {
    const [data, setData] = useState<Partial<Component>>(materialToEdit || { name: '', sku: '', purchaseCost: 0, unitCategory: 'weight', purchaseUnit: 'kg', consumptionUnit: 'kg', type: 'raw_material', custoFabricacao: 0, custoMateriaPrima: 0 });
    const handleSave = async () => {
        if (!data.name || !data.sku) return alert('Campos obrigatórios.');
        await onSave(data);
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={materialToEdit ? "Editar Material" : "Cadastrar Matéria-Prima"}>
            <div className="space-y-4">
                <Input label="Descrição" value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                <Input label="SKU" value={data.sku} onChange={e => setData({...data, sku: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                    <Select label="Categoria" value={data.unitCategory} onChange={e => setData({...data, unitCategory: e.target.value as any})}>
                        <option value="weight">Peso (Kg)</option>
                        <option value="length">Comprimento (M)</option>
                        <option value="count">Contagem (Un)</option>
                    </Select>
                    <Input label="Custo Compra (R$)" type="number" value={data.purchaseCost} onChange={e => setData({...data, purchaseCost: parseFloat(e.target.value)})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Qtd na Compra" type="number" value={data.purchaseQuantity || 1} onChange={e => setData({...data, purchaseQuantity: parseFloat(e.target.value)})} placeholder="Ex: 3 (se for barra de 3m)" />
                    <div className="flex items-end pb-1">
                        <p className="text-[10px] text-slate-400 italic">O custo unitário será calculado automaticamente.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={handleSave}>Confirmar</Button></div>
            </div>
        </Modal>
    );
};
