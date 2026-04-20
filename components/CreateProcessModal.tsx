
import React, { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProcessCategory } from '../types';

// Templates atualizados para serem mais diretos
const TEMPLATES = [
    {
        id: 'manufacturing-std',
        title: 'Produção de Peças',
        subtitle: 'Matéria-Prima → Usinagem → Peça',
        description: 'Ideal para processos de torno, CNC e corte que geram componentes individuais.',
        category: 'manufacturing' as ProcessCategory,
        icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
        nodes: [
            { id: '1', type: 'materialNode', data: { label: 'Matéria-Prima', cost: 0, type: 'materiaPrima' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'fabricationNode', data: { label: 'Usinagem / Corte', cost: 0, type: 'etapaFabricacao' }, position: { x: 450, y: 100 } },
            { id: '3', type: 'productGeneratorNode', data: { label: 'Gerador de Peça', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Nova Peça {bitola}', skuTemplate: 'PECA-{bitola}' } }, position: { x: 800, y: 100 } },
        ],
        edges: [
            { id: 'e1', source: '1', target: '2', type: 'processEdge' },
            { id: 'e2', source: '2', target: '3', targetHandle: 'process-in', type: 'processEdge' },
        ]
    },
    {
        id: 'kit-assembly',
        title: 'Montagem de Kits',
        subtitle: 'Componentes → Montagem → Kit Final',
        description: 'Ideal para agrupar peças prontas e fixadores em um produto final para venda.',
        category: 'kit_assembly' as ProcessCategory,
        icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        nodes: [
            { id: '1', type: 'inventoryNode', data: { label: 'Componente Base', cost: 0, type: 'inventoryComponent' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'fabricationNode', data: { label: 'Mão de Obra Montagem', cost: 0, type: 'etapaFabricacao' }, position: { x: 450, y: 100 } },
            { id: '3', type: 'productGeneratorNode', data: { label: 'Gerador de Kit', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Kit {headCode}', skuTemplate: 'KIT-{headCode}' } }, position: { x: 800, y: 100 } },
        ],
        edges: [
            { id: 'e1', source: '1', target: '2', type: 'processEdge' },
            { id: 'e2', source: '2', target: '3', targetHandle: 'process-in', type: 'processEdge' },
        ]
    },
    {
        id: 'blank',
        title: 'Fluxo em Branco',
        subtitle: 'Sem pré-definições',
        description: 'Comece com uma tela limpa para criar processos complexos e personalizados.',
        category: 'both' as ProcessCategory,
        icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        nodes: [],
        edges: []
    }
];

interface CreateProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, type: 'simple' | 'generator', category: ProcessCategory, templateData?: any) => void;
}

export const CreateProcessModal: React.FC<CreateProcessModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [selectedId, setSelectedId] = useState('manufacturing-std');

    const handleCreate = () => {
        if (!name.trim()) return;
        const template = TEMPLATES.find(t => t.id === selectedId);
        if (template) {
            onCreate(
                name.trim(),
                'generator',
                template.category === 'both' ? 'manufacturing' : template.category,
                { nodes: template.nodes, edges: template.edges }
            );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Fluxo de Engenharia" size="3xl">
            <div className="space-y-8 py-2">
                <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Criar Novo Processo</h3>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-6">Defina a estrutura de custos e fabricação</p>
                    
                    <div className="relative">
                        <Input 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="NOME DO PROCESSO (Ex: Usinagem Corpo-P)"
                            className="!bg-white/10 !border-white/20 !text-white !h-14 text-lg font-black uppercase placeholder:text-white/20 !rounded-2xl"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {TEMPLATES.map(template => (
                        <div
                            key={template.id}
                            onClick={() => setSelectedId(template.id)}
                            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group ${
                                selectedId === template.id 
                                ? 'border-slate-900 bg-slate-50 ring-4 ring-slate-900/5' 
                                : 'border-slate-100 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all ${
                                selectedId === template.id ? 'bg-slate-900 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                            }`}>
                                {template.icon}
                            </div>
                            <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-1">{template.title}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-3">{template.subtitle}</p>
                            <p className="text-[10px] leading-relaxed text-slate-500 font-medium">{template.description}</p>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose} className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest">Cancelar</Button>
                    <Button 
                        onClick={handleCreate} 
                        disabled={!name.trim()} 
                        className="h-12 px-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border-none font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20"
                    >
                        Criar e Abrir Fluxo
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
