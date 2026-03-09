import React, { useMemo } from 'react';
import { Card } from './ui/Card';
import { InventoryHook, PurchaseOrdersHook, ManufacturingOrdersHook, Kit, Installment, ManufacturingHook, Component } from '../types';
import { useFinancials } from '../contexts/FinancialsContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface FinancialDashboardViewProps {
    inventory: InventoryHook;
    purchaseOrdersHook: PurchaseOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    manufacturing: ManufacturingHook;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const StatCard: React.FC<{ title: string; value: string; description: string; }> = ({ title, value, description }) => (
    <Card>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="mt-1 text-3xl font-semibold text-autro-blue">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
    </Card>
);

export const FinancialDashboardView: React.FC<FinancialDashboardViewProps> = ({ inventory, purchaseOrdersHook, manufacturingOrdersHook, manufacturing }) => {
    const { calculateSaleDetails } = useFinancials();

    const financialSummary = useMemo(() => {
        const allInstallments: (Installment & { orderId: string })[] = [];
        purchaseOrdersHook.purchaseOrders.forEach(o => o.installments.forEach(i => allInstallments.push({ ...i, orderId: o.id })));
        manufacturingOrdersHook.manufacturingOrders.forEach(o => o.installments.forEach(i => allInstallments.push({ ...i, orderId: o.id })));

        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        const totalPayable = allInstallments
            .filter(i => i.status === 'pendente')
            .reduce((sum, i) => sum + i.value, 0);

        const payableNext30Days = allInstallments
            .filter(i => {
                const dueDate = new Date(i.dueDate);
                return i.status === 'pendente' && dueDate >= now && dueDate <= thirtyDaysFromNow;
            })
            .reduce((sum, i) => sum + i.value, 0);

        const inventoryValue = inventory.components.reduce((sum, c) => {
            return sum + (c.stock * getComponentCost(c));
        }, 0);

        return { totalPayable, payableNext30Days, inventoryValue };
    }, [purchaseOrdersHook.purchaseOrders, manufacturingOrdersHook.manufacturingOrders, inventory.components]);

    const kitMargins = useMemo(() => {
         const componentSkuMap = new Map<string, Component>(inventory.components.map(c => [c.sku, c]));
         const fastenerFamilia = manufacturing.familias.find(f => f.id === 'fam-fixadores');

        return inventory.kits.map(kit => {
            let totalCost = 0;
            kit.components.forEach(kc => {
                const component: Component | undefined = componentSkuMap.get(kc.componentSku);
                if (component) {
                    totalCost += (getComponentCost(component)) * kc.quantity;
                }
            });
             if (kit.requiredFasteners && fastenerFamilia) {
                kit.requiredFasteners.forEach(rf => {
                    const [bitolaStr, compStr] = rf.dimension.replace('mm','').split('x');
                    const result = evaluateProcess(fastenerFamilia, { bitola: Number(bitolaStr), comprimento: Number(compStr) }, inventory.components);
                    totalCost += (result.custoFabricacao + result.custoMateriaPrima) * rf.quantity;
                });
            }

            const saleDetails = calculateSaleDetails(totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
            return {
                kit,
                marginPercentage: saleDetails.contributionMarginPercentage,
                marginValue: saleDetails.contributionMargin,
            };
        });
    }, [inventory.kits, inventory.components, manufacturing.familias, calculateSaleDetails]);

    const { bestMarginKits, worstMarginKits, averageMargin } = useMemo(() => {
        if (kitMargins.length === 0) return { bestMarginKits: [], worstMarginKits: [], averageMargin: 0 };
        const sortedByMargin = [...kitMargins].sort((a, b) => b.marginPercentage - a.marginPercentage);
        const totalMargin = sortedByMargin.reduce((sum, item) => sum + item.marginPercentage, 0);
        return {
            bestMarginKits: sortedByMargin.slice(0, 5),
            worstMarginKits: sortedByMargin.slice(-5).reverse(),
            averageMargin: totalMargin / kitMargins.length,
        };
    }, [kitMargins]);
    
    const paymentsByMonthChartData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setUTCMonth(d.getUTCMonth() + i, 1);
            return { month: d.getUTCMonth(), year: d.getUTCFullYear(), label: `${d.toLocaleString('default', { month: 'short' })}/${d.getUTCFullYear()}`, total: 0 };
        });

        const allInstallments: Installment[] = [];
        purchaseOrdersHook.purchaseOrders.forEach(o => allInstallments.push(...o.installments));
        manufacturingOrdersHook.manufacturingOrders.forEach(o => allInstallments.push(...o.installments));

        allInstallments.forEach(inst => {
            if (inst.status === 'pendente') {
                const dueDate = new Date(inst.dueDate);
                const monthIndex = months.findIndex(m => m.month === dueDate.getUTCMonth() && m.year === dueDate.getUTCFullYear());
                if (monthIndex > -1) {
                    months[monthIndex].total += inst.value;
                }
            }
        });

        return {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Contas a Pagar',
                data: months.map(m => m.total),
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            }],
        };
    }, [purchaseOrdersHook.purchaseOrders, manufacturingOrdersHook.manufacturingOrders]);

    const inventoryCostBreakdownChartData = useMemo(() => {
        const breakdown = inventory.components.reduce((acc, c: Component) => {
            const value = c.stock * getComponentCost(c);
            if (c.type === 'raw_material') {
                acc.rawMaterials += value;
            } else {
                acc.manufactured += value;
            }
            return acc;
        }, { rawMaterials: 0, manufactured: 0 });

        return {
            labels: ['Matérias-Primas', 'Componentes Processados'],
            datasets: [{
                data: [breakdown.rawMaterials, breakdown.manufactured],
                backgroundColor: ['#002B8A', '#FBBF24'],
            }],
        };
    }, [inventory.components]);


    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-black">Dashboard Financeiro</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Contas a Pagar (Total)" value={formatCurrency(financialSummary.totalPayable)} description="Soma de todas as parcelas pendentes." />
                <StatCard title="A Pagar (Próx. 30 dias)" value={formatCurrency(financialSummary.payableNext30Days)} description="Pagamentos com vencimento nos próximos 30 dias." />
                <StatCard title="Valor do Inventário" value={formatCurrency(financialSummary.inventoryValue)} description="Custo total dos itens em estoque." />
                <StatCard title="Margem de Contribuição Média" value={`${averageMargin.toFixed(1)}%`} description="Média da margem sobre o preço de venda dos kits." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-semibold text-black mb-4">Top 5 Kits por Margem de Contribuição</h3>
                    <div className="space-y-2">
                        {bestMarginKits.map(({ kit, marginPercentage }) => (
                            <div key={kit.id} className="flex justify-between items-center text-sm p-2 bg-green-50 rounded-md">
                                <span className="text-black">{kit.name}</span>
                                <span className="font-bold text-green-700">{marginPercentage.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold text-black mb-4">Piores 5 Kits por Margem de Contribuição</h3>
                     <div className="space-y-2">
                        {worstMarginKits.map(({ kit, marginPercentage }) => (
                            <div key={kit.id} className="flex justify-between items-center text-sm p-2 bg-red-50 rounded-md">
                                <span className="text-black">{kit.name}</span>
                                <span className="font-bold text-red-700">{marginPercentage.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-semibold text-black mb-4">Contas a Pagar (Próximos 6 meses)</h3>
                    <div className="h-64">
                        <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={paymentsByMonthChartData} />
                    </div>
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold text-black mb-4">Composição de Custo do Inventário</h3>
                    <div className="h-64 flex justify-center">
                        <Pie options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} data={inventoryCostBreakdownChartData} />
                    </div>
                </Card>
            </div>

        </div>
    );
};