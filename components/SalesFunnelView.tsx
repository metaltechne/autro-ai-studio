import React, { useState } from 'react';
import { Deal, DealStage, Lead, Kit, InventoryHook, ProductionOrdersHook, ManufacturingHook, ManufacturingOrdersHook, PurchaseOrdersHook, ProductionScenarioShortage, ManufacturingAnalysis, PurchaseRecommendation } from '../types';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useKitPricing } from '../hooks/useKitPricing';
import { useToast } from '../hooks/useToast';
import { generateQuotePDF } from '../src/utils/pdfGenerator';
import { exportToBlingCSV } from '../src/utils/blingExport';
import { Plus, Phone, Mail, Building, DollarSign, Calendar, MessageCircle, MoreVertical, Package, X, ShoppingCart, FileDown, ExternalLink, RefreshCw, Database, Cloud, AlertTriangle } from 'lucide-react';
import { DealModal } from './DealModal';
import { useFinancials } from '../contexts/FinancialsContext';
import { ConfirmationModal } from './ui/ConfirmationModal';

const STAGES: DealStage[] = ['Novo Lead', 'Em Contato', 'Proposta Enviada', 'Negociação', 'Ganho', 'Perdido'];

interface SalesFunnelViewProps {
    inventory?: InventoryHook;
    productionOrdersHook?: ProductionOrdersHook;
    manufacturing?: ManufacturingHook;
    manufacturingOrdersHook?: ManufacturingOrdersHook;
    purchaseOrdersHook?: PurchaseOrdersHook;
}

