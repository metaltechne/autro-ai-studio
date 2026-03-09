import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useToast } from '../hooks/useToast';
import { PurchasePlannerHook, InventoryHook, PurchaseRecommendation, ProductionRecommendation, RawMaterialForecastItem } from '../types';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { getComponentCost } from '../hooks/manufacturing-evaluator';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface PurchaseProductionPlanningViewProps {
    plannerHook: PurchasePlannerHook;
    inventory: InventoryHook;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: number, decimals = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// --- UI Components ---

const KPICard: React.FC<{ title: string; value: string; subtitle: string; icon: React.ReactNode; color: string }> = ({ title, value, subtitle, icon, color }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex items-start justify-between transition-all hover:shadow-md">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            <p className={`text-xs mt-2 font-medium ${color}`}>{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')}`}>
            {icon}
        </div>
    </div>
);

const ABCBadge: React.FC<{ classification: 'A' | 'B' | 'C' }> = ({ classification }) => {
    const styles = {
        A: 'bg-red-100 text-red-800 border-red-200',
        B: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        C: 'bg-green-100 text-green-800 border-green-200',
    };
    return (
        <span className={`px-2.5 py-0.5 text-xs font-bold rounded border ${styles[classification]}`} title={`Curva ABC: Classe ${classification}`}>
            Classe {classification}
        </span>
    );
};

const EmptySection: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="font-medium text-gray-600">{message}</p>
    </div>
);

// --- Icons ---
const FactoryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const ShoppingCartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const ScissorsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7.071-7.071L19 5m-7.071 7.071L5 19m7.071-7.071L5 5" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /></svg>;
const RawMaterialIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;

