import React, { useState } from 'react';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useCRMTasks } from '../hooks/useCRMTasks';
import { Lead, Deal, DealStage, InventoryHook, TaskStatus } from '../types';
import { Search, Plus, MessageCircle, Phone, Building, Calendar, DollarSign, ExternalLink, Save, ArrowLeft, Copy, Check, Tag, CheckCircle2, XCircle, Megaphone, Clock, Bell } from 'lucide-react';
import { DealModal } from './DealModal';

const QUICK_MESSAGES = [
    "Olá, tudo bem? Vi que você se interessou pelos nossos produtos.",
    "Segue o orçamento que você solicitou:",
    "Podemos agendar uma breve reunião para alinhar os detalhes?",
    "Apenas passando para saber se conseguiu analisar a proposta."
];

const MARKETING_TEMPLATES = [
    { title: "Promoção Especial", text: "Olá! Temos uma oferta especial para você esta semana. Aproveite 20% de desconto em nossos produtos." },
    { title: "Lançamento", text: "Novidade na área! Acabamos de lançar um novo produto que pode te interessar. Quer saber mais?" },
    { title: "Reengajamento", text: "Faz um tempo que não nos falamos! Como estão as coisas? Temos novidades que podem ajudar no seu negócio." }
];

interface WhatsAppCRMViewProps {
    inventory?: InventoryHook;
    productionOrdersHook?: any; // or import ProductionOrdersHook
}

