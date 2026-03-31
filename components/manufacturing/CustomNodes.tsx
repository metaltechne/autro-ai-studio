
import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ProcessNodeData, Component, ProcessDimension, ProcessHeadCode, GenerationConfig } from '../../types';
import { calculateMaterialCost, getComponentCost } from '../../hooks/manufacturing-evaluator';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const handleStyle = { width: 10, height: 10, border: '2px solid white', backgroundColor: '#94a3b8' };
const dataHandleStyle = { ...handleStyle, background: '#F59E0B', borderRadius: '50%', width: 14, height: 14 };
const specificHandleStyle = { ...handleStyle, background: '#7C3AED', width: 12, height: 12, border: '2px solid white' };

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const TableInput = ({ value, onSave, type = "number", step, placeholder, className = "" }: { value: any, onSave: (val: any) => void, type?: string, step?: string, placeholder?: string, className?: string }) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value); }, [value]);
    const handleBlur = () => { if (localValue !== value) { onSave(type === "number" ? parseFloat(localValue) || 0 : localValue); } };
    const handleKeyDown = (e: React.KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } };
    return (
        <input type={type} step={step} value={localValue} placeholder={placeholder} onChange={(e) => setLocalValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
            className={`w-full border-none text-center bg-slate-100 focus:ring-2 focus:ring-blue-500 rounded font-black h-8 text-slate-800 placeholder:font-normal placeholder:text-slate-400 text-[10px] sm:text-xs ${className}`}
        />
    );
};

const NodeActions = ({ onDuplicate, onDelete }: { onDuplicate?: () => void, onDelete?: () => void }) => (
    <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 h8a2 2 0 002-2v-2" /></svg></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
    </div>
);

const NodeContainer = ({ children, selected, title, icon, colorClass, className = '', onDuplicate, onDelete, cost, isTotal }: any) => {
    return (
        <div className={`rounded-2xl bg-white shadow-xl border-2 transition-all duration-300 min-w-[280px] sm:min-w-[320px] overflow-hidden ${selected ? 'border-blue-500 ring-8 ring-blue-500/10' : colorClass} ${className}`}>
            <div className={`px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center gap-2 sm:gap-3 ${selected ? 'bg-blue-50' : 'bg-slate-50'} cursor-grab active:cursor-grabbing`}>
                 <div className="flex-shrink-0">{icon}</div>
                 <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] text-slate-900 flex-grow">{title}</span>
                 <NodeActions onDuplicate={onDuplicate} onDelete={onDelete} />
            </div>
            {cost !== undefined && (
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 flex justify-between items-center border-b ${isTotal ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-60">{isTotal ? 'CUSTO TOTAL' : 'CUSTO'}</span>
                    <span className={`font-black ${isTotal ? 'text-emerald-400 text-xs sm:text-base' : 'text-slate-900 text-[10px] sm:text-xs'}`}>{formatCurrency(cost)}</span>
                </div>
            )}
            <div className="p-3 sm:p-5">{children}</div>
        </div>
    );
};

