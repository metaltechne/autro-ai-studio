import React, { useState, useRef } from 'react';
import { ManufacturingOrder, ManufacturingTrackingStep, InventoryHook } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, Trash2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { savePdfResiliently } from '../src/utils/pdfDownloadHelper';

interface ManufacturingOrderTrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: ManufacturingOrder;
    inventory: InventoryHook;
    onSave: (orderId: string, updates: Partial<ManufacturingOrder>) => Promise<void>;
    onUpdateItemStatus?: (orderId: string, componentId: string, status: any) => Promise<void>;
}

export const ManufacturingOrderTrackingModal: React.FC<ManufacturingOrderTrackingModalProps> = ({ isOpen, onClose, order, inventory, onSave, onUpdateItemStatus }) => {
    const { addToast } = useToast();
    const { canViewCosts } = usePermissions();
    const [steps, setSteps] = useState<ManufacturingTrackingStep[]>(order.trackingSteps || []);
    const [orderItems, setOrderItems] = useState(order.orderItems || []);
    const [actualCost, setActualCost] = useState<number | ''>(order.actualCost ?? '');
    const [orderType, setOrderType] = useState<'interna' | 'externa'>(order.type || 'interna');
    const [batchNumber, setBatchNumber] = useState(order.batchNumber || '');
    const [supplierName, setSupplierName] = useState(order.supplierName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isPrinting, setIsPrinting] = useState<string | null>(null);
    const stepRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleStepChange = (stepId: string, field: keyof ManufacturingTrackingStep, value: any) => {
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, [field]: value } : s));
    };

    const handleAddInput = (stepId: string) => {
        setSteps(prev => prev.map(s => {
            if (s.id === stepId) {
                const inputs = s.generatedInputs || [];
                return { ...s, generatedInputs: [...inputs, { id: Date.now().toString(), name: '', quantity: 1 }] };
            }
            return s;
        }));
    };

    const handleUpdateInput = (stepId: string, inputId: string, field: 'name' | 'quantity', value: any) => {
        setSteps(prev => prev.map(s => {
            if (s.id === stepId && s.generatedInputs) {
                return {
                    ...s,
                    generatedInputs: s.generatedInputs.map(input => input.id === inputId ? { ...input, [field]: value } : input)
                };
            }
            return s;
        }));
    };

    const handleRemoveInput = (stepId: string, inputId: string) => {
        setSteps(prev => prev.map(s => {
            if (s.id === stepId && s.generatedInputs) {
                return {
                    ...s,
                    generatedInputs: s.generatedInputs.filter(input => input.id !== inputId)
                };
            }
            return s;
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(order.id, { 
                trackingSteps: steps, 
                orderItems,
                actualCost: actualCost !== '' ? Number(actualCost) : undefined,
                type: orderType,
                batchNumber,
                supplierName: orderType === 'externa' ? supplierName : undefined
            });
            addToast('Acompanhamento salvo com sucesso!', 'success');
            onClose();
        } catch (error) {
            addToast('Erro ao salvar acompanhamento.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateItemStatus = async (componentId: string, status: any) => {
        if (onUpdateItemStatus) {
            await onUpdateItemStatus(order.id, componentId, status);
            setOrderItems(prev => prev.map(item => item.componentId === componentId ? { ...item, status } : item));
        } else {
            setOrderItems(prev => prev.map(item => item.componentId === componentId ? { ...item, status } : item));
        }
        addToast(`Status do item atualizado para ${status.replace('_', ' ')}`, 'success');
    };

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined) return 'R$ 0,00';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handlePrintStep = async (step: ManufacturingTrackingStep, index: number) => {
        const stepElement = stepRefs.current[step.id];
        if (!stepElement) return;

        setIsPrinting(step.id);
        try {
            // Create a temporary container for printing to ensure good formatting
            const printContainer = document.createElement('div');
            printContainer.style.position = 'absolute';
            printContainer.style.left = '-9999px';
            printContainer.style.top = '0';
            printContainer.style.width = '800px'; // Fixed width for A4
            printContainer.style.backgroundColor = 'white';
            printContainer.style.padding = '40px';
            printContainer.style.fontFamily = 'sans-serif';
            
            // Build the HTML content for the PDF
            printContainer.innerHTML = `
                <div style="border: 2px solid #1e293b; padding: 20px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                        <div>
                            <h1 style="margin: 0; font-size: 24px; color: #0f172a;">FICHA DE ACOMPANHAMENTO DE PRODUÇÃO</h1>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Ordem de Produção: <strong>${order.id.substring(0, 8)}</strong></p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Lote/OP: <strong>${order.batchNumber || '-'}</strong></p>
                        </div>
                    </div>

                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #334155;">Detalhes do Produto</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <p style="margin: 0; font-size: 14px;"><strong>Produto:</strong> ${order.orderItems?.map(i => i.name || i.componentId).join(', ') || 'N/A'}</p>
                            <p style="margin: 0; font-size: 14px;"><strong>Prioridade:</strong> ${order.priority?.toUpperCase() || 'NORMAL'}</p>
                            <p style="margin: 0; font-size: 14px;"><strong>Data Previsão:</strong> ${order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR') : '-'}</p>
                        </div>
                    </div>

                    <div style="border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                            Etapa ${index + 1}: ${step.name}
                        </h2>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Atribuído para (Operador/Máquina)</p>
                                <p style="margin: 0; font-size: 16px; font-weight: bold;">${step.assignedTo || '___________________________'}</p>
                            </div>
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Status Atual</p>
                                <p style="margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase;">${step.status.replace('_', ' ')}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; text-align: center;">
                                <p style="margin: 0 0 5px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Qtd. Prevista</p>
                                <p style="margin: 0; font-size: 18px; font-weight: bold;">${step.quantity || '-'}</p>
                            </div>
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; text-align: center;">
                                <p style="margin: 0 0 5px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Qtd. Produzida</p>
                                <p style="margin: 0; font-size: 18px; font-weight: bold;">${step.producedQuantity || '_____'}</p>
                            </div>
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; text-align: center;">
                                <p style="margin: 0 0 5px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Tempo Prev (min)</p>
                                <p style="margin: 0; font-size: 18px; font-weight: bold;">${step.predictedTimeSeconds ? Math.round(step.predictedTimeSeconds / 60) : '-'}</p>
                            </div>
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; text-align: center;">
                                <p style="margin: 0 0 5px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Tempo Real (min)</p>
                                <p style="margin: 0; font-size: 18px; font-weight: bold;">${step.actualTimeSeconds ? Math.round(step.actualTimeSeconds / 60) : '_____'}</p>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Data Início</p>
                                <p style="margin: 0; font-size: 16px; font-weight: bold;">${step.startDate ? new Date(step.startDate).toLocaleDateString('pt-BR') : '____/____/______'}</p>
                            </div>
                            <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px;">
                                <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Data Fim</p>
                                <p style="margin: 0; font-size: 16px; font-weight: bold;">${step.endDate ? new Date(step.endDate).toLocaleDateString('pt-BR') : '____/____/______'}</p>
                            </div>
                        </div>

                        <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 4px; min-height: 100px;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Observações / Problemas (Andon)</p>
                            <p style="margin: 0; font-size: 14px;">${step.blockedReason || ''}</p>
                            ${!step.blockedReason ? '<div style="border-bottom: 1px dotted #cbd5e1; margin-top: 20px;"></div><div style="border-bottom: 1px dotted #cbd5e1; margin-top: 20px;"></div>' : ''}
                        </div>
                    </div>
                    
                    <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                        <div style="width: 45%; text-align: center;">
                            <div style="border-top: 1px solid #000; padding-top: 5px;">
                                <p style="margin: 0; font-size: 12px; font-weight: bold;">Assinatura do Operador</p>
                            </div>
                        </div>
                        <div style="width: 45%; text-align: center;">
                            <div style="border-top: 1px solid #000; padding-top: 5px;">
                                <p style="margin: 0; font-size: 12px; font-weight: bold;">Visto do Supervisor</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(printContainer);

            const canvas = await html2canvas(printContainer, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const elements = clonedDoc.getElementsByTagName('*');
                    for (let i = 0; i < elements.length; i++) {
                        const el = elements[i] as HTMLElement;
                        const styles = window.getComputedStyle(el);
                        const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
                        colorProps.forEach(prop => {
                            const value = styles.getPropertyValue(prop);
                            if (value && value.includes('oklch')) {
                                el.style.setProperty(prop, prop === 'color' ? '#0f172a' : (prop === 'backgroundColor' ? '#ffffff' : '#e2e8f0'), 'important');
                            }
                        });
                    }
                }
            });

            document.body.removeChild(printContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            savePdfResiliently(pdf, `OP_${order.id.substring(0, 8)}_Etapa_${index + 1}_${step.name.replace(/\s+/g, '_')}.pdf`);
            
            addToast('PDF gerado com sucesso!', 'success');
        } catch (error) {
            console.error('Error generating PDF:', error);
            addToast('Erro ao gerar PDF da etapa.', 'error');
        } finally {
            setIsPrinting(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Acompanhamento: ${order.id}`} size="xl">
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase mb-1">Tipo</p>
                        <Select value={orderType} onChange={e => setOrderType(e.target.value as any)} className="w-full h-8 text-xs font-bold">
                            <option value="interna">Interna</option>
                            <option value="externa">Externa</option>
                        </Select>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase mb-1">Lote/OP</p>
                        <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="w-full h-8 text-xs font-bold" />
                    </div>
                    {orderType === 'externa' && (
                        <div className="col-span-2 md:col-span-2">
                            <p className="text-xs font-black text-slate-500 uppercase mb-1">Fornecedor</p>
                            <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nome do fornecedor" className="w-full h-8 text-xs font-bold" />
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase">Início</p>
                        <p className="font-bold text-slate-900">{order.startDate ? new Date(order.startDate).toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase">Previsão</p>
                        <p className="font-bold text-slate-900">{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase">Prioridade</p>
                        <p className={`font-bold capitalize ${
                            order.priority === 'urgente' ? 'text-red-600' :
                            order.priority === 'alta' ? 'text-orange-500' :
                            order.priority === 'baixa' ? 'text-blue-500' :
                            'text-slate-900'
                        }`}>{order.priority || 'normal'}</p>
                    </div>
                    {canViewCosts && (
                        <div>
                            <p className="text-xs font-black text-slate-500 uppercase mb-1">Custo Cobrado (R$)</p>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={actualCost} 
                                onChange={e => setActualCost(e.target.value ? Number(e.target.value) : '')} 
                                placeholder="0.00" 
                                className="w-full h-8 text-xs font-bold" 
                            />
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Itens em Fabricação</h3>
                    <div className="space-y-3 mb-8">
                        {orderItems.map(item => {
                            const component = inventory.findComponentById(item.componentId) || inventory.findComponentBySku(item.componentId);
                            const status = item.status || 'pendente';
                            
                            return (
                                <div key={item.componentId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${
                                            status === 'pendente' ? 'bg-slate-300' :
                                            status === 'em_producao' ? 'bg-blue-500 animate-pulse' :
                                            status === 'aguardando_inspecao' ? 'bg-amber-500' :
                                            'bg-green-500'
                                        }`} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{item.quantity}x {component?.name || item.name || item.componentId}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Status: {status.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {status === 'pendente' && (
                                            <Button size="sm" className="h-8 text-xs px-3" onClick={() => handleUpdateItemStatus(item.componentId, 'em_producao')}>
                                                Iniciar Produção
                                            </Button>
                                        )}
                                        {status === 'em_producao' && (
                                            <Button size="sm" className="h-8 text-xs px-3 bg-amber-600 hover:bg-amber-500" onClick={() => handleUpdateItemStatus(item.componentId, 'aguardando_inspecao')}>
                                                Finalizar Produção
                                            </Button>
                                        )}
                                        {status === 'aguardando_inspecao' && (
                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase">
                                                Aguardando Inspeção
                                            </span>
                                        )}
                                        {status === 'concluido' && (
                                            <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100 uppercase">
                                                Concluído
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Etapas do Processo</h3>
                    {steps.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">Nenhuma etapa definida para esta ordem.</p>
                    ) : (
                        <div className="space-y-4">
                            {steps.map((step, index) => (
                                <div 
                                    key={step.id} 
                                    className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm"
                                    ref={el => { stepRefs.current[step.id] = el; }}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-bold text-slate-800">{index + 1}. {step.name}</h4>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => handlePrintStep(step, index)}
                                                disabled={isPrinting === step.id}
                                                className="h-7 text-xs px-2 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                title="Imprimir Ficha da Etapa"
                                            >
                                                <Printer className="w-3 h-3" />
                                                {isPrinting === step.id ? 'Gerando...' : 'Imprimir Ficha'}
                                            </Button>
                                        </div>
                                        <Select 
                                            value={step.status} 
                                            onChange={e => handleStepChange(step.id, 'status', e.target.value)}
                                            className="w-40 h-10 py-1 sm:py-1 text-sm"
                                        >
                                            <option value="pendente">Pendente</option>
                                            <option value="em_andamento">Em Andamento</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="bloqueado">Bloqueado</option>
                                        </Select>
                                    </div>
                                    {step.status === 'bloqueado' && (
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold text-red-500 uppercase mb-1">Motivo do Bloqueio (Andon)</label>
                                            <Input 
                                                value={step.blockedReason || ''} 
                                                onChange={e => handleStepChange(step.id, 'blockedReason', e.target.value)}
                                                className="w-full h-10 py-1 sm:py-1 text-sm border-red-300 focus:border-red-500 focus:ring-red-500"
                                                placeholder="Descreva o motivo do bloqueio (ex: Falta de material, Quebra de máquina)"
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Prevista</label>
                                            <Input 
                                                type="number" 
                                                value={step.quantity || ''} 
                                                onChange={e => handleStepChange(step.id, 'quantity', Number(e.target.value))}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Produzida</label>
                                            <Input 
                                                type="number" 
                                                value={step.producedQuantity || ''} 
                                                onChange={e => handleStepChange(step.id, 'producedQuantity', Number(e.target.value))}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        {canViewCosts && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Previsto</label>
                                                    <p className="text-sm font-medium text-slate-700 h-10 py-1 sm:py-1 flex items-center">{formatCurrency(step.predictedCost)}</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Real</label>
                                                    <Input 
                                                        type="number" 
                                                        value={step.actualCost || ''} 
                                                        onChange={e => handleStepChange(step.id, 'actualCost', Number(e.target.value))}
                                                        className="w-full h-10 py-1 sm:py-1 text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tempo Prev (min)</label>
                                            <p className="text-sm font-medium text-slate-700 h-10 py-1 sm:py-1 flex items-center">{step.predictedTimeSeconds ? Math.round(step.predictedTimeSeconds / 60) : 0}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tempo Real (min)</label>
                                            <Input 
                                                type="number" 
                                                value={step.actualTimeSeconds ? Math.round(step.actualTimeSeconds / 60) : ''} 
                                                onChange={e => handleStepChange(step.id, 'actualTimeSeconds', Number(e.target.value) * 60)}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                                            <Input 
                                                type="date" 
                                                value={step.startDate || ''} 
                                                onChange={e => handleStepChange(step.id, 'startDate', e.target.value)}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                                            <Input 
                                                type="date" 
                                                value={step.endDate || ''} 
                                                onChange={e => handleStepChange(step.id, 'endDate', e.target.value)}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-4">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Atribuído para (Operador/Máquina)</label>
                                            <Input 
                                                list="machines-list"
                                                value={step.assignedTo || ''} 
                                                onChange={e => handleStepChange(step.id, 'assignedTo', e.target.value)}
                                                className="w-full h-10 py-1 sm:py-1 text-sm"
                                                placeholder="Ex: Torno CNC 1, João..."
                                            />
                                            <datalist id="machines-list">
                                                <option value="Torno CNC 1" />
                                                <option value="Torno CNC 2" />
                                                <option value="Fresa CNC 1" />
                                                <option value="Corte a Laser 1" />
                                                <option value="Dobradeira 1" />
                                                <option value="Solda MIG 1" />
                                                <option value="Solda TIG 1" />
                                                <option value="Bancada de Montagem 1" />
                                                <option value="Bancada de Montagem 2" />
                                                <option value="Estufa de Pintura" />
                                                <option value="Embalagem" />
                                                <option value="Controle de Qualidade" />
                                            </datalist>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase">Insumos/Peças Geradas</label>
                                            <Button variant="secondary" size="sm" onClick={() => handleAddInput(step.id)} className="h-7 text-xs px-3">
                                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                        {step.generatedInputs && step.generatedInputs.length > 0 ? (
                                            <div className="space-y-2">
                                                {step.generatedInputs.map(input => (
                                                    <div key={input.id} className="flex gap-2 items-center">
                                                        <Input 
                                                            value={input.name} 
                                                            onChange={e => handleUpdateInput(step.id, input.id, 'name', e.target.value)}
                                                            placeholder="Nome da peça/insumo"
                                                            className="flex-grow h-10 py-1 sm:py-1 text-sm"
                                                        />
                                                        <Input 
                                                            type="number" 
                                                            value={input.quantity} 
                                                            onChange={e => handleUpdateInput(step.id, input.id, 'quantity', Number(e.target.value))}
                                                            className="w-24 h-10 py-1 sm:py-1 text-sm"
                                                            min="1"
                                                        />
                                                        <button 
                                                            onClick={() => handleRemoveInput(step.id, input.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                            title="Remover"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">Nenhum insumo gerado registrado nesta etapa.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                        {isSaving ? 'Salvando...' : 'Salvar Acompanhamento'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