export const SalesFunnelView: React.FC<SalesFunnelViewProps> = ({ 
    inventory, 
    productionOrdersHook,
    manufacturing,
    manufacturingOrdersHook,
    purchaseOrdersHook
}) => {
    const { 
        deals, 
        leads, 
        updateDealStage, 
        isLoading, 
        isDirty, 
        savingStatus, 
        lastSync, 
        isOutdated, 
        saveChanges, 
        loadData, 
        discardDrafts 
    } = useSalesFunnel();
    const { getKitPrice } = useKitPricing();
    const { addToast } = useToast();
    const { settings } = useFinancials();
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
    const [isAddingDeal, setIsAddingDeal] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | undefined>(undefined);
    const [isConverting, setIsConverting] = useState(false);
    
    const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
    const [isDiscardDraftConfirmOpen, setIsDiscardDraftConfirmOpen] = useState(false);

    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        setDraggedDealId(dealId);
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', dealId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, stage: DealStage) => {
        e.preventDefault();
        if (draggedDealId) {
            const deal = deals.find(d => d.id === draggedDealId);
            if (deal && deal.stage !== stage) {
                updateDealStage(draggedDealId, stage);
                addToast(`Negócio "${deal.title || 'Sem título'}" movido para ${stage}. Salvando...`, "success");
            }
            setDraggedDealId(null);
        }
    };

    const getLeadForDeal = (leadId: string) => leads.find(l => l.id === leadId);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const handleGenerateQuote = async (deal: Deal) => {
        if (!inventory) return;
        if (!deal.items || deal.items.length === 0) {
            addToast("O negócio não possui itens para gerar orçamento.", "warning");
            return;
        }

        try {
            const lead = getLeadForDeal(deal.leadId);
            const clientName = lead ? lead.name : 'Cliente';
            
            const items = deal.items.map(item => {
                const searchId = item.id || (item.type === 'kit' ? item.kitId : item.componentId);
                const kit = item.type === 'kit' 
                    ? inventory.kits.find(k => k.id === searchId) 
                    : inventory.components.find(c => c.id === searchId);
                const price = item.type === 'kit' 
                    ? (getKitPrice(searchId || '') || 0)
                    : ((kit as any)?.custoFabricacao || 0);
                return { kit, quantity: item.quantity, price };
            });

            await generateQuotePDF(clientName, deal.title, items, deal.value, deal.taxValue, deal.shippingValue, deal.taxDetails, deal.vehicleDetails);
            addToast("Orçamento gerado com sucesso!", "success");
        } catch (error: any) {
            console.error("Error generating PDF:", error);
            addToast(`Erro ao gerar orçamento: ${error.message}`, "error");
        }
    };

    const handleConvertToOrder = async (deal: Deal) => {
        if (!productionOrdersHook || !inventory || !manufacturing || !manufacturingOrdersHook || !purchaseOrdersHook) {
            addToast('Sistema não está totalmente carregado para gerar pedidos.', 'error');
            return;
        }

        if (!deal.items || deal.items.length === 0) {
            addToast('Não é possível converter: o negócio não possui kits.', 'warning');
            return;
        }

        setIsConverting(true);

        try {
            const orderItems = deal.items.map(item => ({
                id: item.id,
                type: item.type,
                quantity: item.quantity,
                variant: 'Padrão' as const
            }));

            // 1. Analyze Production Run to get shortages
            const analysis = inventory.analyzeProductionRun(
                orderItems,
                [], // no extra items
                manufacturing.familias || [],
                inventory.components,
                settings
            );

            // Select the best scenario (usually the first one, or 'S' head)
            const scenario = analysis.scenarios.find(s => s.isPossible) || analysis.scenarios[0];
            
            if (!scenario) {
                addToast('Não foi possível gerar cenários de produção para este pedido.', 'error');
                setIsConverting(false);
                return;
            }

            // 2. Create Production Order
            const newOrderId = await productionOrdersHook.addProductionOrder({
                orderItems,
                selectedScenario: scenario,
                virtualComponents: analysis.virtualComponents,
                scannedItems: {},
                substitutions: {},
                installments: [],
                notes: `Pedido gerado a partir da oportunidade: ${deal.title}`,
                customerId: deal.leadId,
                saleDetails: {
                    customerName: getLeadForDeal(deal.leadId)?.name || 'Cliente',
                    customerPhone: getLeadForDeal(deal.leadId)?.phone || '',
                    customerAddress: '',
                    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    paymentMethod: 'Pix',
                    totalAmount: deal.value,
                    discount: 0,
                    shippingCost: 0,
                    sellingPrice: deal.value,
                    profit: 0,
                    totalTaxes: 0,
                    taxBreakdown: [],
                    isOverridden: false,
                    contributionMargin: 0,
                    contributionMarginPercentage: 0,
                }
            });

            if (!newOrderId) throw new Error("Failed to create Production Order");

            // 3. Generate Needs (Manufacturing & Purchase)
            const shortages = scenario.shortages;
            if (shortages.length > 0) {
                const toManufacture: ProductionScenarioShortage[] = [];
                const directToPurchase: ProductionScenarioShortage[] = [];

                for (const shortage of shortages) {
                    let component = inventory.findComponentById(shortage.componentId);
                    if (!component) {
                        component = analysis.virtualComponents.find(vc => vc.id === shortage.componentId);
                    }

                    if (component) {
                        if (component.sourcing === 'purchased' || component.type === 'raw_material') {
                            directToPurchase.push(shortage);
                        } else {
                            toManufacture.push(shortage);
                        }
                    }
                }

                let manufacturingOrderAnalysis: ManufacturingAnalysis | null = null;
                if (toManufacture.length > 0) {
                    const moItems = toManufacture.map(s => {
                        let component = inventory.findComponentById(s.componentId);
                        if (!component && s.componentId.startsWith('comp-virtual-')) {
                            component = analysis.virtualComponents.find(vc => vc.id === s.componentId);
                        }
                        return { 
                            componentId: s.componentId, 
                            quantity: s.shortage,
                            name: s.componentName,
                            sku: component?.sku || s.componentId.replace('comp-virtual-', '')
                        };
                    });
                    manufacturingOrderAnalysis = manufacturing.analyzeManufacturingRun(moItems, inventory.components, analysis.virtualComponents);
                    await manufacturingOrdersHook.addManufacturingOrder(moItems, manufacturingOrderAnalysis);
                }

                const purchaseMap = new Map<string, PurchaseRecommendation>();
                
                (directToPurchase || []).forEach(s => {
                    let component = inventory.findComponentById(s.componentId);
                    if (!component) {
                        component = analysis.virtualComponents.find(vc => vc.id === s.componentId);
                    }
                    
                    if (component) {
                        purchaseMap.set(s.componentId, {
                            componentId: s.componentId, name: s.componentName, sku: component.sku,
                            sourcing: component.sourcing || 'purchased', required: s.required, inStock: s.available,
                            toOrder: s.shortage, abcClass: 'C',
                        });
                    }
                });
    
                if (manufacturingOrderAnalysis) {
                    const manufacturingShortages = (manufacturingOrderAnalysis.requirements || [])
                        .filter(req => req.shortage > 0 && req.type !== 'etapaFabricacao');
                    
                    (manufacturingShortages || []).forEach(req => {
                        let component = inventory.findComponentById(req.id);
                        if (!component) {
                            component = analysis.virtualComponents.find(vc => vc.id === req.id);
                        }
                        if (component) {
                            if (purchaseMap.has(req.id)) {
                                const existing = purchaseMap.get(req.id)!;
                                existing.required += req.quantity;
                                existing.toOrder += req.shortage;
                            } else {
                                purchaseMap.set(req.id, {
                                    componentId: req.id, name: req.name, sku: component.sku,
                                    sourcing: component.sourcing || 'purchased', required: req.quantity, inStock: req.stock,
                                    toOrder: req.shortage, abcClass: 'C',
                                });
                            }
                        }
                    });
                }

                const finalPurchaseRecommendations = Array.from(purchaseMap.values());
                if (finalPurchaseRecommendations.length > 0) {
                    const expectedDeliveryDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    await purchaseOrdersHook.addPurchaseOrder(finalPurchaseRecommendations, expectedDeliveryDate);
                }
            }

            addToast(`Pedido ${newOrderId} gerado com sucesso! Necessidades de fabricação e compra foram criadas.`, 'success');
        } catch (error) {
            console.error('Erro ao gerar pedido:', error);
            addToast('Erro ao gerar pedido e necessidades.', 'error');
        } finally {
            setIsConverting(false);
        }
    };

    const handleRefresh = () => {
        if (isDirty) {
            setIsRefreshConfirmOpen(true);
        } else {
            loadData();
        }
    };

    const handleDiscardDraft = () => {
        if (isDirty) {
            setIsDiscardDraftConfirmOpen(true);
        }
    };

    const performRefreshFromCloud = async () => {
        setIsRefreshConfirmOpen(false);
        discardDrafts();
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <RefreshCw className="w-12 h-12 text-autro-primary animate-spin" />
                <p className="text-slate-500 font-medium">Carregando funil de vendas...</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Funil de Vendas (CRM)</h1>
                        <p className="text-slate-500">Gerencie suas oportunidades de negócio</p>
                    </div>
                    
                    {/* Sync Status Indicators */}
                    <div className="flex items-center gap-2 ml-4 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                        {savingStatus === 'saving' ? (
                            <div className="flex items-center text-blue-600 text-xs font-bold">
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                SALVANDO...
                            </div>
                        ) : isDirty ? (
                            <div className="flex items-center text-amber-600 text-xs font-bold animate-pulse">
                                <Database className="w-3.5 h-3.5 mr-1.5" />
                                RASCUNHO LOCAL
                            </div>
                        ) : (
                            <div className="flex items-center text-emerald-600 text-xs font-bold">
                                <Cloud className="w-3.5 h-3.5 mr-1.5" />
                                NUVEM SINCRONIZADA
                            </div>
                        )}
                        
                        {isOutdated && (
                            <div className="flex items-center text-red-600 text-xs font-bold ml-2">
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                DESATUALIZADO
                            </div>
                        )}
                        
                        {lastSync && (
                            <span className="text-[10px] text-slate-400 ml-2 border-l border-slate-200 pl-2">
                                Sinc: {new Date(lastSync).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isDirty && (
                        <button
                            onClick={handleDiscardDraft}
                            className="flex items-center px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Descartar rascunho local"
                        >
                            <X className="w-5 h-5 mr-2" />
                            Descartar
                        </button>
                    )}
                    
                    <button
                        onClick={handleRefresh}
                        className={`flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors ${isOutdated ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                        title="Atualizar da nuvem"
                    >
                        <RefreshCw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>

                    <button
                        onClick={() => setIsAddingDeal(true)}
                        className="flex items-center px-4 py-2 bg-autro-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nova Oportunidade
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 h-full min-w-max pb-4">
                    {STAGES.map(stage => {
                        const stageDeals = deals.filter(d => d.stage === stage);
                        const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

                        return (
                            <div
                                key={stage}
                                className="w-80 flex flex-col bg-slate-100 rounded-xl overflow-hidden border border-slate-200"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage)}
                            >
                                <div className="p-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-semibold text-slate-700">{stage}</h3>
                                        <span className="bg-slate-200 text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                                            {stageDeals.length}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">{formatCurrency(totalValue)}</p>
                                </div>

                                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                                    {stageDeals.map(deal => {
                                        const lead = getLeadForDeal(deal.leadId);
                                        return (
                                            <div
                                                key={deal.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                                className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-autro-primary transition-colors group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-medium text-slate-800 line-clamp-2">{deal.title}</h4>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingDeal(deal);
                                                            setIsAddingDeal(true);
                                                        }}
                                                        className="text-slate-400 hover:text-autro-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="text-lg font-bold text-slate-700 mb-3">
                                                    {formatCurrency(deal.value)}
                                                </div>
                                                {deal.items && deal.items.length > 0 && (
                                                    <div className="mb-3">
                                                        <div className="flex items-center text-xs font-medium text-slate-500 mb-1">
                                                            <Package className="w-3.5 h-3.5 mr-1" />
                                                            Kits Inclusos ({deal.items.length})
                                                        </div>
                                                        <div className="space-y-1">
                                                            {deal.items.map(item => {
                                                                const kit = inventory?.kits.find(k => k.id === item.kitId);
                                                                return (
                                                                    <div key={item.kitId} className="text-xs text-slate-600 flex justify-between bg-slate-50 p-1.5 rounded" title={kit?.name}>
                                                                        <span className="truncate pr-2 font-mono text-[10px]">{item.quantity} {kit?.sku || 'SKU'}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {lead && (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center text-sm text-slate-600">
                                                            <Building className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                                            <span className="truncate">{lead.name}</span>
                                                        </div>
                                                        {lead.phone && (
                                                            <div className="flex items-center text-sm text-slate-600">
                                                                <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                                                <span>{lead.phone}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(deal.createdAt).toLocaleDateString('pt-BR')}
                                                        </span>
                                                        <a
                                                            href={`https://wa.me/${lead?.phone?.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-green-600 hover:text-green-700 bg-green-50 p-1.5 rounded-full"
                                                            title="Conversar no WhatsApp"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                    {deal.stage === 'Ganho' && deal.items && deal.items.length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isConverting) handleConvertToOrder(deal);
                                                            }}
                                                            disabled={isConverting}
                                                            className={`w-full mt-1 flex items-center justify-center py-1.5 text-white text-xs font-bold rounded transition-colors ${isConverting ? 'bg-slate-400 cursor-not-allowed' : 'bg-autro-primary hover:bg-blue-600'}`}
                                                        >
                                                            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                                                            {isConverting ? 'Gerando...' : 'Gerar Pedido'}
                                                        </button>
                                                    )}
                                                    {deal.items && deal.items.length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGenerateQuote(deal);
                                                            }}
                                                            className="w-full mt-1 flex items-center justify-center py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded transition-colors border border-slate-200"
                                                        >
                                                            <FileDown className="w-3.5 h-3.5 mr-1.5" />
                                                            Gerar Orçamento
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DealModal 
                isOpen={isAddingDeal} 
                onClose={() => {
                    setIsAddingDeal(false);
                    setEditingDeal(undefined);
                }} 
                inventory={inventory}
                existingDeal={editingDeal}
                productionOrdersHook={productionOrdersHook}
            />

            {/* Sync Confirmation Modals */}
            <ConfirmationModal
                isOpen={isRefreshConfirmOpen}
                onClose={() => setIsRefreshConfirmOpen(false)}
                onConfirm={performRefreshFromCloud}
                title="Atualizar da Nuvem"
                confirmText="Atualizar e Perder Rascunho"
                variant="danger"
            >
                <p>Você tem alterações não salvas. Se atualizar agora, perderá o rascunho local. Deseja continuar?</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isDiscardDraftConfirmOpen}
                onClose={() => setIsDiscardDraftConfirmOpen(false)}
                onConfirm={() => {
                    discardDrafts();
                    setIsDiscardDraftConfirmOpen(false);
                }}
                title="Descartar Rascunho"
                confirmText="Descartar Alterações"
                variant="danger"
            >
                <p>Tem certeza que deseja descartar todas as alterações locais do funil de vendas? Esta ação não pode ser desfeita.</p>
            </ConfirmationModal>
        </div>
    );
};
