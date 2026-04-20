import React, { useState, useEffect, useMemo } from 'react';
import { DealStage, InventoryHook, Deal, ProductionOrdersHook, SaleItem, ProductionOrderItem } from '../types';
import { useSalesFunnel } from '../hooks/useSalesFunnel';
import { useKitPricing } from '../hooks/useKitPricing';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoles } from '../hooks/api';
import { UserProfile } from '../types';
import { X, Search, Plus, Minus, DollarSign, FileDown, Upload, Download, CheckCircle, ExternalLink } from 'lucide-react';
import { generateQuotePDF } from '../src/utils/pdfGenerator';
import { exportToBlingCSV } from '../src/utils/blingExport';

const STAGES: DealStage[] = ['Novo Lead', 'Em Contato', 'Proposta Enviada', 'Negociação', 'Ganho', 'Perdido'];

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventory?: InventoryHook;
    initialLeadId?: string;
    initialStage?: DealStage;
    existingDeal?: Deal;
    productionOrdersHook?: ProductionOrdersHook;
}

export const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, inventory, initialLeadId, initialStage, existingDeal, productionOrdersHook }) => {
    const { leads, addDeal, updateDeal, addLead } = useSalesFunnel();
    const { getKitPrice } = useKitPricing();
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        title: '',
        value: 0,
        taxValue: 0,
        taxDetails: {
            icms: 0,
            ipi: 0,
            pis: 0,
            cofins: 0
        },
        shippingValue: 0,
        leadId: initialLeadId || '',
        leadName: '',
        leadPhone: '',
        stage: initialStage || 'Novo Lead' as DealStage,
        vehicleDetails: [] as { description: string; code: string; keyCount: number }[],
        assignedSellerId: ''
    });

    const [itemSearch, setItemSearch] = useState('');
    const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'kits' | 'components' | 'keys'>('all');
    const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
    const [manualValueOverride, setManualValueOverride] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log("Importing CSV...", event.target.files);
        const file = event.target.files?.[0];
        console.log("File:", file);
        console.log("Inventory:", inventory);
        if (!file || !inventory) {
            console.log("Missing file or inventory", { file: !!file, inventory: !!inventory });
            return;
        }

        try {
            const csvText = await file.text();
            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("Arquivo CSV vazio ou sem dados.");
            
            const separator = lines[0].includes(';') ? ';' : ',';
            const header = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
            
            const headerIndices: Record<string, number> = {
                "Código do produto": header.findIndex(h => /código|sku/i.test(h)),
                "Quantidade": header.findIndex(h => /qtd|quantidade/i.test(h))
            };
            
            if (Object.values(headerIndices).some(i => i === -1)) {
                throw new Error(`Cabeçalho do CSV não encontrado nas colunas. Colunas encontradas: ${header.join(', ')}. Esperado: Código/SKU e Quantidade/Qtd.`);
            }

            const newSelectedItems = [...selectedItems];
            let importedCount = 0;

            lines.slice(1).forEach(line => {
                const columns = line.split(separator).map(col => col.trim().replace(/"/g, ''));
                if (columns.length < header.length) return;
                
                const quantity = Math.ceil(parseFloat(columns[headerIndices["Quantidade"]].replace(',', '.')));
                const sku = columns[headerIndices["Código do produto"]];
                
                if (sku && !isNaN(quantity) && quantity > 0) {
                    const kit = inventory.kits.find(k => k.sku === sku);
                    if (kit) {
                        const existing = newSelectedItems.find(i => i.id === kit.id && i.type === 'kit');
                        if (existing) existing.quantity += quantity;
                        else newSelectedItems.push({ id: kit.id, type: 'kit', quantity });
                        importedCount++;
                    } else {
                        const component = inventory.components.find(c => c.sku === sku);
                        if (component) {
                            const existing = newSelectedItems.find(i => i.id === component.id && i.type === 'component');
                            if (existing) existing.quantity += quantity;
                            else newSelectedItems.push({ id: component.id, type: 'component', quantity });
                            importedCount++;
                        }
                    }
                }
            });

            setSelectedItems(newSelectedItems);
            setManualValueOverride(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            addToast(`${importedCount} kits importados com sucesso!`, "success");
        } catch (error: any) {
            addToast(`Erro ao importar CSV: ${error.message}`, "error");
        }
    };

    const handleExportCSV = () => {
        if (!inventory) return;
        
        if (selectedItems.length === 0) {
            addToast("Selecione pelo menos um item para exportar.", "warning");
            return;
        }

        try {
            let csvContent = "Código do produto;Descrição;Quantidade;Valor Unitário;Valor Total\n";
            
            selectedItems.forEach(item => {
                const details = item.type === 'kit' 
                    ? inventory.kits.find(k => k.id === item.id)
                    : inventory.findComponentById(item.id);
                if (!details) return;
                
                const price = item.type === 'kit' 
                    ? getKitPrice(item.id) 
                    : (('custoMateriaPrima' in details ? details.custoMateriaPrima : 0) || 0) + (('custoFabricacao' in details ? details.custoFabricacao : 0) || 0);
                csvContent += `"${details.sku}";"${details.name}";${item.quantity};${price.toFixed(2)};${(price * item.quantity).toFixed(2)}\n`;
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `exportacao_kits_${new Date().getTime()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast("CSV exportado com sucesso!", "success");
        } catch (error: any) {
            addToast(`Erro ao exportar CSV: ${error.message}`, "error");
        }
    };

    const { user, role } = useAuth();
    const [sellers, setSellers] = useState<UserProfile[]>([]);

    useEffect(() => {
        if (isOpen) {
            getUserRoles().then(roles => {
                setSellers(roles.filter(r => r.role === 'Vendedor' || r.role === 'Gestor' || r.role === 'Admin'));
            });

            if (existingDeal) {
                const taxDetailsMap = { icms: 0, ipi: 0, pis: 0, cofins: 0 };
                if (existingDeal.taxDetails) {
                    existingDeal.taxDetails.forEach(detail => {
                        if (detail.name.toLowerCase() === 'icms') taxDetailsMap.icms = detail.value;
                        if (detail.name.toLowerCase() === 'ipi') taxDetailsMap.ipi = detail.value;
                        if (detail.name.toLowerCase() === 'pis') taxDetailsMap.pis = detail.value;
                        if (detail.name.toLowerCase() === 'cofins') taxDetailsMap.cofins = detail.value;
                    });
                }

                setForm({
                    title: existingDeal.title,
                    value: existingDeal.value,
                    taxValue: existingDeal.taxValue || 0,
                    taxDetails: taxDetailsMap,
                    shippingValue: existingDeal.shippingValue || 0,
                    leadId: existingDeal.leadId,
                    leadName: '',
                    leadPhone: '',
                    stage: existingDeal.stage,
                    vehicleDetails: existingDeal.vehicleDetails || [],
                    assignedSellerId: existingDeal.assignedSellerId || ''
                });
                if (existingDeal.items) {
                    setSelectedItems(existingDeal.items);
                } else {
                    setSelectedItems([]);
                }
                setManualValueOverride(true); // Keep existing value by default
            } else {
                setForm({
                    title: '',
                    value: 0,
                    taxValue: 0,
                    taxDetails: { icms: 0, ipi: 0, pis: 0, cofins: 0 },
                    shippingValue: 0,
                    leadId: initialLeadId || '',
                    leadName: '',
                    leadPhone: '',
                    stage: initialStage || 'Novo Lead',
                    vehicleDetails: [],
                    assignedSellerId: role === 'Vendedor' ? (user?.uid || '') : ''
                });
                setSelectedItems([]);
                setManualValueOverride(false);
            }
            setItemSearch('');
            setIsSubmitting(false);
        }
    }, [isOpen, initialLeadId, initialStage, existingDeal, role, user]);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const filteredItems = useMemo(() => {
        if (!inventory) return [];
        let kits = inventory.kits.filter(k => 
            k.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
            k.sku.toLowerCase().includes(itemSearch.toLowerCase())
        ).map(k => ({ ...k, type: 'kit' as const }));
        
        let components = inventory.components.filter(c => 
            c.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
            c.sku.toLowerCase().includes(itemSearch.toLowerCase())
        ).map(c => ({ ...c, type: 'component' as const }));

        if (itemTypeFilter === 'kits') {
            components = [];
        } else if (itemTypeFilter === 'components') {
            kits = [];
            components = components.filter(c => !c.familiaId?.startsWith('fam-chave'));
        } else if (itemTypeFilter === 'keys') {
            kits = [];
            components = components.filter(c => c.familiaId?.startsWith('fam-chave'));
        }

        return [...kits, ...components].sort((a,b) => a.name.localeCompare(b.name));
    }, [inventory, itemSearch, itemTypeFilter]);

    // Reset page when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [itemSearch, itemTypeFilter]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);
    
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

    const handleQuantityChange = (id: string, type: 'kit' | 'component', delta: number) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.id === id && i.type === type);
            if (existing) {
                const nextQty = Math.max(0, existing.quantity + delta);
                if (nextQty === 0) {
                    return prev.filter(i => !(i.id === id && i.type === type));
                }
                return prev.map(i => (i.id === id && i.type === type) ? { ...i, quantity: nextQty } : i);
            } else if (delta > 0) {
                return [...prev, { id, type, quantity: delta }];
            }
            return prev;
        });
        setManualValueOverride(false);
    };

    useEffect(() => {
        if (!inventory || manualValueOverride) return;
        let total = 0;
        selectedItems.forEach(item => {
            if (item.type === 'kit') {
                total += getKitPrice(item.id) * item.quantity;
            } else {
                const comp = inventory.findComponentById(item.id);
                if (comp) {
                    total += ((comp.custoMateriaPrima || 0) + (comp.custoFabricacao || 0)) * item.quantity;
                }
            }
        });
        
        // Calculate total tax from details
        const calculatedTax = form.taxDetails.icms + form.taxDetails.ipi + form.taxDetails.pis + form.taxDetails.cofins;
        
        // Add tax and shipping
        const finalTotal = total + calculatedTax + (form.shippingValue || 0);
        setForm(prev => ({ ...prev, value: Number(finalTotal.toFixed(2)), taxValue: calculatedTax }));
    }, [selectedItems, inventory, manualValueOverride, getKitPrice, form.taxDetails, form.shippingValue]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, value: Number(e.target.value) }));
        setManualValueOverride(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedItems.length === 0) {
            addToast("Selecione pelo menos um item para a oportunidade.", "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            const taxDetailsList = [
                { name: 'ICMS', value: form.taxDetails.icms },
                { name: 'IPI', value: form.taxDetails.ipi },
                { name: 'PIS', value: form.taxDetails.pis },
                { name: 'COFINS', value: form.taxDetails.cofins }
            ].filter(t => t.value > 0);

            let finalLeadId = form.leadId;
            
            const isAssignedByManager = (role === 'Gestor' || role === 'Admin') && form.assignedSellerId !== user?.uid;
            
            if (!finalLeadId) {
                const newLead = await addLead({
                    name: form.leadName,
                    phone: form.leadPhone,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : undefined
                });
                finalLeadId = newLead.id;
            }

            if (existingDeal) {
                await updateDeal({
                    ...existingDeal,
                    title: form.title,
                    value: form.value,
                    taxValue: form.taxValue,
                    taxDetails: taxDetailsList,
                    shippingValue: form.shippingValue,
                    leadId: finalLeadId,
                    stage: form.stage,
                    items: selectedItems.length > 0 ? selectedItems : undefined,
                    vehicleDetails: form.vehicleDetails.length > 0 ? form.vehicleDetails : undefined,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : existingDeal.assignedByManagerId
                });
                addToast("Oportunidade atualizada com sucesso!", "success");
            } else {
                await addDeal({
                    title: form.title,
                    value: form.value,
                    taxValue: form.taxValue,
                    taxDetails: taxDetailsList,
                    shippingValue: form.shippingValue,
                    leadId: finalLeadId,
                    stage: form.stage,
                    items: selectedItems.length > 0 ? selectedItems : undefined,
                    vehicleDetails: form.vehicleDetails.length > 0 ? form.vehicleDetails : undefined,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : undefined
                });
                addToast("Nova oportunidade criada com sucesso!", "success");
            }

            onClose();
        } catch (error: any) {
            console.error("Error saving deal:", error);
            addToast(`Erro ao salvar oportunidade: ${error.message}`, "error");
            setIsSubmitting(false);
        }
    };

    const handleSell = async () => {
        if (!productionOrdersHook) {
            addToast("Erro: Hook de ordens de produção não disponível.", "error");
            return;
        }

        if (selectedItems.length === 0) {
            addToast("Selecione pelo menos um item para vender.", "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            let finalLeadId = form.leadId;
            let finalLeadName = form.leadName;
            
            const isAssignedByManager = (role === 'Gestor' || role === 'Admin') && form.assignedSellerId !== user?.uid;
            
            if (!finalLeadId) {
                const newLead = await addLead({
                    name: form.leadName,
                    phone: form.leadPhone,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : undefined
                });
                finalLeadId = newLead.id;
            } else {
                const lead = leads.find(l => l.id === finalLeadId);
                if (lead) finalLeadName = lead.name;
            }

            const taxDetailsList = [
                { name: 'ICMS', value: form.taxDetails.icms },
                { name: 'IPI', value: form.taxDetails.ipi },
                { name: 'PIS', value: form.taxDetails.pis },
                { name: 'COFINS', value: form.taxDetails.cofins }
            ].filter(t => t.value > 0);

            if (existingDeal) {
                await updateDeal({
                    ...existingDeal,
                    title: form.title,
                    value: form.value,
                    taxValue: form.taxValue,
                    taxDetails: taxDetailsList,
                    shippingValue: form.shippingValue,
                    leadId: finalLeadId,
                    stage: 'Ganho',
                    items: selectedItems.length > 0 ? selectedItems : undefined,
                    vehicleDetails: form.vehicleDetails.length > 0 ? form.vehicleDetails : undefined,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : existingDeal.assignedByManagerId
                });
            } else {
                await addDeal({
                    title: form.title,
                    value: form.value,
                    taxValue: form.taxValue,
                    taxDetails: taxDetailsList,
                    shippingValue: form.shippingValue,
                    leadId: finalLeadId,
                    stage: 'Ganho',
                    items: selectedItems.length > 0 ? selectedItems : undefined,
                    vehicleDetails: form.vehicleDetails.length > 0 ? form.vehicleDetails : undefined,
                    assignedSellerId: form.assignedSellerId || undefined,
                    assignedByManagerId: isAssignedByManager ? user?.uid : undefined
                });
            }

            const orderId = await productionOrdersHook.addProductionOrder({
                orderItems: selectedItems,
                selectedScenario: {
                    fastenerHeadCode: 'Análise Geral',
                    isPossible: true,
                    totalCost: form.value,
                    costBreakdown: { materialCost: 0, fabricationCost: 0 },
                    inventoryValueConsumed: 0,
                    shortageValue: 0,
                    shortages: [],
                    detailedRequirements: [],
                    substitutionsMade: []
                },
                virtualComponents: [],
                customerId: finalLeadId,
                scannedItems: {},
                substitutions: {},
                installments: [{
                    id: `inst-${new Date().getTime()}`,
                    number: "1",
                    value: form.value,
                    dueDate: new Date().toISOString(),
                    status: 'pendente'
                }]
            });

            addToast(`Venda concluída com sucesso! Pedido ${orderId} gerado.`, "success");
            onClose();
        } catch (error: any) {
            console.error("Error selling deal:", error);
            addToast(`Erro ao realizar venda: ${error.message}`, "error");
            setIsSubmitting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!inventory) return;
        
        if (selectedItems.length === 0) {
            addToast("Selecione pelo menos um kit para gerar o orçamento.", "warning");
            return;
        }

        try {
            const lead = leads.find(l => l.id === form.leadId);
            const clientName = lead ? lead.name : form.leadName || 'Cliente';
            
            const items = selectedItems.map(item => {
                const details = item.type === 'kit' ? inventory.kits.find(k => k.id === item.id) : inventory.findComponentById(item.id);
                const price = item.type === 'kit' 
                    ? getKitPrice(item.id) 
                    : ((details && 'custoMateriaPrima' in details ? details.custoMateriaPrima : 0) || 0) + ((details && 'custoFabricacao' in details ? details.custoFabricacao : 0) || 0);
                return { kit: details, quantity: item.quantity, price };
            });

            const taxDetailsList = [
                { name: 'ICMS', value: form.taxDetails.icms },
                { name: 'IPI', value: form.taxDetails.ipi },
                { name: 'PIS', value: form.taxDetails.pis },
                { name: 'COFINS', value: form.taxDetails.cofins }
            ].filter(t => t.value > 0);

            await generateQuotePDF(clientName, form.title, items, form.value, form.taxValue, form.shippingValue, taxDetailsList, form.vehicleDetails);
            addToast("Orçamento gerado com sucesso!", "success");
        } catch (error: any) {
            console.error("Error generating PDF:", error);
            addToast(`Erro ao gerar orçamento: ${error.message}`, "error");
        }
    };

    if (!isOpen) return null;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">{existingDeal ? 'Editar Oportunidade' : 'Nova Oportunidade de Venda'}</h2>
                    <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImportCSV}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                            title="Importar CSV"
                        >
                            <Upload className="w-4 h-4" />
                            Importar
                        </button>
                        {selectedItems.length > 0 && (
                            <>
                                <button 
                                    onClick={() => {
                                        const dealToExport = existingDeal ? {
                                            ...existingDeal,
                                            items: selectedItems
                                        } : {
                                            id: 'TEMP',
                                            leadId: form.leadId,
                                            title: form.title,
                                            value: form.value,
                                            stage: form.stage,
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString(),
                                            items: selectedItems
                                        };
                                        exportToBlingCSV([dealToExport as any], leads, inventory!);
                                        addToast("Dados preparados para o Bling.", "success");
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium transition-colors"
                                    title="Exportar para Bling"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Bling
                                </button>
                                <button 
                                    onClick={handleExportCSV}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                    title="Exportar CSV"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                    title="Gerar Orçamento em PDF"
                                >
                                    <FileDown className="w-4 h-4" />
                                    Orçamento
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm border border-slate-200 ml-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left Column: Deal Info */}
                    <div className="w-full md:w-1/3 p-6 border-r border-slate-200 overflow-y-auto bg-white">
                        <form id="deal-form" onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Título do Negócio</label>
                                <input
                                    type="text"
                                    required
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary"
                                    placeholder="Ex: Venda de 50 Kits para Cliente X"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente (Lead)</label>
                                <select
                                    value={form.leadId}
                                    onChange={e => setForm({ ...form, leadId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary mb-3"
                                    disabled={!!initialLeadId}
                                >
                                    <option value="">-- Criar Novo Cliente --</option>
                                    {leads.map(lead => (
                                        <option key={lead.id} value={lead.id}>{lead.name} {lead.company ? `(${lead.company})` : ''}</option>
                                    ))}
                                </select>

                                {!form.leadId && (
                                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Cliente</label>
                                            <input
                                                type="text"
                                                required
                                                value={form.leadName}
                                                onChange={e => setForm({ ...form, leadName: e.target.value })}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp</label>
                                            <input
                                                type="text"
                                                required
                                                value={form.leadPhone}
                                                onChange={e => setForm({ ...form, leadPhone: e.target.value })}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                                placeholder="Ex: 5511999999999"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(role === 'Gestor' || role === 'Admin') && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Vendedor Responsável</label>
                                    <select
                                        value={form.assignedSellerId}
                                        onChange={e => setForm({ ...form, assignedSellerId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary"
                                    >
                                        <option value="">-- Selecione o Vendedor --</option>
                                        {sellers.map(seller => (
                                            <option key={seller.uid} value={seller.uid}>{seller.email} ({seller.role})</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1">Como gestor, você pode atribuir esta venda a um vendedor.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Etapa do Funil</label>
                                <select
                                    value={form.stage}
                                    onChange={e => setForm({ ...form, stage: e.target.value as DealStage })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary"
                                >
                                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Veículos / Equipamentos</h4>
                                    <button 
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, vehicleDetails: [...prev.vehicleDetails, { description: '', code: '', keyCount: 1 }] }))}
                                        className="text-autro-primary hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                        title="Adicionar Veículo"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                {form.vehicleDetails.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Nenhum veículo adicionado. Clique no + para adicionar.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {form.vehicleDetails.map((v, idx) => (
                                            <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 relative group">
                                                <button 
                                                    type="button"
                                                    onClick={() => setForm(prev => ({ ...prev, vehicleDetails: prev.vehicleDetails.filter((_, i) => i !== idx) }))}
                                                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Descrição (Ex: Caminhão Scania)"
                                                        value={v.description}
                                                        onChange={e => {
                                                            const newDetails = [...form.vehicleDetails];
                                                            newDetails[idx].description = e.target.value;
                                                            setForm({ ...form, vehicleDetails: newDetails });
                                                        }}
                                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-autro-primary"
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Código/Placa"
                                                            value={v.code}
                                                            onChange={e => {
                                                                const newDetails = [...form.vehicleDetails];
                                                                newDetails[idx].code = e.target.value;
                                                                setForm({ ...form, vehicleDetails: newDetails });
                                                            }}
                                                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-autro-primary"
                                                        />
                                                        <div className="flex items-center gap-1">
                                                            <label className="text-[10px] font-medium text-slate-500">Chaves:</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={v.keyCount}
                                                                onChange={e => {
                                                                    const newDetails = [...form.vehicleDetails];
                                                                    newDetails[idx].keyCount = Number(e.target.value);
                                                                    setForm({ ...form, vehicleDetails: newDetails });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-autro-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Impostos e Taxas (Brasil)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">ICMS (R$)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.taxDetails.icms}
                                            onChange={e => {
                                                setForm({ ...form, taxDetails: { ...form.taxDetails, icms: Number(e.target.value) } });
                                                setManualValueOverride(false);
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">IPI (R$)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.taxDetails.ipi}
                                            onChange={e => {
                                                setForm({ ...form, taxDetails: { ...form.taxDetails, ipi: Number(e.target.value) } });
                                                setManualValueOverride(false);
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">PIS (R$)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.taxDetails.pis}
                                            onChange={e => {
                                                setForm({ ...form, taxDetails: { ...form.taxDetails, pis: Number(e.target.value) } });
                                                setManualValueOverride(false);
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">COFINS (R$)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.taxDetails.cofins}
                                            onChange={e => {
                                                setForm({ ...form, taxDetails: { ...form.taxDetails, cofins: Number(e.target.value) } });
                                                setManualValueOverride(false);
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-200">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Frete (R$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.shippingValue}
                                        onChange={e => {
                                            setForm({ ...form, shippingValue: Number(e.target.value) });
                                            setManualValueOverride(false);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-autro-primary"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Total (R$)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <DollarSign className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={form.value}
                                        onChange={handleValueChange}
                                        className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-autro-primary focus:border-autro-primary font-bold text-xl text-autro-primary bg-blue-50/30"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                    O valor é calculado automaticamente ao selecionar os kits ao lado. Você pode digitar um valor diferente para aplicar descontos ou acréscimos.
                                </p>
                            </div>
                        </form>
                    </div>

                    {/* Right Column: Kit Selection */}
                    <div className="w-full md:w-2/3 flex flex-col bg-slate-100">
                        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-slate-800">Selecione os Itens</h3>
                                <div className="text-sm font-medium text-autro-primary bg-blue-50 px-3 py-1 rounded-full">
                                    {selectedItems.reduce((a, b) => a + b.quantity, 0)} itens selecionados
                                </div>
                            </div>
                            <div className="relative mb-3">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar kits ou componentes por nome ou SKU..." 
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-autro-primary bg-slate-50"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setItemTypeFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${itemTypeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todos</button>
                                <button type="button" onClick={() => setItemTypeFilter('kits')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${itemTypeFilter === 'kits' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>Kits</button>
                                <button type="button" onClick={() => setItemTypeFilter('components')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${itemTypeFilter === 'components' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>Componentes</button>
                                <button type="button" onClick={() => setItemTypeFilter('keys')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${itemTypeFilter === 'keys' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>Chaves</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {paginatedItems.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    Nenhum item encontrado com esse nome.
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {paginatedItems.map(item => {
                                            const price = item.type === 'kit' ? getKitPrice(item.id) : ((item.custoMateriaPrima || 0) + (item.custoFabricacao || 0));
                                            const qty = selectedItems.find(i => i.id === item.id && i.type === item.type)?.quantity || 0;
                                            
                                            return (
                                                <div key={`${item.type}-${item.id}`} className={`bg-white p-4 rounded-xl border-2 transition-all flex flex-col h-full ${qty > 0 ? 'border-autro-primary shadow-md' : 'border-transparent shadow-sm hover:border-slate-200'}`}>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className="font-bold text-slate-800 line-clamp-2 leading-snug">{item.name}</h4>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${item.type === 'kit' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {item.type === 'kit' ? 'KIT' : 'ITEM'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs font-medium text-slate-400 mb-3">{item.sku}</div>
                                                    </div>
                                                    <div className="flex items-end justify-between mt-4 pt-3 border-t border-slate-100">
                                                        <div className="font-bold text-autro-primary">
                                                            {formatCurrency(price)}
                                                        </div>
                                                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                                                            <button type="button" onClick={() => handleQuantityChange(item.id, item.type, -1)} className={`p-1.5 rounded transition-colors ${qty > 0 ? 'hover:bg-white text-slate-700 shadow-sm' : 'text-slate-300 cursor-not-allowed'}`} disabled={qty === 0}>
                                                                <Minus className="w-4 h-4" />
                                                            </button>
                                                            <span className="w-8 text-center font-bold text-slate-800">{qty}</span>
                                                            <button type="button" onClick={() => handleQuantityChange(item.id, item.type, 1)} className="p-1.5 hover:bg-white rounded text-slate-700 shadow-sm transition-colors">
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="flex justify-center items-center gap-4 mt-6">
                                            <button 
                                                type="button"
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-50 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                                Anterior
                                            </button>
                                            <span className="text-sm font-medium text-slate-600">
                                                Página {currentPage} de {totalPages}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-50 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                            >
                                                Próxima
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div>
                        {(!existingDeal || existingDeal.stage !== 'Ganho') && (
                            <button 
                                type="button" 
                                onClick={handleSell} 
                                disabled={isSubmitting || selectedItems.length === 0}
                                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Vender (Gerar Pedido)
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" form="deal-form" disabled={isSubmitting} className="px-8 py-2.5 bg-autro-primary text-white rounded-lg hover:bg-blue-600 font-bold transition-colors flex items-center shadow-md hover:shadow-lg">
                            {isSubmitting ? 'Salvando...' : 'Salvar Oportunidade'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
