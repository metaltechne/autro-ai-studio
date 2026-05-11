
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { WorkStation, Consumable, StandardOperation, ManufacturingHook, OperationConsumable, ManufacturingOrdersHook, ManufacturingOrder, InventoryHook } from '../../types';
import { nanoid } from 'nanoid';
import { useToast } from '../../hooks/useToast';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Plus, 
    Trash2, 
    Link2, 
    Unlink, 
    Search, 
    TrendingUp, 
    Users, 
    Zap, 
    Calculator,
    Package,
    Settings2,
    CheckCircle2,
    XCircle,
    Info,
    ChevronRight,
    Edit3,
    BarChart3,
    CloudUpload,
    Check
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';

interface ManufacturingSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    manufacturing: ManufacturingHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    inventory: InventoryHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const HourlyRateInput: React.FC<{
    ws: WorkStation;
    saveWorkStations: (workStations: WorkStation[]) => void;
    workStations: WorkStation[];
}> = ({ ws, saveWorkStations, workStations }) => {
    const [value, setValue] = useState(ws.hourlyRate.toString().replace('.', ','));

    useEffect(() => {
        setValue(ws.hourlyRate.toString().replace('.', ','));
    }, [ws.hourlyRate]);

    const handleBlur = () => {
        const rate = parseFloat(value.replace(',', '.')) || 0;
        const newStations = workStations.map(w => w.id === ws.id ? {...w, hourlyRate: rate} : w);
        saveWorkStations(newStations);
        setValue(rate.toString().replace('.', ','));
    };

    return (
        <input
            className="font-bold text-emerald-600 text-right bg-transparent border border-slate-200 hover:border-slate-300 rounded px-2 py-1 w-24 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleBlur}
        />
    );
};

