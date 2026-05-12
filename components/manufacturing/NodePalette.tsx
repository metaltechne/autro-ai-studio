
import React from 'react';
import { Panel } from 'reactflow';
import { ProcessCategory, StandardOperation } from '../../types';

interface PaletteItemProps {
    label: string;
    type: string;
    colorClass: string;
    icon: React.ReactNode;
    onClick?: (type: string) => void;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ label, type, colorClass, icon, onClick }) => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            className={`flex flex-col items-center justify-center p-2 border-2 rounded-xl cursor-grab active:cursor-grabbing transition-all bg-white shadow-sm hover:shadow-md ${colorClass}`}
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => onClick?.(type)}
            draggable
        >
            {icon}
            <span className="text-[9px] font-black uppercase text-slate-500 mt-1.5 text-center leading-none tracking-tighter">
                {label}
            </span>
        </div>
    );
};

interface NodePaletteProps {
    mode: 'all' | ProcessCategory;
    standardOperations?: StandardOperation[];
    onAddNode?: (type: string) => void;
}

const NodePalette: React.FC<NodePaletteProps> = ({ mode, standardOperations = [], onAddNode }) => {
    return (
        <Panel position="top-left" className="m-4 ml-2 flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl border border-slate-200 w-28 max-h-[85vh] overflow-y-auto hide-scrollbar pointer-events-auto">
            <div className="text-xs font-bold text-slate-400 uppercase text-center mb-1 tracking-wider">DNA</div>
            
            <PaletteItem 
                label="DNA Geométrico" 
                type="dnaTable"
                colorClass="hover:border-blue-400 border-blue-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10m0-10l5 5m-5-5l-4 4m9 2l5-5m-5 5l4 4M15 7v10m0-10l5 5m-5-5l-4 4m9 2l5-5m-5 5l4 4m-4-5l-4 4" /></svg>}
            />

            <PaletteItem 
                label="Tabela Códigos" 
                type="codificationTable"
                colorClass="hover:border-amber-400 border-amber-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
            />

            <div className="w-full h-px bg-slate-200 my-1"></div>
            <div className="text-xs font-bold text-slate-400 uppercase text-center mb-1 tracking-wider">Mapeamento</div>

            <PaletteItem 
                label="Insumos DNA" 
                type="materialMapping"
                colorClass="hover:border-emerald-400 border-emerald-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" /></svg>}
            />

            <div className="w-full h-px bg-slate-200 my-1"></div>
            <div className="text-xs font-bold text-slate-400 uppercase text-center mb-1 tracking-wider">Processos</div>

            <PaletteItem 
                label="Etapa de Processo" 
                type="etapaFabricacao"
                colorClass="hover:border-slate-400 border-slate-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
            />
            
            <PaletteItem 
                label="Item de Estoque" 
                type="inventoryComponent"
                colorClass="hover:border-purple-400 border-purple-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            />

            <PaletteItem 
                label="Usinagem Parafuso" 
                type="usinagemParafusoSextavado"
                colorClass="hover:border-rose-400 border-rose-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>}
            />

            <div className="w-full h-px bg-slate-200 my-1"></div>
            <div className="text-xs font-bold text-slate-400 uppercase text-center mb-1 tracking-wider">Geração</div>

            <PaletteItem 
                label="Gerador" 
                type="productGenerator"
                colorClass="hover:border-orange-400 border-orange-100"
                onClick={onAddNode}
                icon={<svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            />
        </Panel>
    );
};

export default NodePalette;
