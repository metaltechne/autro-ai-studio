import React, { useMemo, useState, useEffect } from 'react';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoles } from '../hooks/api';
import { UserProfile } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { DollarSign, TrendingUp, Users, Target, Activity, Award } from 'lucide-react';

const COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

export const SalesDashboardView: React.FC = () => {
    const { deals, leads } = useSalesFunnel();
    const { role } = useAuth(); // Can use this to filter views for sellers vs managers

    const [sellers, setSellers] = useState<UserProfile[]>([]);
    
    useEffect(() => {
        getUserRoles().then(re => setSellers(re));
    }, []);

    const metrics = useMemo(() => {
        const wonDeals = deals.filter(d => d.stage === 'Ganho');
        const closedLost = deals.filter(d => d.stage === 'Perdido');
        
        const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
        const activeDeals = deals.filter(d => d.stage !== 'Ganho' && d.stage !== 'Perdido');
        const pipelineValue = activeDeals.reduce((sum, d) => sum + d.value, 0);
        
        const winRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;
        
        // Faturamento mensal
        const monthlyRevenueMap: Record<string, number> = {};
        wonDeals.forEach(deal => {
            const date = new Date(deal.updatedAt || deal.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyRevenueMap[key] = (monthlyRevenueMap[key] || 0) + deal.value;
        });

        const monthlyRevenueList = Object.entries(monthlyRevenueMap)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Metricas de vendedores
        const sellerMap: Record<string, { won: number, revenue: number, active: number }> = {};
        deals.forEach(deal => {
            const sellerId = deal.assignedSellerId || 'Sem Vendedor';
            
            let sellerName = 'Sem Vendedor';
            if (sellerId !== 'Sem Vendedor') {
                const s = sellers.find(x => x.uid === sellerId);
                sellerName = s ? s.email.split('@')[0] : 'Desconhecido';
            }

            if (!sellerMap[sellerName]) sellerMap[sellerName] = { won: 0, revenue: 0, active: 0 };
            
            if (deal.stage === 'Ganho') {
                sellerMap[sellerName].won += 1;
                sellerMap[sellerName].revenue += deal.value;
            } else if (deal.stage !== 'Perdido') {
                sellerMap[sellerName].active += 1;
            }
        });

        const sellerPerformance = Object.entries(sellerMap).map(([name, stats]) => ({
            name,
            ...stats
        })).sort((a, b) => b.revenue - a.revenue);

        // Distribuição do funil
        const stageMap: Record<string, number> = {};
        deals.forEach(deal => {
            const stage = deal.stage;
            stageMap[stage] = (stageMap[stage] || 0) + 1;
        });
        const stageData = Object.entries(stageMap).map(([name, value]) => ({ name, value }));

        return {
            totalRevenue,
            pipelineValue,
            winRate,
            wonCount: wonDeals.length,
            activeCount: activeDeals.length,
            lostCount: closedLost.length,
            monthlyRevenueList,
            sellerPerformance,
            stageData
        };
    }, [deals, sellers]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-autro-primary w-8 h-8" />
                        Dashboard de Vendas
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Análise de Performance e Evolução de Receita</p>
                </div>
            </header>

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Faturamento Total</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(metrics.totalRevenue)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pipeline Ativo</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(metrics.pipelineValue)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Win Rate (Conversão)</p>
                            <p className="text-2xl font-black text-slate-900">{metrics.winRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Negócios Fechados</p>
                            <p className="text-2xl font-black text-slate-900">{metrics.wonCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Evolução Faturamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-slate-400" /> Evolução de Faturamento
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics.monthlyRevenueList} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis tickFormatter={(val) => `R$${val/1000}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <RechartsTooltip 
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    name="Faturamento" 
                                    stroke="#0ea5e9" 
                                    strokeWidth={4}
                                    activeDot={{ r: 8, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }}
                                    dot={{ r: 4, fill: '#fff', stroke: '#0ea5e9', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Performance de Vendas por Vendedor */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Users className="text-slate-400" /> Rank Vendedores
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.sellerPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" tickFormatter={(val) => `R$${val/1000}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                <RechartsTooltip 
                                    formatter={(value: number) => formatCurrency(value)}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} 
                                />
                                <Bar dataKey="revenue" name="Faturamento (R$)" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                    {metrics.sellerPerformance.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Distribuição de Fases */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Target className="text-slate-400" /> Fases do Funil
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.stageData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {metrics.stageData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} 
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tabela de Vendedores Detalhada */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Users className="text-slate-400" /> Detalhamento da Equipe
                    </h3>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400">Vendedor</th>
                                    <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 text-center">Negócios Ativos</th>
                                    <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 text-center">Ganhos</th>
                                    <th className="py-3 px-4 font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Faturamento Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {metrics.sellerPerformance.map(seller => (
                                    <tr key={seller.name} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4 font-bold text-slate-900">{seller.name}</td>
                                        <td className="py-4 px-4 text-slate-600 text-center font-medium">{seller.active}</td>
                                        <td className="py-4 px-4 text-green-600 text-center font-black">{seller.won}</td>
                                        <td className="py-4 px-4 text-slate-900 font-black text-right">{formatCurrency(seller.revenue)}</td>
                                    </tr>
                                ))}
                                {metrics.sellerPerformance.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">Nenhum dado de vendas registrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
