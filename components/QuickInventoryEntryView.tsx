
import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { InventoryHook, Component, InventoryLogType } from '../types';
import { useToast } from '../hooks/useToast';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { Search, Plus, Minus, Package, BarChart3, Database, Key } from 'lucide-react';

interface QuickInventoryEntryViewProps {
  inventory: InventoryHook;
}

type CategoryType = 'barras' | 'insumos' | 'moedas' | 'segredos' | 'outros';

export const QuickInventoryEntryView: React.FC<QuickInventoryEntryViewProps> = ({ inventory }) => {
  const { addToast } = useToast();
  const { components, addInventoryLog } = inventory;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('barras');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const categories = useMemo(() => {
    const cats: Record<CategoryType, Component[]> = {
      barras: [],
      insumos: [],
      moedas: [],
      segredos: [],
      outros: []
    };

    (components || []).forEach(c => {
      const sku = (c.sku || '').toUpperCase();
      const name = (c.name || '').toUpperCase();
      
      if (sku.startsWith('RM-BARRA') || sku.startsWith('RM-TUBO')) {
        cats.barras.push(c);
      } else if (sku.includes('MOEDA') || name.includes('MOEDA')) {
        cats.moedas.push(c);
      } else if (sku.includes('SEGREDO') || name.includes('SEGREDO')) {
        cats.segredos.push(c);
      } else if (c.familiaId === 'fam-embalagens' || sku.startsWith('SACO') || sku.startsWith('CX-') || sku.startsWith('EMB-')) {
        cats.insumos.push(c);
      } else {
        cats.outros.push(c);
      }
    });

    // Sort each list by name
    Object.values(cats).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    
    return cats;
  }, [components]);

  const filteredComponents = useMemo(() => {
    const list = categories[activeCategory] || [];
    if (!searchTerm) return list;
    return list.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, activeCategory, searchTerm]);

  const handleAdjust = (componentId: string, amount: number) => {
    setAdjustments(prev => ({
      ...prev,
      [componentId]: (prev[componentId] || 0) + amount
    }));
  };

  const handleInputChange = (componentId: string, value: string) => {
    const numValue = parseFloat(value);
    setAdjustments(prev => ({
      ...prev,
      [componentId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const totalAdjustments = Object.values(adjustments).filter(v => v !== 0).length;

  const handleSave = async () => {
    if (totalAdjustments === 0) return;
    setIsProcessing(true);
    try {
      const promises = Object.entries(adjustments)
        .filter(([_, value]) => value !== 0)
        .map(([id, value]) => {
          return addInventoryLog({
            componentId: id,
            type: value > 0 ? 'entrada' : 'saída',
            quantity: Math.abs(value),
            reason: value > 0 ? 'ajuste_inventario_positivo' : 'ajuste_inventario_negativo',
            notes: 'Entrada rápida pelo Terminal de Insumos'
          });
        });

      await Promise.all(promises);
      addToast(`${totalAdjustments} ajustes processados com sucesso.`, 'success');
      setAdjustments({});
      setIsConfirming(false);
    } catch (error) {
      console.error(error);
      addToast("Erro ao processar ajustes.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasChanges = totalAdjustments > 0;

  const categoryConfig: Record<CategoryType, { label: string, icon: any, color: string }> = {
    barras: { label: 'Barras e Tubos', icon: BarChart3, color: 'text-blue-600' },
    insumos: { label: 'Insumos', icon: Package, color: 'text-emerald-600' },
    moedas: { label: 'Moedas', icon: Database, color: 'text-amber-600' },
    segredos: { label: 'Segredos', icon: Key, color: 'text-purple-600' },
    outros: { label: 'Outros', icon: Search, color: 'text-gray-600' }
  };

  return (
    <div className="h-full flex flex-col font-sans max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Entrada Rápida</h2>
          <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Controle ágil de estoque: Barras, Insumos, Moedas e Segredos</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 w-full md:w-auto">
          {(Object.keys(categoryConfig) as CategoryType[]).map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); }}
              className={`flex-1 md:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {React.createElement(categoryConfig[cat].icon, { size: 14 })}
              <span className="hidden sm:inline">{categoryConfig[cat].label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <Input
          type="text"
          placeholder={`Buscar em ${categoryConfig[activeCategory].label}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 h-14 !bg-white !border-slate-200 rounded-2xl text-lg font-medium shadow-sm transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
        {filteredComponents.length > 0 ? filteredComponents.map(item => (
          <Card key={item.id} className="p-4 flex flex-col justify-between hover:shadow-md transition-shadow border-slate-200 bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 uppercase truncate leading-none mb-1">{item.name}</h4>
                <p className="text-[10px] font-mono font-bold text-slate-400">{item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Estoque Atual</p>
                <p className="text-lg font-black text-slate-900">{item.stock}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleAdjust(item.id, -1)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 hover:bg-rose-100 hover:text-rose-600 transition-colors"
              >
                <Minus size={18} />
              </button>
              
              <Input
                type="number"
                value={adjustments[item.id] || ''}
                placeholder="0"
                onChange={e => handleInputChange(item.id, e.target.value)}
                className="flex-1 h-10 text-center font-black text-lg !bg-slate-50 !border-slate-100 focus:!border-blue-500"
              />
              
              <button 
                onClick={() => handleAdjust(item.id, 1)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="flex gap-1 mt-2">
              {[5, 10, 50].map(n => (
                <button 
                  key={n}
                  onClick={() => handleAdjust(item.id, n)}
                  className="flex-1 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
                >
                  +{n}
                </button>
              ))}
            </div>
          </Card>
        )) : (
          <div className="col-span-full py-20 text-center text-slate-400">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium uppercase text-xs tracking-widest">Nenhum item encontrado nesta categoria</p>
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50 animate-bounce-in">
          <Card className="p-4 bg-slate-900 text-white shadow-2xl border-none ring-4 ring-blue-500/20">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-2xl font-black">{totalAdjustments}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alterações Pendentes</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="!bg-slate-800 !text-slate-400 border-none" onClick={() => setAdjustments({})}>Cancelar</Button>
                <Button className="bg-blue-600 hover:bg-blue-500 px-8" onClick={() => setIsConfirming(true)}>Aplicar Ajustes</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirming}
        onClose={() => setIsConfirming(false)}
        onConfirm={handleSave}
        isConfirming={isProcessing}
        title="Confirmar Ajustes de Estoque"
        confirmText="Confirmar e Salvar"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Você está prestes a aplicar <span className="font-black text-slate-900">{totalAdjustments}</span> alterações no estoque. Deseja continuar?</p>
          <div className="max-h-40 overflow-y-auto border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(adjustments).filter(([_, v]) => v !== 0).map(([id, val]) => {
                  const comp = inventory.components.find(c => c.id === id);
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2 font-medium truncate max-w-[200px]">{comp?.name}</td>
                      <td className={`px-3 py-2 text-right font-black ${val > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {val > 0 ? '+' : ''}{val}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ConfirmationModal>
    </div>
  );
};