export const PurchaseProductionPlanningView: React.FC<PurchaseProductionPlanningViewProps> = ({ plannerHook, inventory }) => {
    const { addToast } = useToast();
    const { 
        isLoading, 
        cuttingRecommendations, 
        productionPlan, 
        purchasePlan, 
        rawMaterialForecast,
        generateCuttingOrders, 
        generateManufacturingOrders, 
        generatePurchaseOrders 
    } = plannerHook;
    
    const [selectedCuts, setSelectedCuts] = useState<Set<string>>(new Set());
    const [selectedProductions, setSelectedProductions] = useState<Set<string>>(new Set());
    const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
    const [processFilter, setProcessFilter] = useState<string>('all');

    // --- Derived Data & KPIs ---
    
    // Filter Production Plan by Process
    const filteredProductionPlan = useMemo(() => {
        if (processFilter === 'all') return productionPlan;
        return productionPlan.filter(item => {
            const comp = inventory.findComponentById(item.componentId);
            return comp?.familiaId === processFilter;
        });
    }, [productionPlan, processFilter, inventory]);

    // Financial Totals
    const kpiData = useMemo(() => {
        let productionCost = 0;
        let purchaseCost = 0;
        let cuttingSavings = 0;

        filteredProductionPlan.forEach(p => {
            const comp = inventory.findComponentById(p.componentId);
            if (comp) productionCost += getComponentCost(comp) * p.toProduce;
        });

        purchasePlan.forEach(p => {
            const comp = inventory.findComponentById(p.componentId);
            if (comp) purchaseCost += (comp.purchaseCost || 0) * p.toOrder;
        });

        cuttingRecommendations.forEach(c => {
            cuttingSavings += c.costSaving;
        });

        return { productionCost, purchaseCost, cuttingSavings };
    }, [filteredProductionPlan, purchasePlan, cuttingRecommendations, inventory]);

    // Chart Data: Production by Family
    const productionByFamilyChart = useMemo(() => {
        const familyCounts: Record<string, number> = {};
        productionPlan.forEach(p => {
            const comp = inventory.findComponentById(p.componentId);
            const familyName = comp?.familiaId ? (inventory.kits.find(k => false) || {name: comp.familiaId}).name : 'Outros'; 
            const familyId = comp?.familiaId || 'Indefinido';
            familyCounts[familyId] = (familyCounts[familyId] || 0) + 1;
        });

        return {
            labels: Object.keys(familyCounts),
            datasets: [{
                data: Object.values(familyCounts),
                backgroundColor: ['#002B8A', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
                borderWidth: 0,
            }]
        };
    }, [productionPlan, inventory]);

    const toggleSelection = (type: 'cut' | 'prod' | 'purch', id: string, selectAll = false, data: any[] = []) => {
        const updaters = {
            cut: setSelectedCuts,
            prod: setSelectedProductions,
            purch: setSelectedPurchases
        };
        const idField = type === 'cut' ? 'targetComponentId' : 'componentId';
        
        updaters[type](prev => {
            if (selectAll) {
                return prev.size === data.length ? new Set() : new Set(data.map(item => item[idField]));
            }
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const handleGenerateOrders = async (type: 'cut' | 'prod' | 'purch') => {
        try {
            if(type === 'cut') {
                const toGenerate = cuttingRecommendations.filter(rec => selectedCuts.has(rec.targetComponentId));
                if (toGenerate.length === 0) return;
                await generateCuttingOrders(toGenerate);
                setSelectedCuts(new Set());
            } else if(type === 'prod') {
                const toGenerate = filteredProductionPlan.filter(rec => selectedProductions.has(rec.componentId));
                 if (toGenerate.length === 0) return;
                await generateManufacturingOrders(toGenerate);
                setSelectedProductions(new Set());
            } else { // purch
                const toGenerate = purchasePlan.filter(rec => selectedPurchases.has(rec.componentId));
                if (toGenerate.length === 0) return;
                await generatePurchaseOrders(toGenerate);
                setSelectedPurchases(new Set());
            }
        } catch (e) {
            console.error(e);
            addToast("Erro ao gerar ordens.", "error");
        }
    }

    // Extract unique families from production plan for the filter
    const uniqueFamilies = useMemo(() => {
        const ids = new Set(productionPlan.map(p => inventory.findComponentById(p.componentId)?.familiaId).filter(Boolean));
        return Array.from(ids);
    }, [productionPlan, inventory]);

    if(isLoading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
            <svg className="animate-spin h-12 w-12 text-autro-blue mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-xl font-semibold text-gray-700">Otimizando Plano de Produção...</h2>
            <p className="text-gray-500">Nossa IA está analisando estoques, kits e demandas.</p>
        </div>
    );

    const allEmpty = cuttingRecommendations.length === 0 && productionPlan.length === 0 && purchasePlan.length === 0;

    return (
        <div className="space-y-8 pb-10">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Dashboard de PCP</h2>
                    <p className="text-gray-500 mt-1">Planejamento e Controle de Produção Inteligente</p>
                </div>
                <div className="text-right text-sm text-gray-400">
                    Última análise: {new Date().toLocaleTimeString()}
                </div>
            </header>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard 
                    title="Necessidade de Compras" 
                    value={formatCurrency(kpiData.purchaseCost)} 
                    subtitle={`${purchasePlan.length} itens a repor`}
                    icon={<ShoppingCartIcon />}
                    color="text-blue-600"
                />
                <KPICard 
                    title="Custo Estimado de Produção" 
                    value={formatCurrency(kpiData.productionCost)} 
                    subtitle={`${filteredProductionPlan.length} ordens sugeridas`}
                    icon={<FactoryIcon />}
                    color="text-indigo-600"
                />
                 <KPICard 
                    title="Economia com Cortes" 
                    value={formatCurrency(kpiData.cuttingSavings)} 
                    subtitle={`${cuttingRecommendations.length} aproveitamentos`}
                    icon={<ScissorsIcon />}
                    color="text-orange-600"
                />
            </div>
            
            {allEmpty ? (
                 <Card>
                    <EmptySection message="Tudo em ordem! O estoque atual é suficiente para atender a todas as demandas pendentes." />
                 </Card>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* Left Column: Visuals */}
                    <div className="xl:col-span-3 space-y-6">
                        <Card className="h-full flex flex-col justify-center items-center p-6">
                            <h4 className="font-semibold text-gray-700 mb-4 w-full text-left">Mix de Produção</h4>
                            <div className="w-full aspect-square max-w-[200px]">
                                <Doughnut 
                                    data={productionByFamilyChart} 
                                    options={{ 
                                        responsive: true, 
                                        cutout: '70%', 
                                        plugins: { legend: { display: false } } 
                                    }} 
                                />
                            </div>
                            <div className="mt-6 w-full space-y-2">
                                {productionByFamilyChart.labels?.slice(0,4).map((label, i) => (
                                    <div key={i} className="flex justify-between text-xs text-gray-600">
                                        <span className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{backgroundColor: productionByFamilyChart.datasets[0].backgroundColor[i] as string}}></span>
                                            Processo {String(label).replace('fam-', '')}
                                        </span>
                                        <span className="font-bold">{productionByFamilyChart.datasets[0].data[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Tables */}
                    <div className="xl:col-span-9 space-y-8">
                        
                        {/* 0. Raw Material Forecast */}
                        {rawMaterialForecast.length > 0 && (
                            <Card className="border-l-4 border-l-teal-500">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <RawMaterialIcon /> Previsão de Insumos (Matéria-Prima)
                                    </h3>
                                    <p className="text-sm text-gray-500">Estimativa de consumo para realizar todo o plano de fabricação acima.</p>
                                </div>
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 sticky top-0 shadow-sm"><tr>
                                            <th className="px-4 py-3 text-left">Matéria-Prima</th>
                                            <th className="px-4 py-3 text-right">Nec. Produção</th>
                                            <th className="px-4 py-3 text-right">Estoque Atual</th>
                                            <th className="px-4 py-3 text-right">Sugestão Compra</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {rawMaterialForecast.map(item => (
                                                <tr key={item.materialId} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-medium text-gray-800">{item.name} <span className="text-xs text-gray-400">({item.sku})</span></td>
                                                    <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.requiredForPlan)} {item.unit}</td>
                                                    <td className="px-4 py-2 text-right text-gray-600">{formatNumber(item.currentStock)} {item.unit}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${item.netToBuy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {item.netToBuy > 0 ? (
                                                            <>
                                                                {formatNumber(item.netToBuy)} {item.unit}
                                                                {item.purchaseUnit !== item.unit && <span className="text-xs text-gray-500 block font-normal">(aprox. {Math.ceil(item.netToBuy / (inventory.findComponentById(item.materialId)?.purchaseQuantity || 1))} {item.purchaseUnit})</span>}
                                                            </>
                                                        ) : (
                                                            <span className="flex items-center justify-end gap-1">✓ OK</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* 1. Cutting */}
                        {cuttingRecommendations.length > 0 && (
                            <Card className="border-l-4 border-l-orange-500">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <ScissorsIcon /> Oportunidades de Corte
                                        </h3>
                                        <p className="text-sm text-gray-500">Prioridade Alta: Economize material cortando itens parados.</p>
                                    </div>
                                    <Button onClick={() => handleGenerateOrders('cut')} disabled={selectedCuts.size === 0} className="bg-orange-600 hover:bg-orange-700 text-white">
                                        Gerar {selectedCuts.size} Ordens de Corte
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500"><tr>
                                            <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded text-orange-600 focus:ring-orange-500" onChange={() => toggleSelection('cut', '', true, cuttingRecommendations)} checked={selectedCuts.size === cuttingRecommendations.length} /></th>
                                            <th className="px-4 py-3 text-left">Transformar (Origem)</th>
                                            <th className="px-4 py-3 text-left">Em (Destino)</th>
                                            <th className="px-4 py-3 text-right">Qtd.</th>
                                            <th className="px-4 py-3 text-right">Economia</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {cuttingRecommendations.map(rec => {
                                                const source = inventory.findComponentById(rec.sourceComponentId);
                                                const target = inventory.findComponentById(rec.targetComponentId);
                                                return (
                                                    <tr key={rec.targetComponentId} className={`hover:bg-gray-50 transition-colors ${selectedCuts.has(rec.targetComponentId) ? 'bg-orange-50/50' : ''}`}>
                                                        <td className="px-4 py-3"><input type="checkbox" className="rounded text-orange-600 focus:ring-orange-500" checked={selectedCuts.has(rec.targetComponentId)} onChange={() => toggleSelection('cut', rec.targetComponentId)} /></td>
                                                        <td className="px-4 py-3 text-gray-700">{source?.name}</td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">{target?.name}</td>
                                                        <td className="px-4 py-3 text-right font-bold">{rec.quantityToCut}</td>
                                                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatCurrency(rec.costSaving)}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* 2. Production */}
                        <Card className="border-l-4 border-l-indigo-500">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FactoryIcon /> Plano de Fabricação
                                    </h3>
                                    <p className="text-sm text-gray-500">Ordens sugeridas para atender a demanda.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Select 
                                        value={processFilter} 
                                        onChange={(e) => setProcessFilter(e.target.value)}
                                        className="min-w-[200px]"
                                    >
                                        <option value="all">Todos os Processos</option>
                                        {uniqueFamilies.map(fid => (
                                            <option key={fid} value={fid as string}>
                                                Processo: {(String(fid).replace('fam-', '')).toUpperCase()}
                                            </option>
                                        ))}
                                    </Select>
                                    <Button onClick={() => handleGenerateOrders('prod')} disabled={selectedProductions.size === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
                                        Gerar {selectedProductions.size} Ordens
                                    </Button>
                                </div>
                            </div>
                            
                            {filteredProductionPlan.length === 0 ? <EmptySection message="Nenhum item para fabricar neste filtro." /> : (
                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 sticky top-0 shadow-sm"><tr>
                                            <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" onChange={() => toggleSelection('prod', '', true, filteredProductionPlan)} checked={selectedProductions.size === filteredProductionPlan.length && filteredProductionPlan.length > 0}/></th>
                                            <th className="px-4 py-3 text-center">Classe</th>
                                            <th className="px-4 py-3 text-left">Componente</th>
                                            <th className="px-4 py-3 text-left">SKU</th>
                                            <th className="px-4 py-3 text-right">Estoque Atual</th>
                                            <th className="px-4 py-3 text-right">A Produzir</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredProductionPlan.map(rec => (
                                                <tr key={rec.componentId} className={`hover:bg-gray-50 transition-colors ${selectedProductions.has(rec.componentId) ? 'bg-indigo-50/50' : ''}`}>
                                                    <td className="px-4 py-3"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={selectedProductions.has(rec.componentId)} onChange={() => toggleSelection('prod', rec.componentId)} /></td>
                                                    <td className="px-4 py-3 text-center"><ABCBadge classification={rec.abcClass} /></td>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{rec.name}</td>
                                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{rec.sku}</td>
                                                    <td className="px-4 py-3 text-right text-gray-600">{Math.floor(rec.inStock)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-700 bg-indigo-50 rounded-lg">{Math.ceil(rec.toProduce)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>

                        {/* 3. Purchasing */}
                        {purchasePlan.length > 0 && (
                            <Card className="border-l-4 border-l-blue-500">
                                <div className="flex justify-between items-center mb-4">
                                   <div>
                                       <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <ShoppingCartIcon /> Plano de Compras
                                       </h3>
                                       <p className="text-sm text-gray-500">Matérias-primas e itens faltantes (Déficits Diretos).</p>
                                   </div>
                                   <Button onClick={() => handleGenerateOrders('purch')} disabled={selectedPurchases.size === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                                       Gerar {selectedPurchases.size} Ordens de Compra
                                   </Button>
                               </div>
                               <div className="overflow-x-auto max-h-[500px]">
                                   <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 sticky top-0 shadow-sm"><tr>
                                           <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" onChange={() => toggleSelection('purch', '', true, purchasePlan)} checked={selectedPurchases.size === purchasePlan.length} /></th>
                                           <th className="px-4 py-3 text-center">Classe</th>
                                           <th className="px-4 py-3 text-left">Item</th>
                                           <th className="px-4 py-3 text-right">Estoque</th>
                                           <th className="px-4 py-3 text-right">A Comprar</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                           {purchasePlan.map(rec => (
                                                <tr key={rec.componentId} className={`hover:bg-gray-50 transition-colors ${selectedPurchases.has(rec.componentId) ? 'bg-blue-50/50' : ''}`}>
                                                   <td className="px-4 py-3"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={selectedPurchases.has(rec.componentId)} onChange={() => toggleSelection('purch', rec.componentId)} /></td>
                                                   <td className="px-4 py-3 text-center"><ABCBadge classification={rec.abcClass} /></td>
                                                   <td className="px-4 py-3 font-medium text-gray-900">{rec.name} <span className="text-gray-400 font-normal ml-1">({rec.sku})</span></td>
                                                   <td className="px-4 py-3 text-right text-gray-600">{Math.floor(rec.inStock)}</td>
                                                   <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50 rounded-lg">{Math.ceil(rec.toOrder)}</td>
                                               </tr>
                                           ))}
                                       </tbody>
                                   </table>
                                </div>
                           </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
