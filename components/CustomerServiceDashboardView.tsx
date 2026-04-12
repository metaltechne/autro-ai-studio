import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useCRMTasks } from '../hooks/useCRMTasks';
import { Task, TaskStatus, ServiceStrategy } from '../types';
import { 
    CheckCircle, Clock, AlertCircle, Calendar, User, 
    Plus, Settings, CheckSquare, X, ChevronRight, 
    Layout, Zap, Target, TrendingUp, ArrowRight,
    Search, Filter, MoreVertical, Trash2, Edit2,
    MessageSquare, Phone, Mail, Award
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import ReactFlow, { 
    Background, 
    Controls, 
    Node, 
    Edge, 
    MarkerType 
} from 'reactflow';
import 'reactflow/dist/style.css';

const KANBAN_COLUMNS = [
    { id: TaskStatus.PENDING, title: 'A Fazer', color: 'bg-slate-100 border-slate-200 text-slate-700' },
    { id: TaskStatus.IN_PROGRESS, title: 'Em Andamento', color: 'bg-blue-50 border-blue-100 text-blue-700' },
    { id: TaskStatus.OVERDUE, title: 'Atrasadas', color: 'bg-red-50 border-red-100 text-red-700' },
    { id: TaskStatus.COMPLETED, title: 'Concluídas', color: 'bg-green-50 border-green-100 text-green-700' },
];

export const CustomerServiceDashboardView: React.FC = () => {
    const { leads, deals, registerInteraction, checkWindows } = useSalesFunnel();
    const { tasks, strategies, updateTask, toggleStrategy, addTask, deleteTask } = useCRMTasks(leads, deals);
    
    const [activeTab, setActiveTab] = useState<'kanban' | 'strategies' | 'insights'>('kanban');
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [newTaskForm, setNewTaskForm] = useState({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], relatedLeadId: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every minute for timers
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            checkWindows();
        }, 60000);
        return () => clearInterval(timer);
    }, [checkWindows]);

    // KPIs
    const kpis = useMemo(() => {
        const pending = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
        const overdue = tasks.filter(t => t.status === TaskStatus.OVERDUE).length;
        const completedToday = tasks.filter(t => {
            if (t.status !== TaskStatus.COMPLETED || !t.completedAt) return false;
            const completedDate = new Date(t.completedAt).toDateString();
            const today = new Date().toDateString();
            return completedDate === today;
        }).length;
        
        const totalCompleted = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        const completionRate = tasks.length > 0 ? Math.round((totalCompleted / tasks.length) * 100) : 0;
        
        const lostWindows = leads.filter(l => l.lostDueToWindow).length;
        
        return { pending, overdue, completedToday, totalLeads: leads.length, completionRate, lostWindows };
    }, [tasks, leads]);

    // Automatic Reminders for WhatsApp Window
    useEffect(() => {
        const now = new Date();
        leads.forEach(lead => {
            if (lead.lastInteractionAt && lead.whatsappWindowStatus === 'open') {
                const lastInteraction = new Date(lead.lastInteractionAt);
                const diffMs = now.getTime() - lastInteraction.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                
                // If less than 2 hours remaining and no reminder task exists
                if (diffHours >= 22 && diffHours < 24) {
                    const reminderTitle = `URGENTE: Janela WhatsApp expirando - ${lead.name}`;
                    const existingTask = tasks.find(t => t.title === reminderTitle && t.status !== TaskStatus.COMPLETED);
                    
                    if (!existingTask) {
                        addTask({
                            title: reminderTitle,
                            description: 'A janela de 24h do WhatsApp está prestes a fechar. Envie uma mensagem agora para manter o contato aberto.',
                            dueDate: new Date().toISOString(),
                            status: TaskStatus.PENDING,
                            relatedLeadId: lead.id
                        });
                    }
                }
            }
        });
    }, [leads, tasks, addTask]);

    const filteredTasks = useMemo(() => {
        if (!searchTerm) return tasks;
        const term = searchTerm.toLowerCase();
        return tasks.filter(t => 
            t.title.toLowerCase().includes(term) || 
            t.description?.toLowerCase().includes(term) ||
            leads.find(l => l.id === t.relatedLeadId)?.name.toLowerCase().includes(term)
        );
    }, [tasks, searchTerm, leads]);

    const onDragEnd = useCallback((result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as TaskStatus;
        updateTask(draggableId, { status: newStatus });
    }, [updateTask]);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        addTask({
            title: newTaskForm.title,
            description: newTaskForm.description,
            dueDate: new Date(newTaskForm.dueDate).toISOString(),
            status: TaskStatus.PENDING,
            relatedLeadId: newTaskForm.relatedLeadId || undefined
        });
        setIsAddingTask(false);
        setNewTaskForm({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], relatedLeadId: '' });
    };

    // ReactFlow Data for Strategies
    const flowData = useMemo(() => {
        const nodes: Node[] = [
            { 
                id: 'trigger-lead', 
                data: { label: 'Novo Lead Recebido' }, 
                position: { x: 50, y: 50 },
                style: { background: '#3b82f6', color: '#fff', borderRadius: '8px', padding: '10px', width: 180 }
            },
            { 
                id: 'trigger-stage', 
                data: { label: 'Mudança de Etapa' }, 
                position: { x: 50, y: 250 },
                style: { background: '#8b5cf6', color: '#fff', borderRadius: '8px', padding: '10px', width: 180 }
            }
        ];

        const edges: Edge[] = [];

        strategies.forEach((strategy, index) => {
            const strategyId = `strat-${strategy.id}`;
            nodes.push({
                id: strategyId,
                data: { label: strategy.name },
                position: { x: 350, y: strategy.triggerEvent === 'NEW_LEAD' ? 50 : 250 + (index * 60) },
                style: { 
                    background: strategy.isActive ? '#fff' : '#f1f5f9', 
                    border: `2px solid ${strategy.isActive ? '#3b82f6' : '#cbd5e1'}`, 
                    borderRadius: '8px', 
                    padding: '10px',
                    width: 220,
                    opacity: strategy.isActive ? 1 : 0.6
                }
            });

            edges.push({
                id: `edge-${strategy.id}`,
                source: strategy.triggerEvent === 'NEW_LEAD' ? 'trigger-lead' : 'trigger-stage',
                target: strategyId,
                animated: strategy.isActive,
                markerEnd: { type: MarkerType.ArrowClosed, color: strategy.isActive ? '#3b82f6' : '#cbd5e1' },
                style: { stroke: strategy.isActive ? '#3b82f6' : '#cbd5e1' }
            });

            const taskId = `task-${strategy.id}`;
            nodes.push({
                id: taskId,
                data: { label: `Tarefa: ${strategy.taskTitle}` },
                position: { x: 650, y: strategy.triggerEvent === 'NEW_LEAD' ? 50 : 250 + (index * 60) },
                style: { background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: '8px', padding: '10px', width: 220, fontSize: '12px' }
            });

            edges.push({
                id: `edge-task-${strategy.id}`,
                source: strategyId,
                target: taskId,
                markerEnd: { type: MarkerType.ArrowClosed }
            });
        });

        return { nodes, edges };
    }, [strategies]);

    return (
        <div className="space-y-6 pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Target className="w-8 h-8 text-autro-primary" />
                        Dashboard de Atendimento
                    </h1>
                    <p className="text-slate-500 font-medium">Cadência de vendas, automação e inteligência de follow-up.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                        <button 
                            onClick={() => setActiveTab('kanban')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'kanban' ? 'bg-autro-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Layout className="w-4 h-4" /> Kanban
                        </button>
                        <button 
                            onClick={() => setActiveTab('strategies')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'strategies' ? 'bg-autro-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Zap className="w-4 h-4" /> Fluxos
                        </button>
                        <button 
                            onClick={() => setActiveTab('insights')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'insights' ? 'bg-autro-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <TrendingUp className="w-4 h-4" /> Insights
                        </button>
                    </div>
                </div>
            </div>

            {/* Top Stats & Gamification */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Clock className="w-16 h-16 text-blue-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pendentes</p>
                        <p className="text-4xl font-black text-slate-900 mt-2">{kpis.pending}</p>
                        <div className="mt-4 flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-fit">
                            Próximos Follow-ups
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <AlertCircle className="w-16 h-16 text-red-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Atrasadas</p>
                        <p className="text-4xl font-black text-red-600 mt-2">{kpis.overdue}</p>
                        <div className="mt-4 flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg w-fit">
                            Ação Imediata Necessária
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-16 h-16 text-green-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Concluídas Hoje</p>
                        <p className="text-4xl font-black text-green-600 mt-2">{kpis.completedToday}</p>
                        <div className="mt-4 flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit">
                            Meta Diária em Progresso
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <X className="w-16 h-16 text-orange-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Janelas Perdidas</p>
                        <p className="text-4xl font-black text-orange-600 mt-2">{kpis.lostWindows}</p>
                        <div className="mt-4 flex items-center text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg w-fit">
                            Leads sem resposta 24h+
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-autro-primary to-blue-700 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                            <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Performance</p>
                            <Award className="w-6 h-6" />
                        </div>
                        <p className="text-3xl font-black mt-2">{kpis.completionRate}%</p>
                        <p className="text-xs opacity-70 mt-1">Taxa de conclusão de tarefas</p>
                    </div>
                    <div className="mt-4">
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white h-2 rounded-full transition-all duration-1000" style={{ width: `${kpis.completionRate}%` }}></div>
                        </div>
                        <p className="text-[10px] font-bold mt-2 text-center uppercase tracking-widest">Nível: Especialista em Vendas</p>
                    </div>
                </div>
            </div>

            {/* Main Content Areas */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px]">
                {activeTab === 'kanban' && (
                    <div className="p-6 h-full flex flex-col">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar tarefas ou clientes..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-autro-primary transition-all text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                    <Filter className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setIsAddingTask(true)}
                                    className="px-6 py-2.5 bg-autro-primary text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-bold text-sm"
                                >
                                    <Plus className="w-5 h-5" /> Nova Tarefa
                                </button>
                            </div>
                        </div>

                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 overflow-x-auto pb-4">
                                {KANBAN_COLUMNS.map(column => (
                                    <div key={column.id} className="flex flex-col min-w-[280px]">
                                        <div className={`flex items-center justify-between p-3 rounded-t-2xl border-t border-x ${column.color}`}>
                                            <h3 className="font-black uppercase tracking-widest text-[10px]">{column.title}</h3>
                                            <span className="bg-white/50 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                {filteredTasks.filter(t => t.status === column.id).length}
                                            </span>
                                        </div>
                                        <Droppable droppableId={column.id}>
                                            {(provided, snapshot) => (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className={`flex-1 p-3 bg-slate-50/50 border-x border-b border-slate-200 rounded-b-2xl min-h-[400px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/50 border-dashed border-autro-primary' : ''}`}
                                                >
                                                    <div className="space-y-3">
                                                        {filteredTasks
                                                            .filter(t => t.status === column.id)
                                                            .map((task, index) => {
                                                                const lead = task.relatedLeadId ? leads.find(l => l.id === task.relatedLeadId) : null;
                                                                const DraggableComponent = Draggable as any;
                                                                return (
                                                                    <DraggableComponent key={task.id} draggableId={task.id} index={index}>
                                                                        {(provided: any, snapshot: any) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                {...provided.dragHandleProps}
                                                                                className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl border-autro-primary z-50' : ''}`}
                                                                            >
                                                                                <div className="flex justify-between items-start mb-2">
                                                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{task.title}</h4>
                                                                                    <button className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <MoreVertical className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                                {task.description && (
                                                                                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                                                                                )}
                                                                                
                                                                                {lead && (
                                                                                    <div className="space-y-2 mb-3">
                                                                                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                                            <div className="w-6 h-6 rounded-full bg-autro-primary/10 flex items-center justify-center text-autro-primary text-[10px] font-bold">
                                                                                                {lead.name.charAt(0)}
                                                                                            </div>
                                                                                            <span className="text-[10px] font-bold text-slate-600 truncate">{lead.name}</span>
                                                                                        </div>
                                                                                        
                                                                                        {/* WhatsApp Window Timer */}
                                                                                        <div className={`p-2 rounded-lg border flex items-center justify-between ${
                                                                                            !lead.lastInteractionAt ? 'bg-slate-50 border-slate-100' :
                                                                                            lead.whatsappWindowStatus === 'closed' ? 'bg-red-50 border-red-100' :
                                                                                            'bg-blue-50 border-blue-100'
                                                                                        }`}>
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <MessageSquare className={`w-3 h-3 ${lead.whatsappWindowStatus === 'closed' ? 'text-red-500' : 'text-autro-primary'}`} />
                                                                                                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">Janela 24h</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className={`text-[10px] font-black ${
                                                                                                    lead.whatsappWindowStatus === 'closed' ? 'text-red-600' : 'text-slate-700'
                                                                                                }`}>
                                                                                                    {(() => {
                                                                                                        if (!lead.lastInteractionAt) return '--:--';
                                                                                                        if (lead.whatsappWindowStatus === 'closed') return 'EXPIRADA';
                                                                                                        
                                                                                                        const last = new Date(lead.lastInteractionAt);
                                                                                                        const expiry = new Date(last.getTime() + 24 * 60 * 60 * 1000);
                                                                                                        const diff = expiry.getTime() - currentTime.getTime();
                                                                                                        
                                                                                                        if (diff <= 0) return 'EXPIRADA';
                                                                                                        
                                                                                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                                                                                        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                                                        return `${hours}h ${mins}m`;
                                                                                                    })()}
                                                                                                </span>
                                                                                                <button 
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        registerInteraction(lead.id);
                                                                                                    }}
                                                                                                    className="p-1 bg-white rounded border border-slate-200 hover:border-autro-primary hover:text-autro-primary transition-all shadow-sm"
                                                                                                    title="Registrar Interação (Resetar Janela)"
                                                                                                >
                                                                                                    <Zap className="w-2.5 h-2.5" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                                                                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${task.status === TaskStatus.OVERDUE ? 'text-red-500' : 'text-slate-400'}`}>
                                                                                        <Calendar className="w-3 h-3" />
                                                                                        {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1">
                                                                                        {task.status === TaskStatus.COMPLETED ? (
                                                                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                                                                        ) : (
                                                                                            <div className="flex gap-1">
                                                                                                <button onClick={() => deleteTask(task.id)} className="p-1 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-300">
                                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                                </button>
                                                                                                <button onClick={() => updateTask(task.id, { status: TaskStatus.COMPLETED })} className="p-1 hover:bg-green-50 hover:text-green-500 rounded transition-colors text-slate-300">
                                                                                                    <CheckSquare className="w-3.5 h-3.5" />
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </DraggableComponent>
                                                                );
                                                            })}
                                                        {provided.placeholder}
                                                    </div>
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                ))}
                            </div>
                        </DragDropContext>
                    </div>
                )}

                {activeTab === 'strategies' && (
                    <div className="h-full flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Fluxos de Cadência</h2>
                                <p className="text-sm text-slate-500 font-medium">Visualize e gerencie as automações de follow-up do seu CRM.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div> Ativo
                                    <div className="w-3 h-3 bg-slate-300 rounded-full ml-2"></div> Inativo
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[500px] relative">
                            <ReactFlow
                                nodes={flowData.nodes}
                                edges={flowData.edges}
                                fitView
                                nodesDraggable={false}
                                nodesConnectable={false}
                                elementsSelectable={true}
                            >
                                <Background color="#e2e8f0" gap={20} />
                                <Controls />
                            </ReactFlow>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100">
                            {strategies.map(strategy => (
                                <div key={strategy.id} className={`p-4 rounded-2xl border transition-all ${strategy.isActive ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-slate-800 text-sm">{strategy.name}</h3>
                                        <label className="relative inline-flex items-center cursor-pointer scale-75">
                                            <input type="checkbox" className="sr-only peer" checked={strategy.isActive} onChange={() => toggleStrategy(strategy.id)} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-autro-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <Zap className="w-3 h-3 text-autro-primary" />
                                        {strategy.triggerEvent === 'NEW_LEAD' ? 'Novo Lead' : `Etapa: ${strategy.targetStage}`}
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">{strategy.taskDescription}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Target className="w-6 h-6 text-red-500" />
                                    Foco de Hoje
                                </h3>
                                <div className="space-y-4">
                                    {tasks.filter(t => t.status === TaskStatus.OVERDUE).slice(0, 3).map(task => (
                                        <div key={task.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between group hover:bg-red-100 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-200">
                                                    <AlertCircle className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{task.title}</p>
                                                    <p className="text-xs text-red-600 font-bold uppercase tracking-widest">Atrasada há {Math.floor((new Date().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))} dias</p>
                                                </div>
                                            </div>
                                            <button onClick={() => updateTask(task.id, { status: TaskStatus.IN_PROGRESS })} className="p-2 bg-white rounded-xl shadow-sm text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                    {tasks.filter(t => t.status === TaskStatus.OVERDUE).length === 0 && (
                                        <div className="p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                            <p className="font-bold text-slate-800">Tudo em dia!</p>
                                            <p className="text-sm text-slate-500">Você não tem tarefas atrasadas no momento.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Zap className="w-6 h-6 text-yellow-500" />
                                    Sugestões da IA
                                </h3>
                                <div className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <TrendingUp className="w-24 h-24" />
                                    </div>
                                    <div className="relative z-10 space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-autro-primary flex items-center justify-center flex-shrink-0">
                                                <MessageSquare className="w-4 h-4" />
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed">
                                                "Notei que 3 leads na etapa <span className="text-autro-primary font-bold">Proposta Enviada</span> não recebem contato há mais de 48h. Recomendo um follow-up rápido via WhatsApp."
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed">
                                                "O melhor horário para ligar para seus clientes atuais tem sido entre <span className="text-green-400 font-bold">10:00 e 11:30</span>. Agende suas ligações importantes para este período."
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed">
                                                "A estratégia <span className="text-purple-400 font-bold">Boas-vindas</span> gerou 15% mais engajamento este mês. Considere adicionar um vídeo de apresentação no fluxo."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="flex-1 space-y-4">
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Estratégia de Cadência</h3>
                                    <p className="text-slate-600 leading-relaxed">
                                        Grandes sistemas de venda utilizam a técnica de **"Multi-Touch Cadence"**. 
                                        Não dependa apenas de um canal. Alterne entre WhatsApp, E-mail e Ligações em intervalos de 1, 3 e 7 dias para maximizar a conversão.
                                    </p>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">1</div>
                                            WhatsApp
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">2</div>
                                            Ligação
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">3</div>
                                            E-mail
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-64 h-40 bg-white rounded-2xl shadow-inner border border-blue-200 flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-autro-primary">+24%</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Aumento na Conversão</p>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-autro-primary" />
                                        Saúde do WhatsApp
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                                            <span className="text-sm font-bold text-slate-600">Janelas Ativas</span>
                                            <span className="text-sm font-black text-autro-primary">{leads.filter(l => l.whatsappWindowStatus === 'open').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-2xl">
                                            <span className="text-sm font-bold text-red-600">Janelas Expiradas</span>
                                            <span className="text-sm font-black text-red-600">{kpis.lostWindows}</span>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                            <p className="text-xs font-bold text-blue-800 mb-1">Dica Estratégica:</p>
                                            <p className="text-[11px] text-blue-600 leading-relaxed">
                                                Cada janela perdida custa caro. Configure lembretes automáticos para 22h após o último contato para garantir que você nunca perca a chance de falar com o lead gratuitamente.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Task Modal */}
            {isAddingTask && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 opacity-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Plus className="w-6 h-6 text-autro-primary" />
                                Nova Tarefa Manual
                            </h3>
                            <button onClick={() => setIsAddingTask(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddTask} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Título da Tarefa</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newTaskForm.title} 
                                        onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})} 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-autro-primary transition-all font-medium" 
                                        placeholder="Ex: Ligar para confirmar recebimento" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Data Limite</label>
                                        <input 
                                            type="date" 
                                            required 
                                            value={newTaskForm.dueDate} 
                                            onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} 
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-autro-primary transition-all font-medium" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Prioridade</label>
                                        <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-autro-primary transition-all font-medium">
                                            <option>Normal</option>
                                            <option>Alta</option>
                                            <option>Urgente</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                                    <textarea 
                                        value={newTaskForm.description} 
                                        onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-autro-primary transition-all font-medium h-32 resize-none" 
                                        placeholder="Detalhes adicionais sobre o que deve ser feito..." 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Lead Relacionado</label>
                                    <select 
                                        value={newTaskForm.relatedLeadId} 
                                        onChange={e => setNewTaskForm({...newTaskForm, relatedLeadId: e.target.value})} 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-autro-primary transition-all font-medium"
                                    >
                                        <option value="">Nenhum lead selecionado</option>
                                        {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddingTask(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 py-4 bg-autro-primary text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
                                >
                                    Salvar Tarefa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

