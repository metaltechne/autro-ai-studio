
import React, { useState, useMemo, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { ManufacturingHook, InventoryHook, ManufacturingOrderItem, ManufacturingOrdersHook, View, ManufacturingAnalysis, PurchaseOrdersHook, Component, ProcessHeadCode } from '../types';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { useToast } from '../hooks/useToast';

export const ManufacturingPlannerView: React.FC<ManufacturingPlannerViewProps> = ({ manufacturing, inventory, manufacturingOrdersHook, purchaseOrdersHook, setCurrentView }) => {
    const { familias, analyzeManufacturingRun } = manufacturing;
    const { components } = inventory;
    const { addManufacturingOrder } = manufacturingOrdersHook;
    const { addToast } = useToast();
    
    const [selectedFamiliaId, setSelectedFamiliaId] = useState<string>('');
    const [selectedCodeFilter, setSelectedCodeFilter] = useState<string>('all');
    const [order, setOrder] = useState<ManufacturingOrderItem[]>([]);
    const [analysisResult, setAnalysisResult] = useState<ManufacturingAnalysis | null>(null);
    const [showDictionary, setShowDictionary] = useState(false);
    
    // New fields for manufacturing order
    const [orderType, setOrderType] = useState<'interna' | 'externa'>('interna');
    const [priority, setPriority] = useState<'baixa' | 'normal' | 'alta' | 'urgente'>('normal');
    const [startDate, setStartDate] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [notes, setNotes] = useState('');

    const manufacturableFamilias = useMemo(() => {
        return familias.filter(f => f.nodes?.some(n => n.data.type === 'productGenerator')).sort((a,b) => a.nome.localeCompare(b.nome));
    }, [familias]);

    // Extrai todos os códigos disponíveis para a família selecionada (locais ou herdados)
    const availableCodes = useMemo(() => {
        if (!selectedFamiliaId) return [];
        const fam = familias.find(f => f.id === selectedFamiliaId);
        if (!fam) return [];
        
        const codes = new Set<string>();
        // Busca direta
        fam.nodes.forEach(n => {
            if ((n.data.type === 'headCodeTable' || n.data.type === 'codificationTable' || n.data.type === 'codificationTableNode') && n.data.headCodes) {
                n.data.headCodes.forEach(hc => codes.add(hc.code));
            }
        });
        
        // Busca em subconjuntos (Herança)
        if (codes.size === 0) {
            fam.nodes.forEach(n => {
                if (n.data.type === 'inventoryComponent' && n.data.componentIdTemplate) {
                    const template = n.data.componentIdTemplate;
                    const source = familias.find(f => f.nodes?.some(gn => (gn.data.type === 'productGenerator' || gn.data.type === 'productGeneratorNode') && gn.data.generationConfig?.skuTemplate === template));
                    source?.nodes.forEach(sn => {
                        if ((sn.data.type === 'headCodeTable' || sn.data.type === 'codificationTable' || sn.data.type === 'codificationTableNode') && sn.data.headCodes) {
                            sn.data.headCodes.forEach(hc => codes.add(hc.code));
                        }
                    });
                }
            });
        }
        
        return Array.from(codes).sort();
    }, [selectedFamiliaId, familias]);

    const filteredComponents = useMemo(() => {
        if (!selectedFamiliaId) return [];
        let items = components.filter(c => c.familiaId === selectedFamiliaId);
        
        if (selectedCodeFilter !== 'all') {
            items = items.filter(c => c.sku.includes(selectedCodeFilter) || c.name.includes(selectedCodeFilter));
        }
        
        return items.sort((a, b) => a.name.localeCompare(b.name));
    }, [components, selectedFamiliaId, selectedCodeFilter]);

    const handleAddAllFiltered = () => {
        const newItems = filteredComponents.map(c => ({ componentId: c.id, quantity: 1, name: c.name, sku: c.sku }));
        setOrder(prev => {
            const updated = [...prev];
            newItems.forEach(ni => {
                if (!updated.find(u => u.componentId === ni.componentId)) updated.push(ni);
            });
            return updated;
        });
        addToast(`${newItems.length} variações adicionadas ao lote.`, 'info');
    };

    const codificationDictionary = useMemo(() => {
        const dict = new Map<string, { code: string; type: string; description: string; femaleStock: number; maleStock: number; femaleSku: string; maleSku: string }>();
        familias.forEach(f => {
            f.nodes.forEach(n => {
                if ((n.data.type === 'headCodeTable' || n.data.type === 'codificationTable' || n.data.type === 'codificationTableNode') && n.data.headCodes) {
                    n.data.headCodes.forEach((hc: ProcessHeadCode) => {
                        const dictKey = `${hc.type || 'N/A'}-${hc.code}`;
                        if (!dict.has(dictKey)) {
                            const femaleSku = `MOEDA-${hc.type ? hc.type + '-' : ''}${hc.code}`;
                            const maleSku = `SEGREDO-${hc.type ? hc.type + '-' : ''}${hc.code}`;
                            const femaleComp = inventory.findComponentBySku(femaleSku);
                            const maleComp = inventory.findComponentBySku(maleSku);
                            dict.set(dictKey, {
                                code: hc.code, type: hc.type || 'GERAL', description: hc.description || 'Padrão não definido',
                                femaleSku, maleSku, femaleStock: femaleComp?.stock || 0, maleStock: maleComp?.stock || 0
                            });
                        }
                    });
                }
            });
        });
        return Array.from(dict.values()).sort((a, b) => a.type.localeCompare(b.type) || a.code.localeCompare(b.code));
    }, [familias, inventory]);

    const handleAnalyze = () => {
        if (order.length === 0) return;
        const result = analyzeManufacturingRun(order, components);
        setAnalysisResult(result);
    };

    return (
        <div className="h-full flex flex-col font-sans max-w-[1600px] mx-auto overflow-hidden">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Lotes de Fabricação</h2>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Planejamento de Produção Interna e Terceirizada</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowDictionary(!showDictionary)} variant="secondary" className="h-11 rounded-2xl uppercase font-black text-[10px] flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Dicionário de Segredos
                    </Button>
                    <Button onClick={handleAnalyze} disabled={order.length === 0} className="h-11 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 border-none shadow-xl shadow-indigo-500/20 uppercase font-black text-[10px]">Analisar Consumo</Button>
                </div>
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
                {/* 1. Seleção de Peças para Produzir */}
                <Card className="lg:col-span-3 flex flex-col min-h-0 p-0 overflow-hidden border-2 border-slate-200">
                    <div className="p-4 bg-slate-900 text-white space-y-4">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Processo</h3>
                            <Select value={selectedFamiliaId} onChange={e => { setSelectedFamiliaId(e.target.value); setSelectedCodeFilter('all'); }} className="!bg-white/10 !text-white !border-white/20 !h-10 text-[10px]">
                                <option value="" className="text-slate-900">Escolher Fluxo...</option>
                                {manufacturableFamilias.map(f => <option key={f.id} value={f.id} className="text-slate-900">{f.nome}</option>)}
                            </Select>
                        </div>
                        
                        {selectedFamiliaId && availableCodes.length > 0 && (
                            <div className="animate-fade-in">
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Filtrar por Código</h3>
                                <div className="flex gap-2">
                                    <Select value={selectedCodeFilter} onChange={e => setSelectedCodeFilter(e.target.value)} className="flex-grow !bg-white/10 !text-white !border-white/20 !h-10 text-[10px]">
                                        <option value="all" className="text-slate-900">Todos os Códigos</option>
                                        {availableCodes.map(code => <option key={code} value={code} className="text-slate-900">{code}</option>)}
                                    </Select>
                                    <Button size="sm" onClick={handleAddAllFiltered} className="!bg-indigo-500 hover:!bg-indigo-400 !text-white border-none text-[10px] px-2" title="Adicionar todos os visíveis">+</Button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-white">
                        {selectedFamiliaId ? (
                            filteredComponents.length > 0 ? (
                                filteredComponents.map(c => (
                                    <div key={c.id} onClick={() => {
                                        setOrder(prev => {
                                            const ex = prev.find(i => i.componentId === c.id);
                                            if (ex) return prev.map(i => i.componentId === c.id ? {...i, quantity: i.quantity + 1} : i);
                                            return [...prev, { componentId: c.id, quantity: 1, name: c.name, sku: c.sku }];
                                        });
                                        setAnalysisResult(null);
                                    }} className="p-3 border border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all flex justify-between items-center group">
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-800 text-[11px] uppercase truncate">{c.name}</p>
                                            <p className="text-[9px] font-mono text-slate-400">{c.sku}</p>
                                        </div>
                                        <span className="text-indigo-400 group-hover:text-indigo-600 font-black">+</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-400 text-[10px] font-black uppercase py-20 opacity-30">Nenhuma variação encontrada para este filtro</p>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                                <svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <p className="text-[10px] font-black uppercase tracking-widest">Aguardando Seleção de Processo</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* 2. Plano do Lote */}
                <Card className="lg:col-span-5 flex flex-col min-h-0 p-0 overflow-hidden border-2 border-slate-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Itens do Lote</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.length} variações selecionadas</p>
                        </div>
                        <Button variant="danger" size="sm" onClick={() => setOrder([])} disabled={order.length === 0} className="rounded-xl h-8 text-[9px] uppercase font-black">Limpar</Button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-white shadow-inner">
                        {order.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" /></svg>
                                <p className="text-[10px] font-black uppercase tracking-widest">Arraste itens ou clique em +</p>
                            </div>
                        ) : (
                            order.map(item => {
                                const comp = inventory.findComponentById(item.componentId);
                                return (
                                    <div key={item.componentId} className="flex items-center gap-3 animate-fade-in">
                                        <div className="flex-grow p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-colors">
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-900 text-xs uppercase truncate">{comp?.name}</p>
                                                <p className="text-[9px] font-mono text-slate-400 font-bold">{comp?.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-slate-100 rounded-xl p-1 border">
                                                    <button onClick={() => setOrder(prev => prev.map(i => i.componentId === item.componentId ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-900 font-black shadow-sm">-</button>
                                                    <input type="number" min="1" value={item.quantity} onChange={e => {
                                                        const val = Number(e.target.value) || 1;
                                                        setOrder(prev => prev.map(i => i.componentId === item.componentId ? {...i, quantity: val} : i));
                                                        setAnalysisResult(null);
                                                    }} className="w-12 border-none bg-transparent text-center font-black text-slate-900 focus:ring-0" />
                                                    <button onClick={() => setOrder(prev => prev.map(i => i.componentId === item.componentId ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-900 font-black shadow-sm">+</button>
                                                </div>
                                                <button onClick={() => setOrder(prev => prev.filter(i => i.componentId !== item.componentId))} className="p-2 text-rose-300 hover:text-rose-600 transition-colors">×</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>

                {/* 3. Viabilidade / Resultado */}
                <Card className="lg:col-span-4 flex flex-col min-h-0 p-0 overflow-hidden border-2 border-indigo-600 shadow-2xl relative">
                    <div className="p-6 bg-indigo-600 text-white">
                        <h3 className="text-xl font-black uppercase tracking-tighter">Explosão de Insumos</h3>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">Cálculo de Carga de Materiais</p>
                    </div>
                    <div className="flex-grow p-6 flex flex-col bg-white">
                        {!analysisResult ? (
                            <div className="flex-grow flex flex-col items-center justify-center opacity-20 text-center">
                                <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Defina o Lote para Analisar</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full animate-fade-in">
                                <div className="p-5 bg-emerald-50 rounded-2xl border-2 border-emerald-200 text-center mb-6">
                                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Custo Total de Produção</p>
                                    <p className="text-3xl font-black text-slate-900">{formatCurrency(analysisResult.totalCost)}</p>
                                </div>
                                <div className="flex-grow overflow-y-auto space-y-2 mb-6 -mr-2 pr-2">
                                    {analysisResult.detailedBreakdown && analysisResult.detailedBreakdown.length > 0 && (
                                        <>
                                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 mb-2">Detalhamento por Item</h4>
                                            {analysisResult.detailedBreakdown.map((step, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                                    <div className="min-w-0 flex-grow">
                                                        <p className="font-bold text-slate-700 truncate">{step.name}</p>
                                                        <p className="text-[9px] text-slate-400 font-black uppercase">{step.details}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 ml-4">
                                                        <p className="font-black text-slate-900">{formatCurrency(step.cost)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="h-4"></div>
                                        </>
                                    )}
                                    {analysisResult.manufacturingSteps && analysisResult.manufacturingSteps.length > 0 && (
                                        <>
                                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 mb-2 mt-4">Etapas de Fabricação</h4>
                                            {analysisResult.manufacturingSteps.map((step, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                                    <div className="min-w-0 flex-grow">
                                                        <p className="font-bold text-indigo-900 truncate">{step.name}</p>
                                                        <p className="text-[9px] text-indigo-500 font-black uppercase">{step.details}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 ml-4">
                                                        <p className="font-black text-indigo-900">{formatCurrency(step.cost)}</p>
                                                        {step.timeSeconds ? <p className="text-[9px] text-indigo-500 font-bold">{Math.round(step.timeSeconds / 60)} min</p> : null}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="h-4"></div>
                                        </>
                                    )}
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 mb-2">Materiais a Consumir</h4>
                                    {analysisResult.requirements.map(req => {
                                        const comp = inventory.findComponentById(req.id);
                                        const hasStock = (comp?.stock || 0) >= req.quantity;
                                        return (
                                            <div key={req.id} className={`flex justify-between items-center text-[11px] p-2 rounded-lg border ${hasStock ? 'bg-slate-50 border-slate-100' : 'bg-rose-50 border-rose-100'}`}>
                                                <div className="min-w-0 flex-grow">
                                                    <p className="font-bold text-slate-700 truncate">{req.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase">Saldo: {comp?.stock || 0} {req.unit}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-4">
                                                    <p className={`font-black ${hasStock ? 'text-slate-900' : 'text-rose-600'}`}>{req.quantity.toFixed(1)} {req.unit}</p>
                                                    {!hasStock && <p className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">Falta { (req.quantity - (comp?.stock || 0)).toFixed(1) }</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Detalhes da Ordem</h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo de Fabricação</label>
                                            <Select value={orderType} onChange={e => setOrderType(e.target.value as any)} className="w-full h-8 text-xs">
                                                <option value="interna">Interna</option>
                                                <option value="externa">Externa (Terceirizada)</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Prioridade</label>
                                            <Select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full h-8 text-xs">
                                                <option value="baixa">Baixa</option>
                                                <option value="normal">Normal</option>
                                                <option value="alta">Alta</option>
                                                <option value="urgente">Urgente</option>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Lote / OP</label>
                                        <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="Ex: LOTE-001" className="w-full h-8 text-xs" />
                                    </div>

                                    {orderType === 'externa' && (
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Fornecedor / Terceiro</label>
                                            <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nome do fornecedor" className="w-full h-8 text-xs" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 text-xs" />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Previsão de Entrega</label>
                                            <Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} className="w-full h-8 text-xs" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Observações</label>
                                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruções adicionais..." className="w-full h-8 text-xs" />
                                    </div>
                                </div>

                                <Button onClick={async () => {
                                    const id = await addManufacturingOrder(order, analysisResult, {
                                        type: orderType,
                                        priority,
                                        startDate,
                                        expectedDeliveryDate,
                                        batchNumber,
                                        supplierName: orderType === 'externa' ? supplierName : undefined,
                                        notes
                                    });
                                    if(id) { 
                                        addToast(`Ordem ${id} Gerada com Sucesso`, 'success'); 
                                        setOrder([]); 
                                        setAnalysisResult(null); 
                                        setBatchNumber('');
                                        setSupplierName('');
                                        setNotes('');
                                    }
                                }} className="h-16 w-full bg-indigo-600 hover:bg-indigo-500 border-none shadow-xl text-lg font-black uppercase italic rounded-2xl mt-4 shrink-0">Gerar Ordem de Fabricação</Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Modal Dicionário de Segredos */}
            <ConfirmationModal 
                isOpen={showDictionary} onClose={() => setShowDictionary(false)} onConfirm={() => setShowDictionary(false)}
                title="Dicionário de Segredos e Códigos Geométricos" confirmText="Fechar" variant="primary"
            >
                <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                    <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        Use esta tabela para conferir o saldo de Moedas (Fêmea) e Segredos (Macho) por código de geometria.
                    </p>
                    <table className="min-w-full text-[10px] font-sans">
                        <thead className="bg-slate-100 font-black uppercase text-slate-600 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 text-left">TIPO</th>
                                <th className="px-4 py-2 text-left">CÓDIGO (ID)</th>
                                <th className="px-4 py-2 text-center">MOEDA (EST)</th>
                                <th className="px-4 py-2 text-center">SEGREDO (EST)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {codificationDictionary.map(item => (
                                <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-200 rounded text-[9px] font-black uppercase">{item.type}</span></td>
                                    <td className="px-4 py-3 font-bold text-slate-900">{item.code}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black ${item.femaleStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.femaleStock > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                            {item.femaleStock}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black ${item.maleStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.maleStock > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                            {item.maleStock}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ConfirmationModal>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface ManufacturingPlannerViewProps {
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    setCurrentView: (view: View) => void;
}
