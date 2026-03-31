
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FamiliaComponente, ManufacturingHook, InventoryHook, GeneratedProduct } from '../types';
import { generateAllProductsForFamilia } from '../hooks/manufacturing-evaluator';

interface GeneratedProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    familia: FamiliaComponente;
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

type SortKey = 'name' | 'sku' | 'custoTotal';
type SortDirection = 'asc' | 'desc';

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full py-20">
        <svg className="animate-spin h-8 w-8 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const CompositionBar: React.FC<{ materialCost: number, laborCost: number, totalCost: number }> = ({ materialCost, laborCost, totalCost }) => {
    if (totalCost <= 0) return <div className="w-32 h-3 bg-gray-100 rounded-full"></div>;
    
    const matPercent = Math.max(0, Math.min(100, (materialCost / totalCost) * 100));
    const labPercent = Math.max(0, 100 - matPercent);

    return (
        <div className="flex flex-col w-32 flex-shrink-0">
             <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                <div 
                    style={{ width: `${matPercent}%` }} 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    title={`Matéria-Prima: ${matPercent.toFixed(1)}%`}
                ></div>
                <div 
                    style={{ width: `${labPercent}%` }} 
                    className="bg-blue-600 h-full transition-all duration-500" 
                    title={`Processo: ${labPercent.toFixed(1)}%`}
                ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                <span>Mat.</span>
                <span>Proc.</span>
            </div>
        </div>
    );
};

export const GeneratedProductsModal: React.FC<GeneratedProductsModalProps> = ({ isOpen, onClose, familia, manufacturing, inventory }) => {
    const [products, setProducts] = useState<GeneratedProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
    const [expandedSku, setExpandedSku] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setExpandedSku(null);
            // Pequeno delay para garantir que o spinner apareça em processos pesados
            setTimeout(() => {
                const config = {
                    workStations: manufacturing.workStations,
                    operations: manufacturing.standardOperations,
                    consumables: manufacturing.consumables,
                    allFamilias: manufacturing.familias // CRUCIAL: Passa a lista para herdar DNA
                };
                const generated = generateAllProductsForFamilia(familia, inventory.components, inventory.kits, config);
                setProducts(generated);
                setIsLoading(false);
            }, 50);
        }
    }, [isOpen, familia, manufacturing.workStations, manufacturing.standardOperations, manufacturing.consumables, manufacturing.familias, inventory.components, inventory.kits]);

    const sortedAndFilteredProducts = useMemo(() => {
        let sortableItems = [...products];
        
        if (searchTerm) {
            sortableItems = sortableItems.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        sortableItems.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            if (sortConfig.key === 'custoTotal') {
                aValue = a.custoMateriaPrima + a.custoFabricacao;
                bValue = b.custoMateriaPrima + b.custoFabricacao;
            } else {
                aValue = a[sortConfig.key];
                bValue = b[sortConfig.key];
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortableItems;
    }, [products, searchTerm, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };
    
    const handleToggleExpand = (sku: string) => {
        setExpandedSku(prev => (prev === sku ? null : sku));
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Composição de Custo: ${familia.nome}`} size="4xl">
            <div className="max-h-[70vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <Input
                        placeholder="Filtrar por nome ou SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-xs"
                    />
                    <div className="text-right">
                        <p className="text-sm font-medium text-black">{sortedAndFilteredProducts.length} de {products.length} produtos</p>
                    </div>
                </div>
                {isLoading ? (
                    <Spinner />
                ) : (
                    <div className="overflow-y-auto flex-grow border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th onClick={() => requestSort('name')} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer w-1/3">Nome{getSortIndicator('name')}</th>
                                    <th onClick={() => requestSort('sku')} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer">SKU{getSortIndicator('sku')}</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Gráfico</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Custos</th>
                                    <th onClick={() => requestSort('custoTotal')} className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer">Total{getSortIndicator('custoTotal')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedAndFilteredProducts.map(product => {
                                    const isExpanded = expandedSku === product.sku;
                                    const totalCost = product.custoMateriaPrima + product.custoFabricacao;

                                    return (
                                        <React.Fragment key={product.sku}>
                                            <tr onClick={() => handleToggleExpand(product.sku)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-black">
                                                    <span className={`inline-block transition-transform duration-200 transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                    <span className="ml-2 uppercase font-bold">{product.name}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{product.sku}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex justify-center">
                                                        <CompositionBar 
                                                            materialCost={product.custoMateriaPrima} 
                                                            laborCost={product.custoFabricacao} 
                                                            totalCost={totalCost} 
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-right text-gray-500 font-medium">
                                                    <div><span className="text-emerald-600 font-bold">Mat:</span> {formatCurrency(product.custoMateriaPrima)}</div>
                                                    <div><span className="text-blue-700 font-bold">Proc:</span> {formatCurrency(product.custoFabricacao)}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-black text-slate-900">{formatCurrency(totalCost)}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50 animate-fade-in border-l-4 border-l-autro-blue">
                                                    <td colSpan={5} className="p-4">
                                                        <h4 className="font-bold text-black text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            🧬 Memória de Cálculo Industrial
                                                        </h4>
                                                        <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                                                            <table className="min-w-full">
                                                                <thead className="bg-gray-50 border-b">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left text-[9px] font-black text-gray-400 uppercase">Item de Composição</th>
                                                                        <th className="px-3 py-2 text-left text-[9px] font-black text-gray-400 uppercase">Fator de Resolução</th>
                                                                        <th className="px-3 py-2 text-right text-[9px] font-black text-gray-400 uppercase">Custo</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {product.costBreakdown.map((step, index) => (
                                                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="px-3 py-2 text-xs text-slate-800 font-bold">{step.name}</td>
                                                                            <td className="px-3 py-2 text-[10px] text-slate-400 italic font-mono">{step.details || "Valor Direto"}</td>
                                                                            <td className="px-3 py-2 text-xs text-right font-black text-slate-700">{formatCurrency(step.cost)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot className="bg-slate-900 text-white">
                                                                    <tr>
                                                                        <td colSpan={2} className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest opacity-60">Soma Total Produção:</td>
                                                                        <td className="px-3 py-3 text-right text-sm font-black text-emerald-400">{formatCurrency(totalCost)}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        {sortedAndFilteredProducts.length === 0 && (
                            <p className="text-center text-gray-500 py-12 font-medium">Nenhum produto gerado com os critérios atuais.</p>
                        )}
                    </div>
                )}
            </div>
             <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }`}</style>
            <div className="flex justify-end pt-4 mt-4 border-t gap-2">
                <Button onClick={onClose} variant="secondary">Fechar</Button>
            </div>
        </Modal>
    );
};