export const WhatsAppCRMView: React.FC<WhatsAppCRMViewProps> = ({ inventory, productionOrdersHook }) => {
    const { leads, deals, addLead, addDeal, updateLead, addDealActivity } = useSalesFunnel();
    const { tasks, addTask, updateTask } = useCRMTasks(leads, deals);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingDeal, setIsAddingDeal] = useState(false);
    
    const [isAddingLead, setIsAddingLead] = useState(false);
    const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', company: '' });
    
    const [newNote, setNewNote] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [copiedMarketingIndex, setCopiedMarketingIndex] = useState<number | null>(null);
    const [newTag, setNewTag] = useState('');
    
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');

    const selectedLead = leads.find(l => l.id === selectedLeadId);
    const leadDeals = deals.filter(d => d.leadId === selectedLeadId);
    const leadTasks = tasks.filter(t => t.relatedLeadId === selectedLeadId && t.status !== TaskStatus.COMPLETED);

    const filteredLeads = leads.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.phone.includes(searchTerm) ||
        (l.tags && l.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleAddLead = async (e: React.FormEvent) => {
        e.preventDefault();
        const lead = await addLead(newLeadForm);
        setSelectedLeadId(lead.id);
        setIsAddingLead(false);
        setNewLeadForm({ name: '', phone: '', company: '' });
    };

    const handleAddNote = async () => {
        if (!selectedLeadId || !newNote.trim()) return;
        
        const lead = leads.find(l => l.id === selectedLeadId);
        if (lead) {
            await updateLead({
                ...lead,
                notes: lead.notes ? `${lead.notes}\n\n[${new Date().toLocaleDateString()}] ${newNote}` : `[${new Date().toLocaleDateString()}] ${newNote}`
            });
            setNewNote('');
        }
    };

    const formatPhoneForWa = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    };

    const handleCopyMessage = (msg: string, index: number) => {
        navigator.clipboard.writeText(msg);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleCopyMarketingMessage = (msg: string, index: number) => {
        navigator.clipboard.writeText(msg);
        setCopiedMarketingIndex(index);
        setTimeout(() => setCopiedMarketingIndex(null), 2000);
    };

    const toggleMarketingOptIn = async () => {
        if (!selectedLead) return;
        await updateLead({
            ...selectedLead,
            marketingOptIn: !selectedLead.marketingOptIn
        });
    };

    const handleAddTag = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newTag.trim() && selectedLead) {
            e.preventDefault();
            const currentTags = selectedLead.tags || [];
            if (!currentTags.includes(newTag.trim())) {
                await updateLead({
                    ...selectedLead,
                    tags: [...currentTags, newTag.trim()]
                });
            }
            setNewTag('');
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!selectedLead || !selectedLead.tags) return;
        await updateLead({
            ...selectedLead,
            tags: selectedLead.tags.filter(t => t !== tagToRemove)
        });
    };

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLeadId || !newTaskTitle.trim() || !newTaskDate) return;
        
        addTask({
            title: newTaskTitle,
            dueDate: new Date(newTaskDate).toISOString(),
            status: TaskStatus.PENDING,
            relatedLeadId: selectedLeadId
        });
        
        setNewTaskTitle('');
        setNewTaskDate('');
    };

    const recordMarketingMessageSent = async () => {
        if (!selectedLead) return;
        await updateLead({
            ...selectedLead,
            lastMarketingMessageAt: new Date().toISOString()
        });
    };

    return (
        <div className="flex h-full bg-slate-50 relative">
            {/* Left Sidebar - Leads List */}
            <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full absolute md:relative z-10 transition-transform duration-300 ${selectedLeadId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                <div className="p-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <MessageCircle className="w-5 h-5 mr-2 text-green-500" />
                        WhatsApp CRM
                    </h2>
                    <div className="relative mb-3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar contatos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-100 border-transparent rounded-lg focus:bg-white focus:border-autro-primary focus:ring-2 focus:ring-autro-primary/20 transition-all text-sm"
                        />
                    </div>
                    <a
                        href="https://business.facebook.com/wa/manage/home"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                        title="Abrir o Gerenciador do WhatsApp no Meta Business Suite para envios em massa"
                    >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Disparo em Massa (Meta)
                        <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
                    </a>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isAddingLead ? (
                        <form onSubmit={handleAddLead} className="p-4 border-b border-slate-100 bg-blue-50/50">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Novo Contato</h3>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    required
                                    placeholder="Nome"
                                    value={newLeadForm.name}
                                    onChange={e => setNewLeadForm({...newLeadForm, name: e.target.value})}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-autro-primary"
                                />
                                <input
                                    type="text"
                                    required
                                    placeholder="WhatsApp (ex: 11999999999)"
                                    value={newLeadForm.phone}
                                    onChange={e => setNewLeadForm({...newLeadForm, phone: e.target.value})}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-autro-primary"
                                />
                                <input
                                    type="text"
                                    placeholder="Empresa (Opcional)"
                                    value={newLeadForm.company}
                                    onChange={e => setNewLeadForm({...newLeadForm, company: e.target.value})}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-autro-primary"
                                />
                                <div className="flex gap-2 pt-1">
                                    <button type="submit" className="flex-1 bg-autro-primary text-white text-sm py-1.5 rounded hover:bg-blue-600">
                                        Salvar
                                    </button>
                                    <button type="button" onClick={() => setIsAddingLead(false)} className="flex-1 bg-slate-200 text-slate-700 text-sm py-1.5 rounded hover:bg-slate-300">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsAddingLead(true)}
                            className="w-full p-3 text-sm text-autro-primary font-medium hover:bg-blue-50 flex items-center justify-center border-b border-slate-100"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar Novo Contato
                        </button>
                    )}

                    <div className="divide-y divide-slate-100">
                        {filteredLeads.map(lead => (
                            <button
                                key={lead.id}
                                onClick={() => setSelectedLeadId(lead.id)}
                                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedLeadId === lead.id ? 'bg-blue-50/50 border-l-4 border-autro-primary' : 'border-l-4 border-transparent'}`}
                            >
                                <div className="font-medium text-slate-800 flex items-center justify-between">
                                    {lead.name}
                                    {lead.marketingOptIn && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                </div>
                                <div className="text-sm text-slate-500 mt-1 flex items-center">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {lead.phone}
                                </div>
                                {lead.tags && lead.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {lead.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                                {tag}
                                            </span>
                                        ))}
                                        {lead.tags.length > 3 && (
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                                +{lead.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Content - Lead Details & Actions */}
            <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
                {selectedLead ? (
                    <>
                        <div className="p-4 md:p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedLeadId(null)}
                                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">{selectedLead.name}</h1>
                                    <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-1 md:mt-2 text-sm text-slate-600">
                                        <span className="flex items-center"><Phone className="w-3.5 h-3.5 mr-1.5" /> {selectedLead.phone}</span>
                                        {selectedLead.company && <span className="flex items-center"><Building className="w-3.5 h-3.5 mr-1.5" /> {selectedLead.company}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <button 
                                            onClick={toggleMarketingOptIn}
                                            className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedLead.marketingOptIn ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                            title="Consentimento para receber mensagens de marketing"
                                        >
                                            {selectedLead.marketingOptIn ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                                            Opt-in Marketing
                                        </button>
                                        
                                        {selectedLead.tags?.map(tag => (
                                            <span key={tag} className="flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
                                                <Tag className="w-3 h-3 mr-1" />
                                                {tag}
                                                <button onClick={() => handleRemoveTag(tag)} className="ml-1.5 hover:text-blue-900"><XCircle className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                        <div className="relative flex items-center">
                                            <input 
                                                type="text" 
                                                value={newTag}
                                                onChange={e => setNewTag(e.target.value)}
                                                onKeyDown={handleAddTag}
                                                placeholder="+ Nova Tag (Enter)"
                                                className="text-xs bg-transparent border-none focus:ring-0 p-0 w-28 placeholder:text-slate-400 text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <a
                                    href={`https://web.whatsapp.com/send?phone=${formatPhoneForWa(selectedLead.phone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm font-medium"
                                >
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Abrir no WhatsApp Web
                                    <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
                                </a>
                                <a
                                    href="https://business.facebook.com/latest/inbox/all/?business_id=1075329373013082&asset_id=111265804830254"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                    title="Abrir Painel Meta Business Suite"
                                >
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Painel Meta
                                    <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
                                </a>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Left Column: Notes & Quick Messages */}
                                <div className="space-y-6">
                                    {/* Quick Messages */}
                                    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wider">Mensagens Rápidas</h3>
                                        <div className="space-y-2">
                                            {QUICK_MESSAGES.map((msg, idx) => (
                                                <div key={idx} className="flex gap-2 items-start p-2 hover:bg-slate-50 rounded-lg group transition-colors border border-transparent hover:border-slate-100">
                                                    <p className="text-sm text-slate-600 flex-1">{msg}</p>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleCopyMessage(msg, idx)}
                                                            className="p-1.5 text-slate-400 hover:text-autro-primary hover:bg-blue-50 rounded"
                                                            title="Copiar texto"
                                                        >
                                                            {copiedIndex === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                        </button>
                                                        <a 
                                                            href={`https://web.whatsapp.com/send?phone=${formatPhoneForWa(selectedLead.phone)}&text=${encodeURIComponent(msg)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                                                            title="Enviar no WhatsApp"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Marketing Templates */}
                                    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center">
                                                <Megaphone className="w-4 h-4 mr-2 text-purple-500" />
                                                Templates de Marketing
                                            </h3>
                                            {selectedLead.lastMarketingMessageAt && (
                                                <span className="text-xs text-slate-500 flex items-center" title="Último envio de marketing">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {new Date(selectedLead.lastMarketingMessageAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {!selectedLead.marketingOptIn && (
                                            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start">
                                                <XCircle className="w-4 h-4 mr-1.5 shrink-0 mt-0.5" />
                                                <p>Este lead não possui Opt-in de Marketing ativo. Enviar mensagens em massa pode resultar em bloqueio do número.</p>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {MARKETING_TEMPLATES.map((template, idx) => (
                                                <div key={idx} className="flex flex-col p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-purple-200 transition-colors group">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs font-bold text-slate-700">{template.title}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => handleCopyMarketingMessage(template.text, idx)}
                                                                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                                                title="Copiar texto"
                                                            >
                                                                {copiedMarketingIndex === idx ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <a 
                                                                href={`https://web.whatsapp.com/send?phone=${formatPhoneForWa(selectedLead.phone)}&text=${encodeURIComponent(template.text)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={recordMarketingMessageSent}
                                                                className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                                                                title="Enviar no WhatsApp"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-600 leading-relaxed">{template.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Reminders Section */}
                                    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wider flex items-center">
                                            <Bell className="w-4 h-4 mr-2 text-amber-500" />
                                            Lembretes e Tarefas
                                        </h3>
                                        
                                        <form onSubmit={handleAddTask} className="mb-4 flex flex-col gap-2">
                                            <input
                                                type="text"
                                                value={newTaskTitle}
                                                onChange={e => setNewTaskTitle(e.target.value)}
                                                placeholder="O que precisa ser feito?"
                                                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary"
                                            />
                                            <div className="flex gap-2">
                                                <input
                                                    type="date"
                                                    value={newTaskDate}
                                                    onChange={e => setNewTaskDate(e.target.value)}
                                                    className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!newTaskTitle.trim() || !newTaskDate}
                                                    className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Adicionar
                                                </button>
                                            </div>
                                        </form>

                                        <div className="space-y-2">
                                            {leadTasks.length > 0 ? (
                                                leadTasks.map(task => (
                                                    <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                        <button 
                                                            onClick={() => updateTask(task.id, { status: TaskStatus.COMPLETED })}
                                                            className="mt-0.5 text-slate-300 hover:text-green-500 transition-colors"
                                                            title="Marcar como concluído"
                                                        >
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </button>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-slate-800">{task.title}</p>
                                                            <p className="text-xs text-slate-500 mt-1 flex items-center">
                                                                <Calendar className="w-3 h-3 mr-1" />
                                                                {new Date(task.dueDate).toLocaleDateString()}
                                                                {task.status === TaskStatus.OVERDUE && (
                                                                    <span className="ml-2 text-red-500 font-medium">Atrasado</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic text-center py-2">Nenhum lembrete pendente.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes Section */}
                                    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Anotações da Conversa</h3>
                                        <div className="mb-4">
                                            <textarea
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                                placeholder="Digite os detalhes importantes da conversa aqui..."
                                                className="w-full h-24 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary resize-none"
                                            />
                                            <div className="flex justify-end mt-2">
                                                <button
                                                    onClick={handleAddNote}
                                                    disabled={!newNote.trim()}
                                                    className="flex items-center px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Salvar Nota
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 mt-6">
                                            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Histórico</h4>
                                            {selectedLead.notes ? (
                                                <div className="bg-slate-50 p-4 rounded-lg text-slate-700 whitespace-pre-wrap text-sm border border-slate-100 max-h-60 overflow-y-auto">
                                                    {selectedLead.notes}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">Nenhuma anotação salva ainda.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Deals Section */}
                                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-semibold text-slate-800">Oportunidades (Funil)</h3>
                                        <button 
                                            onClick={() => setIsAddingDeal(true)}
                                            className="flex items-center text-sm text-autro-primary hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Nova Oportunidade
                                        </button>
                                    </div>
                                    
                                    {leadDeals.length > 0 ? (
                                        <div className="space-y-3">
                                            {leadDeals.map(deal => (
                                                <div key={deal.id} className="p-4 border border-slate-200 rounded-lg hover:border-autro-primary transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-medium text-slate-800">{deal.title}</h4>
                                                        <span className="text-sm font-bold text-slate-700">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="bg-blue-50 text-autro-primary px-2.5 py-1 rounded-full font-medium">
                                                            {deal.stage}
                                                        </span>
                                                        <span className="text-slate-400 flex items-center">
                                                            <Calendar className="w-3.5 h-3.5 mr-1" />
                                                            {new Date(deal.createdAt).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                            <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm mb-3">Nenhuma oportunidade criada para este contato.</p>
                                            <button 
                                                onClick={() => setIsAddingDeal(true)}
                                                className="text-sm text-autro-primary font-medium hover:underline"
                                            >
                                                Criar primeira oportunidade
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <MessageCircle className="w-16 h-16 mb-4 text-slate-200" />
                        <h2 className="text-xl font-medium text-slate-600">Selecione um contato</h2>
                        <p className="mt-2 max-w-sm">Escolha um contato na lista ou adicione um novo para gerenciar as anotações e abrir o WhatsApp Web.</p>
                    </div>
                )}
            </div>
            
            {/* Deal Modal */}
            <DealModal 
                isOpen={isAddingDeal} 
                onClose={() => setIsAddingDeal(false)} 
                inventory={inventory} 
                initialLeadId={selectedLeadId || undefined}
                productionOrdersHook={productionOrdersHook}
            />
        </div>
    );
};