export const DNATableNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => (
    <div className="relative">
        <NodeContainer selected={selected} title="DNA GEOMÉTRICO (TABELA)" colorClass="border-blue-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode}>
            <div className="nodrag nowheel space-y-4">
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1 text-[9px] h-8" onClick={data.addDimension}>+ Medida</Button>
                </div>
                <div className="border rounded-lg bg-white shadow-inner">
                    <table className="w-full text-[10px] sm:text-[11px]">
                        <thead className="bg-slate-800 text-white font-black sticky top-0">
                            <tr><th className="p-2 text-left">ROSCA (M)</th><th className="p-2 text-left">COMP (mm)</th><th className="w-8"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.dimensions?.map(dim => (
                                <tr key={dim.id} className="hover:bg-slate-50 h-10 relative">
                                    <td className="p-1"><TableInput value={dim.bitola} onSave={(val) => data.updateDimension?.(dim.id, { bitola: val })} /></td>
                                    <td className="p-1"><TableInput value={dim.comprimento} onSave={(val) => data.updateDimension?.(dim.id, { comprimento: val })} /></td>
                                    <td className="p-1 text-center"><button onClick={() => data.deleteDimension?.(dim.id)} className="text-red-300 hover:text-red-500 font-bold text-lg">×</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Sincronizar Estrutura</span>
                    <Handle type="source" position={Position.Right} id="data-out" style={dataHandleStyle} />
                </div>
            </div>
        </NodeContainer>
    </div>
));

export const MaterialMappingNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => {
    const matOptions = data.getMaterialOptions?.() || [];
    return (
        <div className="relative">
            <NodeContainer selected={selected} title="MAPEAMENTO DE INSUMOS" colorClass="border-emerald-200" className="w-[500px]" onDuplicate={data.duplicateNode} onDelete={data.deleteNode} cost={data.cost}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <Handle type="target" position={Position.Left} id="data-in" style={dataHandleStyle} />
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-4">Entrada DNA</span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white nodrag nowheel">
                        <table className="w-full text-[10px] sm:text-[11px]">
                            <thead className="bg-emerald-600 text-white font-black uppercase sticky top-0">
                                <tr><th className="p-2 text-left">MEDIDA</th><th className="p-2 text-left">INSUMO</th><th className="p-2 w-16 text-center">CONS</th><th className="p-2 w-20 text-center">CUSTO</th><th className="p-2 w-12 text-center">RAMIF</th></tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-50">
                                {data.dimensions?.map(dim => {
                                    const mat = matOptions.find((m: any) => m.id === dim.baseMaterialId);
                                    const rowCost = mat ? calculateMaterialCost(mat, mat.consumptionUnit === 'm' ? (dim.consumption || 0) / 1000 : (dim.consumption || 0)) : 0;
                                    return (
                                        <tr key={dim.id} className="h-10 relative">
                                            <td className="p-2 font-black text-slate-700">M{dim.bitola}x{dim.comprimento}</td>
                                            <td className="p-1">
                                                <select value={dim.baseMaterialId || ''} onChange={e => data.updateDimension?.(dim.id, { baseMaterialId: e.target.value })} 
                                                    className="w-full text-[10px] sm:text-[11px] border-none bg-slate-50 focus:ring-0 font-black uppercase text-slate-600 rounded">
                                                    <option value="">-- ESCOLHER --</option>
                                                    {matOptions.map((m: any) => (<option key={m.id} value={m.id}>{m.sku}</option>))}
                                                </select>
                                            </td>
                                            <td className="p-1"><TableInput value={dim.consumption || ''} onSave={(val) => data.updateDimension?.(dim.id, { consumption: val })} /></td>
                                            <td className="p-1 text-center font-bold text-emerald-600">{formatCurrency(rowCost)}</td>
                                            <td className="p-1 text-center relative overflow-visible">
                                                <Handle type="source" position={Position.Right} id={`row-${dim.id}`} style={specificHandleStyle} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </NodeContainer>
        </div>
    );
});

export const ServiceMappingNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => {
    return (
        <div className="relative">
            <NodeContainer selected={selected} title="SERVIÇO POR MEDIDA" colorClass="border-indigo-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode} cost={data.cost}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <Handle type="target" position={Position.Left} id="data-in" style={dataHandleStyle} />
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-4">Entrada DNA</span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white nodrag nowheel">
                        <table className="w-full text-[10px] sm:text-[11px]">
                            <thead className="bg-indigo-600 text-white font-black uppercase sticky top-0">
                                <tr><th className="p-2 text-left">MEDIDA</th><th className="p-2 text-right">VALOR (R$)</th><th className="p-2 w-20 text-center">CUSTO</th><th className="p-2 w-12 text-center">RAMIF</th></tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                                {data.dimensions?.map(dim => (
                                    <tr key={dim.id} className="h-10 relative">
                                        <td className="p-2 font-black text-slate-700">M{dim.bitola}x{dim.comprimento}</td>
                                        <td className="p-1"><TableInput value={dim.serviceCost || 0} onSave={(val) => data.updateDimension?.(dim.id, { serviceCost: val })} /></td>
                                        <td className="p-1 text-center font-bold text-indigo-600">{formatCurrency(Number(dim.serviceCost) || 0)}</td>
                                        <td className="p-1 text-center relative overflow-visible">
                                            <Handle type="source" position={Position.Right} id={`row-${dim.id}`} style={specificHandleStyle} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </NodeContainer>
        </div>
    );
});

export const ProductGeneratorNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => (
    <div className="relative">
        <Handle type="target" position={Position.Top} id="data-in" style={dataHandleStyle} />
        <Handle type="target" position={Position.Left} id="process-in" style={handleStyle} />
        <NodeContainer selected={selected} title="GERADOR FINAL" colorClass="border-orange-300" isTotal cost={data.cost} onDuplicate={data.duplicateNode} onDelete={data.deleteNode} icon={<svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}>
            <div className="nodrag">
                <p className="text-[9px] font-black text-slate-400 uppercase text-center mb-4 italic">Conecte o DNA no topo e os processos na esquerda</p>
                <div className="space-y-4">
                    <Input label="TEMPLATE NOME" value={data.generationConfig?.nameTemplate || ''} onChange={e => data.updateNodeGenerationConfig?.({ nameTemplate: e.target.value })} placeholder="Ex: Item M{bitola}" />
                    <Input label="TEMPLATE SKU" value={data.generationConfig?.skuTemplate || ''} onChange={e => data.updateNodeGenerationConfig?.({ skuTemplate: e.target.value })} placeholder="Ex: SKU-{bitola}" />
                    <Button size="sm" onClick={data.onViewGeneratedProducts} className="w-full h-10 font-black text-[10px] uppercase bg-orange-600 hover:bg-orange-700 shadow-lg">Ver Itens Gerados</Button>
                </div>
            </div>
        </NodeContainer>
    </div>
));

export const FabricationNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => {
    const op = data.operations?.find(o => o.id === data.operationId);
    const mode = data.costCalculationMode || 'time';
    
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} style={handleStyle} />
            <NodeContainer selected={selected} title="ETAPA DE PROCESSO" colorClass="border-slate-200" cost={data.cost} onDuplicate={data.duplicateNode} onDelete={data.deleteNode}>
                <div className="space-y-4 nodrag">
                    <Input label="NOME DA ETAPA" defaultValue={data.label} onBlur={e => data.updateNodeLabel?.(e.target.value)} />
                    
                    <Select label="MODO DE CUSTO" value={mode} onChange={e => data.updateNodeOperationDetails?.({ costCalculationMode: e.target.value as any })}>
                        <option value="time">Tempo (Operador/Máquina)</option>
                        <option value="fixed">Custo Fixo</option>
                        <option value="workstation">Posto de Trabalho</option>
                    </Select>

                    {mode === 'fixed' && (
                        <Input label="CUSTO FIXO (R$)" type="number" value={data.fixedCost || 0} onChange={e => data.updateNodeOperationDetails?.({ fixedCost: parseFloat(e.target.value) })} />
                    )}
                    
                    {mode === 'time' && (
                        <div className="space-y-3">
                            <Select label="SERVIÇO" value={data.operationId || ''} onChange={e => data.updateNodeOperationDetails?.({ operationId: e.target.value })}><option value="">-- MANUAL --</option>{data.operations?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
                            <div className="grid grid-cols-2 gap-3">
                                <Select label="OPERADOR" value={data.manualOperatorId || ''} onChange={e => data.updateNodeOperationDetails?.({ manualOperatorId: e.target.value })}><option value="">PADRÃO</option>{data.operators?.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}</Select>
                                <Input label="TEMPO (s)" type="number" value={data.manualTimeSeconds || 0} onChange={e => data.updateNodeOperationDetails?.({ manualTimeSeconds: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                    )}

                    {mode === 'workstation' && (
                        <Select label="POSTO DE TRABALHO" value={data.workStationId || ''} onChange={e => data.updateNodeOperationDetails?.({ workStationId: e.target.value })}><option value="">ESCOLHER...</option>{data.operators?.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}</Select>
                    )}
                </div>
            </NodeContainer>
            <Handle type="source" position={Position.Right} style={handleStyle} />
        </div>
    );
});

export const MaterialNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => (
    <div className="relative"><Handle type="target" position={Position.Left} style={handleStyle} /><NodeContainer selected={selected} title="MATÉRIA-PRIMA" colorClass="border-emerald-200" cost={data.cost} onDuplicate={data.duplicateNode} onDelete={data.deleteNode}><div className="space-y-4 nodrag"><Select label="ITEM" value={data.baseMaterialId || ''} onChange={e => data.updateNodeMaterialDetails?.({ baseMaterialId: e.target.value }, [])}><option value="">ESCOLHER...</option>{data.getMaterialOptions?.().map(m => <option key={m.id} value={m.id}>{m.sku}</option>)}</Select><Input label="CONSUMO" type="number" defaultValue={data.consumption || 0} onBlur={e => data.updateNodeMaterialDetails?.({ consumption: parseFloat(e.target.value) || 0 }, [])} /></div></NodeContainer><Handle type="source" position={Position.Right} style={handleStyle} /></div>
));

export const InventoryNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => {
    const isDynamic = !!data.componentIdTemplate || !!data.sourceFamiliaId;
    
    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} style={handleStyle} />
            <NodeContainer selected={selected} title="ITEM DE ESTOQUE" colorClass="border-purple-200" cost={data.cost} onDuplicate={data.duplicateNode} onDelete={data.deleteNode}>
                <div className="space-y-4 nodrag">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-500">TIPO DE ITEM</span>
                        <select 
                            className="text-[9px] border-slate-200 rounded p-1 bg-slate-50"
                            value={isDynamic ? 'dynamic' : 'fixed'}
                            onChange={e => {
                                if (e.target.value === 'fixed') {
                                    data.updateNodeComponentDetails?.({ componentIdTemplate: '', sourceFamiliaId: '' }, []);
                                } else {
                                    data.updateNodeComponentDetails?.({ componentId: '', componentIdTemplate: '{sku}' }, []);
                                }
                            }}
                        >
                            <option value="fixed">Item Fixo Único</option>
                            <option value="dynamic">Item de Outro Processo</option>
                        </select>
                    </div>

                    {isDynamic ? (
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                            <div className="text-[9px] font-black uppercase text-blue-700 tracking-widest mb-2 flex items-center gap-1">
                                <span>🔗</span> VINCULAR PROCESSO
                            </div>
                            
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[8px] font-bold text-slate-500 uppercase">Processo de Origem</label>
                                    <select 
                                        className="w-full text-[10px] p-1.5 rounded border border-blue-200 bg-white font-bold text-blue-900"
                                        value={data.sourceFamiliaId || ''}
                                        onChange={e => {
                                            const famId = e.target.value;
                                            const fam = data.allFamilias?.find(f => f.id === famId);
                                            const genNode = fam?.nodes.find(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode');
                                            const skuTpl = genNode?.data.generationConfig?.skuTemplate || '';
                                            data.updateNodeComponentDetails?.({ 
                                                sourceFamiliaId: famId,
                                                componentIdTemplate: skuTpl || data.componentIdTemplate
                                            }, []);
                                        }}
                                    >
                                        <option value="">-- Selecione o Processo --</option>
                                        {data.allFamilias?.map(f => (
                                            <option key={f.id} value={f.id}>{f.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {data.sourceFamiliaId && (
                                    <div className="mt-2 p-2 bg-white rounded border border-blue-100">
                                        <p className="text-[9px] text-slate-600 leading-relaxed">
                                            As bitolas e comprimentos serão herdados automaticamente deste processo. Não é necessário criar a tabela novamente.
                                        </p>
                                        <div className="mt-2 pt-2 border-t border-blue-50 flex flex-col gap-1">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase">Formato do Código (SKU)</label>
                                            <input 
                                                type="text"
                                                className="w-full text-[9px] p-1 rounded border border-slate-200 bg-slate-50 font-mono text-slate-600"
                                                value={data.componentIdTemplate || ''}
                                                onChange={e => data.updateNodeComponentDetails?.({ componentIdTemplate: e.target.value }, [])}
                                                placeholder="Ex: PAR-M{bitola}X{comprimento}"
                                            />
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-50 flex flex-col gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.inheritDna !== false} 
                                                    onChange={e => data.updateNodeComponentDetails?.({ inheritDna: e.target.checked }, [])}
                                                />
                                                <span className="text-[9px] font-bold text-slate-600">Herdar Tabela DNA (Bitolas/Comprimentos)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.inheritCodes !== false} 
                                                    onChange={e => data.updateNodeComponentDetails?.({ inheritCodes: e.target.checked }, [])}
                                                />
                                                <span className="text-[9px] font-bold text-slate-600">Herdar Tabela de Códigos</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Select value={data.componentId || ''} onChange={e => data.updateNodeComponentDetails?.({ componentId: e.target.value, componentIdTemplate: '', sourceFamiliaId: '' }, [])}>
                            <option value="">SELECIONAR...</option>
                            {(data.getInventoryComponentOptions?.() || []).map((c: any) => <option key={c.id} value={c.id}>{c.sku}</option>)}
                        </Select>
                    )}
                </div>
            </NodeContainer>
            <Handle type="source" position={Position.Right} style={handleStyle} />
        </div>
    );
});

export const CodificationTableNode = memo(({ data, selected }: any) => (
    <div className="relative">
        <NodeContainer selected={selected} title="TABELA DE CÓDIGOS" colorClass="border-amber-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode}>
            <div className="nodrag nowheel">
                <div className="flex gap-2 mb-2">
                    <Button size="sm" variant="secondary" className="flex-1 text-[9px] h-8" onClick={() => data.addHeadCode?.()}>+ Código</Button>
                </div>
                <div className="border rounded-lg bg-white shadow-inner">
                    <table className="w-full text-[10px] table-fixed">
                        <thead className="bg-slate-800 text-white font-black sticky top-0">
                            <tr><th className="p-2 text-left">CÓDIGO</th><th className="p-2 text-left">TIPO</th><th className="w-8"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.headCodes?.map(hc => (
                                <tr key={hc.id} className="hover:bg-slate-50">
                                    <td className="p-1"><TableInput value={hc.code} onSave={(val) => data.updateHeadCode?.(hc.id, { code: val })} type="text" /></td>
                                    <td className="p-1"><TableInput value={hc.type || ''} onSave={(val) => data.updateHeadCode?.(hc.id, { type: val })} type="text" /></td>
                                    <td className="p-1 text-center"><button onClick={() => data.deleteHeadCode?.(hc.id)} className="text-red-300 hover:text-red-500 font-bold text-lg">×</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </NodeContainer>
        <Handle type="source" position={Position.Right} style={dataHandleStyle} />
    </div>
));

export const FinalNode = memo(({ data, selected }: any) => (
    <div className="relative"><Handle type="target" position={Position.Left} style={handleStyle} /><NodeContainer selected={selected} title="RESULTADO" colorClass="border-slate-900 bg-slate-900 text-white" cost={data.cost} isTotal><p className="text-[10px] opacity-60 italic">Soma integral calculada.</p></NodeContainer></div>
));

export const UsinagemParafusoSextavadoNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => (
    <div className="relative">
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <NodeContainer selected={selected} title="USINAGEM PARAFUSO SEXTAVADO" colorClass="border-rose-300" onDuplicate={data.duplicateNode} onDelete={data.deleteNode}>
            <div className="nodrag nowheel space-y-4">
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1 text-[9px] h-8" onClick={data.addDimension}>+ Medida</Button>
                </div>
                <div className="border rounded-lg bg-white shadow-inner">
                    <table className="w-full text-[10px] sm:text-[11px]">
                        <thead className="bg-rose-800 text-white font-black sticky top-0">
                            <tr><th className="p-2 text-left">BITOLA (M)</th><th className="p-2 text-left">COMP (mm)</th><th className="w-8"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.dimensions?.map(dim => (
                                <tr key={dim.id} className="hover:bg-slate-50 h-10 relative">
                                    <td className="p-1"><TableInput value={dim.bitola} onSave={(val) => data.updateDimension?.(dim.id, { bitola: val })} /></td>
                                    <td className="p-1"><TableInput value={dim.comprimento} onSave={(val) => data.updateDimension?.(dim.id, { comprimento: val })} /></td>
                                    <td className="p-1 text-center"><button onClick={() => data.deleteDimension?.(dim.id)} className="text-red-300 hover:text-red-500 font-bold text-lg">×</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </NodeContainer>
        <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
));

export const VariableNode = memo(({ data, selected }: any) => (
    <div className="relative"><NodeContainer selected={selected} title="VARIÁVEL" colorClass="border-slate-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode}><div className="nodrag"><Input label="NOME" defaultValue={data.label} onBlur={e => data.updateNodeLabel?.(e.target.value)} className="mb-3" /><Input label="VALOR" type="number" defaultValue={data.cost} onBlur={e => data.updateNodeCost?.(e.target.value)} /></div></NodeContainer><Handle type="source" position={Position.Right} style={dataHandleStyle} /></div>
));

export const SubProcessMappingNode: React.FC<NodeProps<ProcessNodeData>> = memo(({ data, selected }) => {
    return (
        <div className="relative">
            <NodeContainer selected={selected} title="PROCESSO POR MEDIDA" colorClass="border-purple-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode} cost={data.cost}>
                <div className="space-y-4">
                    <Handle type="target" position={Position.Left} id="data-in" style={dataHandleStyle} />
                    <div className="overflow-hidden rounded-xl border border-purple-100 bg-white nodrag nowheel">
                        <table className="w-full text-[10px]">
                            <thead className="bg-purple-600 text-white font-black uppercase sticky top-0">
                                <tr><th className="p-2 text-left">MEDIDA</th><th className="p-2">PROCESSO ALVO</th><th className="p-2 w-12 text-center">RAMIF</th></tr>
                            </thead>
                            <tbody className="divide-y divide-purple-50">
                                {data.dimensions?.map(dim => (
                                    <tr key={dim.id} className="h-10 relative">
                                        <td className="p-2 font-black text-slate-700">M{dim.bitola}x{dim.comprimento}</td>
                                        <td className="p-1">
                                            <select value={dim.targetFamiliaId || ''} onChange={e => data.updateDimension?.(dim.id, { targetFamiliaId: e.target.value })} 
                                                className="w-full text-[9px] border-none bg-transparent focus:ring-0 font-black uppercase text-slate-600 truncate">
                                                <option value="">-- PADRÃO --</option>
                                                {data.allFamilias?.map(f => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                                            </select>
                                        </td>
                                        <td className="p-1 text-center relative overflow-visible">
                                            <Handle type="source" position={Position.Right} id={`row-${dim.id}`} style={specificHandleStyle} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </NodeContainer>
        </div>
    );
});

export const ExternalDataSourceNode = memo(({ data, selected }: any) => (
    <div className="relative"><NodeContainer selected={selected} title="FONTE EXTERNA" colorClass="border-slate-200" onDuplicate={data.duplicateNode} onDelete={data.deleteNode}><p className="text-[10px] text-slate-400 italic">Sincronização de dados legados.</p></NodeContainer><Handle type="source" position={Position.Right} style={dataHandleStyle} /></div>
));

// UI Helpers para o Designer
export const DimensionTableUI: React.FC<{ dimensions: ProcessDimension[] | undefined; onUpdate: (id: string, data: Partial<ProcessDimension>) => void; onAdd: () => void; onDelete: (id: string) => void; }> = ({ dimensions, onUpdate, onAdd, onDelete }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dimensões</h4><Button size="sm" variant="secondary" onClick={onAdd}>+ Nova Medida</Button></div>
        <div className="border rounded-xl bg-white shadow-inner">
            <table className="min-w-full text-[10px]">
                <thead className="bg-slate-800 text-white font-black sticky top-0"><tr><th className="p-2 text-left">ROSCA (M)</th><th className="p-2 text-left">COMP (mm)</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{dimensions?.map((dim: any) => (<tr key={dim.id} className="hover:bg-slate-50"><td className="p-1"><TableInput value={dim.bitola} onSave={(val) => onUpdate(dim.id, { bitola: val })} /></td><td className="p-1"><TableInput value={dim.comprimento} onSave={(val) => onUpdate(dim.id, { comprimento: val })} /></td><td className="p-1 text-center"><button onClick={() => onDelete(dim.id)} className="text-red-300 hover:text-red-600 font-bold text-lg">×</button></td></tr>))}</tbody>
            </table>
        </div>
    </div>
);

export const HeadCodeTableUI: React.FC<{ headCodes: ProcessHeadCode[] | undefined; onUpdate: (id: string, data: Partial<ProcessHeadCode>) => void; onAdd: (code?: string) => void; onDelete: (id: string) => void; }> = ({ headCodes, onUpdate, onAdd, onDelete }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Códigos de Cabeça</h4><Button size="sm" variant="secondary" onClick={() => onAdd?.()}>+ Novo Código</Button></div>
        <div className="border rounded-xl bg-white shadow-inner">
            <table className="min-w-full text-[10px]">
                <thead className="bg-slate-800 text-white font-black sticky top-0"><tr><th className="p-2 text-left">CÓDIGO</th><th className="p-2 text-left">TIPO</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{headCodes?.map((hc: any) => (<tr key={hc.id} className="hover:bg-slate-50"><td className="p-1"><TableInput value={hc.code} onSave={(val) => onUpdate(hc.id, { code: val })} type="text" /></td><td className="p-1"><TableInput value={hc.type || ''} onSave={(val) => onUpdate(hc.id, { type: val })} type="text" /></td><td className="p-1 text-center"><button onClick={() => onDelete(hc.id)} className="text-red-300 hover:text-red-600 font-bold text-lg">×</button></td></tr>))}</tbody>
            </table>
        </div>
    </div>
);

export const ProductGeneratorFormUI: React.FC<{ config: GenerationConfig | undefined; cost: number; onUpdate: (config: Partial<GenerationConfig>) => void; onViewProducts: () => void; }> = ({ config, cost, onUpdate, onViewProducts }) => (
    <div className="space-y-4">
        <Input label="Template de Nome" value={config?.nameTemplate || ''} onChange={e => onUpdate({ nameTemplate: e.target.value })} placeholder="Ex: Parafuso M{bitola}" />
        <Input label="Template de SKU" value={config?.skuTemplate || ''} onChange={e => onUpdate({ skuTemplate: e.target.value })} placeholder="Ex: FIX-{bitola}" />
        <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-700">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custo Total Un.</span>
            <span className="text-lg font-black text-emerald-400">{formatCurrency(cost)}</span>
        </div>
        <Button onClick={onViewProducts} className="w-full bg-orange-600 hover:bg-orange-500 border-none shadow-lg mt-2 uppercase font-black text-[10px]">Ver Itens Gerados</Button>
    </div>
);
