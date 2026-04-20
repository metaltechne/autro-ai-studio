import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ProductionOrder, ManufacturingOrder, InventoryHook, ManufacturingOrderItem, ProductionOrderItem } from '../../types';
import { AUTRO_LOGO_URL } from '../../data/assets';

interface PickingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ProductionOrder | ManufacturingOrder | null;
  inventory: InventoryHook;
}

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

export const PickingListModal: React.FC<PickingListModalProps> = ({ isOpen, onClose, order, inventory }) => {
    if (!isOpen || !order) return null;

    const isProductionOrder = 'selectedScenario' in order;
    const orderType = isProductionOrder ? 'Ordem de Produção (Montagem)' : 'Ordem de Fabricação';
    
    const requirements = isProductionOrder
        ? order.selectedScenario.detailedRequirements.map(req => {
            let component = inventory.findComponentById(req.componentId);
            if (!component) {
                component = (order as ProductionOrder).virtualComponents.find(vc => vc.id === req.componentId);
            }
            
            let itemType = 'Componente'; // Default
            if (component) {
                if (component.type === 'raw_material') {
                    itemType = 'Matéria-Prima';
                } else if (component.familiaId === 'fam-fixadores') {
                    itemType = 'Fixador';
                }
            } else if (req.componentId.includes('virtual-FIX-')) {
                // Fallback for virtual fasteners if component object not found
                itemType = 'Fixador';
            }

            return {
                sku: component?.sku || 'N/A',
                name: req.componentName,
                quantity: req.required,
                stock: req.available,
                type: itemType,
            };
        })
        : order.analysis.requirements
            .filter(req => req.type !== 'etapaFabricacao') // Don't show services in picking list
            .map(req => ({
                sku: inventory.findComponentById(req.id)?.sku || 'N/A',
                name: req.name,
                quantity: req.quantity,
                stock: inventory.findComponentById(req.id)?.stock || 0,
                type: req.type === 'materiaPrima' ? 'Matéria-Prima' : 'Componente'
            }));

    const productsToMake = order.orderItems.map(item => {
        if (isProductionOrder) {
            const prodItem = item as ProductionOrderItem;
            // Try lookup by ID first, then SKU as fallback if ID looks like a SKU
            const product = inventory.findKitById(prodItem.id) || 
                          inventory.findKitBySku(prodItem.id) ||
                          inventory.findComponentById(prodItem.id) || 
                          inventory.findComponentBySku(prodItem.id) || 
                          (order as ProductionOrder).virtualComponents?.find(vc => vc.id === prodItem.id || vc.sku === prodItem.id);
            
            return {
                quantity: item.quantity,
                name: product?.name || (inventory.isLoading ? 'Carregando...' : `Item não encontrado (${prodItem.id || 'ID ausente'})`),
                sku: product?.sku || prodItem.id || '---'
            };
        } else { // ManufacturingOrder
            const componentId = (item as ManufacturingOrderItem).componentId;
            const product = inventory.findComponentById(componentId) || inventory.findComponentBySku(componentId);
            
            if (product) {
                return {
                    quantity: item.quantity,
                    name: product.name,
                    sku: product.sku
                };
            }
            
            // Fallback for virtual components
            const virtualIdPrefix = 'comp-virtual-';
            if (componentId && componentId.startsWith(virtualIdPrefix)) {
                const sku = componentId.substring(virtualIdPrefix.length);
                let name = `Componente Virtual (${sku})`;
                // Try to parse fastener name from SKU
                if (sku.startsWith('FIX-')) {
                    const parts = sku.split('-');
                    if (parts.length >= 3) {
                        const headCode = parts.slice(1, -1).join('-');
                        const dimension = parts[parts.length - 1];
                        name = `Fixador ${headCode} ${dimension}`;
                    }
                }
                return {
                    quantity: item.quantity,
                    name: name,
                    sku: sku
                };
            }
            
            // Default fallback
            return {
                quantity: item.quantity,
                name: inventory.isLoading ? 'Carregando...' : `Item não encontrado (${componentId || 'ID ausente'})`,
                sku: componentId || 'N/A'
            };
        }
    });

    const handlePrint = () => {
        const contentEl = document.getElementById('picking-list-content');
        if (!contentEl) return;
        
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Lista de Separação</title>');
            printWindow.document.write(`
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: black; }
                    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #002B8A; padding-bottom: 10px; }
                    .header img { height: 40px; }
                    .header h2 { margin: 0; font-size: 18px; font-weight: normal; }
                    .header-info { text-align: right; }
                    .section-title { font-size: 16px; font-weight: bold; color: #002B8A; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
                    ul { list-style-position: inside; padding-left: 0; }
                    .checkbox-col { width: 40px; text-align: center; }
                </style>
            `);
            printWindow.document.write('</head><body>');
            printWindow.document.write(contentEl.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Lista de Separação - ${order.id}`} size="3xl">
            <div id="picking-list-content" className="text-black">
                <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid rgb(0, 43, 138)', paddingBottom: '10px', marginBottom: '20px' }}>
                    <div>
                        <img src={AUTRO_LOGO_URL} alt="AUTRO Logo" style={{ height: '40px' }} />
                        <h2 style={{ margin: '0px', fontSize: '18px', fontWeight: 'normal' }}>{order.id}</h2>
                    </div>
                    <div className="header-info" style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0px' }}><strong>Tipo:</strong> {orderType}</p>
                        <p style={{ margin: '0px' }}><strong>Data de Emissão:</strong> {formatDateTime(new Date().toISOString())}</p>
                        <p style={{ margin: '0px' }}><strong>Data da Ordem:</strong> {formatDateTime(order.createdAt)}</p>
                    </div>
                </div>

                <h3 className="section-title" style={{ fontSize: '16px', fontWeight: 'bold', color: 'rgb(0, 43, 138)', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid rgb(204, 204, 204)', paddingBottom: '4px' }}>Itens para Produção</h3>
                <ul className="space-y-1" style={{ listStylePosition: 'inside', paddingLeft: '0px' }}>
                    {productsToMake.map((product, index) => (
                        <li key={index}>
                            <strong>{product.quantity}x</strong> {product.name} (SKU: {product.sku})
                        </li>
                    ))}
                </ul>

                <h3 className="section-title" style={{ fontSize: '16px', fontWeight: 'bold', color: 'rgb(0, 43, 138)', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid rgb(204, 204, 204)', paddingBottom: '4px' }}>Materiais Necessários</h3>
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">OK</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd.</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {requirements.sort((a,b) => a.name.localeCompare(b.name)).map((req, index) => (
                            <tr key={index}>
                                <td className="px-2 py-2 text-center align-middle">
                                    <div className="w-4 h-4 border border-gray-400 rounded-sm mx-auto"></div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-gray-600 font-mono">{req.sku}</td>
                                <td className="px-4 py-2 whitespace-nowrap font-medium text-black">{req.name}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-gray-600">{req.type}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-black">{req.quantity}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600">{req.stock}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {isProductionOrder && (order as ProductionOrder).selectedScenario.substitutionsMade.length > 0 && (
                    <>
                        <h3 className="section-title" style={{ fontSize: '16px', fontWeight: 'bold', color: 'rgb(0, 43, 138)', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid rgb(204, 204, 204)', paddingBottom: '4px' }}>Substituições por Corte</h3>
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">OK</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item a ser Cortado (Fonte)</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item a ser Produzido (Alvo)</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {(order as ProductionOrder).selectedScenario.substitutionsMade.map((sub, index) => (
                                    <tr key={index}>
                                        <td className="px-2 py-2 text-center align-middle"><div className="w-4 h-4 border border-gray-400 rounded-sm mx-auto"></div></td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-black">{sub.from.name} (SKU: {sub.from.sku})</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-black">{sub.to.name} (SKU: {sub.to.sku})</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-bold text-black">{sub.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t gap-2 print-hide">
                <Button variant="secondary" onClick={onClose}>Fechar</Button>
                <Button onClick={handlePrint}>Imprimir Lista</Button>
            </div>
        </Modal>
    );
};