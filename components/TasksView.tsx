import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Task, TaskStatus, UserRole } from '../types';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Calendar, Clock, CheckCircle2, AlertCircle, MoreVertical, Trash2, Edit3, User } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export const TasksView: React.FC = () => {
    const { tasks, addTask, updateTask, deleteTask } = useTasks();
    const { user, role } = useAuth();
    const { addToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
    const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [assignedTo, setAssignedTo] = useState('');
    const [category, setCategory] = useState('');

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setDueDate('');
        setPriority('normal');
        setAssignedTo('');
        setCategory('');
        setEditingTask(null);
    };

    const handleOpenModal = (task?: Task) => {
        if (task) {
            setEditingTask(task);
            setTitle(task.title);
            setDescription(task.description || '');
            setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
            setPriority(task.priority || 'normal');
            setAssignedTo(task.assignedTo || '');
            setCategory(task.category || '');
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!title) {
            addToast('O título é obrigatório', 'error');
            return;
        }

        try {
            if (editingTask) {
                await updateTask(editingTask.id, {
                    title,
                    description,
                    dueDate: dueDate ? new Date(dueDate).toISOString() : '',
                    priority,
                    assignedTo,
                    category
                });
                addToast('Tarefa atualizada com sucesso', 'success');
            } else {
                await addTask({
                    title,
                    description,
                    dueDate: dueDate ? new Date(dueDate).toISOString() : '',
                    status: TaskStatus.PENDING,
                    priority,
                    assignedTo,
                    category,
                    creatorId: user?.uid
                });
                addToast('Tarefa criada com sucesso', 'success');
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            addToast('Erro ao salvar tarefa', 'error');
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = filterStatus === 'ALL' || task.status === filterStatus;
            const matchesAssignee = filterAssignee === 'ALL' || task.assignedTo === filterAssignee || (filterAssignee === 'ME' && task.assignedTo === user?.email);
            return matchesSearch && matchesStatus && matchesAssignee;
        });
    }, [tasks, searchTerm, filterStatus, filterAssignee, user]);

    const columns = [
        { id: TaskStatus.PENDING, title: 'Pendentes', color: 'bg-slate-100', borderColor: 'border-slate-200' },
        { id: TaskStatus.IN_PROGRESS, title: 'Em Andamento', color: 'bg-indigo-50', borderColor: 'border-indigo-200' },
        { id: TaskStatus.COMPLETED, title: 'Concluídas', color: 'bg-emerald-50', borderColor: 'border-emerald-200' }
    ];

    const getPriorityColor = (p?: string) => {
        switch(p) {
            case 'urgent': return 'text-rose-600 bg-rose-100';
            case 'high': return 'text-orange-600 bg-orange-100';
            case 'low': return 'text-slate-600 bg-slate-100';
            default: return 'text-blue-600 bg-blue-100';
        }
    };

    const getPriorityLabel = (p?: string) => {
        switch(p) {
            case 'urgent': return 'Urgente';
            case 'high': return 'Alta';
            case 'low': return 'Baixa';
            default: return 'Normal';
        }
    };

    return (
        <div className="flex flex-col h-full max-w-[1600px] mx-auto">
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Tarefas e Lembretes</h2>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Gestão de Atividades da Equipe</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 border-none shadow-xl shadow-indigo-500/20 uppercase font-black text-[10px] flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Tarefa
                </Button>
            </header>

            <Card className="mb-6 p-4 border-2 border-slate-200 shrink-0">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-grow min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar tarefas..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 text-xs font-bold"
                        />
                    </div>
                    <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-40 h-10 text-xs font-bold">
                        <option value="ALL">Todos os Status</option>
                        <option value={TaskStatus.PENDING}>Pendentes</option>
                        <option value={TaskStatus.IN_PROGRESS}>Em Andamento</option>
                        <option value={TaskStatus.COMPLETED}>Concluídas</option>
                    </Select>
                    <Select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="w-40 h-10 text-xs font-bold">
                        <option value="ALL">Todos os Usuários</option>
                        <option value="ME">Minhas Tarefas</option>
                    </Select>
                </div>
            </Card>

            <div className="flex-grow flex gap-6 overflow-x-auto pb-4 min-h-0 w-full">
                {columns.map(col => (
                    <div key={col.id} className={`flex-1 min-w-[280px] max-w-[400px] flex flex-col rounded-2xl border-2 ${col.borderColor} ${col.color} overflow-hidden`}>
                        <div className="p-4 border-b border-black/5 flex justify-between items-center bg-white/50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight">{col.title}</h3>
                            <span className="bg-white text-slate-600 text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                                {filteredTasks.filter(t => t.status === col.id).length}
                            </span>
                        </div>
                        <div className="flex-grow p-4 overflow-y-auto space-y-3 custom-scrollbar">
                            {filteredTasks.filter(t => t.status === col.id).map(task => {
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
                                
                                return (
                                    <div key={task.id} className={`bg-white p-4 rounded-xl shadow-sm border ${isOverdue ? 'border-rose-300' : 'border-slate-200'} hover:shadow-md transition-shadow group relative`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2 items-center flex-wrap">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                                    {getPriorityLabel(task.priority)}
                                                </span>
                                                {task.category && (
                                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                                                        {task.category}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(task)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => setDeletingTaskId(task.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                        
                                        <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{task.title}</h4>
                                        {task.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                                        )}
                                        
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                            <div className="flex items-center gap-3">
                                                {task.dueDate && (
                                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {task.assignedTo && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600" title={task.assignedTo}>
                                                        <User className="w-3 h-3" />
                                                        <span className="truncate max-w-[100px]">{task.assignedTo.split('@')[0]}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex gap-1">
                                                {task.status !== TaskStatus.PENDING && (
                                                    <button onClick={() => updateTask(task.id, { status: TaskStatus.PENDING })} className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200" title="Mover para Pendente">
                                                        <Clock className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {task.status !== TaskStatus.IN_PROGRESS && (
                                                    <button onClick={() => updateTask(task.id, { status: TaskStatus.IN_PROGRESS })} className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100" title="Mover para Em Andamento">
                                                        <AlertCircle className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {task.status !== TaskStatus.COMPLETED && (
                                                    <button onClick={() => updateTask(task.id, { status: TaskStatus.COMPLETED })} className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Concluir">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredTasks.filter(t => t.status === col.id).length === 0 && (
                                <div className="text-center p-6 border-2 border-dashed border-black/10 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Nenhuma tarefa</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Título</label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" className="font-bold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    className="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 min-h-[100px]"
                                    placeholder="Detalhes da tarefa..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data de Vencimento</label>
                                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="font-bold text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Prioridade</label>
                                    <Select value={priority} onChange={e => setPriority(e.target.value as any)} className="font-bold text-sm">
                                        <option value="low">Baixa</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">Alta</option>
                                        <option value="urgent">Urgente</option>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Atribuir a (Email/Nome)</label>
                                    <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Ex: joao@empresa.com" className="font-bold text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Categoria</label>
                                    <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Produção, Vendas..." className="font-bold text-sm" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="font-bold">Cancelar</Button>
                            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8">Salvar Tarefa</Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deletingTaskId}
                onClose={() => setDeletingTaskId(null)}
                onConfirm={() => {
                    if (deletingTaskId) {
                        deleteTask(deletingTaskId);
                        setDeletingTaskId(null);
                        addToast('Tarefa excluída com sucesso', 'success');
                    }
                }}
                title="Excluir Tarefa"
            >
                <p>Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.</p>
            </ConfirmationModal>
        </div>
    );
};
