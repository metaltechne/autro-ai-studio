
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { InventoryHook, Kit, ManufacturingHook, KitCostDetails, KitCostBreakdownItem, ScannedQRCodeData, SaleDetails, Component, View, KitComponent } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { KitEditModal } from './KitEditModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { evaluateProcess, getComponentCost } from '../hooks/manufacturing-evaluator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Pagination } from './ui/Pagination';
import { InlineQRCode } from './ui/InlineQRCode';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { KitImportModal } from './KitImportModal';
import { Select } from './ui/Select';
import { useFinancials } from '../contexts/FinancialsContext';
import { Modal } from './ui/Modal';
import { getLogoBase64ForPdf } from '../data/assets';

interface KitsViewProps {
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  onShowQRCode: (details: { title: string; data: ScannedQRCodeData }) => void;
  onViewDetails: (kitId: string) => void;
}

const ITEMS_PER_PAGE = 20;

const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const DataRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`flex justify-between items-start py-2 border-b ${className}`}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-black text-right font-semibold">{value}</dd>
    </div>
);

const defaultSaleDetails: SaleDetails = {
    sellingPrice: 0,
    profit: 0,
    totalTaxes: 0,
    taxBreakdown: [],
    isOverridden: false,
    contributionMargin: 0,
    contributionMarginPercentage: 0,
};

const SaleDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    kitName: string;
    cost: number;
    saleDetails?: SaleDetails;
}> = ({ isOpen, onClose, kitName, cost, saleDetails }) => {
    if (!saleDetails) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Composição de Preço: ${kitName}`}>
            <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-baseline">
                        <span className="text-lg font-medium text-black">Preço Final de Venda</span>
                        <span className="text-3xl font-bold text-autro-blue">{formatCurrency(saleDetails.sellingPrice)}</span>
                    </div>
                     {saleDetails.isOverridden && <p className="text-xs text-center text-gray-500 mt-1">(Preço definido manualmente)</p>}
                </div>
                <dl className="space-y-2 text-sm">
                    <DataRow label="Custo do Kit" value={formatCurrency(cost)} />
                    <DataRow 
                        label="Margem de Contribuição" 
                        value={`${formatCurrency(saleDetails.contributionMargin)} (${saleDetails.contributionMarginPercentage.toFixed(2)}%)`}
                        className="text-green-700"
                    />
                    <DataRow label="Lucro Líquido" value={formatCurrency(saleDetails.profit)} />
                    <DataRow label="Total de Impostos" value={formatCurrency(saleDetails.totalTaxes)} />
                </dl>
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-black mb-2">Detalhamento dos Impostos</h4>
                    <dl className="space-y-1 text-sm">
                        {saleDetails.taxBreakdown.map(tax => (
                            <DataRow key={tax.name} label={`${tax.name} (${tax.percentage}%)`} value={formatCurrency(tax.value)} />
                        ))}
                    </dl>
                </div>
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t">
                <Button onClick={onClose} variant="secondary">Fechar</Button>
            </div>
        </Modal>
    );
};

const KitCard: React.FC<{ 
    kit: Kit; 
    costDetails: KitCostDetails;
    onViewDetails: (kitId: string) => void;
    onShowSaleDetails: (details: { kitName: string, cost: number, saleDetails?: SaleDetails }) => void;
    selectedKeyCost: number;
    calculateSaleDetails: (cost: number, options: { priceOverride?: number; strategy?: 'markup' | 'override' }) => SaleDetails;
}> = ({ kit, costDetails, onViewDetails, onShowSaleDetails, selectedKeyCost, calculateSaleDetails }) => {
    
    return (
        <Card className="flex flex-col h-full transition-all duration-200 hover:shadow-xl cursor-pointer hover:border-autro-blue/50" onClick={() => onViewDetails(kit.id)}>
            <div className="flex-grow flex flex-col space-y-3">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-grow">
                        <h4 className="font-bold text-black text-lg truncate" title={kit.name}>{kit.name}</h4>
                        <p className="text-xs text-gray-500 font-mono tracking-tighter">SKU: {kit.sku}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 uppercase font-black tracking-widest border-b pb-2">
                    <div className="bg-gray-50 p-1.5 rounded">{kit.marca}</div>
                    <div className="bg-gray-50 p-1.5 rounded truncate text-center">{kit.modelo}</div>
                </div>

                <div className="space-y-1.5 py-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Composição do Kit</p>
                    {kit.components.slice(0, 3).map((c: KitComponent, i: number) => (
                        <div key={i} className="flex justify-between text-xs items-center">
                            <span className="text-slate-600 truncate mr-2">{c.componentSku}</span>
                            <span className="font-bold text-slate-900">{c.quantity}x</span>
                        </div>
                    ))}
                    {kit.requiredFasteners.map((f: { dimension: string; quantity: number }, i: number) => {
                        const isNut = f.dimension.includes('x0');
                        const label = isNut ? `Porca M${f.dimension.split('x')[0]}` : `Parafuso ${f.dimension}`;
                        return (
                            <div key={`f-${i}`} className={`flex justify-between text-xs items-center px-1 rounded ${isNut ? 'text-amber-700 bg-amber-50/50' : 'text-indigo-700 bg-indigo-50/50'}`}>
                                <span className="truncate mr-2 font-medium">{label}</span>
                                <span className="font-black">{f.quantity}x</span>
                            </div>
                        );
                    })}
                    {(kit.components.length > 3) && (
                        <p className="text-[10px] text-center text-gray-400 font-bold italic">+{kit.components.length - 3} outros itens...</p>
                    )}
                </div>

                <div className="border-t pt-3 space-y-2 mt-auto">
                    <div className="flex justify-between items-baseline">
                         <span className="text-[10px] text-gray-500 font-bold uppercase">Preço Venda</span>
                         <span className="text-xl font-black text-autro-blue" onClick={(e) => { e.stopPropagation(); onShowSaleDetails({ kitName: kit.name, cost: costDetails.totalCost, saleDetails: costDetails.saleDetails })}}>{formatCurrency(costDetails.saleDetails?.sellingPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-400">Margem Estimada</span>
                        <span className="text-green-600">{formatCurrency(costDetails.saleDetails?.contributionMargin || 0)} ({(costDetails.saleDetails?.contributionMarginPercentage || 0).toFixed(1)}%)</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export const KitsView: React.FC<KitsViewProps> = ({ inventory, manufacturing, onShowQRCode, onViewDetails }) => {
  const { kits, addKit, updateKit, deleteKit, components } = inventory;
  const { calculateSaleDetails } = useFinancials();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [deletingKit, setDeletingKit] = useState<Kit | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [saleDetailsModalData, setSaleDetailsModalData] = useState<{ kitName: string; cost: number; saleDetails?: SaleDetails } | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  
  const [filters, setFilters] = useState({
    searchTerm: '',
    brand: '',
    model: '',
    year: '',
    fastenerDim: '',
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, selectedKeyId]);

  const keyComponents = useMemo(() => {
    return inventory.components
        .filter(c => c.familiaId === 'fam-chave-p' || c.familiaId === 'fam-chave-s')
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory.components]);

  const selectedKeyCost = useMemo(() => {
    if (!selectedKeyId) return 0;
    const key: Component | undefined = keyComponents.find(c => c.id === selectedKeyId);
    return key ? getComponentCost(key) : 0;
  }, [selectedKeyId, keyComponents]);

  const kitCostDetailsMap = useMemo((): Map<string, KitCostDetails> => {
    const detailsMap = new Map<string, KitCostDetails>();
    const fastenerFamilia = manufacturing.familias.find(f => f.id === 'fam-fixadores');
    const fastenerCostCache = new Map<string, number>();
    const componentSkuMap = new Map<string, Component>(components.map(c => [c.sku, c]));

    const getFastenerCost = (dimension: string): number => {
      if (fastenerCostCache.has(dimension)) {
        return fastenerCostCache.get(dimension)!;
      }
      if (fastenerFamilia) {
        const simpleDim = dimension.replace('mm','');
        const [bitolaStr, comprimentoStr] = simpleDim.split('x');
        const bitola = parseInt(bitolaStr, 10);
        const comprimento = parseInt(comprimentoStr, 10);
        if (!isNaN(bitola) && !isNaN(comprimento)) {
            const result = evaluateProcess(
                fastenerFamilia,
                { bitola, comprimento },
                inventory.components,
            );
            const fastenerCost = result.custoMateriaPrima + result.custoFabricacao;
            fastenerCostCache.set(dimension, fastenerCost);
            return fastenerCost;
        }
      }
      return 0;
    };

    for (const kit of kits) {
        let totalCost = 0;
        const breakdown: KitCostBreakdownItem[] = [];
        kit.components.forEach((kc: KitComponent) => {
            const component: Component | undefined = componentSkuMap.get(kc.componentSku);
            if (component) {
                const unitCost = getComponentCost(component);
                const itemTotalCost = unitCost * kc.quantity;
                totalCost += itemTotalCost;
                breakdown.push({
                    name: component.name, sku: component.sku, quantity: kc.quantity,
                    unitCost: unitCost, totalCost: itemTotalCost, type: 'Componente',
                });
            }
        });
        if (kit.requiredFasteners) {
            kit.requiredFasteners.forEach((rf: { dimension: string; quantity: number }) => {
                const unitCost = getFastenerCost(rf.dimension);
                const itemTotalCost = unitCost * rf.quantity;
                totalCost += itemTotalCost;
                const isNut = rf.dimension.endsWith('x0mm') || rf.dimension.includes('x0');
                const name = isNut
                    ? `Porca M${rf.dimension.split('x')[0]}`
                    : `Fixador ${rf.dimension}`;
                breakdown.push({
                    name, sku: `DIM-${rf.dimension}`, quantity: rf.quantity,
                    unitCost, totalCost: itemTotalCost, type: 'Fixador',
                });
            });
        }
        const saleDetails = calculateSaleDetails(totalCost, { priceOverride: kit.sellingPriceOverride, strategy: kit.pricingStrategy });
        detailsMap.set(kit.id, { totalCost, breakdown: breakdown.sort((a, b) => b.totalCost - a.totalCost), saleDetails });
    }
    return detailsMap;
  }, [kits, components, manufacturing.familias, inventory.components, calculateSaleDetails]);

  const handleOpenModalForCreate = useCallback(() => {
    setEditingKit(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveKit = useCallback(async (kitData: Kit | Omit<Kit, 'id'>) => {
    if ('id' in kitData) {
      await updateKit(kitData);
    } else {
      await addKit(kitData);
    }
    setIsModalOpen(false);
  }, [addKit, updateKit]);

  const filterOptions = useMemo(() => {
    const brands = [...new Set(kits.map(k => k.marca))].sort((a: string, b: string) => a.localeCompare(b));
    const relevantKitsForModel = filters.brand ? kits.filter(k => k.marca === filters.brand) : [];
    const models = [...new Set(relevantKitsForModel.map(k => k.modelo))].sort((a: string, b: string) => a.localeCompare(b));
    const relevantKitsForYear = filters.model ? relevantKitsForModel.filter(k => k.modelo === filters.model) : [];
    const years = [...new Set(relevantKitsForYear.map(k => k.ano))].sort((a: string, b: string) => a.localeCompare(b));
    return { brands, models, years };
  }, [kits, filters.brand, filters.model]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => {
        const newFilters = { ...prev, [name]: value };
        if (name === 'brand') { newFilters.model = ''; newFilters.year = ''; }
        if (name === 'model') { newFilters.year = ''; }
        return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({ searchTerm: '', brand: '', model: '', year: '', fastenerDim: '' });
    setSelectedKeyId('');
  };

  const filteredKits = useMemo(() => {
    return kits.filter(k => {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      const lowerFastenerDim = filters.fastenerDim.toLowerCase();
      const passesSearch = filters.searchTerm ? 
        k.name.toLowerCase().includes(lowerSearchTerm) ||
        k.sku.toLowerCase().includes(lowerSearchTerm) : true;
      const passesBrand = filters.brand ? k.marca === filters.brand : true;
      const passesModel = filters.model ? k.modelo === filters.model : true;
      const passesYear = filters.year ? k.ano === filters.year : true;
      const passesFastener = filters.fastenerDim ? 
        k.requiredFasteners.some(f => f.dimension.toLowerCase().includes(lowerFastenerDim)) : true;
      return passesSearch && passesBrand && passesModel && passesYear && passesFastener;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [kits, filters]);

  const totalPages = Math.ceil(filteredKits.length / ITEMS_PER_PAGE);
  const paginatedKits = filteredKits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    try {
        const logoBase64 = await getLogoBase64ForPdf();
        doc.addImage(logoBase64, 'PNG', 14, 12, 40, 10);
    } catch (error) { console.error("Could not load logo for PDF:", error); }
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Kits de Produtos', 200, 22, { align: 'right' });
    doc.setDrawColor('#002B8A');
    doc.line(14, 28, 200, 28);
    autoTable(doc, {
      head: [['Nome', 'Marca', 'Modelo', 'Ano', 'SKU', 'Custo Total', 'Preço de Venda']],
      body: filteredKits.map(k => {
          const details = kitCostDetailsMap.get(k.id);
          return [k.name, k.marca, k.modelo, k.ano, k.sku, formatCurrency(details?.totalCost || 0), formatCurrency(details?.saleDetails?.sellingPrice || 0)]
      }),
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [0, 43, 138] },
    });
    doc.save(`relatorio_kits_${Date.now()}.pdf`);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredKits.map(k => {
        const details = kitCostDetailsMap.get(k.id);
        return {
            'Nome do Kit': k.name, 'SKU': k.sku, 'Marca': k.marca, 'Modelo': k.modelo, 'Ano': k.ano,
            'Custo Total (R$)': details?.totalCost || 0, 'Preço de Venda (R$)': details?.saleDetails?.sellingPrice || 0,
            'Componentes (SKU:Qtd)': k.components.map((c: KitComponent) => `${c.componentSku}:${c.quantity}`).join(','),
            'Fixadores (Dimensao:Qtd)': k.requiredFasteners.map((f: { dimension: string; quantity: number }) => `${f.dimension}:${f.quantity}`).join(','),
        }
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kits');
    XLSX.writeFile(workbook, `relatorio_kits_${Date.now()}.xlsx`);
  };

  return (
    <div>
        <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { setFileToImport(f); setIsImportModalOpen(true); } e.target.value = ''; }} accept=".xlsx, .xls" className="hidden" />
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-black flex-grow">Kits de Produtos</h2>
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-2">
                <Button onClick={handleExportPDF} variant="secondary" disabled={filteredKits.length === 0}>PDF</Button>
                <Button onClick={handleExportExcel} variant="secondary" disabled={filteredKits.length === 0}>Excel</Button>
                <Button onClick={handleOpenModalForCreate}>Novo Kit</Button>
            </div>
             <div className="flex gap-2 border-l pl-2">
                <Button onClick={() => fileInputRef.current?.click()}>Importar Excel</Button>
            </div>
        </div>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <Input className="lg:col-span-2" label="Pesquisar por Nome/SKU" name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Pesquisar..." />
            <Select label="Marca" name="brand" value={filters.brand} onChange={handleFilterChange}>
                <option value="">Todas as Marcas</option>
                {filterOptions.brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Select label="Modelo" name="model" value={filters.model} onChange={handleFilterChange} disabled={!filters.brand}>
                <option value="">Todos os Modelos</option>
                {filterOptions.models.map((m: string) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Select label="Ano" name="year" value={filters.year} onChange={handleFilterChange} disabled={!filters.model}>
                <option value="">Todos os Anos</option>
                {filterOptions.years.map((y: string) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Input label="Dimensão do Fixador" name="fastenerDim" value={filters.fastenerDim} onChange={handleFilterChange} placeholder="Ex: 8x40mm" />
            <div className="lg:col-span-2">
                <Select label="Analisar Custo com Chave" name="selectedKey" value={selectedKeyId} onChange={e => setSelectedKeyId(e.target.value)}>
                    <option value="">Não incluir chave na análise</option>
                    {keyComponents.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
            </div>
             <Button onClick={handleClearFilters} variant="secondary" className="w-full">Limpar Filtros</Button>
        </div>
      </Card>

      {paginatedKits.length === 0 && (
        <EmptyState
            icon={<svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
            title="Nenhum Kit Encontrado"
            message="Comece adicionando um novo kit ou mude os filtros."
        >
            <Button onClick={handleOpenModalForCreate}>Adicionar Kit</Button>
        </EmptyState>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {paginatedKits.map(kit => (
          <KitCard 
            key={kit.id} 
            kit={kit} 
            costDetails={kitCostDetailsMap.get(kit.id) || { totalCost: 0, breakdown: [], saleDetails: defaultSaleDetails }} 
            onViewDetails={onViewDetails}
            onShowSaleDetails={setSaleDetailsModalData}
            selectedKeyCost={selectedKeyCost}
            calculateSaleDetails={calculateSaleDetails}
          />
        ))}
      </div>
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {isModalOpen && <KitEditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveKit} kitToEdit={editingKit} inventory={inventory} />}
      {isImportModalOpen && <KitImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} file={fileToImport} inventory={inventory} />}
      {deletingKit && (
        <ConfirmationModal isOpen={!!deletingKit} onClose={() => setDeletingKit(null)} onConfirm={async () => { await deleteKit(deletingKit.id); setDeletingKit(null); }} title={`Excluir Kit "${deletingKit.name}"`} isConfirming={isConfirmingDelete} confirmText="Sim, Excluir">
            <p className="text-sm text-gray-600">Tem certeza que deseja excluir o kit "{deletingKit.name} ({deletingKit.sku})"? Esta ação não pode ser desfeita.</p>
        </ConfirmationModal>
      )}
      {saleDetailsModalData && <SaleDetailsModal isOpen={!!saleDetailsModalData} onClose={() => setSaleDetailsModalData(null)} {...saleDetailsModalData} />}
    </div>
  );
};
