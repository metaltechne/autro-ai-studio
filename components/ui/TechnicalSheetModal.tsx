
import React, { useMemo } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ScannedQRCodeData, InventoryHook, ManufacturingHook, Component, Kit, FamiliaComponente, KitComponent } from '../../types';
import { evaluateProcess, getComponentCost, parseFastenerSku } from '../../hooks/manufacturing-evaluator';

interface TechnicalSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedData: ScannedQRCodeData | null;
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const DataRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`flex justify-between items-start py-2.5 border-b ${className}`}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-black text-right font-semibold">{value}</dd>
    </div>
);

const BOMTreeItem: React.FC<{ 
    name: string; 
    sku: string; 
    quantity: number; 
    type: string; 
    level: number;
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
}> = ({ name, sku, quantity, type, level, inventory, manufacturing }) => {
    const component = inventory.findComponentBySku(sku);
    const subStructure = useMemo(() => {
        if (!component || !component.familiaId) return null;
        const familia = manufacturing.familias.find(f => f.id === component.familiaId);
        if (!familia) return null;
        const skuInfo = parseFastenerSku(sku);
        const variables = skuInfo ? { bitola: skuInfo.bitola, comprimento: skuInfo.comprimento } : {};
        const result = evaluateProcess(familia, variables, inventory.components);
        return result.nodes.filter(n => n.data.type === 'materiaPrima' || n.data.type === 'inventoryComponent');
    }, [component, sku, inventory, manufacturing]);

    return (
        <div className="mt-1">
            <div className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors ${level > 0 ? 'ml-6 border-l-2 border-slate-200 pl-4' : ''}`}>
                <div className="flex-grow min-w-0">
                    <p className={`text-sm font-bold truncate ${type === 'Fixador' ? 'text-indigo-700' : 'text-slate-900'}`}>
                        {quantity}x {name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{sku} • {type}</p>
                </div>
            </div>
            {subStructure && subStructure.map((node, idx) => {
                let subName = node.data.label;
                let subSku = "";
                let subType = "Insumo";
                if (node.data.type === 'materiaPrima' && node.data.baseMaterialId) {
                    const mat = inventory.findComponentById(node.data.baseMaterialId);
                    subSku = mat?.sku || ""; subName = mat?.name || subName; subType = "Matéria-Prima";
                } else if (node.data.type === 'inventoryComponent') {
                    subSku = node.data.componentId ? (inventory.findComponentById(node.data.componentId)?.sku || "") : (node.data.componentIdTemplate || "");
                    subType = "Subconjunto";
                }
                return (
                    <BOMTreeItem key={idx} name={subName} sku={subSku} quantity={node.data.consumption || 1} type={subType} level={level + 1} inventory={inventory} manufacturing={manufacturing} />
                );
            })}
        </div>
    );
};

const KitSheet: React.FC<{ kit: Kit; inventory: InventoryHook; manufacturing: ManufacturingHook }> = ({ kit, inventory, manufacturing }) => {
    return (
         <div className="space-y-6">
            <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">{kit.name}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Kit de Produto Acabado</p>
                <dl className="mb-4 bg-gray-50 p-4 rounded-xl">
                    <DataRow label="SKU" value={kit.sku} />
                    <DataRow label="Frota" value={`${kit.marca} ${kit.modelo}`} />
                    <DataRow label="Ano" value={kit.ano} />
                </dl>
            </div>

            <div>
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-autro-blue rounded-full"></div>
                    Composição e Árvore (BOM)
                </h4>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <div className="space-y-2">
                        {kit.components.map((c, i) => (
                            <BOMTreeItem key={`c-${i}`} name={inventory.findComponentBySku(c.componentSku)?.name || c.componentSku} sku={c.componentSku} quantity={c.quantity} type="Componente" level={0} inventory={inventory} manufacturing={manufacturing} />
                        ))}
                        {kit.requiredFasteners.map((f, i) => {
                            const isNut = f.dimension.includes('x0');
                            const label = isNut ? `Porca M${f.dimension.split('x')[0]}` : `Parafuso ${f.dimension}`;
                            return (
                                <div key={`f-${i}`} className={`flex items-center gap-2 p-2 rounded-lg border ml-0 ${isNut ? 'bg-amber-50/50 border-amber-100/50' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                                    <div className="flex-grow min-w-0">
                                        <p className={`text-sm font-black ${isNut ? 'text-amber-900' : 'text-indigo-900'}`}>
                                            {f.quantity}x {label}
                                        </p>
                                        <p className={`text-[10px] font-black uppercase tracking-tighter ${isNut ? 'text-amber-400' : 'text-indigo-400'}`}>{isNut ? 'Hardware / Porca' : 'Fixador / Hardware Padrão'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
};

export const TechnicalSheetModal: React.FC<TechnicalSheetModalProps> = ({ isOpen, onClose, scannedData, inventory, manufacturing }) => {
    const content = useMemo(() => {
        if (!scannedData) return null;
        const { type, id } = scannedData;
        switch (type) {
            case 'component': {
                const component = inventory.findComponentById(id);
                return component ? (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-black">{component.name}</h3>
                        <dl className="bg-gray-50 p-4 rounded-xl"><DataRow label="SKU" value={component.sku} /><DataRow label="Estoque" value={component.stock} /></dl>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                            <BOMTreeItem name={component.name} sku={component.sku} quantity={1} type="Item Pai" level={0} inventory={inventory} manufacturing={manufacturing} />
                        </div>
                    </div>
                ) : <p>Componente não encontrado.</p>;
            }
            case 'kit': {
                const kit = inventory.findKitById(id);
                return kit ? <KitSheet kit={kit} inventory={inventory} manufacturing={manufacturing} /> : <p>Kit não encontrado.</p>;
            }
            default: return <p>Tipo de QR Code inválido.</p>;
        }
    }, [scannedData, inventory, manufacturing]);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ficha Técnica & Estrutura">
            {content}
            <div className="flex justify-end pt-4 mt-4 border-t"><Button onClick={onClose} variant="secondary">Fechar</Button></div>
        </Modal>
    );
};
