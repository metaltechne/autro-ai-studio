
import React, { useState, useMemo, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ManufacturingOrdersHook, PurchaseOrdersHook, Installment, ManufacturingOrder, PurchaseOrder, InventoryHook } from '../types';
import { FinancialManagementModal } from './ui/FinancialManagementModal';
import { Modal } from './ui/Modal';
import { GoogleGenAI } from '@google/genai';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import * as api from '../hooks/api';

interface PaymentCalendarViewProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    inventory: InventoryHook;
}

interface CalendarEvent {
    id: string; // unique ID for the event
    orderId: string;
    date: string; // YYYY-MM-DD
    type: 'payment' | 'delivery';
    value: number; // for payments, can be 0 for deliveries
    isOverdue: boolean;
    description: string;
    order: ManufacturingOrder | PurchaseOrder;
    status?: 'pendente' | 'pago';
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date: Date) => date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const AiSummaryModal: React.FC<{ isOpen: boolean; onClose: () => void; summary: string; isLoading: boolean; error: string; onRegenerate: () => void; }> = ({ isOpen, onClose, summary, isLoading, error, onRegenerate }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Análise Inteligente de Fluxo de Caixa">
        <div className="space-y-4">
            {isLoading ? (
                <div className="flex items-center justify-center h-40">
                    <svg className="animate-spin h-8 w-8 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            ) : error ? (
                <p className="text-red-600">{error}</p>
            ) : (
                <div className="text-sm text-black bg-gray-50 p-4 rounded-md whitespace-pre-wrap font-sans">{summary}</div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={onClose}>Fechar</Button>
                <Button onClick={onRegenerate} disabled={isLoading}>Gerar Novamente</Button>
            </div>
        </div>
    </Modal>
);

export const PaymentCalendarView: React.FC<PaymentCalendarViewProps> = ({ manufacturingOrdersHook, purchaseOrdersHook, inventory }) => {
    const { manufacturingOrders, updateManufacturingOrderInstallments } = manufacturingOrdersHook;
    const { purchaseOrders, updatePurchaseOrderInstallments } = purchaseOrdersHook;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [editingOrder, setEditingOrder] = useState<(ManufacturingOrder | PurchaseOrder) & { totalValue: number } | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'pendente' | 'pago' | 'atrasado'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    const purchaseOrderValueMap = useMemo(() => {
        const map = new Map<string, number>();
        purchaseOrders.forEach(order => {
            const totalValue = order.items.reduce((sum, item) => {
                const component = inventory.findComponentById(item.id);
                const cost = component?.purchaseCost ?? (component?.custoMateriaPrima || 0) + (component?.custoFabricacao || 0);
                return sum + (cost * item.quantity);
            }, 0);
            map.set(order.id, totalValue);
        });
        return map;
    }, [purchaseOrders, inventory]);

    const allEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events: CalendarEvent[] = [];

        manufacturingOrders.forEach(order => {
            order.installments?.forEach(inst => {
                const isOverdue = new Date(inst.dueDate) < today && inst.status === 'pendente';
                events.push({
                    id: inst.id, orderId: order.id, date: inst.dueDate, type: 'payment', value: inst.value, isOverdue,
                    description: `Pagamento Parcela #${inst.number || ''}`, order: order,
                    status: inst.status
                });
            });
        });

        purchaseOrders.forEach(order => {
            order.installments?.forEach(inst => {
                const isOverdue = new Date(inst.dueDate) < today && inst.status === 'pendente';
                events.push({
                    id: inst.id, orderId: order.id, date: inst.dueDate, type: 'payment', value: inst.value, isOverdue,
                    description: `Pagamento Parcela #${inst.number || ''}`, order: order,
                    status: inst.status
                });
            });
            if (order.status === 'pendente' && order.expectedDeliveryDate) {
                events.push({
                    id: `delivery-${order.id}`, orderId: order.id, date: order.expectedDeliveryDate, type: 'delivery',
                    value: purchaseOrderValueMap.get(order.id) || 0, isOverdue: new Date(order.expectedDeliveryDate) < today,
                    description: 'Recebimento de Compra', order: order,
                });
            }
        });

        return events;
    }, [manufacturingOrders, purchaseOrders, purchaseOrderValueMap]);

    const filteredEvents = useMemo(() => {
        return allEvents.filter(event => {
            if (event.type === 'payment') {
                if (filterStatus !== 'all') {
                    if (filterStatus === 'atrasado') { if (!event.isOverdue) return false; } 
                    else if (filterStatus !== event.status) return false;
                }
            } else { // delivery
                if (filterStatus === 'pago') return false; // Deliveries can't be 'paid'
                if (filterStatus === 'atrasado' && !event.isOverdue) return false;
                if (filterStatus === 'pendente' && event.isOverdue) return false;
            }

            if (searchTerm && !event.orderId.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            return true;
        });
    }, [allEvents, filterStatus, searchTerm]);


    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        filteredEvents.forEach(event => {
            const dateKey = event.date;
            const dayEvents = map.get(dateKey) || [];
            dayEvents.push(event);
            map.set(dateKey, dayEvents);
        });
        return map;
    }, [filteredEvents]);

    const { days, firstDayOfMonth } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const numDays = lastDay.getDate();
        const daysArray = Array.from({ length: numDays }, (_, i) => i + 1);
        return { days: daysArray, firstDayOfMonth: firstDay.getDay() };
    }, [currentDate]);

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const handleEditOrder = (order: ManufacturingOrder | PurchaseOrder) => {
        const totalValue = order.id.startsWith('PO-')
            ? purchaseOrderValueMap.get(order.id) || 0
            : (order as ManufacturingOrder).predictedCost;
        setEditingOrder({ ...order, totalValue });
    };

    const handleSaveInstallments = async (orderId: string, installments: Installment[]) => {
        if (orderId.startsWith('PO-')) {
            await updatePurchaseOrderInstallments(orderId, installments);
        } else {
            await updateManufacturingOrderInstallments(orderId, installments);
        }
    };
    
    const generateAiSummary = useCallback(async () => {
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiError('');

        try {
            /* Fix: Obtain API key directly from environment and follow GoogleGenAI initialization guidelines. */
            if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const today = new Date();
            const next30Days = new Date();
            next30Days.setDate(today.getDate() + 30);
            
            const upcomingPayments = allEvents
                .filter(e => e.type === 'payment' && e.status === 'pendente' && new Date(e.date) <= next30Days)
                .map(e => ({ orderId: e.orderId, value: e.value, dueDate: e.date, overdue: e.isOverdue }));
            
            if (upcomingPayments.length === 0) {
                setAiSummary("Não há pagamentos pendentes nos próximos 30 dias. O fluxo de caixa para este período está tranquilo.");
                setIsAiLoading(false);
                return;
            }

            const context = `**Contexto Financeiro - Próximos 30 dias:**\n${JSON.stringify(upcomingPayments, null, 2)}`;
            const systemInstruction = `Você é um analista financeiro sênior. Analise a lista de pagamentos pendentes e forneça um resumo executivo em português. Destaque os pagamentos mais urgentes (vencidos ou vencendo em breve), o valor total a ser pago no período e identifique quaisquer concentrações de pagamentos que possam exigir atenção. Seja conciso e direto.`;
            
            /* Fix: Using recommended gemini-3-flash-preview model. */
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: context,
                config: { systemInstruction },
            });
            setAiSummary(response.text);

        } catch (error) {
            console.error("AI analysis error:", error);
            setAiError("Ocorreu um erro ao gerar a análise. Verifique sua chave de API.");
        } finally {
            setIsAiLoading(false);
        }
    }, [allEvents]);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
                <h2 className="text-3xl font-bold text-black">Calendário Financeiro</h2>
                <Button onClick={generateAiSummary}>Análise Inteligente (IA)</Button>
            </div>
            <Card className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     <Select label="Filtrar Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                        <option value="all">Todos Eventos</option>
                        <option value="pendente">Pagamentos Pendentes</option>
                        <option value="pago">Pagamentos Efetuados</option>
                        <option value="atrasado">Eventos Atrasados</option>
                    </Select>
                    <div className="lg:col-span-2">
                        <Input label="Buscar por ID da Ordem" placeholder="Ex: PO-0001" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <Button variant="secondary" onClick={handlePrevMonth}>&larr;</Button>
                    <h3 className="text-xl font-bold text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                    <Button variant="secondary" onClick={handleNextMonth}>&rarr;</Button>
                </div>

                <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600 bg-gray-50">{day}</div>
                    ))}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="bg-gray-50"></div>)}
                    {days.map(day => {
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dateKey = date.toISOString().split('T')[0];
                        const dayEvents = eventsByDay.get(dateKey) || [];
                        const totalDayValue = dayEvents.filter(e=>e.type === 'payment' && e.status === 'pendente').reduce((sum, e) => sum + e.value, 0);

                        return (
                            <div key={day} className="bg-white p-2 min-h-[120px] flex flex-col" onClick={() => setSelectedDay(date)}>
                                <span className="font-semibold text-sm">{day}</span>
                                <div className="flex-grow space-y-1 mt-1 overflow-hidden">
                                    {dayEvents.map(event => (
                                        <div key={event.id} className={`p-1 rounded text-xs truncate ${event.type === 'payment' ? (event.isOverdue ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800') : 'bg-blue-200 text-blue-800'}`} title={`${event.orderId}: ${event.description}`}>
                                            {event.type === 'payment' && <span className="font-bold">{formatCurrency(event.value)}</span>} {event.orderId}
                                        </div>
                                    ))}
                                </div>
                                {totalDayValue > 0 && <div className="text-right text-xs font-bold mt-1">{formatCurrency(totalDayValue)}</div>}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {selectedDay && (
                 <Modal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} title={`Eventos para ${formatDate(selectedDay)}`}>
                    <div className="space-y-3">
                        {(eventsByDay.get(selectedDay.toISOString().split('T')[0]) || []).map(event => (
                            <div key={event.id} className={`p-3 rounded-lg border-l-4 ${event.type === 'payment' ? (event.isOverdue ? 'border-red-500' : 'border-yellow-500') : 'border-blue-500'}`}>
                                <p className="font-semibold">{event.description} - {event.orderId}</p>
                                <p className="text-sm">{event.type === 'payment' ? `Valor: ${formatCurrency(event.value)}` : `Valor da Entrega: ${formatCurrency(event.value)}`}</p>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            <FinancialManagementModal
                order={editingOrder}
                onClose={() => setEditingOrder(null)}
                onSave={handleSaveInstallments}
            />
            
            <AiSummaryModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                summary={aiSummary}
                isLoading={isAiLoading}
                error={aiError}
                onRegenerate={generateAiSummary}
            />
        </div>
    );
};
