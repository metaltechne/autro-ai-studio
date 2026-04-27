
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { InventoryHook, Kit, KitComponent, Component, FamiliaComponente } from '../types';

interface KitEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (kit: Kit | Omit<Kit, 'id'>) => Promise<void>;
  kitToEdit: Kit | null;
  inventory: InventoryHook;
}

const emptyKit: Omit<Kit, 'id'> = {
  name: '',
  sku: '',
  marca: '',
  modelo: '',
  ano: '',
  components: [],
  requiredFasteners: [],
  sellingPriceOverride: undefined,
};

export const KitEditModal: React.FC<KitEditModalProps> = ({ isOpen, onClose, onSave, kitToEdit, inventory }) => {
  const [kitData, setKitData] = useState<Kit | Omit<Kit, 'id'>>(kitToEdit || emptyKit);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for different component types
  const [newStandardComponentSku, setNewStandardComponentSku] = useState('');
  const [newStandardComponentQty, setNewStandardComponentQty] = useState(1);
  const [newPackagingSku, setNewPackagingSku] = useState('');
  const [newPackagingQty, setNewPackagingQty] = useState(1);
  const [newFastenerDim, setNewFastenerDim] = useState('');
  const [newFastenerQty, setNewFastenerQty] = useState(1);
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleResult, setNewRuleResult] = useState('');

  const { components: allComponents } = inventory;
  const componentSkuMap = useMemo(() => new Map(allComponents.filter(c => !!c.sku).map(c => [c.sku.toUpperCase(), c])), [allComponents]);

  // Separate component lists for dropdowns
  const standardComponents = useMemo(() => allComponents.filter(c => c.familiaId !== 'fam-embalagens').sort((a,b) => a.name.localeCompare(b.name)), [allComponents]);
  const packagingComponents = useMemo(() => allComponents.filter(c => c.familiaId === 'fam-embalagens').sort((a,b) => a.name.localeCompare(b.name)), [allComponents]);

  const generatorFamilias = useMemo(() => {
    const all = (inventory.familias || []).filter(f => 
        f.nodes?.some(n => n.data.type === 'productGenerator' || n.data.type === 'productGeneratorNode')
    );

    if (all.some(f => !!f.masterProcessTag)) {
        return all.filter(f => !!f.masterProcessTag);
    }

    return all.filter(f => {
        const nome = f.nome?.toUpperCase() || '';
        const isSubProcess = nome.includes('CABO') || nome.includes('HASTE') || nome.includes('SEGREDO') || nome.includes('CORPO CHAVE');
        return !isSubProcess;
    });
  }, [inventory.familias]);

  const groupedFamilies = useMemo(() => {
    const groups: Record<string, FamiliaComponente[]> = {
        'FIX-P': [],
        'FIX-S': [],
        'FIX-S EXT': [],
        'Generico': []
    };
    generatorFamilias.forEach(f => {
        const tag = f.masterProcessTag;
        if (tag && groups[tag]) {
            groups[tag].push(f);
        } else {
            const nome = f.nome?.toUpperCase() || '';
            if (nome.includes('FIX-S EXT') || nome.includes('FIX S EXT')) {
                groups['FIX-S EXT'].push(f);
            } else if (nome.includes('FIX-S') || nome.includes('FIX S')) {
                groups['FIX-S'].push(f);
            } else if (nome.includes('FIX-P') || nome.includes('FIX P') || nome.includes('POR-P') || nome.includes('POR P')) {
                groups['FIX-P'].push(f);
            } else {
                groups['Generico'].push(f);
            }
        }
    });
    return groups;
  }, [generatorFamilias]);

  // Separate component lists for display within the kit
  const kitStandardComponents = useMemo(() => kitData.components.filter((kc: KitComponent) => kc.componentSku && (componentSkuMap.get(kc.componentSku.toUpperCase()) as Component | undefined)?.familiaId !== 'fam-embalagens'), [kitData.components, componentSkuMap]);
  const kitPackagingComponents = useMemo(() => kitData.components.filter((kc: KitComponent) => kc.componentSku && (componentSkuMap.get(kc.componentSku.toUpperCase()) as Component | undefined)?.familiaId === 'fam-embalagens'), [kitData.components, componentSkuMap]);


  useEffect(() => {
    setKitData(kitToEdit || emptyKit);
    // Reset local state when modal opens/kit changes
    setNewStandardComponentSku('');
    setNewStandardComponentQty(1);
    setNewPackagingSku('');
    setNewPackagingQty(1);
    setNewFastenerDim('');
    setNewFastenerQty(1);
    setNewRuleCondition('');
    setNewRuleResult('');
    setIsSaving(false);
  }, [kitToEdit, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if (name === 'sellingPriceOverride') {
        setKitData(prev => ({
            ...prev,
            sellingPriceOverride: value === '' ? undefined : parseFloat(value)
        }));
    } else {
        setKitData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddComponent = (sku: string, qty: number) => {
    if (!sku || qty <= 0) return;
    if(kitData.components.some(c => c.componentSku === sku)) {
        alert("Este componente já foi adicionado ao kit.");
        return;
    }
    const newKitComponent: KitComponent = { componentSku: sku, quantity: qty };
    setKitData(prev => ({
      ...prev,
      components: [...prev.components, newKitComponent],
    }));
    // Reset respective inputs
    if (packagingComponents.some(p => p.sku === sku)) {
        setNewPackagingSku('');
        setNewPackagingQty(1);
    } else {
        setNewStandardComponentSku('');
        setNewStandardComponentQty(1);
    }
  };

  const handleRemoveComponent = (componentSkuToRemove: string) => {
    setKitData(prev => ({
      ...prev,
      components: prev.components.filter(c => c.componentSku !== componentSkuToRemove),
    }));
  };
  
  const handleAddFastener = () => {
    const trimmedDim = newFastenerDim.trim();
    if (!trimmedDim.match(/^\d+x\d+(mm)?$/i) || newFastenerQty <= 0) {
        alert("Por favor, insira a dimensão no formato correto (ex: 8x40 ou 8x40mm) e uma quantidade válida.");
        return;
    }
    
    const normalizedDim = trimmedDim.toLowerCase().endsWith('mm') ? trimmedDim.toLowerCase() : `${trimmedDim.toLowerCase()}mm`;
    
    if((kitData.requiredFasteners || []).some(f => f.dimension === normalizedDim)) {
        alert("Esta dimensão de fixador já foi adicionada ao kit.");
        return;
    }

    const newRequiredFastener = { dimension: normalizedDim, quantity: newFastenerQty };
    setKitData(prev => ({
      ...prev,
      requiredFasteners: [...(prev.requiredFasteners || []), newRequiredFastener],
    }));
    setNewFastenerDim('');
    setNewFastenerQty(1);
  };

  const handleRemoveFastener = (dimensionToRemove: string) => {
    setKitData(prev => ({
      ...prev,
      requiredFasteners: (prev.requiredFasteners || []).filter(f => f.dimension !== dimensionToRemove),
    }));
  };

  const handleAddRule = () => {
    if (!newRuleCondition.trim() || !newRuleResult.trim()) {
      alert("Por favor, preencha tanto a condição quanto o resultado da regra.");
      return;
    }
    const newRule = { condition: newRuleCondition.trim(), result: newRuleResult.trim() };
    setKitData(prev => ({
      ...prev,
      compatibilityRules: [...(prev.compatibilityRules || []), newRule],
    }));
    setNewRuleCondition('');
    setNewRuleResult('');
  };

  const handleRemoveRule = (index: number) => {
    setKitData(prev => ({
      ...prev,
      compatibilityRules: (prev.compatibilityRules || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!kitData.name || !kitData.sku) {
      alert('Por favor, preencha o Nome do Kit e o SKU.');
      return;
    }
    setIsSaving(true);
    await onSave(kitData);
    onClose();
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={kitToEdit ? 'Editar Kit' : 'Adicionar Novo Kit'} size="2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome do Kit" name="name" value={kitData.name} onChange={handleInputChange} />
            <Input label="SKU" name="sku" value={kitData.sku} onChange={handleInputChange} />
            <Input label="Marca" name="marca" value={kitData.marca} onChange={handleInputChange} />
            <Input label="Modelo" name="modelo" value={kitData.modelo} onChange={handleInputChange} />
            <Input label="Ano" name="ano" value={kitData.ano} onChange={handleInputChange} />
            <Input
                label="Preço de Venda Manual (Opcional)"
                name="sellingPriceOverride"
                type="number"
                step="0.01"
                placeholder="Deixe em branco para cálculo automático"
                value={kitData.sellingPriceOverride ?? ''}
                onChange={handleInputChange}
            />
            <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-800 uppercase tracking-tight mb-2">Processo para Parafusos/Hastes</label>
                    <select 
                        name="selectedFamiliaId" 
                        value={kitData.selectedFamiliaId || ''} 
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-autro-blue focus:ring-4 focus:ring-autro-blue/10 appearance-none transition-all"
                    >
                        <option value="">Padrão (Automático)</option>
                        {Object.entries(groupedFamilies).map(([tag, families]) => {
                            const fams = families as FamiliaComponente[];
                            return fams.length > 0 && (
                                <optgroup key={`parafuso-${tag}`} label={tag === 'Generico' ? 'Outros Processos' : `Linha ${tag}`}>
                                    {fams.map(f => (
                                        <option key={f.id} value={f.id}>{f.nome}</option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-800 uppercase tracking-tight mb-2">Processo para Porcas</label>
                    <select 
                        name="selectedNutFamiliaId" 
                        value={kitData.selectedNutFamiliaId || ''} 
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-autro-blue focus:ring-4 focus:ring-autro-blue/10 appearance-none transition-all"
                    >
                        <option value="">Detecção Automática</option>
                        {Object.entries(groupedFamilies).map(([tag, families]) => {
                            const fams = families as FamiliaComponente[];
                            return fams.length > 0 && (
                                <optgroup key={`porca-${tag}`} label={tag === 'Generico' ? 'Outros Processos' : `Linha ${tag}`}>
                                    {fams.map(f => (
                                        <option key={f.id} value={f.id}>{f.nome}</option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
                <div className="col-span-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 px-1">
                        {kitData.selectedFamiliaId || kitData.selectedNutFamiliaId
                          ? "⚠️ Este kit usará processos EXCLUSIVOS para geração e baixa de estoque." 
                          : "✓ Este kit usará as famílias mestre definidas pelas heurísticas base."}
                    </p>
                </div>
            </div>
        </div>
        
        {/* Standard Components */}
        <div className="border-t pt-4">
            <h4 className="text-md font-semibold mb-2 text-black">Componentes Padrão (Copos, Tampas, etc.)</h4>
            <div className="space-y-2 mb-4">
                {kitStandardComponents.map((kc: KitComponent) => {
                    const component = componentSkuMap.get(kc.componentSku.toUpperCase()) as Component | undefined;
                    return (
                        <div key={kc.componentSku} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                             <div>
                                <span className="font-medium text-black">{kc.quantity}x</span>
                                <span className="ml-2 text-black">{component?.name || 'Componente inválido'}</span>
                                <span className="ml-2 text-xs text-gray-500">(SKU: {component?.sku})</span>
                            </div>
                            <Button variant="danger" onClick={() => handleRemoveComponent(kc.componentSku)} className="px-2 py-1 text-xs">Remover</Button>
                        </div>
                    );
                })}
                {kitStandardComponents.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Nenhum componente padrão adicionado.</p>}
            </div>
            <div className="border-t pt-4">
                <h4 className="text-md font-semibold mb-2 text-black">Adicionar Componente Padrão</h4>
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-black mb-1">Componente</label>
                        <select value={newStandardComponentSku} onChange={(e) => setNewStandardComponentSku(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-autro-blue focus:border-autro-blue">
                            <option value="" disabled>Selecione...</option>
                            {standardComponents.map((c: Component) => <option key={c.id} value={c.sku}>{c.name} (SKU: {c.sku})</option>)}
                        </select>
                    </div>
                    <div className="w-24">
                        <Input label="Qtd." type="number" min="1" value={newStandardComponentQty} onChange={e => setNewStandardComponentQty(parseInt(e.target.value, 10) || 1)} />
                    </div>
                    <Button onClick={() => handleAddComponent(newStandardComponentSku, newStandardComponentQty)} variant="secondary">Adicionar</Button>
                </div>
            </div>
        </div>
        
        {/* Packaging Components */}
        <div className="border-t pt-4">
            <h4 className="text-md font-semibold mb-2 text-black">Itens de Embalagem</h4>
            <div className="space-y-2 mb-4">
                {kitPackagingComponents.map((kc: KitComponent) => {
                    const component = componentSkuMap.get(kc.componentSku.toUpperCase()) as Component | undefined;
                    return (
                        <div key={kc.componentSku} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div>
                                <span className="font-medium text-black">{kc.quantity}x</span>
                                <span className="ml-2 text-black">{component?.name || 'Item inválido'}</span>
                                <span className="ml-2 text-xs text-gray-500">(SKU: {component?.sku})</span>
                            </div>
                            <Button variant="danger" onClick={() => handleRemoveComponent(kc.componentSku)} className="px-2 py-1 text-xs">Remover</Button>
                        </div>
                    );
                })}
                {kitPackagingComponents.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Nenhum item de embalagem adicionado.</p>}
            </div>
            <div className="border-t pt-4">
                <h4 className="text-md font-semibold mb-2 text-black">Adicionar Item de Embalagem</h4>
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-black mb-1">Embalagem</label>
                        <select value={newPackagingSku} onChange={(e) => setNewPackagingSku(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-autro-blue focus:border-autro-blue">
                            <option value="" disabled>Selecione...</option>
                            {packagingComponents.map((c: Component) => <option key={c.id} value={c.sku}>{c.name} (SKU: {c.sku})</option>)}
                        </select>
                    </div>
                    <div className="w-24">
                        <Input label="Qtd." type="number" min="1" value={newPackagingQty} onChange={e => setNewPackagingQty(parseInt(e.target.value, 10) || 1)} />
                    </div>
                    <Button onClick={() => handleAddComponent(newPackagingSku, newPackagingQty)} variant="secondary">Adicionar</Button>
                </div>
            </div>
        </div>

         <div className="border-t pt-4">
            <h4 className="text-md font-semibold mb-2 text-black">Fixadores Necessários</h4>
            <div className="space-y-2 mb-4">
                {(kitData.requiredFasteners || []).map((rf: { dimension: string; quantity: number }) => (
                    <div key={rf.dimension} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div>
                            <span className="font-medium text-black">{rf.quantity}x</span>
                            <span className="ml-2 text-black">{rf.dimension}</span>
                        </div>
                        <Button variant="danger" onClick={() => handleRemoveFastener(rf.dimension)} className="px-2 py-1 text-xs">
                            Remover
                        </Button>
                    </div>
                ))}
                {(kitData.requiredFasteners || []).length === 0 && <p className="text-sm text-gray-500 text-center py-2">Nenhum fixador necessário adicionado.</p>}
            </div>

            <div className="border-t pt-4">
                 <h4 className="text-md font-semibold mb-2 text-black">Adicionar Fixador Necessário</h4>
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <Input 
                          label="Dimensão" 
                          placeholder="Ex: 8x40"
                          value={newFastenerDim} 
                          onChange={e => setNewFastenerDim(e.target.value)} 
                        />
                    </div>
                    <div className="w-24">
                        <Input label="Qtd." type="number" min="1" value={newFastenerQty} onChange={e => setNewFastenerQty(parseInt(e.target.value, 10) || 1)} />
                    </div>
                    <Button onClick={handleAddFastener} variant="secondary">Adicionar</Button>
                </div>
            </div>
        </div>

        {/* Compatibility Rules */}
        <div className="border-t pt-4">
            <h4 className="text-md font-semibold mb-2 text-black">Regras de Compatibilidade</h4>
            <div className="space-y-2 mb-4">
                {(kitData.compatibilityRules || []).map((rule, index) => (
                    <div key={rule.condition + rule.result} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                        <div className="flex-grow">
                            <span className="text-xs font-bold text-autro-blue uppercase tracking-wider">Se:</span>
                            <span className="ml-1 text-sm text-black">{rule.condition}</span>
                            <span className="mx-2 text-gray-300">|</span>
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Resultado:</span>
                            <span className="ml-1 text-sm text-black">{rule.result}</span>
                        </div>
                        <Button variant="danger" onClick={() => handleRemoveRule(index)} className="px-2 py-1 text-xs ml-2">
                            Remover
                        </Button>
                    </div>
                ))}
                {(kitData.compatibilityRules || []).length === 0 && <p className="text-sm text-gray-500 text-center py-2">Nenhuma regra de compatibilidade definida.</p>}
            </div>

            <div className="border-t pt-4">
                 <h4 className="text-md font-semibold mb-2 text-black">Adicionar Regra de Compatibilidade</h4>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input 
                          label="Condição (Ex: 'Se motor 2.0')" 
                          placeholder="Ex: Motor 2.0"
                          value={newRuleCondition} 
                          onChange={e => setNewRuleCondition(e.target.value)} 
                        />
                        <Input 
                          label="Resultado (Ex: 'Usar parafuso 10x50')" 
                          placeholder="Ex: Usar parafuso 10x50"
                          value={newRuleResult} 
                          onChange={e => setNewRuleResult(e.target.value)} 
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAddRule} variant="secondary">Adicionar Regra</Button>
                    </div>
                </div>
            </div>
        </div>
      </div>
       <div className="flex justify-end pt-6 border-t mt-4">
            <Button onClick={onClose} variant="secondary" className="mr-2" disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Kit'}
            </Button>
        </div>
    </Modal>
  );
};
