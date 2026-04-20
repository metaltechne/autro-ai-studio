import React, { useState } from 'react';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useCRMTasks } from '../hooks/useCRMTasks';
import { Lead, CallStage, TaskStatus } from '../types';
import { Phone, PhoneCall, Calendar, AlertCircle, CheckCircle2, Clock, Search, Plus, User, Building, GripVertical, MessageCircle } from 'lucide-react';

const CALL_STAGES: CallStage[] = ['A Ligar', 'Sem Resposta', 'Em Contato', 'Reunião Agendada', 'Não Tem Interesse'];

export const CallsCRMView: React.FC = () => {
    const { leads, updateLead } = useSalesFunnel();
    const { tasks, updateTask, addTask } = useCRMTasks(leads, []);
    const [searchTerm, setSearchTerm] = useState('');
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

    const handleStageChange = async (leadId: string, newStage: CallStage) => {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            await updateLead({ ...lead, callStage: newStage });
        }
    };

    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggedLeadId(leadId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', leadId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, stage: CallStage) => {
        e.preventDefault();
        if (draggedLeadId) {
            handleStageChange(draggedLeadId, stage);
            setDraggedLeadId(null);
        }
    };

    const filteredLeads = leads.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.phone.includes(searchTerm) ||
        (l.company && l.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Group leads by call stage
    const leadsByStage = CALL_STAGES.reduce((acc, stage) => {
        acc[stage] = filteredLeads.filter(l => (l.callStage || 'A Ligar') === stage);
        return acc;
    }, {} as Record<CallStage, Lead[]>);

    const getStageColor = (stage: CallStage) => {
        switch (stage) {
            case 'A Ligar': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Sem Resposta': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Em Contato': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Reunião Agendada': return 'bg-green-100 text-green-800 border-green-200';
            case 'Não Tem Interesse': return 'bg-slate-100 text-slate-800 border-slate-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                        <PhoneCall className="w-6 h-6 mr-2 text-autro-primary" />
                        CRM de Ligações (Telemarketing)
                    </h1>
                    <p className="text-slate-500 mt-1">Gerencie suas ligações, funil de contato e lembretes.</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar contatos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 border-transparent rounded-lg focus:bg-white focus:border-autro-primary focus:ring-2 focus:ring-autro-primary/20 transition-all text-sm"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-x-auto p-6">
                <div className="flex gap-6 h-full min-w-max">
                    {CALL_STAGES.map(stage => (
                        <div 
                            key={stage}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage)}
                            className={`w-80 flex flex-col rounded-xl border transition-colors bg-slate-100/50 border-slate-200`}
                        >
                            <div className={`p-3 m-2 rounded-lg border font-semibold flex justify-between items-center ${getStageColor(stage)}`}>
                                <span>{stage}</span>
                                <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs">
                                    {leadsByStage[stage].length}
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-[100px]">
                                {leadsByStage[stage].map((lead) => {
                                    const leadTasks = tasks.filter(t => t.relatedLeadId === lead.id && t.status !== TaskStatus.COMPLETED);
                                    const hasOverdue = leadTasks.some(t => t.status === TaskStatus.OVERDUE);
                                    
                                    return (
                                        <div 
                                            key={lead.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-autro-primary/50 transition-all cursor-grab active:cursor-grabbing group`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-1 text-slate-300 group-hover:text-slate-400">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>
                                                    <h4 className="font-bold text-slate-800">{lead.name}</h4>
                                                </div>
                                                {leadTasks.length > 0 && (
                                                    <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${hasOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} title={`${leadTasks.length} lembretes pendentes`}>
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {leadTasks.length}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="space-y-1.5 mb-4 ml-6">
                                                <div className="text-sm text-slate-600 flex items-center">
                                                    <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                    {lead.phone}
                                                </div>
                                                {lead.company && (
                                                    <div className="text-sm text-slate-600 flex items-center">
                                                        <Building className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                        {lead.company}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-3 border-t border-slate-100 space-y-3">
                                                {/* Quick Add Reminder */}
                                                <div className="flex flex-col gap-2">
                                                    {leadTasks.length > 0 && (
                                                        <div className="space-y-1">
                                                            {leadTasks.map(task => (
                                                                <div key={task.id} className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-100 text-xs">
                                                                    <span className="truncate flex-1 text-slate-700" title={task.title}>{task.title}</span>
                                                                    <button 
                                                                        onClick={() => updateTask(task.id, { status: TaskStatus.COMPLETED })}
                                                                        className="text-slate-400 hover:text-green-500 ml-1"
                                                                        title="Concluir"
                                                                    >
                                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                const title = window.prompt('Qual o lembrete para este contato?');
                                                                if (title) {
                                                                    const dateStr = window.prompt('Para quando? (Formato: YYYY-MM-DD)', new Date().toISOString().split('T')[0]);
                                                                    if (dateStr) {
                                                                        addTask({
                                                                            title,
                                                                            dueDate: dateStr,
                                                                            relatedLeadId: lead.id,
                                                                            status: TaskStatus.PENDING
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            className="flex-1 text-xs text-autro-primary font-medium hover:bg-blue-50 p-1.5 rounded border border-dashed border-blue-200 flex items-center justify-center"
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            Novo Lembrete
                                                        </button>
                                                        <a
                                                            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded border border-green-200 flex items-center justify-center"
                                                            title="WhatsApp"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
