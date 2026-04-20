import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DashboardWidget, KpiWidgetConfig, ChartWidgetConfig, KpiMetric, ChartDimension, ChartMetric } from '../types';

interface WidgetConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: KpiWidgetConfig | ChartWidgetConfig) => void;
    widget: DashboardWidget;
}

const kpiMetricOptions: { value: KpiMetric; label: string }[] = [
    { value: 'inventoryValue', label: 'Valor Total do Inventário' },
    { value: 'pendingProduction', label: 'Ordens de Produção Pendentes' },
    { value: 'pendingManufacturing', label: 'Ordens de Fabricação Pendentes' },
    { value: 'pendingPurchase', label: 'Ordens de Compra Pendentes' },
];

const chartDimensionOptions: { value: ChartDimension; label: string }[] = [
    { value: 'kitBrand', label: 'Marca do Kit' },
    { value: 'poStatus', label: 'Status da Ordem de Produção' },
    { value: 'monthYear', label: 'Mês/Ano (Ordens Concluídas)' },
];

const chartMetricOptions: { value: ChartMetric; label: string }[] = [
    { value: 'kitCount', label: 'Contagem de Kits' },
    { value: 'kitCost', label: 'Valor Total de Custo (Kits)' },
    { value: 'kitSaleValue', label: 'Valor Total de Venda (Kits)' },
    { value: 'poCount', label: 'Contagem de Ordens de Produção' },
];

export const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({ isOpen, onClose, onSave, widget }) => {
    const [config, setConfig] = useState(widget);

    useEffect(() => {
        setConfig(widget);
    }, [widget]);

    const handleSave = () => {
        if (config.type === 'kpi' || config.type === 'bar' || config.type === 'line' || config.type === 'pie') {
            onSave(config as KpiWidgetConfig | ChartWidgetConfig);
        }
    };
    
    const handleTypeChange = (newType: 'kpi' | 'bar' | 'line' | 'pie') => {
        if (newType === 'kpi') {
            setConfig(prev => ({ ...prev, type: newType, metric: 'inventoryValue' } as KpiWidgetConfig));
        } else {
            setConfig(prev => ({ ...prev, type: newType, dimension: 'kitBrand', metric: 'kitSaleValue' } as ChartWidgetConfig));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar Widget">
            <div className="space-y-4">
                <Input
                    label="Título do Widget"
                    value={config.title}
                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                />

                <Select label="Tipo de Widget" value={config.type} onChange={e => handleTypeChange(e.target.value as any)}>
                    <option value="kpi">Indicador (KPI)</option>
                    <option value="bar">Gráfico de Barras</option>
                    <option value="line">Gráfico de Linhas</option>
                    <option value="pie">Gráfico de Pizza</option>
                </Select>

                {config.type === 'kpi' && (
                    <Select
                        label="Métrica do KPI"
                        value={config.metric}
                        onChange={e => setConfig(prev => {
                            if (prev.type === 'kpi') {
                                return { ...prev, metric: e.target.value as KpiMetric };
                            }
                            return prev;
                        })}
                    >
                        {kpiMetricOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                )}

                {(config.type === 'bar' || config.type === 'line' || config.type === 'pie') && (
                    <>
                        <Select
                            label="Dimensão (Agrupar por)"
                            value={config.dimension}
                            onChange={e => setConfig(prev => {
                                if (prev.type === 'bar' || prev.type === 'line' || prev.type === 'pie') {
                                    return { ...prev, dimension: e.target.value as ChartDimension };
                                }
                                return prev;
                            })}
                        >
                            {chartDimensionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                        <Select
                            label="Métrica (O que medir)"
                            value={config.metric}
                            onChange={e => setConfig(prev => {
                                if (prev.type === 'bar' || prev.type === 'line' || prev.type === 'pie') {
                                    return { ...prev, metric: e.target.value as ChartMetric };
                                }
                                return prev;
                            })}
                        >
                             {chartMetricOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                    </>
                )}
            </div>
             <div className="flex justify-end pt-6 mt-4 border-t gap-2">
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar Configuração</Button>
            </div>
        </Modal>
    );
};