export const ManufacturingSettingsModal: React.FC<ManufacturingSettingsModalProps> = ({ isOpen, onClose, manufacturing, manufacturingOrdersHook, inventory }) => {
    const { 
        workStations, 
        consumables, 
        standardOperations, 
        saveWorkStations, 
        saveConsumables, 
        saveOperations,
        saveChanges,
        isDirty,
        savingStatus
    } = manufacturing;

    const { manufacturingOrders } = manufacturingOrdersHook;

    const [activeTab, setActiveTab] = useState<'stages' | 'workstations' | 'consumables' | 'dashboard'>('dashboard');
    const [isLinkingInsumo, setIsLinkingInsumo] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingPerformanceId, setViewingPerformanceId] = useState<string | null>(null);
    const [editingStationId, setEditingStationId] = useState<string | null>(null);
    
    const { addToast } = useToast();

    const handleSaveChanges = async () => {
        await saveChanges();
        try {
            await inventory.recalculateAllComponentCosts(manufacturing.familias, inventory.components, { 
                ws: workStations, 
                cons: consumables, 
                ops: standardOperations, 
                kits: [] 
            });
        } catch (error) {
            console.error(error);
            addToast("Erro ao recalcular custos das peças com base nas configurações atualizadas.", "error"); 
        }
    };

    // States para novos cadastros
    const [newStation, setNewStation] = useState({ 
        name: '', 
        hourlyRate: '', 
        description: '',
        role: '',
        jobFunction: '',
        monthlySalary: '', 
        workingHoursPerMonth: '176'
    });
    const [newConsumable, setNewConsumable] = useState({ name: '', unit: 'un', purchasePrice: '', monthlyConsumption: '', monthlyProduction: '3000', category: 'GERAL' });
    const [newOp, setNewOp] = useState({ name: '', category: 'GERAL', workStationId: '', timeSeconds: '60' });

    // --- Memoized Statistics for Dashboard ---
    const stats = useMemo(() => {
        const totalOpCost = standardOperations.reduce((acc, op) => {
            const ws = workStations.find(w => w.id === op.workStationId);
            const laborCost = ((op.timeSeconds || 0) / 3600) * (ws?.hourlyRate || 0);
            const consumablesCost = (op.operationConsumables || []).reduce((sum, oc) => {
                const c = consumables.find(item => item.id === oc.consumableId);
                return sum + ((oc.quantity || 0) * (c?.unitCost || 0));
            }, 0);
            return acc + laborCost + consumablesCost;
        }, 0);

        const avgOpCost = standardOperations.length > 0 ? totalOpCost / standardOperations.length : 0;
        
        const costDistribution = standardOperations.map(op => {
            const ws = workStations.find(w => w.id === op.workStationId);
            const laborCost = ((op.timeSeconds || 0) / 3600) * (ws?.hourlyRate || 0);
            const consumablesCost = (op.operationConsumables || []).reduce((sum, oc) => {
                const c = consumables.find(item => item.id === oc.consumableId);
                return sum + ((oc.quantity || 0) * (c?.unitCost || 0));
            }, 0);
            return {
                name: op.name,
                value: Number((laborCost + consumablesCost).toFixed(2)),
                labor: Number(laborCost.toFixed(2)),
                consumables: Number(consumablesCost.toFixed(2))
            };
        }).sort((a, b) => b.value - a.value).slice(0, 5);

        return { totalOpCost, avgOpCost, costDistribution };
    }, [standardOperations, workStations, consumables]);

    const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    const performanceByOperator = useMemo(() => {
        const stats: Record<string, { 
            produced: number, 
            actualTime: number, 
            predictedTime: number,
            breakdown: Record<string, { produced: number, actualTime: number, predictedTime: number }>
        }> = {};
        
        manufacturingOrders.forEach(order => {
            order.trackingSteps?.forEach(step => {
                const op = standardOperations.find(o => o.name === step.name);
                if (op && op.workStationId) {
                    if (!stats[op.workStationId]) {
                        stats[op.workStationId] = { produced: 0, actualTime: 0, predictedTime: 0, breakdown: {} };
                    }
                    
                    const actualTime = step.actualTimeSeconds || step.predictedTimeSeconds || 0;
                    const predictedTime = step.predictedTimeSeconds || 0;
                    const qty = step.quantity || 0;

                    stats[op.workStationId].produced += qty;
                    stats[op.workStationId].actualTime += actualTime;
                    stats[op.workStationId].predictedTime += predictedTime;

                    // Breakdown by item
                    order.orderItems?.forEach(item => {
                        const itemName = item.name || item.sku;
                        if (!stats[op.workStationId!].breakdown[itemName]) {
                            stats[op.workStationId!].breakdown[itemName] = { produced: 0, actualTime: 0, predictedTime: 0 };
                        }
                        stats[op.workStationId!].breakdown[itemName].produced += qty;
                        stats[op.workStationId!].breakdown[itemName].actualTime += actualTime;
                        stats[op.workStationId!].breakdown[itemName].predictedTime += predictedTime;
                    });
                }
            });
        });

        return stats;
    }, [manufacturingOrders, standardOperations]);

    // --- Handlers para Vinculação de Insumos ---
    const handleAddConsumableToOp = (opId: string, consumableId: string) => {
        const updated = standardOperations.map(op => {
            if (op.id !== opId) return op;
            const existing = op.operationConsumables || [];
            if (existing.some(c => c.consumableId === consumableId)) return op;
            return {
                ...op,
                operationConsumables: [...existing, { consumableId, quantity: 1 }]
            };
        });
        saveOperations(updated);
        setIsLinkingInsumo(null);
    };

    const handleRemoveConsumableFromOp = (opId: string, consumableId: string) => {
        const updated = standardOperations.map(op => {
            if (op.id !== opId) return op;
            return {
                ...op,
                operationConsumables: (op.operationConsumables || []).filter(c => c.consumableId !== consumableId)
            };
        });
        saveOperations(updated);
    };

    // --- Handlers para Insumos ---
    const handleUpdateConsumable = (id: string, field: keyof Consumable, value: any) => {
        const updated = consumables.map(c => {
            if (c.id !== id) return c;
            const updatedItem = { ...c, [field]: value };
            const price = field === 'purchasePrice' ? Number(value) : updatedItem.purchasePrice;
            const cons = field === 'monthlyConsumption' ? Number(value) : updatedItem.monthlyConsumption;
            const prod = field === 'monthlyProduction' ? Number(value) : updatedItem.monthlyProduction;
            updatedItem.unitCost = prod > 0 ? (price * cons) / prod : 0;
            return updatedItem;
        });
        saveConsumables(updated);
    };

    const handleAddConsumable = () => {
        if (!newConsumable.name) return;
        const price = Number(newConsumable.purchasePrice) || 0;
        const cons = Number(newConsumable.monthlyConsumption) || 0;
        const prod = Number(newConsumable.monthlyProduction) || 3000;
        const unitCost = prod > 0 ? (price * cons) / prod : 0;

        saveConsumables([...consumables, { 
            id: nanoid(), name: newConsumable.name, unit: newConsumable.unit, purchasePrice: price,
            monthlyConsumption: cons, monthlyProduction: prod, unitCost: unitCost, category: newConsumable.category
        }]);
        setNewConsumable({ name: '', unit: 'un', purchasePrice: '', monthlyConsumption: '', monthlyProduction: '3000', category: 'GERAL' });
    };

    // --- Handlers para Operadores ---
    const handleUpdateStation = (id: string, updates: Partial<WorkStation>) => {
        const updated = workStations.map(ws => ws.id === id ? { ...ws, ...updates } : ws);
        saveWorkStations(updated);
    };

    const handleAddStation = () => {
        if (!newStation.name) return;
        
        let hRate = parseFloat(newStation.hourlyRate.replace(',', '.')) || 0;

        saveWorkStations([...workStations, { 
            id: nanoid(), 
            name: newStation.name, 
            hourlyRate: hRate,
            description: newStation.description,
            role: newStation.role,
            jobFunction: newStation.jobFunction
        }]);
        setNewStation({ name: '', hourlyRate: '', description: '', role: '', jobFunction: '', monthlySalary: '', workingHoursPerMonth: '176' });
        addToast(`Operador ${newStation.name} cadastrado com sucesso!`, 'success');
    };

    // --- Handlers para Operações ---
    const handleAddOp = () => {
        if (!newOp.name || !newOp.workStationId) return;
        saveOperations([...standardOperations, {
            id: nanoid(),
            name: newOp.name,
            category: newOp.category,
            workStationId: newOp.workStationId,
            timeSeconds: parseInt(newOp.timeSeconds) || 60,
            operationConsumables: []
        }]);
        setNewOp({ name: '', category: 'GERAL', workStationId: '', timeSeconds: '60' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Central de Gestão de Custos Industriais" size="4xl">
            {/* Professional Navigation Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                        { id: 'stages', label: 'Operações', icon: Zap },
                        { id: 'workstations', label: 'Operadores', icon: Users },
                        { id: 'consumables', label: 'Insumos', icon: Package }
                    ].map((tab) => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-tight ${
                                activeTab === tab.id 
                                ? 'bg-white shadow-sm text-sky-600 border border-slate-200' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                            }`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {activeTab !== 'dashboard' && (
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Pesquisar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-inner"
                            />
                        </div>
                    )}

                    <Button
                        size="sm"
                        variant={isDirty ? "primary" : "secondary"}
                        onClick={handleSaveChanges}
                        disabled={savingStatus === 'saving'}
                        className={`h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center gap-2 transition-all ${isDirty ? 'bg-sky-600 text-white shadow-lg shadow-sky-200 animate-pulse' : ''}`}
                    >
                        {savingStatus === 'saving' ? (
                            <>Sincronizando...</>
                        ) : isDirty ? (
                            <>
                                <CloudUpload className="w-3.5 h-3.5" />
                                Salvar Agora
                            </>
                        ) : (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                Sincronizado
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="min-h-[600px]">
                <AnimatePresence mode="wait">
                    {/* --- DASHBOARD TAB --- */}
                    {activeTab === 'dashboard' && (
                        <motion.div 
                            key="dashboard"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-200/50 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                            <Calculator className="w-6 h-6 text-white" />
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-sky-200" />
                                    </div>
                                    <div>
                                        <p className="text-sky-100 text-xs font-bold uppercase tracking-widest mb-1">Custo Médio Operação</p>
                                        <h3 className="text-3xl font-black">{formatCurrency(stats.avgOpCost)}</h3>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-emerald-50 p-2 rounded-xl">
                                            <Zap className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">Ativo</span>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total de Operações</p>
                                        <h3 className="text-3xl font-black text-slate-800">{standardOperations.length}</h3>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-amber-50 p-2 rounded-xl">
                                            <Package className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Base</span>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Insumos Cadastrados</p>
                                        <h3 className="text-3xl font-black text-slate-800">{consumables.length}</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-sky-500" />
                                        Top 5 Operações por Custo
                                    </h4>
                                    <div className="h-[300px] min-h-[300px] min-w-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.costDistribution} layout="vertical" margin={{ left: 20, right: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                    formatter={(value: number) => [formatCurrency(value), 'Custo Total']}
                                                />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                    {stats.costDistribution.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                        <Settings2 className="w-4 h-4 text-emerald-500" />
                                        Composição de Custos Médios
                                    </h4>
                                    <div className="h-[300px] min-h-[300px] min-w-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Mão de Obra', value: stats.costDistribution.reduce((acc, curr) => acc + curr.labor, 0) },
                                                        { name: 'Insumos', value: stats.costDistribution.reduce((acc, curr) => acc + curr.consumables, 0) }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#0ea5e9" />
                                                    <Cell fill="#10b981" />
                                                </Pie>
                                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* --- ABA 1: OPERAÇÕES (SERVIÇOS) --- */}
                    {activeTab === 'stages' && (
                        <motion.div 
                            key="stages"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner items-end">
                                <div className="md:col-span-2">
                                    <Input 
                                        label="Nome da Operação" 
                                        value={newOp.name} 
                                        onChange={e => setNewOp({...newOp, name: e.target.value})} 
                                        placeholder="Ex: Solda Robotizada" 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <Select 
                                        label="Operador Padrão" 
                                        value={newOp.workStationId} 
                                        onChange={e => setNewOp({...newOp, workStationId: e.target.value})}
                                        className="bg-white"
                                    >
                                        <option value="">Selecione...</option>
                                        {workStations.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                                    </Select>
                                </div>
                                <div className="md:col-span-1">
                                    <Input 
                                        label="Tempo (seg)" 
                                        type="number" 
                                        value={newOp.timeSeconds} 
                                        onChange={e => setNewOp({...newOp, timeSeconds: e.target.value})} 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <Select 
                                        label="Categoria" 
                                        value={newOp.category} 
                                        onChange={e => setNewOp({...newOp, category: e.target.value})}
                                        className="bg-white"
                                    >
                                        <option value="GERAL">Geral</option>
                                        <option value="SOLDA">Solda</option>
                                        <option value="USINAGEM">Usinagem</option>
                                        <option value="MONTAGEM">Montagem</option>
                                        <option value="CORTE">Corte</option>
                                    </Select>
                                </div>
                                <div className="md:col-span-1">
                                    <Button 
                                        onClick={handleAddOp} 
                                        className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="font-black text-[10px] uppercase">Cadastrar</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-visible border border-slate-200 rounded-3xl shadow-sm bg-white">
                                <table className="min-w-full divide-y divide-slate-100">
                                    <thead className="bg-slate-50/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Serviço & Categoria</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Operador</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Insumos Relacionados</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Total</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {standardOperations.filter(op => op.name.toLowerCase().includes(searchTerm.toLowerCase())).map(op => {
                                            const ws = workStations.find(w => w.id === op.workStationId);
                                            const laborCost = ((op.timeSeconds || 0) / 3600) * (ws?.hourlyRate || 0);
                                            const consumablesCost = (op.operationConsumables || []).reduce((sum, oc) => {
                                                const c = consumables.find(item => item.id === oc.consumableId);
                                                return sum + ((oc.quantity || 0) * (c?.unitCost || 0));
                                            }, 0);
                                            const totalOpCost = (laborCost || 0) + (consumablesCost || 0);

                                            return (
                                                <tr key={op.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-8 bg-sky-500 rounded-full" />
                                                            <div>
                                                                <p className="font-bold text-slate-700 text-sm">{op.name}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none">{op.category}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400">{op.timeSeconds}s</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-3.5 h-3.5 text-slate-300" />
                                                            <span className="text-xs font-semibold text-slate-600">{ws?.name || 'Não definido'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1.5 min-w-[220px]">
                                                            {(op.operationConsumables || []).map(oc => {
                                                                const c = consumables.find(item => item.id === oc.consumableId);
                                                                return (
                                                                    <span key={oc.consumableId} className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-lg text-[10px] font-bold shadow-sm">
                                                                        {c?.name || 'Insumo'}
                                                                        <button onClick={() => handleRemoveConsumableFromOp(op.id, oc.consumableId)} className="text-emerald-300 hover:text-emerald-600 transition-colors">
                                                                            <Unlink className="w-2.5 h-2.5" />
                                                                        </button>
                                                                    </span>
                                                                );
                                                            })}
                                                            
                                                            <div className="relative">
                                                                <button 
                                                                    onClick={() => setIsLinkingInsumo(isLinkingInsumo === op.id ? null : op.id)}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-sky-100 transition-colors"
                                                                >
                                                                    <Link2 className="w-2.5 h-2.5" />
                                                                    Vincular
                                                                </button>
                                                                
                                                                <AnimatePresence>
                                                                    {isLinkingInsumo === op.id && (
                                                                        <motion.div 
                                                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                            className="absolute z-[100] right-0 top-full mt-2 w-64 bg-white shadow-2xl border border-slate-200 rounded-2xl p-4 ring-4 ring-slate-900/5"
                                                                        >
                                                                            <div className="flex justify-between items-center mb-3">
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escolha o Insumo</p>
                                                                                <button onClick={() => setIsLinkingInsumo(null)} className="text-slate-300 hover:text-slate-600">
                                                                                    <XCircle className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                            <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                                                                {consumables.length === 0 && (
                                                                                    <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhum insumo cadastrado</p>
                                                                                )}
                                                                                {consumables.map(c => (
                                                                                    <button 
                                                                                        key={c.id} 
                                                                                        onClick={() => handleAddConsumableToOp(op.id, c.id)}
                                                                                        className="w-full text-left p-2.5 hover:bg-sky-50 text-xs rounded-xl font-bold text-slate-600 truncate flex items-center gap-2 group/btn transition-colors"
                                                                                    >
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/btn:bg-sky-500 transition-colors" />
                                                                                        {c.name}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100/50 inline-block shadow-sm group-hover:shadow transition-all">
                                                            <span className="text-sm font-black text-sky-700" title={`Labor: ${formatCurrency(laborCost)} | Insumos: ${formatCurrency(consumablesCost)}`}>
                                                                {formatCurrency(totalOpCost)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => saveOperations(standardOperations.filter(i => i.id !== op.id))} 
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}


                    {/* --- ABA 2: OPERADORES --- */}
                    {activeTab === 'workstations' && (
                        <motion.div 
                            key="workstations"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-sky-500" />
                                    Gerenciamento de Operadores e Postos
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="lg:col-span-1">
                                        <Input 
                                            label="Nome / Posto" 
                                            placeholder="Ex: João Silva" 
                                            value={newStation.name} 
                                            onChange={e => setNewStation({ ...newStation, name: e.target.value })} 
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <Input 
                                            label="Custo Hora (R$)" 
                                            type="text"
                                            placeholder="Ex: 29,50"
                                            value={newStation.hourlyRate} 
                                            onChange={e => setNewStation({ ...newStation, hourlyRate: e.target.value })} 
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <Input 
                                            label="Cargo" 
                                            placeholder="Ex: Soldador"
                                            value={newStation.role} 
                                            onChange={e => setNewStation({ ...newStation, role: e.target.value })} 
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <Input 
                                            label="Função" 
                                            placeholder="Ex: Operar CNC"
                                            value={newStation.jobFunction} 
                                            onChange={e => setNewStation({ ...newStation, jobFunction: e.target.value })} 
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <Input 
                                            label="Obs/Descrição" 
                                            placeholder="Opcional..."
                                            value={newStation.description} 
                                            onChange={e => setNewStation({ ...newStation, description: e.target.value })} 
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button onClick={handleAddStation} className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl shadow-md flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" />
                                            <span className="font-black text-[10px] uppercase tracking-widest">Cadastrar</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Nome / Posto</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo & Função</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Hora</th>
                                                <th className="px-6 py-4"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {workStations.filter(ws => ws.name.toLowerCase().includes(searchTerm.toLowerCase())).map(ws => (
                                                <tr key={ws.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <input 
                                                            className="font-bold text-slate-800 bg-transparent border border-transparent hover:border-slate-300 rounded px-2 py-1 transition-colors w-full focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500" 
                                                            value={ws.name} 
                                                            onChange={e => {
                                                                const newStations = workStations.map(w => w.id === ws.id ? {...w, name: e.target.value} : w);
                                                                saveWorkStations(newStations);
                                                            }} 
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <input 
                                                                className="text-xs font-bold text-slate-600 bg-transparent border border-transparent hover:border-slate-300 rounded px-2 py-0.5 transition-colors w-full focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500" 
                                                                placeholder="Cargo..."
                                                                value={ws.role || ''} 
                                                                onChange={e => {
                                                                    const newStations = workStations.map(w => w.id === ws.id ? {...w, role: e.target.value} : w);
                                                                    saveWorkStations(newStations);
                                                                }} 
                                                            />
                                                            <input 
                                                                className="text-[10px] text-slate-400 font-medium bg-transparent border border-transparent hover:border-slate-300 rounded px-2 py-0.5 transition-colors w-full focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500" 
                                                                placeholder="Função..."
                                                                value={ws.jobFunction || ''} 
                                                                onChange={e => {
                                                                    const newStations = workStations.map(w => w.id === ws.id ? {...w, jobFunction: e.target.value} : w);
                                                                    saveWorkStations(newStations);
                                                                }} 
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <input 
                                                            className="text-xs text-slate-500 bg-transparent border border-transparent hover:border-slate-300 rounded px-2 py-1 transition-colors w-full focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500" 
                                                            placeholder="Adicione uma descrição..."
                                                            value={ws.description || ''} 
                                                            onChange={e => {
                                                                const newStations = workStations.map(w => w.id === ws.id ? {...w, description: e.target.value} : w);
                                                                saveWorkStations(newStations);
                                                            }} 
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <HourlyRateInput ws={ws} saveWorkStations={saveWorkStations} workStations={workStations} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => {
                                                                if (window.confirm(`Excluir operador ${ws.name}?`)) {
                                                                    saveWorkStations(workStations.filter(w => w.id !== ws.id));
                                                                }
                                                            }}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {workStations.length === 0 && (
                                        <div className="py-12 text-center">
                                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">Nenhum operador cadastrado.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {activeTab === 'consumables' && (
                        <motion.div 
                            key="consumables"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-3xl -mr-32 -mt-32 rounded-full" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-sky-500 p-2 rounded-xl">
                                            <Calculator className="w-5 h-5 text-white" />
                                        </div>
                                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Rateio Coeficiente de Insumos</h4>
                                    </div>
                                    <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
                                        A plataforma calcula automaticamente o custo unitário por peça baseado no seu gasto mensal absoluto e produção planejada.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm items-end">
                                <div className="md:col-span-2">
                                    <Input label="Descrição do Insumo" value={newConsumable.name} onChange={e => setNewConsumable({ ...newConsumable, name: e.target.value })} className="bg-slate-50" />
                                </div>
                                    <Input label="Compra Total (R$)" type="text" value={newConsumable.purchasePrice} onChange={e => setNewConsumable({ ...newConsumable, purchasePrice: e.target.value })} className="bg-slate-50" />
                                <Input label="Gasto/Mês Qtd" type="text" value={newConsumable.monthlyConsumption} onChange={e => setNewConsumable({ ...newConsumable, monthlyConsumption: e.target.value })} className="bg-slate-50" />
                                <Input label="Capac. Prod (Peças)" type="text" value={newConsumable.monthlyProduction} onChange={e => setNewConsumable({ ...newConsumable, monthlyProduction: e.target.value })} className="bg-slate-50" />
                                <Button onClick={handleAddConsumable} className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl shadow-lg flex items-center justify-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    <span className="font-black text-[10px] uppercase">Cadastrar</span>
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {consumables.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                                    <motion.div 
                                        layout
                                        key={c.id} 
                                        className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
                                    >
                                        <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                                            <div>
                                                <input 
                                                    className="font-black text-slate-800 text-sm bg-transparent border-none focus:ring-2 focus:ring-sky-500/20 rounded p-1 w-full" 
                                                    value={c.name} 
                                                    onChange={e => handleUpdateConsumable(c.id, 'name', e.target.value)} 
                                                />
                                                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded ml-1">Insumo Industrial</span>
                                            </div>
                                            <button 
                                                onClick={() => saveConsumables(consumables.filter(item => item.id !== c.id))}
                                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-5 bg-slate-50/50 space-y-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Preço Compra</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black text-slate-500">R$</span>
                                                        <input 
                                                            type="text" 
                                                            className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none" 
                                                            value={c.purchasePrice} 
                                                            onChange={e => handleUpdateConsumable(c.id, 'purchasePrice', e.target.value)} 
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Gasto Mensal</p>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none" 
                                                            value={c.monthlyConsumption} 
                                                            onChange={e => handleUpdateConsumable(c.id, 'monthlyConsumption', e.target.value)} 
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Produção Mês</p>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none" 
                                                            value={c.monthlyProduction} 
                                                            onChange={e => handleUpdateConsumable(c.id, 'monthlyProduction', e.target.value)} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Custo Rateado (Un)</p>
                                                    <h4 className="text-xl font-black text-emerald-600">{formatCurrency(c.unitCost)}</h4>
                                                </div>
                                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                                    <Zap className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </Modal>
    );
};
