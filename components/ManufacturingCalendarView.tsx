import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ManufacturingOrdersHook, ManufacturingOrder } from '../types';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { Input } from './ui/Input';

interface ManufacturingCalendarViewProps {
    manufacturingOrdersHook: ManufacturingOrdersHook;
}

interface CalendarEvent {
    id: string;
    orderId: string;
    date: string; // YYYY-MM-DD
    type: 'start' | 'delivery' | 'step_start' | 'step_end';
    description: string;
    order: ManufacturingOrder;
    status?: string;
    colorClass: string;
}

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const ManufacturingCalendarView: React.FC<ManufacturingCalendarViewProps> = ({ manufacturingOrdersHook }) => {
    const { manufacturingOrders } = manufacturingOrdersHook;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'interna' | 'externa'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const allEvents = useMemo(() => {
        const events: CalendarEvent[] = [];

        manufacturingOrders.forEach(order => {
            if (filterType !== 'all' && order.type !== filterType) return;
            if (searchTerm && !order.id.toLowerCase().includes(searchTerm.toLowerCase()) && !order.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase())) return;

            const isUrgente = order.priority === 'urgente';
            const isAlta = order.priority === 'alta';

            if (order.startDate) {
                events.push({
                    id: `start-${order.id}`,
                    orderId: order.id,
                    date: order.startDate,
                    type: 'start',
                    description: `Início OP: ${order.batchNumber || order.id}`,
                    order: order,
                    status: order.status,
                    colorClass: isUrgente ? 'bg-red-100 text-red-800 border-red-300' : isAlta ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                });
            }

            if (order.expectedDeliveryDate) {
                events.push({
                    id: `delivery-${order.id}`,
                    orderId: order.id,
                    date: order.expectedDeliveryDate,
                    type: 'delivery',
                    description: `Entrega OP: ${order.batchNumber || order.id}`,
                    order: order,
                    status: order.status,
                    colorClass: isUrgente ? 'bg-red-100 text-red-800 border-red-300' : isAlta ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-green-100 text-green-800 border-green-300'
                });
            }

            order.trackingSteps?.forEach(step => {
                if (step.startDate) {
                    events.push({
                        id: `step-start-${step.id}`,
                        orderId: order.id,
                        date: step.startDate,
                        type: 'step_start',
                        description: `Início Etapa: ${step.name}`,
                        order: order,
                        status: step.status,
                        colorClass: 'bg-purple-100 text-purple-800 border-purple-300'
                    });
                }
                if (step.endDate) {
                    events.push({
                        id: `step-end-${step.id}`,
                        orderId: order.id,
                        date: step.endDate,
                        type: 'step_end',
                        description: `Fim Etapa: ${step.name}`,
                        order: order,
                        status: step.status,
                        colorClass: 'bg-orange-100 text-orange-800 border-orange-300'
                    });
                }
            });
        });

        return events;
    }, [manufacturingOrders, filterType, searchTerm]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        allEvents.forEach(event => {
            const dateKey = event.date;
            const dayEvents = map.get(dateKey) || [];
            dayEvents.push(event);
            map.set(dateKey, dayEvents);
        });
        return map;
    }, [allEvents]);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center">
                <h2 className="text-2xl font-bold text-slate-800">Calendário de Produção</h2>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Select label="Tipo de Fabricação" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                        <option value="all">Todas</option>
                        <option value="interna">Interna</option>
                        <option value="externa">Externa</option>
                    </Select>
                    <div className="md:col-span-2">
                        <Input label="Buscar OP ou Lote" placeholder="Ex: OP-001" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <Button variant="secondary" onClick={handlePrevMonth}>&larr; Anterior</Button>
                    <h3 className="text-xl font-bold text-slate-800 capitalize">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                    <Button variant="secondary" onClick={handleNextMonth}>Próximo &rarr;</Button>
                </div>

                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-slate-600 bg-slate-50 uppercase tracking-wider">{day}</div>
                    ))}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-50 min-h-[120px]"></div>)}
                    {days.map(day => {
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        // Adjust for local timezone to avoid off-by-one errors when formatting to YYYY-MM-DD
                        const offset = date.getTimezoneOffset() * 60000;
                        const localDate = new Date(date.getTime() - offset);
                        const dateKey = localDate.toISOString().split('T')[0];
                        const dayEvents = eventsByDay.get(dateKey) || [];

                        return (
                            <div 
                                key={day} 
                                className="bg-white p-2 min-h-[120px] flex flex-col hover:bg-slate-50 transition-colors cursor-pointer border-t border-l border-slate-100" 
                                onClick={() => setSelectedDay(localDate)}
                            >
                                <span className={`font-semibold text-sm w-6 h-6 flex items-center justify-center rounded-full ${dayEvents.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>
                                    {day}
                                </span>
                                <div className="flex-grow space-y-1 mt-2 overflow-y-auto max-h-[100px] scrollbar-thin">
                                    {dayEvents.map(event => (
                                        <div 
                                            key={event.id} 
                                            className={`px-2 py-1 rounded text-[10px] font-medium truncate border ${event.colorClass}`} 
                                            title={event.description}
                                        >
                                            {event.description}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {selectedDay && (
                 <Modal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} title={`Eventos para ${selectedDay.toLocaleDateString('pt-BR')}`}>
                    <div className="space-y-3">
                        {(() => {
                            const offset = selectedDay.getTimezoneOffset() * 60000;
                            const localDate = new Date(selectedDay.getTime() - offset);
                            const dateKey = localDate.toISOString().split('T')[0];
                            const dayEvents = eventsByDay.get(dateKey) || [];
                            
                            if (dayEvents.length === 0) {
                                return <p className="text-slate-500 italic">Nenhum evento para este dia.</p>;
                            }

                            return dayEvents.map(event => (
                                <div key={event.id} className={`p-3 rounded-lg border-l-4 bg-slate-50 ${event.colorClass.split(' ')[2]}`}>
                                    <p className="font-bold text-slate-800 text-sm">{event.description}</p>
                                    <p className="text-xs text-slate-500 mt-1">OP: {event.orderId} | Status: <span className="capitalize">{event.status || 'N/A'}</span></p>
                                </div>
                            ));
                        })()}
                    </div>
                </Modal>
            )}
        </div>
    );
};
