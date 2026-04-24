
import React, { useState, useMemo } from 'react';
import { InventoryHook, ManufacturingHook, Component, Kit } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { 
    Wrench, 
    Settings, 
    Package, 
    FileText, 
    Layers, 
    Circle, 
    Hexagon, 
    Maximize2,
    Plus,
    Trash2,
    Link as LinkIcon,
    ChevronRight,
    Dna,
    Activity,
    Cpu,
    ShieldCheck,
    AlertCircle,
    Search,
    Zap,
    Copy
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { CreateProcessModal } from './CreateProcessModal';

interface InventorySlotProps {
    title: string;
    categoryId: string;
    icon: React.ReactNode;
    items: (Component | Kit)[];
    color: string;
    onAddItem?: () => void;
    onDropItem: (itemId: string, itemType: 'component' | 'kit', newCategory: string) => void;
}

const InventorySlot: React.FC<InventorySlotProps> = ({ title, categoryId, icon, items, color, onAddItem, onDropItem }) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('itemId');
        const itemType = e.dataTransfer.getData('itemType') as 'component' | 'kit';
        if (itemId && itemType) {
            onDropItem(itemId, itemType, categoryId);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className={`flex items-center justify-between p-3 rounded-t-xl ${color} text-white shadow-sm`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
                </div>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div 
                className="flex-grow bg-slate-50/50 border-x border-b border-slate-200 rounded-b-xl p-2 overflow-y-auto max-h-[300px] scrollbar-thin"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {items.length === 0 ? (
                    <div className="h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
                        <Plus size={16} className="mb-1 opacity-50" />
                        <span className="text-[9px] font-bold uppercase">Vazio</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {items.map(item => {
                            const isKit = 'components' in item;
                            return (
                                <div 
                                    key={item.id} 
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('itemId', item.id);
                                        e.dataTransfer.setData('itemType', isKit ? 'kit' : 'component');
                                    }}
                                    className="group relative bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:border-autro-primary transition-all cursor-grab active:cursor-grabbing"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-800 truncate">{item.name}</span>
                                        <span className="text-[8px] font-mono text-slate-400 uppercase">{item.sku} {isKit ? '(Kit)' : ''}</span>
                                    </div>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-1.5 h-1.5 rounded-full bg-autro-primary"></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {onAddItem && (
                    <button 
                        onClick={onAddItem}
                        className="w-full mt-2 py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:text-autro-primary hover:border-autro-primary hover:bg-white transition-all flex items-center justify-center gap-1"
                    >
                        <Plus size={12} />
                        <span className="text-[9px] font-black uppercase">Adicionar</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export const KitEngineeringView: React.FC<{ inventory: InventoryHook; manufacturing: ManufacturingHook }> = ({ inventory, manufacturing }) => {
    const { addToast } = useToast();
    const [isAddingRule, setIsAddingRule] = useState(false);
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [newRule, setNewRule] = useState({ condition: '', result: '' });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchTerm, setSearchTerm] = useState('');

    const tabItems = [
        { id: 'dashboard', label: 'Dashboard de Engenharia', icon: <Activity size={14} className="mr-2" /> },
        { id: 'compatibility', label: 'Matriz de Compatibilidade', icon: <LinkIcon size={14} className="mr-2" /> },
        { id: 'dna', label: 'DNA Geométrico Mestre', icon: <Dna size={14} className="mr-2" /> },
        { id: 'processes', label: 'Fluxos de Fabricação', icon: <Cpu size={14} className="mr-2" /> },
    ];

    const engineeringStats = useMemo(() => {
        const totalComponents = inventory.components.length;
        const totalKits = inventory.kits.length;
        const totalProcesses = manufacturing.familias.length;
        const totalRules = inventory.kits.reduce((acc, k) => acc + (k.compatibilityRules?.length || 0), 0) + 4; // +4 for defaults
        
        return { totalComponents, totalKits, totalProcesses, totalRules };
    }, [inventory.components, inventory.kits, manufacturing.familias]);

    const validationAlerts = useMemo(() => {
        const alerts: { type: 'warning' | 'error'; message: string; familyId?: string; actionType?: 'autoCategorize' }[] = [];
        
        // Check for families without DNA
        manufacturing.familias.forEach(f => {
            const hasDNA = f.nodes.some(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable');
            if (!hasDNA && f.category === 'manufacturing') {
                alerts.push({ type: 'warning', message: `Processo "${f.nome}" não possui tabela de DNA definida.`, familyId: f.id });
            }
        });

        return alerts;
    }, [manufacturing.familias]);

    const dnaDimensions = useMemo(() => {
        const allDims: { familiaName: string; familiaId: string; nodeId: string; dimensions: any[] }[] = [];
        manufacturing.familias.forEach(f => {
            f.nodes.forEach(n => {
                if ((n.data.type === 'dnaTable' || n.data.type === 'dimensionTable' || n.data.type === 'dnaTableNode') && n.data.dimensions) {
                    allDims.push({
                        familiaName: f.nome,
                        familiaId: f.id,
                        nodeId: n.id,
                        dimensions: n.data.dimensions
                    });
                }
            });
        });
        return allDims;
    }, [manufacturing.familias]);

    const globalVariables = useMemo(() => {
        const vars: { familiaName: string; familiaId: string; nodeId: string; label: string; cost: number }[] = [];
        manufacturing.familias.forEach(f => {
            f.nodes.forEach(n => {
                if (n.data.type === 'processVariable') {
                    vars.push({
                        familiaName: f.nome,
                        familiaId: f.id,
                        nodeId: n.id,
                        label: n.data.label,
                        cost: n.data.cost
                    });
                }
            });
        });
        return vars;
    }, [manufacturing.familias]);

    const categories = useMemo(() => {
        const comps = inventory.components;
        const kits = inventory.kits;

        const categorized = {
            fixadores: [] as (Component | Kit)[],
            porcas: [] as (Component | Kit)[],
            copos: [] as (Component | Kit)[],
            tampas: [] as (Component | Kit)[],
            chaves: [] as (Component | Kit)[],
            insumos: [] as (Component | Kit)[],
            manuais: [] as (Component | Kit)[],
            embalagens: [] as (Component | Kit)[],
            outros: [] as (Component | Kit)[]
        };

        const allItems = [...comps, ...kits].filter(item => {
            if (!searchTerm) return true;
            return item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        });

        allItems.forEach(item => {
            let cat = item.category;
            if (!cat) {
                const isKit = 'components' in item;
                if (isKit) {
                    if (item.name.toLowerCase().includes('chave') || item.sku.includes('CHAVE')) cat = 'chaves';
                    else cat = 'outros';
                } else {
                    const c = item as Component;
                    if (c.sku.includes('PAR-') || c.sku.includes('FIX-') || c.name.toLowerCase().includes('parafuso') || c.name.toLowerCase().includes('fixador') || c.name.toLowerCase().includes(' par ') || c.name.toLowerCase().startsWith('par ') || c.name.toLowerCase().includes(' fix ') || c.name.toLowerCase().startsWith('fix ')) cat = 'fixadores';
                    else if (c.sku.includes('NUT-') || c.name.toLowerCase().includes('porca') || c.sku.includes('POR-P') || c.sku.includes('POR-') || c.name.toLowerCase().includes(' por ') || c.name.toLowerCase().startsWith('por ')) cat = 'porcas';
                    else if (c.sku.includes('COPO') || c.name.toLowerCase().includes('copo')) cat = 'copos';
                    else if (c.sku.includes('TAMPA') || c.name.toLowerCase().includes('tampa')) cat = 'tampas';
                    else if (c.name.toLowerCase().includes('chave') || c.sku.includes('CHAVE')) cat = 'chaves';
                    else if (c.type === 'raw_material' && !c.sku.includes('PAR-') && !c.sku.includes('FIX-') && !c.sku.includes('NUT-')) cat = 'insumos';
                    else if (c.sku.includes('MANUAL') || c.name.toLowerCase().includes('manual')) cat = 'manuais';
                    else if (c.sku.includes('EMB-') && !c.sku.includes('COPO') && !c.sku.includes('TAMPA')) cat = 'embalagens';
                    else cat = 'outros';
                }
            }

            if (categorized[cat as keyof typeof categorized]) {
                categorized[cat as keyof typeof categorized].push(item);
            } else {
                categorized.outros.push(item);
            }
        });

        return categorized;
    }, [inventory.components, inventory.kits, searchTerm]);

    const handleDropItem = async (itemId: string, itemType: 'component' | 'kit', newCategory: string) => {
        if (itemType === 'component') {
            const comp = inventory.components.find(c => c.id === itemId);
            if (comp) {
                await inventory.updateComponent({ ...comp, category: newCategory });
                addToast(`Componente movido para ${newCategory}`, 'success');
            }
        } else {
            const kit = inventory.kits.find(k => k.id === itemId);
            if (kit) {
                await inventory.updateKit({ ...kit, category: newCategory });
                addToast(`Kit movido para ${newCategory}`, 'success');
            }
        }
    };

    const globalRules = useMemo(() => {
        const rules: { condition: string; result: string }[] = [];
        const seen = new Set<string>();
        
        // Default rules that reflect the system logic
        const defaultRules = [
            // Regras de Componentes
            { condition: 'Parafuso M6', result: 'Copo 19,05mm' },
            { condition: 'Parafuso M8', result: 'Copo 22,22mm' },
            { condition: 'Parafuso M10', result: 'Copo 25,40mm' },
            { condition: 'Comprimento = 0', result: 'Usar Por-P (Porca)' },
            { condition: 'Variante Fix-S', result: 'Cabeça Fix-S (Segurança)' },
            { condition: 'Variante Fix-P', result: 'Cabeça Fix-P (Pressão)' },
            { condition: 'Venda de Kit', result: 'Chave vendida separadamente' },
            
            // Regras de Fluxo de Processos
            { condition: 'Processo: Usinagem Sextavado', result: 'Requer: Barra Sextavada (Insumo)' },
            { condition: 'Processo: Corte de Barra', result: 'Requer: Serra Fita (Equipamento)' },
            { condition: 'Processo: Estamparia', result: 'Requer: Molde Específico' },
            { condition: 'Processo: Tratamento Térmico', result: 'Aumenta Dureza em 20%' },
            { condition: 'Processo: Zincagem', result: 'Adiciona 0.05mm de espessura' },
            
            // Regras de Geração de Kits
            { condition: 'Geração: Kit de Fixação', result: 'Incluir: Manual de Instruções' },
            { condition: 'Geração: Kit com Copo', result: 'Incluir: Embalagem Plástica Protetora' },
            { condition: 'Geração: Produto Final', result: 'Requer: Inspeção de Qualidade' },
            { condition: 'DNA: Passo de Rosca Fino', result: 'Ajustar Velocidade de Usinagem (-15%)' },
            { condition: 'Tabela de Códigos: Prefixo PAR', result: 'Família: Fixadores' }
        ];

        inventory.kits.forEach(k => {
            k.compatibilityRules?.forEach(r => {
                const key = `${r.condition}-${r.result}`;
                if (!seen.has(key)) {
                    rules.push(r);
                    seen.add(key);
                }
            });
        });
        
        // If no rules are found in any kit, we show the defaults
        if (rules.length === 0) {
            return defaultRules;
        }
        
        return rules;
    }, [inventory.kits]);

    const [editingRule, setEditingRule] = useState<{ index: number; condition: string; result: string } | null>(null);

    const handleAddRule = async () => {
        if (!newRule.condition || !newRule.result) return;
        
        const updatePromises = inventory.kits.map(k => {
            const updatedRules = [...(k.compatibilityRules || []), newRule];
            return inventory.updateKit({ ...k, compatibilityRules: updatedRules });
        });
        
        await Promise.all(updatePromises);
        setNewRule({ condition: '', result: '' });
        setIsAddingRule(false);
        addToast('Regra global adicionada com sucesso.', 'success');
    };

    const handleUpdateRule = async () => {
        if (!editingRule || !editingRule.condition || !editingRule.result) return;
        
        const oldRule = globalRules[editingRule.index];
        
        const updatePromises = inventory.kits.map(k => {
            const updatedRules = (k.compatibilityRules || []).map(r => 
                (r.condition === oldRule.condition && r.result === oldRule.result) 
                ? { condition: editingRule.condition, result: editingRule.result } 
                : r
            );
            return inventory.updateKit({ ...k, compatibilityRules: updatedRules });
        });
        
        await Promise.all(updatePromises);
        setEditingRule(null);
        addToast('Regra atualizada com sucesso.', 'success');
    };

    const handleDeleteRule = async (condition: string, result: string) => {
        const updatePromises = inventory.kits.map(k => {
            const updatedRules = (k.compatibilityRules || []).filter(r => r.condition !== condition || r.result !== result);
            return inventory.updateKit({ ...k, compatibilityRules: updatedRules });
        });
        await Promise.all(updatePromises);
        addToast('Regra global removida.', 'info');
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Engenharia Mestra de Kits</h2>
                    <p className="text-sm text-slate-500 font-medium">Gerencie o ecossistema de componentes e regras de montagem.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAddingRule(true)} className="shadow-lg shadow-autro-primary/20">
                        <LinkIcon size={16} className="mr-2" />
                        Vincular Compatibilidade
                    </Button>
                </div>
            </div>

            <div className="w-full">
                <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 overflow-x-auto no-scrollbar">
                    {tabItems.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all duration-200 whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'bg-white shadow-sm text-slate-900' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Componentes', value: engineeringStats.totalComponents, icon: <Package className="text-blue-500" /> },
                            { label: 'Kits Configuráveis', value: engineeringStats.totalKits, icon: <Layers className="text-indigo-500" /> },
                            { label: 'Famílias de Geração', value: engineeringStats.totalProcesses, icon: <Cpu className="text-emerald-500" /> },
                            { label: 'Regras de Lógica', value: engineeringStats.totalRules, icon: <ShieldCheck className="text-amber-500" /> }
                        ].map((stat, i) => (
                            <Card key={i} className="p-6 border-none shadow-soft flex items-center gap-4 group hover:bg-slate-50 transition-colors">
                                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {stat.icon}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-1 border-none shadow-soft overflow-hidden bg-slate-900 group relative">
                             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Cpu size={120} className="text-white" />
                             </div>
                             <div className="p-8 h-full flex flex-col relative z-10">
                                <div className="w-16 h-16 bg-autro-primary rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-autro-primary/40 group-hover:rotate-12 transition-transform">
                                    <Plus size={32} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic">Novas Famílias</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-8">
                                    Crie novas matrizes de geração para parafusos, porcas ou kits complexos.
                                </p>
                                <div className="mt-auto">
                                    <Button 
                                        onClick={() => setIsCreateFamilyModalOpen(true)}
                                        className="w-full bg-white text-slate-900 border-none h-12 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 shadow-xl"
                                    >
                                        Criar Nova Família
                                    </Button>
                                </div>
                             </div>
                        </Card>
                        <Card className="border-none shadow-soft overflow-hidden">
                            <div className="bg-slate-900 p-4 flex items-center gap-3">
                                <AlertCircle size={20} className="text-amber-400" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Alertas de Integridade</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Inconsistências detectadas na engenharia</p>
                                </div>
                            </div>
                            <div className="p-4 space-y-3 bg-white">
                                {validationAlerts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-emerald-500">
                                        <ShieldCheck size={48} className="mb-2 opacity-20" />
                                        <p className="text-xs font-black uppercase tracking-widest">Tudo em conformidade</p>
                                    </div>
                                ) : (
                                    validationAlerts.map((alert, i) => (
                                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${alert.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                            <div className="flex-grow">
                                                <p className="text-xs font-bold leading-tight">{alert.message}</p>
                                                {alert.familyId && (
                                                    <button 
                                                        onClick={() => manufacturing.setActiveFamiliaId(alert.familyId!)}
                                                        className="mt-1 text-[10px] font-black uppercase underline"
                                                    >
                                                        Corrigir agora
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="border-none shadow-soft overflow-hidden">
                            <div className="bg-autro-primary p-4 flex items-center gap-3">
                                <Activity size={20} className="text-white" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Resumo da Matriz</h3>
                                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-tight">Distribuição de regras por categoria</p>
                                </div>
                            </div>
                            <div className="p-6 bg-white flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-4xl font-black text-slate-800">{globalRules.length}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Regras Globais Definidas</p>
                                    <div className="mt-6 flex gap-2">
                                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase">DNA: {dnaDimensions.length}</div>
                                        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">Variáveis: {globalVariables.length}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                    </div>
                )}

                {activeTab === 'compatibility' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 border-none shadow-soft overflow-hidden">
                            <div className="bg-slate-900 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-autro-primary rounded-xl flex items-center justify-center shadow-lg shadow-autro-primary/40">
                                        <LinkIcon size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Matriz de Compatibilidade Global</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Regras de dependência entre componentes</p>
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                                    {globalRules.length} Regras Ativas
                                </div>
                            </div>
                            <div className="p-6 bg-white">
                                {globalRules.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma regra de compatibilidade definida</p>
                                        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setIsAddingRule(true)}>Criar Primeira Regra</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {globalRules.map((rule, i) => (
                                            <div key={i} className="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-autro-primary hover:bg-white transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Se</span>
                                                        <span className="text-sm font-black text-slate-800">{rule.condition}</span>
                                                    </div>
                                                    <ChevronRight size={16} className="text-autro-primary" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Então</span>
                                                        <span className="text-sm font-black text-autro-primary">{rule.result}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => setEditingRule({ index: i, condition: rule.condition, result: rule.result })}
                                                        className="p-2 text-slate-300 hover:text-autro-primary transition-colors"
                                                    >
                                                        <Settings size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRule(rule.condition, rule.result)}
                                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className="border-none shadow-soft overflow-hidden">
                            <div className="bg-slate-800 p-4 flex items-center gap-3">
                                <Package size={20} className="text-autro-primary" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">BOM Padrão (Universal)</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Itens obrigatórios em todo Kit</p>
                                </div>
                            </div>
                            <div className="p-4 space-y-3 bg-white h-full">
                                {[
                                    { name: 'Manual de Instruções', qty: 1, icon: <FileText size={14} /> },
                                    { name: 'Etiqueta de Identificação', qty: 1, icon: <Package size={14} /> },
                                    { name: 'Embalagem Plástica/Caixa', qty: 1, icon: <Layers size={14} /> }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="text-slate-400">{item.icon}</div>
                                            <span className="text-xs font-bold text-slate-700">{item.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">x{item.qty}</span>
                                    </div>
                                ))}
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[9px] text-amber-700 font-bold leading-relaxed">
                                        * Estes itens são adicionados automaticamente a qualquer Kit gerado pelo sistema, independente das variações de fixadores.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                    </div>
                )}

                {activeTab === 'dna' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-none shadow-soft overflow-hidden">
                            <div className="bg-blue-900 p-4 flex items-center gap-3">
                                <Dna size={20} className="text-blue-400" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">DNA Geométrico Mestre</h3>
                                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-tight">Variações de medidas sincronizadas</p>
                                </div>
                            </div>
                            <div className="p-6 bg-white space-y-6">
                                {dnaDimensions.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum DNA Geométrico encontrado nos processos</p>
                                    </div>
                                ) : (
                                    dnaDimensions.map((dna, idx) => (
                                        <div key={idx} className="border border-slate-100 rounded-2xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{dna.familiaName}</span>
                                                <span className="text-[9px] font-bold text-slate-400">ID: {dna.nodeId}</span>
                                            </div>
                                            <div className="p-4 overflow-x-auto">
                                                <table className="w-full text-[11px]">
                                                    <thead>
                                                        <tr className="text-slate-400 font-black uppercase tracking-widest border-b">
                                                            <th className="pb-2 text-left">Bitola (M)</th>
                                                            <th className="pb-2 text-left">Comprimento (mm)</th>
                                                            <th className="pb-2 text-right">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {dna.dimensions.map((dim, dIdx) => (
                                                            <tr key={dIdx} className="group">
                                                                <td className="py-2 font-black text-slate-700">M{dim.bitola}</td>
                                                                <td className="py-2 font-black text-slate-700">{dim.comprimento}mm</td>
                                                                <td className="py-2 text-right">
                                                                    <button 
                                                                        onClick={() => {
                                                                            manufacturing.setActiveFamiliaId(dna.familiaId);
                                                                            addToast(`Redirecionando para o processo ${dna.familiaName}`, 'info');
                                                                        }}
                                                                        className="text-[9px] font-black text-blue-600 hover:underline uppercase"
                                                                    >
                                                                        Editar no Fluxo
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="border-none shadow-soft overflow-hidden">
                            <div className="bg-slate-800 p-4 flex items-center gap-3">
                                <Settings size={20} className="text-autro-primary" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Variáveis de Engenharia</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Custos e parâmetros globais</p>
                                </div>
                            </div>
                            <div className="p-6 bg-white space-y-4">
                                {globalVariables.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma variável encontrada nos processos</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {globalVariables.map((v, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.familiaName}</span>
                                                    <span className="text-sm font-black text-slate-800">{v.label}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase block">Valor</span>
                                                        <span className="text-sm font-black text-emerald-600">R$ {v.cost.toFixed(2)}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => manufacturing.setActiveFamiliaId(v.familiaId)}
                                                        className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-autro-primary transition-all"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                    </div>
                )}

                {activeTab === 'processes' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-none shadow-soft overflow-hidden">
                        <div className="bg-slate-900 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                    <Cpu size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Fluxos de Fabricação Ativos</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Status da engenharia de processos</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                                {manufacturing.familias.length} Processos
                            </div>
                        </div>
                        <div className="p-6 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {manufacturing.familias.map(f => {
                                    const hasDNA = f.nodes.some(n => n.data.type === 'dnaTable' || n.data.type === 'dimensionTable');
                                    const hasGenerator = f.nodes.some(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode');
                                    
                                    return (
                                        <div key={f.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:border-emerald-500 transition-all group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition-colors">
                                                    <Activity size={18} className="text-slate-400 group-hover:text-emerald-500" />
                                                </div>
                                                <div className="flex gap-1">
                                                    {hasDNA && <span className="w-2 h-2 rounded-full bg-blue-500" title="Possui DNA"></span>}
                                                    {hasGenerator && <span className="w-2 h-2 rounded-full bg-orange-500" title="Gera Produtos"></span>}
                                                </div>
                                            </div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight mb-2 truncate">{f.nome}</h4>
                                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase mb-4">
                                                <span>{f.nodes.length} Blocos</span>
                                                <span>{f.edges.length} Conexões</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="w-full bg-white border-slate-200 text-[10px] font-black uppercase tracking-widest h-9"
                                                    onClick={() => {
                                                        manufacturing.setActiveFamiliaId(f.id);
                                                        addToast(`Abrindo editor de fluxo: ${f.nome}`, 'info');
                                                    }}
                                                >
                                                    Abrir Editor
                                                </Button>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="px-3 bg-white border-slate-200 text-slate-400 hover:text-autro-primary hover:border-autro-primary h-9"
                                                    title="Duplicar Processo"
                                                    onClick={() => {
                                                        manufacturing.duplicateFamilia(f.id);
                                                        addToast(`Família duplicada com sucesso.`, 'success');
                                                    }}
                                                >
                                                    <Copy size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>
                    </div>
                )}
            </div>

            {/* Edit Rule Modal */}
            {editingRule && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-slate-900 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-autro-primary rounded-xl flex items-center justify-center shadow-lg shadow-autro-primary/40">
                                    <Settings size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Editar Regra</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Ajustar lógica de compatibilidade</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-6 bg-white">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Condição de Gatilho (SE)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Maximize2 size={16} />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={editingRule.condition}
                                            onChange={(e) => setEditingRule({...editingRule, condition: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-autro-primary/20 focus:border-autro-primary transition-all"
                                            placeholder="Ex: Parafuso M8"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                        <ChevronRight size={16} className="text-slate-400 rotate-90" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Resultado Esperado (ENTÃO)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-autro-primary">
                                            <Hexagon size={16} />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={editingRule.result}
                                            onChange={(e) => setEditingRule({...editingRule, result: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-autro-primary/20 focus:border-autro-primary transition-all"
                                            placeholder="Ex: Copo 22,22mm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" className="flex-1 font-black uppercase tracking-widest text-[10px]" onClick={() => setEditingRule(null)}>Cancelar</Button>
                                <Button className="flex-1 font-black uppercase tracking-widest text-[10px]" onClick={handleUpdateRule}>Salvar Alterações</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            {isAddingRule && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden">
                        <div className="bg-autro-primary p-6 text-white">
                            <h3 className="text-xl font-black uppercase tracking-tight">Vincular Compatibilidade</h3>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">Crie uma nova dependência lógica</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Condição de Gatilho</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        className="w-full h-12 pl-4 pr-10 rounded-xl border-2 border-slate-100 focus:border-autro-primary outline-none transition-all font-bold text-slate-800"
                                        value={newRule.condition}
                                        onChange={e => setNewRule({...newRule, condition: e.target.value})}
                                        placeholder="Ex: Parafuso M8"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Settings size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-autro-primary">
                                    <ChevronRight size={24} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Resultado Esperado</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        className="w-full h-12 pl-4 pr-10 rounded-xl border-2 border-slate-100 focus:border-autro-primary outline-none transition-all font-bold text-slate-800"
                                        value={newRule.result}
                                        onChange={e => setNewRule({...newRule, result: e.target.value})}
                                        placeholder="Ex: Copo 22,22mm"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Circle size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" className="flex-1 h-12 font-black uppercase tracking-widest" onClick={() => setIsAddingRule(false)}>Cancelar</Button>
                                <Button className="flex-1 h-12 font-black uppercase tracking-widest" onClick={handleAddRule}>Salvar Regra</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {isCreateFamilyModalOpen && (
                <CreateProcessModal 
                    isOpen={isCreateFamilyModalOpen} 
                    onClose={() => setIsCreateFamilyModalOpen(false)}
                    existingFamilies={manufacturing.familias} 
                    onCreate={(name, type, category, data) => {
                        manufacturing.addFamilia(name, type, category, data);
                        setIsCreateFamilyModalOpen(false);
                        setActiveTab('processes');
                        addToast(`Família "${name}" criada com sucesso.`, 'success');
                    }} 
                />
            )}
        </div>
    );
};
