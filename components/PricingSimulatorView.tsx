
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { InventoryHook, ManufacturingHook, ProductionOrdersHook, Kit, Component, FamiliaComponente, KitComponent } from '../types';
import { useFinancials } from '../contexts/FinancialsContext';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { GoogleGenAI } from '@google/genai';
import * as api from '../hooks/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const formatDecimal = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Indicator: React.FC<{ title: string; value: string; subvalue?: string }> = ({ title, value, subvalue }) => (
    <div className="bg-white/5 p-3 rounded-lg text-center">
        <h4 className="text-sm text-gray-300 font-medium truncate">{title}</h4>
        <p className="text-xl font-bold text-white mt-1">{value}</p>
        {subvalue && <p className="text-xs text-cyan-400">{subvalue}</p>}
    </div>
);

interface PricingSimulatorViewProps {
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
    productionOrdersHook: ProductionOrdersHook;
}

export const PricingSimulatorView: React.FC<PricingSimulatorViewProps> = ({ inventory, manufacturing, productionOrdersHook }) => {
    const { calculateSaleDetails, settings } = useFinancials();
    const { addToast } = useToast();

    const [selectedKitId, setSelectedKitId] = useState('');
    const [price, setPrice] = useState(100);
    const [baseDemand, setBaseDemand] = useState(2000);
    const [priceSensitivity, setPriceSensitivity] = useState(4);
    const [unitCost, setUnitCost] = useState(50);
    const [fixedCost, setFixedCost] = useState(50000);

    const [baseUnitCost, setBaseUnitCost] = useState(50);
    const [costVariationPercent, setCostVariationPercent] = useState(0);

    // AI State
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const { findKitById, kits, components } = inventory;
    const { familias } = manufacturing;
    const { productionOrders } = productionOrdersHook;

    const calculateKitCost = useCallback((kit: Kit): number => {
        const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));
        const preferredId = settings?.preferredFastenerFamiliaId || 'fam-fixadores';
        const fastenerFamilia = familias.find(f => f.id === preferredId);
        let totalCost = 0;
        
        kit.components.forEach((kc: KitComponent) => {
            const component: Component | undefined = componentSkuMap.get(kc.componentSku);
            if (component) {
                totalCost += getComponentCost(component) * kc.quantity;
            }
        });
        
        if (kit.requiredFasteners && fastenerFamilia) {
            kit.requiredFasteners.forEach(rf => {
                const [bitolaStr, compStr] = rf.dimension.replace('mm','').split('x');
                const result = evaluateProcess(fastenerFamilia, { bitola: Number(bitolaStr), comprimento: Number(compStr) }, components);
                totalCost += (result.custoFabricacao + result.custoMateriaPrima) * rf.quantity;
            });
        }
        
        return totalCost;
    }, [components, familias, settings]);
    
    useEffect(() => {
        setAiAnalysis(''); // Clear AI analysis when parameters change
        const kit = findKitById(selectedKitId);
        if (!kit) {
            // Reset to didactic mode if no kit is selected
            setBaseUnitCost(50);
            setUnitCost(50);
            setPrice(100);
            setBaseDemand(2000);
            setPriceSensitivity(4);
            setCostVariationPercent(0);
            return;
        }

        const kitCost = calculateKitCost(kit);
        const saleDetails = calculateSaleDetails(kitCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
        const currentPrice = saleDetails.sellingPrice;

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const salesInPeriod = productionOrders
            .filter(o => o.status === 'concluída' && new Date(o.createdAt) >= ninetyDaysAgo)
            .flatMap(o => o.orderItems)
            .filter(item => item.kitId === selectedKitId)
            .reduce((sum, item) => sum + item.quantity, 0);
        
        const monthlyDemand = Math.max(1, salesInPeriod / 3);

        let a = 2000;
        let b = 4;

        if (monthlyDemand > 0 && currentPrice > 0) {
            // Assume a standard price elasticity of -1.5 if we only have one data point.
            // E = -b * (P/Q)  =>  b = -E * (Q/P)
            const assumedElasticity = -1.5;
            b = -assumedElasticity * (monthlyDemand / currentPrice);
    
            // from Q = a - bP, solve for a: a = Q + bP
            a = monthlyDemand + b * currentPrice;
        }
        
        setBaseUnitCost(parseFloat(kitCost.toFixed(2)));
        setUnitCost(parseFloat(kitCost.toFixed(2)));
        setCostVariationPercent(0);
        setPrice(parseFloat(currentPrice.toFixed(2)));
        setBaseDemand(Math.round(a));
        setPriceSensitivity(parseFloat(b.toFixed(4)));
        
        addToast(`Dados do kit "${kit.name}" carregados.`, 'info');

    }, [selectedKitId, findKitById, productionOrders, calculateKitCost, calculateSaleDetails, addToast]);

    useEffect(() => {
        if (selectedKitId) {
            const newCost = baseUnitCost * (1 + costVariationPercent / 100);
            setUnitCost(newCost);
        }
    }, [costVariationPercent, baseUnitCost, selectedKitId]);


    const calculations = useMemo(() => {
        const p = price;
        const a = baseDemand;
        const b = priceSensitivity;
        const c = unitCost;
        const F = fixedCost;

        const quantity = Math.max(0, a - b * p);
        const revenue = p * quantity;
        const totalCost = c * quantity + F;
        const profit = revenue - totalCost;
        const unitMargin = p - c;
        const elasticity = quantity > 0 ? -b * (p / quantity) : -Infinity;
        const breakEvenQty = unitMargin > 0 ? F / unitMargin : Infinity;
        
        const quadA = -b;
        const quadB = a + (b * c);
        const quadC = -(a * c + F);
        const discriminant = quadB**2 - 4 * quadA * quadC;
        const minPriceForEquilibrium = discriminant >= 0 && quadA !== 0 ? (-quadB + Math.sqrt(discriminant)) / (2 * quadA) : Infinity;
        
        const priceForMaxRevenue = b > 0 ? a / (2 * b) : 0;
        const priceForMaxProfit = b > 0 ? (a + b * c) / (2 * b) : c;
        const maxRevenue = priceForMaxRevenue * (a - b * priceForMaxRevenue);
        const maxProfit = (priceForMaxProfit - c) * (a - b * priceForMaxProfit) - F;


        return { quantity, revenue, totalCost, profit, unitMargin, elasticity, breakEvenQty, minPriceForEquilibrium, priceForMaxRevenue, priceForMaxProfit, maxProfit, maxRevenue };
    }, [price, baseDemand, priceSensitivity, unitCost, fixedCost]);

    const chartData = useMemo(() => {
        const revenueData: ({x: number, y: number | null})[] = [];
        const profitData: ({x: number, y: number | null})[] = [];
        const totalCostData: ({x: number, y: number | null})[] = [];

        const a = baseDemand;
        const b = priceSensitivity;
        const c = unitCost;
        const F = fixedCost;

        const maxInterestingPrice = Math.max(
            price,
            isFinite(calculations.priceForMaxProfit) ? calculations.priceForMaxProfit : 0,
            isFinite(calculations.priceForMaxRevenue) ? calculations.priceForMaxRevenue : 0,
            isFinite(calculations.minPriceForEquilibrium) ? calculations.minPriceForEquilibrium : 0
        );
    
        const maxPriceX = Math.max(maxInterestingPrice * 1.75, price * 2, 200);
        const step = maxPriceX / 200;

        for (let p_chart = 0; p_chart <= maxPriceX; p_chart += step) {
            const q_chart = Math.max(0, a - b * p_chart);
            revenueData.push({x: p_chart, y: q_chart > 0 ? p_chart * q_chart : null });
            profitData.push({x: p_chart, y: q_chart > 0 ? (p_chart - c) * q_chart - F : -F });
            totalCostData.push({x: p_chart, y: q_chart > 0 ? c * q_chart + F : F });
        }

        return { revenueData, profitData, totalCostData, maxPriceX };
    }, [baseDemand, priceSensitivity, unitCost, fixedCost, price, calculations]);
    
    const chartAnnotationsPlugin = useMemo(() => ({
        id: 'chartAnnotationsPlugin',
        afterDraw: (chart: any) => {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;

            const drawPointMarker = (xVal: number, yVal: number, color: string) => {
                const xPx = x.getPixelForValue(xVal);
                const yPx = y.getPixelForValue(yVal);
                if (xPx >= left && xPx <= right && yPx >= top && yPx <= bottom) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(xPx, yPx, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.restore();
                }
            };

            const drawVerticalLine = (xVal: number, color: string, label: string) => {
                const xPx = x.getPixelForValue(xVal);
                if (xPx >= left && xPx <= right) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(xPx, top);
                    ctx.lineTo(xPx, bottom);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = color;
                    ctx.setLineDash([6, 3]);
                    ctx.stroke();
                    
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillText(label, xPx, top - 5);
                    ctx.restore();
                }
            };
            
            drawPointMarker(price, calculations.profit, '#FF6384');
            drawVerticalLine(price, '#FF6384', 'PREÇO ATUAL');

            if (isFinite(calculations.priceForMaxProfit)) {
                drawVerticalLine(calculations.priceForMaxProfit, '#4BC0C0', 'LUCRO MÁX.');
                drawPointMarker(calculations.priceForMaxProfit, calculations.maxProfit, '#4BC0C0');
            }
            if(isFinite(calculations.minPriceForEquilibrium)) {
                 drawVerticalLine(calculations.minPriceForEquilibrium, '#9966FF', 'EQUILÍBRIO');
            }
        }
    }), [price, calculations]);


    const handleGenerateAnalysis = async () => {
        setIsAiLoading(true);
        setAiAnalysis('');
        try {
            /* Fix: Obtain API key directly from environment and follow GoogleGenAI initialization guidelines. */
            if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `Você é um consultor de negócios especialista em precificação. Analise os dados fornecidos e forneça uma recomendação clara e concisa em português do Brasil.

**Formato da Resposta:**
1.  **Diagnóstico:** Comece com um diagnóstico rápido da situação atual (Ex: "Atualmente, seu preço está otimizado para receita, mas não para lucro.").
2.  **Recomendação Principal:** Forneça uma recomendação de preço clara. (Ex: "Recomendo ajustar o preço para R$ XX,XX para maximizar seu lucro.").
3.  **Justificativa:** Explique o porquê da recomendação, mencionando o impacto esperado no lucro, receita e quantidade vendida.
4.  **Observação Adicional (Opcional):** Adicione um insight extra sobre o ponto de equilíbrio ou elasticidade, se for relevante.

**REGRAS:**
- Seja direto e use linguagem de negócios.
- Use no máximo 100 palavras.
- NÃO use formatação Markdown como "**" ou "#".`;

            const context = {
                didacticMode: !selectedKitId,
                currentPrice: price,
                unitCost: unitCost,
                fixedCost: fixedCost,
                currentQuantity: calculations.quantity,
                currentProfit: calculations.profit,
                currentRevenue: calculations.revenue,
                priceForMaxProfit: calculations.priceForMaxProfit,
                maxProfit: calculations.maxProfit,
                priceForMaxRevenue: calculations.priceForMaxRevenue,
                maxRevenue: calculations.maxRevenue,
                breakEvenQuantity: calculations.breakEvenQty,
                priceElasticity: calculations.elasticity
            };

            /* Fix: Using recommended gemini-3-flash-preview model. */
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Dados para análise:\n${JSON.stringify(context, null, 2)}`,
                config: { systemInstruction },
            });
            setAiAnalysis(response.text);

        } catch (error) {
            console.error(error);
            setAiAnalysis("Erro ao gerar análise. Verifique sua chave de API.");
        } finally {
            setIsAiLoading(false);
        }
    };


    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
            {/* Controls */}
            <Card className="xl:col-span-1 bg-gray-800 text-white border-gray-700 !shadow-2xl flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-1">Simulador de Preços</h2>
                <p className="text-sm text-gray-400 mb-6">Ajuste as variáveis para encontrar o preço ideal.</p>

                <div className="space-y-5 flex-grow">
                     <Select label="Selecionar Produto (Opcional)" value={selectedKitId} onChange={e => setSelectedKitId(e.target.value)}>
                        <option value="">Modo Didático (Dados Manuais)</option>
                        {kits.sort((a,b) => a.name.localeCompare(b.name)).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                     </Select>

                    <Slider
                        label="Preço de Venda"
                        value={price}
                        displayValue={formatCurrency(price)}
                        min={0}
                        max={Math.max(200, price * 2)}
                        step={0.5}
                        onChange={e => setPrice(parseFloat(e.target.value))}
                    />
                     <Slider
                        label="Custo Variável Unitário"
                        value={selectedKitId ? costVariationPercent : unitCost}
                        displayValue={formatCurrency(unitCost)}
                        min={selectedKitId ? -50 : 0}
                        max={selectedKitId ? 50 : Math.max(100, unitCost * 2)}
                        step={selectedKitId ? 1 : 0.5}
                        onChange={e => {
                            if (selectedKitId) {
                                setCostVariationPercent(parseFloat(e.target.value));
                            } else {
                                setUnitCost(parseFloat(e.target.value));
                            }
                        }}
                    />
                    {selectedKitId && <p className="text-center text-xs text-gray-400 -mt-4">Variação de Custo: {costVariationPercent}%</p>}
                     <Slider
                        label="Demanda Base (em 'a - bP')"
                        value={baseDemand}
                        displayValue={formatNumber(baseDemand)}
                        min={0}
                        max={Math.max(5000, baseDemand * 2)}
                        step={50}
                        onChange={e => setBaseDemand(parseFloat(e.target.value))}
                        disabled={!!selectedKitId}
                    />
                    <Slider
                        label="Sensibilidade ao Preço (em 'a - bP')"
                        value={priceSensitivity}
                        displayValue={formatDecimal(priceSensitivity)}
                        min={0}
                        max={Math.max(10, priceSensitivity * 2)}
                        step={0.1}
                        onChange={e => setPriceSensitivity(parseFloat(e.target.value))}
                        disabled={!!selectedKitId}
                    />
                </div>
                
                 <div className="mt-6 pt-4 border-t border-white/10">
                    <Button onClick={handleGenerateAnalysis} disabled={isAiLoading} className="w-full">
                        {isAiLoading ? 'Analisando...' : 'Analisar com IA'}
                    </Button>
                </div>
            </Card>

            {/* Results & Chart */}
            <div className="xl:col-span-2 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Indicator title="Quantidade Estimada" value={formatNumber(calculations.quantity)} subvalue={`Margem Unit: ${formatCurrency(calculations.unitMargin)}`} />
                    <Indicator title="Receita Total" value={formatCurrency(calculations.revenue)} subvalue={`Preço Máx. Receita: ${formatCurrency(calculations.priceForMaxRevenue)}`} />
                    <Indicator title="Lucro Total" value={formatCurrency(calculations.profit)} subvalue={`Preço Máx. Lucro: ${formatCurrency(calculations.priceForMaxProfit)}`} />
                    <Indicator title="Ponto de Equilíbrio" value={`${formatNumber(calculations.breakEvenQty)} un.`} subvalue={`Preço Mín: ${formatCurrency(calculations.minPriceForEquilibrium)}`} />
                </div>
                
                <Card className="h-[450px]">
                    <Line
                        data={{
                            datasets: [
                                { type: 'line', label: 'Lucro', data: chartData.profitData, borderColor: '#4BC0C0', backgroundColor: 'rgba(75, 192, 192, 0.2)', tension: 0.1, fill: true, yAxisID: 'y' },
                                { type: 'line', label: 'Receita', data: chartData.revenueData, borderColor: '#3B82F6', tension: 0.1, yAxisID: 'y' },
                                { type: 'line', label: 'Custo Total', data: chartData.totalCostData, borderColor: '#EF4444', tension: 0.1, yAxisID: 'y' },
                            ]
                        }}
                        options={{
                            responsive: true, maintainAspectRatio: false,
                            scales: {
                                x: { type: 'linear', title: { display: true, text: 'Preço de Venda (R$)' }, min: 0, max: chartData.maxPriceX },
                                y: { title: { display: true, text: 'Valor (R$)' } }
                            },
                             plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } }
                        }}
                        plugins={[chartAnnotationsPlugin]}
                    />
                </Card>
                {aiAnalysis && (
                     <Card>
                        <h3 className="text-xl font-semibold text-black mb-2">Análise da IA</h3>
                        <div className="text-sm text-black bg-gray-50 p-4 rounded-md whitespace-pre-wrap">{aiAnalysis}</div>
                    </Card>
                )}
            </div>
        </div>
    );
};
