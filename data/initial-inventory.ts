
import { Component, Kit, FamiliaComponente, InventoryLog, ProcessDimension, WorkStation, Consumable, StandardOperation, ProcessHeadCode } from '../types';

// --- 1. MÃO DE OBRA ---
export const INITIAL_WORKSTATIONS: WorkStation[] = [
    { id: 'ws-antonio', name: 'ANTONIO MARCOS ROSA', hourlyRate: 29.50 },
    { id: 'ws-thiago-g', name: 'THIAGO GONÇALVES', hourlyRate: 29.50 },
    { id: 'ws-ajudante', name: 'AJUDANTE', hourlyRate: 5.20 },
    { id: 'ws-soldador', name: 'SOLDADOR', hourlyRate: 14.50 },
    { id: 'ws-torneiro', name: 'TORNEIRO', hourlyRate: 14.50 },
    { id: 'ws-cnc', name: 'OPERADOR CNC', hourlyRate: 18.00 },
];

// --- 2. INSUMOS ---
export const INITIAL_CONSUMABLES: Consumable[] = [
    { id: 'cons-gas', name: 'Gás de Solda', unit: 'cilindro', purchasePrice: 1200.00, monthlyConsumption: 2, monthlyProduction: 3000, unitCost: 0.80, category: 'SOLDA' },
    { id: 'cons-pastilha', name: 'Pastilha Widia', unit: 'un', purchasePrice: 13.30, monthlyConsumption: 10, monthlyProduction: 3000, unitCost: 0.04, category: 'TORNEAMENTO' },
    { id: 'cons-eletrodo', name: 'Eletrodo', unit: 'kg', purchasePrice: 45.00, monthlyConsumption: 50, monthlyProduction: 3000, unitCost: 0.75, category: 'SOLDA' },
    { id: 'cons-fluido', name: 'Fluido de Corte', unit: 'L', purchasePrice: 180.00, monthlyConsumption: 5, monthlyProduction: 3000, unitCost: 0.30, category: 'USINAGEM' },
    { id: 'cons-lubrificante', name: 'Lubrificante', unit: 'L', purchasePrice: 120.00, monthlyConsumption: 2, monthlyProduction: 3000, unitCost: 0.08, category: 'MANUTENCAO' },
    { id: 'cons-disco', name: 'Disco de Corte', unit: 'un', purchasePrice: 8.50, monthlyConsumption: 100, monthlyProduction: 3000, unitCost: 0.28, category: 'CORTE' },
];

// --- 3. OPERAÇÕES PADRÃO ---
export const INITIAL_OPERATIONS: StandardOperation[] = [
    { id: 'op-usin-cnc', name: 'Usinagem CNC', category: 'CNC', workStationId: 'ws-cnc', timeSeconds: 300, operationConsumables: [{ consumableId: 'cons-pastilha', quantity: 0.2 }] },
    { id: 'op-solda', name: 'Solda Inox', category: 'SOLDA', workStationId: 'ws-soldador', timeSeconds: 60, operationConsumables: [{ consumableId: 'cons-gas', quantity: 1 }] },
    { id: 'op-corte-laser', name: 'Corte a Laser', category: 'CORTE', workStationId: 'ws-cnc', timeSeconds: 120, operationConsumables: [{ consumableId: 'cons-disco', quantity: 0.5 }] },
    { id: 'op-corte', name: 'Corte de Barra', category: 'CORTE', workStationId: 'ws-cnc', timeSeconds: 60, operationConsumables: [{ consumableId: 'cons-disco', quantity: 0.1 }] },
    { id: 'op-gravacao', name: 'Gravação a Laser', category: 'ACABAMENTO', workStationId: 'ws-cnc', timeSeconds: 30, operationConsumables: [] },
    { id: 'op-decapagem', name: 'Decapagem', category: 'ACABAMENTO', workStationId: 'ws-cnc', timeSeconds: 60, operationConsumables: [] },
    { id: 'op-polimento', name: 'Polimento', category: 'ACABAMENTO', workStationId: 'ws-cnc', timeSeconds: 120, operationConsumables: [] },
];

// --- 4. MATÉRIAS-PRIMAS ---
export const INITIAL_COMPONENTS: Component[] = [
    { id: 'comp-RM-PAR-M5X20', name: 'Parafuso Sextavado M5x20', sku: 'RM-PAR-M5X20', type: 'raw_material', stock: 1000, purchaseCost: 0.45, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M6X20', name: 'Parafuso Sextavado M6x20', sku: 'RM-PAR-M6X20', type: 'raw_material', stock: 1000, purchaseCost: 0.65, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M6X25', name: 'Parafuso Sextavado M6x25', sku: 'RM-PAR-M6X25', type: 'raw_material', stock: 1000, purchaseCost: 0.65, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M6X30', name: 'Parafuso Sextavado M6x30', sku: 'RM-PAR-M6X30', type: 'raw_material', stock: 1000, purchaseCost: 0.65, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M6X45', name: 'Parafuso Sextavado M6x45', sku: 'RM-PAR-M6X45', type: 'raw_material', stock: 1000, purchaseCost: 0.65, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M6X50', name: 'Parafuso Sextavado M6x50', sku: 'RM-PAR-M6X50', type: 'raw_material', stock: 1000, purchaseCost: 0.65, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X10', name: 'Parafuso Sextavado M8x10', sku: 'RM-PAR-M8X10', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X15', name: 'Parafuso Sextavado M8x15', sku: 'RM-PAR-M8X15', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X20', name: 'Parafuso Sextavado M8x20', sku: 'RM-PAR-M8X20', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X25', name: 'Parafuso Sextavado M8x25', sku: 'RM-PAR-M8X25', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X30', name: 'Parafuso Sextavado M8x30', sku: 'RM-PAR-M8X30', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X35', name: 'Parafuso Sextavado M8x35', sku: 'RM-PAR-M8X35', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X40', name: 'Parafuso Sextavado M8x40', sku: 'RM-PAR-M8X40', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X45', name: 'Parafuso Sextavado M8x45', sku: 'RM-PAR-M8X45', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X50', name: 'Parafuso Sextavado M8x50', sku: 'RM-PAR-M8X50', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X60', name: 'Parafuso Sextavado M8x60', sku: 'RM-PAR-M8X60', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X70', name: 'Parafuso Sextavado M8x70', sku: 'RM-PAR-M8X70', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X75', name: 'Parafuso Sextavado M8x75', sku: 'RM-PAR-M8X75', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X80', name: 'Parafuso Sextavado M8x80', sku: 'RM-PAR-M8X80', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X86', name: 'Parafuso Sextavado M8x86', sku: 'RM-PAR-M8X86', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X90', name: 'Parafuso Sextavado M8x90', sku: 'RM-PAR-M8X90', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X95', name: 'Parafuso Sextavado M8x95', sku: 'RM-PAR-M8X95', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X110', name: 'Parafuso Sextavado M8x110', sku: 'RM-PAR-M8X110', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X130', name: 'Parafuso Sextavado M8x130', sku: 'RM-PAR-M8X130', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X135', name: 'Parafuso Sextavado M8x135', sku: 'RM-PAR-M8X135', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X150', name: 'Parafuso Sextavado M8x150', sku: 'RM-PAR-M8X150', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X160', name: 'Parafuso Sextavado M8x160', sku: 'RM-PAR-M8X160', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X270', name: 'Parafuso Sextavado M8x270', sku: 'RM-PAR-M8X270', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M8X280', name: 'Parafuso Sextavado M8x280', sku: 'RM-PAR-M8X280', type: 'raw_material', stock: 1000, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X10', name: 'Parafuso Sextavado M10x10', sku: 'RM-PAR-M10X10', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X15', name: 'Parafuso Sextavado M10x15', sku: 'RM-PAR-M10X15', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X20', name: 'Parafuso Sextavado M10x20', sku: 'RM-PAR-M10X20', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X25', name: 'Parafuso Sextavado M10x25', sku: 'RM-PAR-M10X25', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X40', name: 'Parafuso Sextavado M10x40', sku: 'RM-PAR-M10X40', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X45', name: 'Parafuso Sextavado M10x45', sku: 'RM-PAR-M10X45', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X50', name: 'Parafuso Sextavado M10x50', sku: 'RM-PAR-M10X50', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X60', name: 'Parafuso Sextavado M10x60', sku: 'RM-PAR-M10X60', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X70', name: 'Parafuso Sextavado M10x70', sku: 'RM-PAR-M10X70', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X80', name: 'Parafuso Sextavado M10x80', sku: 'RM-PAR-M10X80', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X90', name: 'Parafuso Sextavado M10x90', sku: 'RM-PAR-M10X90', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10X100', name: 'Parafuso Sextavado M10x100', sku: 'RM-PAR-M10X100', type: 'raw_material', stock: 1000, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M12X30', name: 'Parafuso Sextavado M12x30', sku: 'RM-PAR-M12X30', type: 'raw_material', stock: 500, purchaseCost: 2.20, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-PAR-M12X50', name: 'Parafuso Sextavado M12x50', sku: 'RM-PAR-M12X50', type: 'raw_material', stock: 500, purchaseCost: 2.20, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-NUT-M5', name: 'Porca M5', sku: 'RM-NUT-M5', type: 'raw_material', stock: 1000, purchaseCost: 0.15, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-NUT-M6', name: 'Porca M6', sku: 'RM-NUT-M6', type: 'raw_material', stock: 1000, purchaseCost: 0.20, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-NUT-M8', name: 'Porca M8', sku: 'RM-NUT-M8', type: 'raw_material', stock: 1000, purchaseCost: 0.25, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-NUT-M10', name: 'Porca M10', sku: 'RM-NUT-M10', type: 'raw_material', stock: 1000, purchaseCost: 0.35, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-NUT-M12', name: 'Porca M12', sku: 'RM-NUT-M12', type: 'raw_material', stock: 500, purchaseCost: 0.50, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-BARRA-ROSCADA-M5', name: 'Barra Roscada M5', sku: 'RM-BARRA-ROSCADA-M5', type: 'raw_material', stock: 100, purchaseCost: 15.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ROSCADA-M6', name: 'Barra Roscada M6', sku: 'RM-BARRA-ROSCADA-M6', type: 'raw_material', stock: 100, purchaseCost: 12.87, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ROSCADA-M8', name: 'Barra Roscada M8', sku: 'RM-BARRA-ROSCADA-M8', type: 'raw_material', stock: 100, purchaseCost: 42.14, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ROSCADA-M10', name: 'Barra Roscada M10', sku: 'RM-BARRA-ROSCADA-M10', type: 'raw_material', stock: 100, purchaseCost: 46.85, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ROSCADA-M12', name: 'Barra Roscada M12', sku: 'RM-BARRA-ROSCADA-M12', type: 'raw_material', stock: 100, purchaseCost: 26.19, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ROSCADA-M14', name: 'Barra Roscada M14', sku: 'RM-BARRA-ROSCADA-M14', type: 'raw_material', stock: 100, purchaseCost: 131.50, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-ACO', name: 'Barra de Aço', sku: 'RM-BARRA-ACO', type: 'raw_material', stock: 100, purchaseCost: 85.00, custoFabricacao: 0, custoMateriaPrima: 0, sourcing: 'purchased' },
    { id: 'comp-RM-BARRA-ROSCADA', name: 'Barra Roscada', sku: 'RM-BARRA-ROSCADA', type: 'raw_material', stock: 100, purchaseCost: 42.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 1 },
    { id: 'comp-RM-BARRA-15-8', name: 'Barra de Aço 15.8mm (6m)', sku: 'RM-BARRA-15.8', type: 'raw_material', stock: 100, purchaseCost: 50.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-19-05', name: 'Barra de Aço 19.05mm (6m)', sku: 'RM-BARRA-19.05', type: 'raw_material', stock: 100, purchaseCost: 70.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-22-22', name: 'Barra de Aço Inox 22.22mm (6m)', sku: 'RM-BARRA-22.22', type: 'raw_material', stock: 100, purchaseCost: 418.66, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-INOX-3-8', name: 'Barra de Aço Inox 304 3/8" (6m)', sku: 'RM-BARRA-INOX-3-8', type: 'raw_material', stock: 100, purchaseCost: 86.36, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-INOX-10', name: 'Barra de Aço Inox 304 10mm (6m)', sku: 'RM-BARRA-INOX-10', type: 'raw_material', stock: 100, purchaseCost: 160.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-INOX-1-2', name: 'Barra de Aço Inox 304 1/2" (6m)', sku: 'RM-BARRA-INOX-1-2', type: 'raw_material', stock: 100, purchaseCost: 180.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-INOX-5-8', name: 'Barra de Aço Inox 304 5/8" (6m)', sku: 'RM-BARRA-INOX-5-8', type: 'raw_material', stock: 100, purchaseCost: 220.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-BARRA-SEXT-3-8', name: 'Barra Sextavada 3/8" (6m)', sku: 'RM-BARRA-SEXT-3-8', type: 'raw_material', stock: 100, purchaseCost: 120.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-10', name: 'Tubo Inox Ø10.0mm (6m)', sku: 'RM-TUBO-10', type: 'raw_material', stock: 100, purchaseCost: 100.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-12-7', name: 'Tubo Inox Ø12.7mm (6m)', sku: 'RM-TUBO-12.7', type: 'raw_material', stock: 100, purchaseCost: 120.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-15-87', name: 'Tubo Inox Ø15.87x1.50mm (6m)', sku: 'RM-TUBO-15.87', type: 'raw_material', stock: 100, purchaseCost: 79.12, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-19-05', name: 'Tubo de Aço Ø19.05mm (6m)', sku: 'RM-TUBO-19.05', type: 'raw_material', stock: 100, purchaseCost: 60.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-22-22', name: 'Tubo de Aço Ø22.22mm (6m)', sku: 'RM-TUBO-22.22', type: 'raw_material', stock: 100, purchaseCost: 80.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-25-4', name: 'Tubo Inox Ø25.4x1.20mm (6m)', sku: 'RM-TUBO-25.4', type: 'raw_material', stock: 100, purchaseCost: 98.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-TUBO-31-75', name: 'Tubo Inox Ø31.75x3.0mm (6m)', sku: 'RM-TUBO-31.75', type: 'raw_material', stock: 100, purchaseCost: 486.00, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'm', purchaseQuantity: 6 },
    { id: 'comp-RM-ARRUELA-LASER', name: 'Arruela Cortada a Laser', sku: 'RM-ARRUELA-LASER', type: 'raw_material', stock: 1000, purchaseCost: 0.50, custoFabricacao: 0, custoMateriaPrima: 0, consumptionUnit: 'un', purchaseQuantity: 1 },
    { id: 'comp-RM-COPO-GIRATORIO', name: 'Copo Giratório', sku: 'RM-COPO-GIRATORIO', type: 'raw_material', stock: 200, purchaseCost: 15.00, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-MOEDA', name: 'Moeda (Matéria-Prima)', sku: 'RM-MOEDA', type: 'raw_material', stock: 5000, purchaseCost: 0.15, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-CHAPA', name: 'Chapa (Matéria-Prima)', sku: 'RM-CHAPA', type: 'raw_material', stock: 0, purchaseCost: 0, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-BARRA-INOX', name: 'Barra Inox', sku: 'RM-BARRA-INOX', type: 'raw_material', stock: 50, purchaseCost: 120.00, custoFabricacao: 0, custoMateriaPrima: 0 },
    
    // Embalagens Específicas
    { id: 'comp-SACO-PBD-CIAPLAST', name: 'Saco PBD Ciaplast', sku: 'SACO-PBD-CIAPLAST', type: 'component', stock: 1000, purchaseCost: 0.15, custoFabricacao: 0, custoMateriaPrima: 0.15, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-CX-EMBALAGEM-AUTRO', name: 'Caixa Embalagem Autro', sku: 'CX-EMBALAGEM-AUTRO', type: 'component', stock: 500, purchaseCost: 1.20, custoFabricacao: 0, custoMateriaPrima: 1.20, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-COPO-19-05', name: 'Copo 19.05', sku: 'COPO-19.05', type: 'component', stock: 1000, purchaseCost: 0, custoFabricacao: 0.20, custoMateriaPrima: 0, sourcing: 'manufactured', familiaId: 'fam-MONTAGEM-COPO' },
    { id: 'comp-TAMPA-19-05', name: 'Tampa 19.05', sku: 'TAMPA-19.05', type: 'component', stock: 1000, purchaseCost: 0.08, custoFabricacao: 0, custoMateriaPrima: 0.08, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-COPO-22-22', name: 'Copo 22.22', sku: 'COPO-22.22', type: 'component', stock: 1000, purchaseCost: 0, custoFabricacao: 0.25, custoMateriaPrima: 0, sourcing: 'manufactured', familiaId: 'fam-MONTAGEM-COPO' },
    { id: 'comp-TAMPA-22-22', name: 'Tampa 22.22', sku: 'TAMPA-22.22', type: 'component', stock: 1000, purchaseCost: 0.10, custoFabricacao: 0, custoMateriaPrima: 0.10, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-COPO-25-4', name: 'Copo 25.4', sku: 'COPO-25.4', type: 'component', stock: 1000, purchaseCost: 0, custoFabricacao: 0.35, custoMateriaPrima: 0, sourcing: 'manufactured', familiaId: 'fam-MONTAGEM-COPO' },
    { id: 'comp-TAMPA-25-4', name: 'Tampa 25.4', sku: 'TAMPA-25.4', type: 'component', stock: 1000, purchaseCost: 0.15, custoFabricacao: 0, custoMateriaPrima: 0.15, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-COPO-31-75', name: 'Copo 31.75', sku: 'COPO-31.75', type: 'component', stock: 1000, purchaseCost: 0, custoFabricacao: 0.45, custoMateriaPrima: 0, sourcing: 'manufactured', familiaId: 'fam-MONTAGEM-COPO' },
    { id: 'comp-TAMPA-31-75', name: 'Tampa 31.75', sku: 'TAMPA-31.75', type: 'component', stock: 1000, purchaseCost: 0.20, custoFabricacao: 0, custoMateriaPrima: 0.20, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-COPO-STD', name: 'Copo Padrão', sku: 'COPO-STD', type: 'component', stock: 1000, purchaseCost: 0, custoFabricacao: 0.30, custoMateriaPrima: 0, sourcing: 'manufactured', familiaId: 'fam-MONTAGEM-COPO' },
    { id: 'comp-TAMPA-STD', name: 'Tampa Padrão', sku: 'TAMPA-STD', type: 'component', stock: 1000, purchaseCost: 0.12, custoFabricacao: 0, custoMateriaPrima: 0.12, sourcing: 'purchased', familiaId: 'fam-embalagens' },

    { id: 'comp-EMB-COPO-P', name: 'Copo Plástico Pequeno', sku: 'EMB-COPO-P', type: 'component', stock: 500, purchaseCost: 0.10, custoFabricacao: 0, custoMateriaPrima: 0.10, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-COPO-M', name: 'Copo Plástico Médio', sku: 'EMB-COPO-M', type: 'component', stock: 500, purchaseCost: 0.15, custoFabricacao: 0, custoMateriaPrima: 0.15, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-COPO-G', name: 'Copo Plástico Grande', sku: 'EMB-COPO-G', type: 'component', stock: 500, purchaseCost: 0.20, custoFabricacao: 0, custoMateriaPrima: 0.20, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-TAMPA-P', name: 'Tampa Plástica Pequena', sku: 'EMB-TAMPA-P', type: 'component', stock: 500, purchaseCost: 0.05, custoFabricacao: 0, custoMateriaPrima: 0.05, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-TAMPA-M', name: 'Tampa Plástica Média', sku: 'EMB-TAMPA-M', type: 'component', stock: 500, purchaseCost: 0.08, custoFabricacao: 0, custoMateriaPrima: 0.08, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-TAMPA-G', name: 'Tampa Plástica Grande', sku: 'EMB-TAMPA-G', type: 'component', stock: 500, purchaseCost: 0.10, custoFabricacao: 0, custoMateriaPrima: 0.10, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-SACO-ZIP-P', name: 'Saco Plástico Zip Pequeno', sku: 'EMB-SACO-ZIP-P', type: 'component', stock: 1000, purchaseCost: 0.05, custoFabricacao: 0, custoMateriaPrima: 0.05, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-SACO-ZIP-M', name: 'Saco Plástico Zip Médio', sku: 'EMB-SACO-ZIP-M', type: 'component', stock: 1000, purchaseCost: 0.08, custoFabricacao: 0, custoMateriaPrima: 0.08, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-SACO-ZIP-G', name: 'Saco Plástico Zip Grande', sku: 'EMB-SACO-ZIP-G', type: 'component', stock: 1000, purchaseCost: 0.12, custoFabricacao: 0, custoMateriaPrima: 0.12, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-CAIXA-P', name: 'Caixa de Papelão Pequena', sku: 'EMB-CAIXA-P', type: 'component', stock: 200, purchaseCost: 1.00, custoFabricacao: 0, custoMateriaPrima: 1.00, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-CAIXA-M', name: 'Caixa de Papelão Média', sku: 'EMB-CAIXA-M', type: 'component', stock: 200, purchaseCost: 1.50, custoFabricacao: 0, custoMateriaPrima: 1.50, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-CAIXA-G', name: 'Caixa de Papelão Grande', sku: 'EMB-CAIXA-G', type: 'component', stock: 200, purchaseCost: 2.50, custoFabricacao: 0, custoMateriaPrima: 2.50, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-PLASTICO-BOLHA', name: 'Plástico Bolha (Metro)', sku: 'EMB-PLASTICO-BOLHA', type: 'component', stock: 500, purchaseCost: 0.50, custoFabricacao: 0, custoMateriaPrima: 0.50, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-FITA-ADESIVA', name: 'Fita Adesiva', sku: 'EMB-FITA-ADESIVA', type: 'component', stock: 100, purchaseCost: 3.00, custoFabricacao: 0, custoMateriaPrima: 3.00, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-ETIQUETA', name: 'Etiqueta Adesiva', sku: 'EMB-ETIQUETA', type: 'component', stock: 2000, purchaseCost: 0.02, custoFabricacao: 0, custoMateriaPrima: 0.02, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    { id: 'comp-EMB-MANUAL', name: 'Manual de Instruções', sku: 'EMB-MANUAL', type: 'component', stock: 1000, purchaseCost: 0.25, custoFabricacao: 0, custoMateriaPrima: 0.25, sourcing: 'purchased', familiaId: 'fam-embalagens' },
    
    // Chaves (Novos SKUs)
    { id: 'comp-CHAVE-T-S', name: 'Chave T (FIX-S)', sku: 'CHAVE-T-S', type: 'component', stock: 50, purchaseCost: 0, custoFabricacao: 15, custoMateriaPrima: 10, sourcing: 'manufactured', familiaId: 'fam-chave-t-s' },
    { id: 'comp-CHAVE-PITO-S', name: 'Chave Pito (FIX-S)', sku: 'CHAVE-PITO-S', type: 'component', stock: 50, purchaseCost: 0, custoFabricacao: 12, custoMateriaPrima: 8, sourcing: 'manufactured', familiaId: 'fam-chave-pito-s' },
];

export const INITIAL_KITS: Kit[] = [
    {
        id: 'kit-volkswagen-gol-g5',
        name: 'Kit Volkswagen Gol G5',
        sku: 'KIT-VW-GOL-G5',
        marca: 'Volkswagen',
        modelo: 'Gol G5',
        ano: '2008-2012',
        components: [
            { componentSku: 'RM-PAR-M6X20', quantity: 4 },
            { componentSku: 'RM-NUT-M6', quantity: 4 },
            { componentSku: 'RM-BARRA-15.8', quantity: 1.5 },
            { componentSku: 'EMB-COPO-M', quantity: 1 },
            { componentSku: 'EMB-TAMPA-M', quantity: 1 },
            { componentSku: 'EMB-SACO-ZIP-M', quantity: 1 },
            { componentSku: 'EMB-CAIXA-P', quantity: 1 },
            { componentSku: 'EMB-ETIQUETA', quantity: 1 },
            { componentSku: 'EMB-MANUAL', quantity: 1 }
        ],
        requiredFasteners: [
            { dimension: 'M6x20', quantity: 4 }
        ],
        compatibilityRules: [
            { condition: 'Parafuso M6', result: 'Copo 19,05mm' },
            { condition: 'Parafuso M8', result: 'Copo 22,22mm' },
            { condition: 'Parafuso M10', result: 'Copo 25,40mm' },
            { condition: 'Variante Fix P', result: 'Chave P' },
            { condition: 'Variante Fix S', result: 'Chave T' }
        ],
        pricingStrategy: 'markup',
        sellingPriceOverride: undefined
    },
    {
        id: 'kit-fiat-palio',
        name: 'Kit Fiat Palio',
        sku: 'KIT-FIAT-PALIO',
        marca: 'Fiat',
        modelo: 'Palio',
        ano: '2010-2015',
        components: [
            { componentSku: 'RM-PAR-M8X25', quantity: 6 },
            { componentSku: 'RM-NUT-M8', quantity: 6 },
            { componentSku: 'RM-BARRA-19.05', quantity: 2.0 }
        ],
        requiredFasteners: [
            { dimension: 'M8', quantity: 6 }
        ],
        compatibilityRules: [
            { condition: 'Parafuso M6', result: 'Copo 19,05mm' },
            { condition: 'Parafuso M8', result: 'Copo 22,22mm' },
            { condition: 'Parafuso M10', result: 'Copo 25,40mm' },
            { condition: 'Variante Fix P', result: 'Chave P' },
            { condition: 'Variante Fix S', result: 'Chave T' }
        ],
        pricingStrategy: 'markup',
        sellingPriceOverride: undefined
    }
];
export const INITIAL_INVENTORY_LOGS: InventoryLog[] = [];

// --- 5. CÓDIGOS GEOMÉTRICOS ---
export const SHARED_HEAD_CODES: ProcessHeadCode[] = [
    { id: 'c-A0001', code: 'A-0001', type: 'FIX' },
    { id: 'c-A0002', code: 'A-0002', type: 'FIX' },
    { id: 'c-A0003', code: 'A-0003', type: 'FIX' },
    { id: 'c-A0004', code: 'A-0004', type: 'FIX' },
    { id: 'c-A0010', code: 'A-0010', type: 'FIX' },
    { id: 'c-A0015', code: 'A-0015', type: 'FIX' },
    { id: 'c-A0028', code: 'A-0028', type: 'FIX' },
    { id: 'c-A0036', code: 'A-0036', type: 'FIX' },
    { id: 'c-A0048', code: 'A-0048', type: 'FIX' },
    { id: 'c-A0055', code: 'A-0055', type: 'FIX' },
    { id: 'c-A0060', code: 'A-0060', type: 'FIX' },
    { id: 'c-B0070', code: 'B-0070', type: 'FIX' },
    { id: 'c-B0074', code: 'B-0074', type: 'FIX' },
    { id: 'c-B0079', code: 'B-0079', type: 'FIX' },
    { id: 'c-B0083', code: 'B-0083', type: 'FIX' },
    { id: 'c-B0090', code: 'B-0090', type: 'FIX' },
    { id: 'c-B0097', code: 'B-0097', type: 'FIX' },
    { id: 'c-B0105', code: 'B-0105', type: 'FIX' },
    { id: 'c-B0112', code: 'B-0112', type: 'FIX' },
    { id: 'c-B0120', code: 'B-0120', type: 'FIX' },
    { id: 'c-B0130', code: 'B-0130', type: 'FIX' },
    { id: 'c-C0139', code: 'C-0139', type: 'FIX' },
    { id: 'c-C0143', code: 'C-0143', type: 'FIX' },
    { id: 'c-C0147', code: 'C-0147', type: 'FIX' },
    { id: 'c-C0151', code: 'C-0151', type: 'FIX' },
    { id: 'c-C0155', code: 'C-0155', type: 'FIX' },
    { id: 'c-C0159', code: 'C-0159', type: 'FIX' },
    { id: 'c-C0163', code: 'C-0163', type: 'FIX' },
    { id: 'c-C0165', code: 'C-0165', type: 'FIX' },
    { id: 'c-C0168', code: 'C-0168', type: 'FIX' },
    { id: 'c-C0171', code: 'C-0171', type: 'FIX' },
    { id: 'c-C0175', code: 'C-0175', type: 'FIX' },
    { id: 'c-C0180', code: 'C-0180', type: 'FIX' },
    { id: 'c-D0020', code: 'D-0020', type: 'FIX' },
    { id: 'c-D0022', code: 'D-0022', type: 'FIX' },
    { id: 'c-H0200', code: 'H-0200', type: 'FIX' },
    // Moedas
    { id: 'cm-A0001', code: 'A-0001', type: 'MOEDA' },
    { id: 'cm-A0002', code: 'A-0002', type: 'MOEDA' },
    { id: 'cm-A0010', code: 'A-0010', type: 'MOEDA' },
    { id: 'cm-A0015', code: 'A-0015', type: 'MOEDA' },
    { id: 'cm-A0028', code: 'A-0028', type: 'MOEDA' },
    { id: 'cm-A0036', code: 'A-0036', type: 'MOEDA' },
    { id: 'cm-A0048', code: 'A-0048', type: 'MOEDA' },
    { id: 'cm-A0055', code: 'A-0055', type: 'MOEDA' },
    { id: 'cm-A0060', code: 'A-0060', type: 'MOEDA' },
    { id: 'cm-B0070', code: 'B-0070', type: 'MOEDA' },
    { id: 'cm-B0074', code: 'B-0074', type: 'MOEDA' },
    { id: 'cm-B0079', code: 'B-0079', type: 'MOEDA' },
    { id: 'cm-B0083', code: 'B-0083', type: 'MOEDA' },
    { id: 'cm-B0090', code: 'B-0090', type: 'MOEDA' },
    { id: 'cm-B0097', code: 'B-0097', type: 'MOEDA' },
    { id: 'cm-B0105', code: 'B-0105', type: 'MOEDA' },
    { id: 'cm-B0112', code: 'B-0112', type: 'MOEDA' },
    { id: 'cm-B0120', code: 'B-0120', type: 'MOEDA' },
    { id: 'cm-B0130', code: 'B-0130', type: 'MOEDA' },
    { id: 'cm-C0139', code: 'C-0139', type: 'MOEDA' },
    { id: 'cm-C0143', code: 'C-0143', type: 'MOEDA' },
    { id: 'cm-C0147', code: 'C-0147', type: 'MOEDA' },
    { id: 'cm-C0151', code: 'C-0151', type: 'MOEDA' },
    { id: 'cm-C0155', code: 'C-0155', type: 'MOEDA' },
    { id: 'cm-C0159', code: 'C-0159', type: 'MOEDA' },
    { id: 'cm-C0163', code: 'C-0163', type: 'MOEDA' },
    { id: 'cm-C0165', code: 'C-0165', type: 'MOEDA' },
    { id: 'cm-C0168', code: 'C-0168', type: 'MOEDA' },
    { id: 'cm-C0171', code: 'C-0171', type: 'MOEDA' },
    { id: 'cm-C0175', code: 'C-0175', type: 'MOEDA' },
    { id: 'cm-C0180', code: 'C-0180', type: 'MOEDA' },
    { id: 'cm-D0020', code: 'D-0020', type: 'MOEDA' },
    { id: 'cm-D0022', code: 'D-0022', type: 'MOEDA' },
    { id: 'cm-H0200', code: 'H-0200', type: 'MOEDA' },
];

// --- 6. PROCESSOS ---

const dims: ProcessDimension[] = [
    // M5
    { id: 'dim-m5-20', bitola: 5, comprimento: 20, baseMaterialId: 'comp-RM-PAR-M5X20', consumption: 1 },
    { id: 'dim-m5-0', bitola: 5, comprimento: 0, baseMaterialId: 'comp-RM-NUT-M5', consumption: 1 },
    // M6
    { id: 'dim-m6-20', bitola: 6, comprimento: 20, baseMaterialId: 'comp-RM-PAR-M6X20', consumption: 1 },
    { id: 'dim-m6-25', bitola: 6, comprimento: 25, baseMaterialId: 'comp-RM-PAR-M6X25', consumption: 1 },
    { id: 'dim-m6-30', bitola: 6, comprimento: 30, baseMaterialId: 'comp-RM-PAR-M6X30', consumption: 1 },
    { id: 'dim-m6-45', bitola: 6, comprimento: 45, baseMaterialId: 'comp-RM-PAR-M6X45', consumption: 1 },
    { id: 'dim-m6-50', bitola: 6, comprimento: 50, baseMaterialId: 'comp-RM-PAR-M6X50', consumption: 1 },
    { id: 'dim-m6-0', bitola: 6, comprimento: 0, baseMaterialId: 'comp-RM-NUT-M6', consumption: 1 },
    // M8
    { id: 'dim-m8-10', bitola: 8, comprimento: 10, baseMaterialId: 'comp-RM-PAR-M8X10', consumption: 1 },
    { id: 'dim-m8-15', bitola: 8, comprimento: 15, baseMaterialId: 'comp-RM-PAR-M8X15', consumption: 1 },
    { id: 'dim-m8-20', bitola: 8, comprimento: 20, baseMaterialId: 'comp-RM-PAR-M8X20', consumption: 1 },
    { id: 'dim-m8-25', bitola: 8, comprimento: 25, baseMaterialId: 'comp-RM-PAR-M8X25', consumption: 1 },
    { id: 'dim-m8-30', bitola: 8, comprimento: 30, baseMaterialId: 'comp-RM-PAR-M8X30', consumption: 1 },
    { id: 'dim-m8-35', bitola: 8, comprimento: 35, baseMaterialId: 'comp-RM-PAR-M8X35', consumption: 1 },
    { id: 'dim-m8-40', bitola: 8, comprimento: 40, baseMaterialId: 'comp-RM-PAR-M8X40', consumption: 1 },
    { id: 'dim-m8-45', bitola: 8, comprimento: 45, baseMaterialId: 'comp-RM-PAR-M8X45', consumption: 1 },
    { id: 'dim-m8-50', bitola: 8, comprimento: 50, baseMaterialId: 'comp-RM-PAR-M8X50', consumption: 1 },
    { id: 'dim-m8-60', bitola: 8, comprimento: 60, baseMaterialId: 'comp-RM-PAR-M8X60', consumption: 1 },
    { id: 'dim-m8-70', bitola: 8, comprimento: 70, baseMaterialId: 'comp-RM-PAR-M8X70', consumption: 1 },
    { id: 'dim-m8-75', bitola: 8, comprimento: 75, baseMaterialId: 'comp-RM-PAR-M8X75', consumption: 1 },
    { id: 'dim-m8-80', bitola: 8, comprimento: 80, baseMaterialId: 'comp-RM-PAR-M8X80', consumption: 1 },
    { id: 'dim-m8-86', bitola: 8, comprimento: 86, baseMaterialId: 'comp-RM-PAR-M8X86', consumption: 1 },
    { id: 'dim-m8-90', bitola: 8, comprimento: 90, baseMaterialId: 'comp-RM-PAR-M8X90', consumption: 1 },
    { id: 'dim-m8-95', bitola: 8, comprimento: 95, baseMaterialId: 'comp-RM-PAR-M8X95', consumption: 1 },
    { id: 'dim-m8-110', bitola: 8, comprimento: 110, baseMaterialId: 'comp-RM-PAR-M8X110', consumption: 1 },
    { id: 'dim-m8-130', bitola: 8, comprimento: 130, baseMaterialId: 'comp-RM-PAR-M8X130', consumption: 1 },
    { id: 'dim-m8-135', bitola: 8, comprimento: 135, baseMaterialId: 'comp-RM-PAR-M8X135', consumption: 1 },
    { id: 'dim-m8-150', bitola: 8, comprimento: 150, baseMaterialId: 'comp-RM-PAR-M8X150', consumption: 1 },
    { id: 'dim-m8-160', bitola: 8, comprimento: 160, baseMaterialId: 'comp-RM-PAR-M8X160', consumption: 1 },
    { id: 'dim-m8-270', bitola: 8, comprimento: 270, baseMaterialId: 'comp-RM-PAR-M8X270', consumption: 1 },
    { id: 'dim-m8-280', bitola: 8, comprimento: 280, baseMaterialId: 'comp-RM-PAR-M8X280', consumption: 1 },
    { id: 'dim-m8-0', bitola: 8, comprimento: 0, baseMaterialId: 'comp-RM-NUT-M8', consumption: 1 },
    // M10
    { id: 'dim-m10-10', bitola: 10, comprimento: 10, baseMaterialId: 'comp-RM-PAR-M10X10', consumption: 1 },
    { id: 'dim-m10-15', bitola: 10, comprimento: 15, baseMaterialId: 'comp-RM-PAR-M10X15', consumption: 1 },
    { id: 'dim-m10-20', bitola: 10, comprimento: 20, baseMaterialId: 'comp-RM-PAR-M10X20', consumption: 1 },
    { id: 'dim-m10-25', bitola: 10, comprimento: 25, baseMaterialId: 'comp-RM-PAR-M10X25', consumption: 1 },
    { id: 'dim-m10-40', bitola: 10, comprimento: 40, baseMaterialId: 'comp-RM-PAR-M10X40', consumption: 1 },
    { id: 'dim-m10-45', bitola: 10, comprimento: 45, baseMaterialId: 'comp-RM-PAR-M10X45', consumption: 1 },
    { id: 'dim-m10-50', bitola: 10, comprimento: 50, baseMaterialId: 'comp-RM-PAR-M10X50', consumption: 1 },
    { id: 'dim-m10-60', bitola: 10, comprimento: 60, baseMaterialId: 'comp-RM-PAR-M10X60', consumption: 1 },
    { id: 'dim-m10-70', bitola: 10, comprimento: 70, baseMaterialId: 'comp-RM-PAR-M10X70', consumption: 1 },
    { id: 'dim-m10-80', bitola: 10, comprimento: 80, baseMaterialId: 'comp-RM-PAR-M10X80', consumption: 1 },
    { id: 'dim-m10-90', bitola: 10, comprimento: 90, baseMaterialId: 'comp-RM-PAR-M10X90', consumption: 1 },
    { id: 'dim-m10-100', bitola: 10, comprimento: 100, baseMaterialId: 'comp-RM-PAR-M10X100', consumption: 1 },
    { id: 'dim-m10-0', bitola: 10, comprimento: 0, baseMaterialId: 'comp-RM-NUT-M10', consumption: 1 },
    // M12
    { id: 'dim-m12-30', bitola: 12, comprimento: 30, baseMaterialId: 'comp-RM-PAR-M12X30', consumption: 1 },
    { id: 'dim-m12-50', bitola: 12, comprimento: 50, baseMaterialId: 'comp-RM-PAR-M12X50', consumption: 1 },
    { id: 'dim-m12-0', bitola: 12, comprimento: 0, baseMaterialId: 'comp-RM-NUT-M12', consumption: 1 },
];

export const FIX_S_FAMILIA: FamiliaComponente = {
    id: 'fam-FIX-S',
    nome: 'Moeda FIX-S',
    type: 'moeda',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-s', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: [{ id: 'dim-s-22', bitola: 22.22, comprimento: 0, code: 'A-0001' }] }, position: { x: 100, y: 100 } },
        { id: 'n-mat-s', type: 'materiaPrima', data: { label: 'Chapa (MP)', cost: 0, type: 'materiaPrima', baseMaterialId: 'comp-RM-CHAPA', consumption: 0 }, position: { x: 100, y: 250 } },
        { id: 'n-cod-s', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: [
            { id: 'c-A0001', code: 'A-0001', type: 'MOEDA' },
            { id: 'c-A0002', code: 'A-0002', type: 'MOEDA' },
            { id: 'c-A0010', code: 'A-0010', type: 'MOEDA' },
            { id: 'c-A0015', code: 'A-0015', type: 'MOEDA' },
            { id: 'c-A0028', code: 'A-0028', type: 'MOEDA' },
            { id: 'c-A0036', code: 'A-0036', type: 'MOEDA' },
            { id: 'c-A0048', code: 'A-0048', type: 'MOEDA' },
            { id: 'c-A0055', code: 'A-0055', type: 'MOEDA' },
            { id: 'c-A0060', code: 'A-0060', type: 'MOEDA' },
            { id: 'c-B0070', code: 'B-0070', type: 'MOEDA' },
            { id: 'c-B0074', code: 'B-0074', type: 'MOEDA' },
            { id: 'c-B0079', code: 'B-0079', type: 'MOEDA' },
            { id: 'c-B0083', code: 'B-0083', type: 'MOEDA' },
            { id: 'c-B0090', code: 'B-0090', type: 'MOEDA' },
            { id: 'c-B0097', code: 'B-0097', type: 'MOEDA' },
            { id: 'c-B0105', code: 'B-0105', type: 'MOEDA' },
            { id: 'c-B0112', code: 'B-0112', type: 'MOEDA' },
            { id: 'c-B0120', code: 'B-0120', type: 'MOEDA' },
            { id: 'c-B0130', code: 'B-0130', type: 'MOEDA' },
            { id: 'c-C0139', code: 'C-0139', type: 'MOEDA' },
            { id: 'c-C0143', code: 'C-0143', type: 'MOEDA' },
            { id: 'c-C0147', code: 'C-0147', type: 'MOEDA' },
            { id: 'c-C0151', code: 'C-0151', type: 'MOEDA' },
            { id: 'c-C0155', code: 'C-0155', type: 'MOEDA' },
            { id: 'c-C0159', code: 'C-0159', type: 'MOEDA' },
            { id: 'c-C0163', code: 'C-0163', type: 'MOEDA' },
            { id: 'c-C0165', code: 'C-0165', type: 'MOEDA' },
            { id: 'c-C0168', code: 'C-0168', type: 'MOEDA' },
            { id: 'c-C0171', code: 'C-0171', type: 'MOEDA' },
            { id: 'c-C0175', code: 'C-0175', type: 'MOEDA' },
            { id: 'c-C0180', code: 'C-0180', type: 'MOEDA' },
            { id: 'c-D0020', code: 'D-0020', type: 'MOEDA' },
            { id: 'c-D0022', code: 'D-0022', type: 'MOEDA' },
            { id: 'c-H0200', code: 'H-0200', type: 'MOEDA' }
        ] }, position: { x: 250, y: 100 } },
        { id: 'n-corte-laser-s', type: 'etapaFabricacao', data: { label: 'Corte a Laser', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte-laser' }, position: { x: 400, y: 100 } },
        { id: 'n-gen-s', type: 'productGeneratorNode', data: { label: 'Gerador FIX-S', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Moeda FIX-S {bitola} {headCode}', skuTemplate: 'MOEDA-FIX-S-{bitola}-{headCode}' } }, position: { x: 550, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-cod-s', source: 'n-dna-s', target: 'n-cod-s', type: 'dataEdge' },
        { id: 'e-mat-corte-s', source: 'n-mat-s', target: 'n-corte-laser-s', type: 'dataEdge' },
        { id: 'e-cod-corte-s', source: 'n-cod-s', target: 'n-corte-laser-s', type: 'dataEdge' },
        { id: 'e-corte-gen-s', source: 'n-corte-laser-s', target: 'n-gen-s', type: 'dataEdge' }
    ]
};

export const FIX_P_FAMILIA: FamiliaComponente = {
    id: 'fam-FIX-P',
    nome: 'Moeda FIX-P',
    type: 'moeda',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-p', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: [
            { id: 'dim-p-19-05', bitola: 19.05, comprimento: 0, code: 'B-0074' },
            { id: 'dim-p-22-22', bitola: 22.22, comprimento: 0, code: 'B-0070' },
            { id: 'dim-p-25-4', bitola: 25.4, comprimento: 0, code: 'B-0079' }
        ] }, position: { x: 100, y: 100 } },
        { id: 'n-mat-p', type: 'materiaPrima', data: { label: 'Chapa (MP)', cost: 0, type: 'materiaPrima', baseMaterialId: 'comp-RM-CHAPA', consumption: 0 }, position: { x: 100, y: 250 } },
        { id: 'n-cod-p', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: [
            { id: 'c-A0001', code: 'A-0001', type: 'MOEDA' },
            { id: 'c-A0002', code: 'A-0002', type: 'MOEDA' },
            { id: 'c-A0010', code: 'A-0010', type: 'MOEDA' },
            { id: 'c-A0015', code: 'A-0015', type: 'MOEDA' },
            { id: 'c-A0028', code: 'A-0028', type: 'MOEDA' },
            { id: 'c-A0036', code: 'A-0036', type: 'MOEDA' },
            { id: 'c-A0048', code: 'A-0048', type: 'MOEDA' },
            { id: 'c-A0055', code: 'A-0055', type: 'MOEDA' },
            { id: 'c-A0060', code: 'A-0060', type: 'MOEDA' },
            { id: 'c-B0070', code: 'B-0070', type: 'MOEDA' },
            { id: 'c-B0074', code: 'B-0074', type: 'MOEDA' },
            { id: 'c-B0079', code: 'B-0079', type: 'MOEDA' },
            { id: 'c-B0083', code: 'B-0083', type: 'MOEDA' },
            { id: 'c-B0090', code: 'B-0090', type: 'MOEDA' },
            { id: 'c-B0097', code: 'B-0097', type: 'MOEDA' },
            { id: 'c-B0105', code: 'B-0105', type: 'MOEDA' },
            { id: 'c-B0112', code: 'B-0112', type: 'MOEDA' },
            { id: 'c-B0120', code: 'B-0120', type: 'MOEDA' },
            { id: 'c-B0130', code: 'B-0130', type: 'MOEDA' },
            { id: 'c-C0139', code: 'C-0139', type: 'MOEDA' },
            { id: 'c-C0143', code: 'C-0143', type: 'MOEDA' },
            { id: 'c-C0147', code: 'C-0147', type: 'MOEDA' },
            { id: 'c-C0151', code: 'C-0151', type: 'MOEDA' },
            { id: 'c-C0155', code: 'C-0155', type: 'MOEDA' },
            { id: 'c-C0159', code: 'C-0159', type: 'MOEDA' },
            { id: 'c-C0163', code: 'C-0163', type: 'MOEDA' },
            { id: 'c-C0165', code: 'C-0165', type: 'MOEDA' },
            { id: 'c-C0168', code: 'C-0168', type: 'MOEDA' },
            { id: 'c-C0171', code: 'C-0171', type: 'MOEDA' },
            { id: 'c-C0175', code: 'C-0175', type: 'MOEDA' },
            { id: 'c-C0180', code: 'C-0180', type: 'MOEDA' },
            { id: 'c-D0020', code: 'D-0020', type: 'MOEDA' },
            { id: 'c-D0022', code: 'D-0022', type: 'MOEDA' },
            { id: 'c-H0200', code: 'H-0200', type: 'MOEDA' }
        ] }, position: { x: 250, y: 100 } },
        { id: 'n-corte-laser-p', type: 'etapaFabricacao', data: { label: 'Corte a Laser', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte-laser' }, position: { x: 400, y: 100 } },
        { id: 'n-gen-p', type: 'productGeneratorNode', data: { label: 'Gerador FIX-P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Moeda FIX-P {bitola} {headCode}', skuTemplate: 'MOEDA-FIX-P-{bitola}-{headCode}' } }, position: { x: 550, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-cod-p', source: 'n-dna-p', target: 'n-cod-p', type: 'dataEdge' },
        { id: 'e-mat-corte-p', source: 'n-mat-p', target: 'n-corte-laser-p', type: 'dataEdge' },
        { id: 'e-cod-corte-p', source: 'n-cod-p', target: 'n-corte-laser-p', type: 'dataEdge' },
        { id: 'e-corte-gen-p', source: 'n-corte-laser-p', target: 'n-gen-p', type: 'dataEdge' }
    ]
};

export const USINAGEM_PARAFUSO_FAMILIA: FamiliaComponente = {
    id: 'fam-USINAGEM-PARAFUSO',
    nome: 'Usinagem Parafuso FIX-S',
    type: 'parafuso_usinado',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-usinagem', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: dims.filter(d => d.comprimento > 0) }, position: { x: 100, y: 100 } },
        { id: 'n-mat-usinagem', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: dims.filter(d => d.comprimento > 0) }, position: { x: 300, y: 100 } },
        { id: 'n-usinagem', type: 'etapaFabricacao', data: { label: 'Usinagem da Cabeça', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-usinagem', type: 'productGeneratorNode', data: { label: 'Gerador Parafuso Usinado', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Parafuso Usinado FIX-S M{bitola}x{comprimento}', skuTemplate: 'PAR-USIN-FIX-S-M{bitola}X{comprimento}' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-usinagem', source: 'n-dna-usinagem', target: 'n-mat-usinagem', type: 'dataEdge' },
        { id: 'e-mat-usinagem', source: 'n-mat-usinagem', target: 'n-usinagem', type: 'dataEdge' },
        { id: 'e-usinagem-gen', source: 'n-usinagem', target: 'n-gen-usinagem', type: 'dataEdge' }
    ]
};

const barraDims: ProcessDimension[] = dims.filter(d => d.comprimento > 0).map(d => ({
    ...d,
    id: `dim-barra-m${d.bitola}-${d.comprimento}`,
    baseMaterialId: `comp-RM-BARRA-ROSCADA-M${d.bitola}`,
    consumption: d.comprimento / 1000
}));

export const USINAGEM_BARRA_FAMILIA: FamiliaComponente = {
    id: 'fam-USINAGEM-BARRA',
    nome: 'Usinagem Barra Roscada FIX-P',
    type: 'parafuso_usinado',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-usinagem-barra', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: barraDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-usinagem-barra', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: barraDims }, position: { x: 300, y: 100 } },
        { id: 'n-usinagem-barra', type: 'etapaFabricacao', data: { label: 'Corte e Usinagem', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-usinagem-barra', type: 'productGeneratorNode', data: { label: 'Gerador Barra Usinada', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Barra Usinada FIX-P M{bitola}x{comprimento}', skuTemplate: 'BARRA-USIN-FIX-P-M{bitola}X{comprimento}' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-usinagem-barra', source: 'n-dna-usinagem-barra', target: 'n-mat-usinagem-barra', type: 'dataEdge' },
        { id: 'e-mat-usinagem-barra', source: 'n-mat-usinagem-barra', target: 'n-usinagem-barra', type: 'dataEdge' },
        { id: 'e-usinagem-gen-barra', source: 'n-usinagem-barra', target: 'n-gen-usinagem-barra', type: 'dataEdge' }
    ]
};

const corpoUsinadoDims: ProcessDimension[] = [
    { id: 'dim-cu-19', bitola: 19.05, comprimento: 14, baseMaterialId: 'comp-RM-TUBO-19-05', consumption: 0.014 },
    { id: 'dim-cu-22', bitola: 22.22, comprimento: 14, baseMaterialId: 'comp-RM-TUBO-22-22', consumption: 0.014 },
    { id: 'dim-cu-25', bitola: 25.4, comprimento: 14, baseMaterialId: 'comp-RM-TUBO-25-4', consumption: 0.014 },
    { id: 'dim-cu-31', bitola: 31.75, comprimento: 14, baseMaterialId: 'comp-RM-TUBO-31-75', consumption: 0.014 },
];

export const CORTE_TUBOS_FAMILIA: FamiliaComponente = {
    id: 'fam-CORTE-TUBOS',
    nome: 'Corte de Tubos',
    type: 'corte_tubos',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-corte', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: corpoUsinadoDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-corte', type: 'materialMapping', data: { label: 'Tubo (MP)', cost: 0, type: 'materialMapping', dimensions: corpoUsinadoDims }, position: { x: 300, y: 100 } },
        { id: 'n-corte-tubo', type: 'etapaFabricacao', data: { label: 'Corte (14mm)', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-corte', type: 'productGeneratorNode', data: { label: 'Gerador Tubo Cortado', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Tubo Cortado {bitola}mm', skuTemplate: 'TUBO-CORTADO-{bitola}' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-corte', source: 'n-dna-corte', target: 'n-mat-corte', type: 'dataEdge' },
        { id: 'e-mat-corte-tubo', source: 'n-mat-corte', target: 'n-corte-tubo', type: 'dataEdge' },
        { id: 'e-corte-gen', source: 'n-corte-tubo', target: 'n-gen-corte', type: 'dataEdge' }
    ]
};

export const MONTAGEM_COPO_FAMILIA: FamiliaComponente = {
    id: 'fam-MONTAGEM-COPO',
    nome: 'Processo de Fabricação - COPO',
    type: 'montagem_copo',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'Generico',
    nodes: [
        { id: 'n-dna-mont-copo', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: corpoUsinadoDims }, position: { x: 100, y: 150 } },
        { id: 'n-inv-tubo-cortado', type: 'inventoryComponent', data: { label: 'Tubo Cortado', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'TUBO-CORTADO-{bitola}', sourceFamiliaId: 'fam-CORTE-TUBOS' }, position: { x: 300, y: 50 } },
        { id: 'n-mat-arruela', type: 'materiaPrima', data: { label: 'Arruela Laser', cost: 0, type: 'materiaPrima', baseMaterialId: 'comp-RM-ARRUELA-LASER', consumption: 1 }, position: { x: 300, y: 250 } },
        { id: 'n-solda-copo', type: 'etapaFabricacao', data: { label: 'Solda Arruela', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 500, y: 150 } },
        { id: 'n-decapagem-copo', type: 'etapaFabricacao', data: { label: 'Decapagem', cost: 0, type: 'etapaFabricacao', operationId: 'op-decapagem' }, position: { x: 500, y: 250 } },
        { id: 'n-polimento-copo', type: 'etapaFabricacao', data: { label: 'Polimento', cost: 0, type: 'etapaFabricacao', operationId: 'op-polimento' }, position: { x: 500, y: 350 } },
        { id: 'n-gen-copo', type: 'productGeneratorNode', data: { label: 'Gerador Copo', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Copo {bitola}mm', skuTemplate: 'COPO-{bitola}' } }, position: { x: 700, y: 150 } },
        { id: 'n-final-copo', type: 'finalNode', data: { label: 'Soma Total Copo', cost: 0, type: 'final' }, position: { x: 900, y: 150 } },
    ],
    edges: [
        { id: 'e-dna-tubo-cortado', source: 'n-dna-mont-copo', target: 'n-inv-tubo-cortado', type: 'dataEdge' },
        { id: 'e-tubo-solda', source: 'n-inv-tubo-cortado', target: 'n-solda-copo', type: 'dataEdge' },
        { id: 'e-arruela-solda', source: 'n-mat-arruela', target: 'n-solda-copo', type: 'dataEdge' },
        { id: 'e-solda-decapagem', source: 'n-solda-copo', target: 'n-decapagem-copo', type: 'dataEdge' },
        { id: 'e-decapagem-polimento', source: 'n-decapagem-copo', target: 'n-polimento-copo', type: 'dataEdge' },
        { id: 'e-polimento-gen', source: 'n-polimento-copo', target: 'n-gen-copo', type: 'dataEdge' },
        { id: 'e-gen-final-copo', source: 'n-gen-copo', target: 'n-final-copo', type: 'dataEdge' }
    ]
};

const getDiametro = (bitola: number) => {
    if (bitola <= 6) return 19.05;
    if (bitola === 8) return 22.22;
    return 25.4;
};

const montagemFixSDims = dims.filter(d => d.comprimento > 0).map(d => ({ ...d, id: `dim-mont-s-${d.bitola}-${d.comprimento}`, moedaBitola: 22.22 }));
const montagemFixPDims = dims.filter(d => d.comprimento > 0).map(d => ({ ...d, id: `dim-mont-p-${d.bitola}-${d.comprimento}`, diametro: getDiametro(d.bitola), moedaBitola: getDiametro(d.bitola) }));
const montagemPorPDims = dims.filter(d => d.comprimento === 0).map(d => ({ ...d, id: `dim-mont-por-${d.bitola}`, diametro: getDiametro(d.bitola), moedaBitola: getDiametro(d.bitola) }));

export const MONTAGEM_FIX_S_FAMILIA: FamiliaComponente = {
    id: 'fam-MONTAGEM-FIX-S',
    nome: 'Montagem FIX-S',
    type: 'fix_s',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-S',
    nodes: [
        { id: 'n-dna-mont-s', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: montagemFixSDims }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-s', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-moeda-s', type: 'inventoryComponent', data: { label: 'Moeda FIX-S', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-S-{moedaBitola}-{headCode}', sourceFamiliaId: 'fam-FIX-S' }, position: { x: 100, y: 100 } },
        { id: 'n-inv-par-s', type: 'inventoryComponent', data: { label: 'Parafuso Usinado', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'PAR-USIN-FIX-S-M{bitola}X{comprimento}', sourceFamiliaId: 'fam-USINAGEM-PARAFUSO' }, position: { x: 100, y: 300 } },
        { id: 'n-solda-s', type: 'etapaFabricacao', data: { label: 'Solda Inox', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 200 } },
        { id: 'n-gen-mont-s', type: 'productGeneratorNode', data: { label: 'Gerador FIX-S', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'FIX-S {headCode} M{bitola}x{comprimento}', skuTemplate: 'FIX-S-{headCode}-M{bitola}X{comprimento}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-moeda-s', source: 'n-dna-mont-s', target: 'n-inv-moeda-s', type: 'dataEdge' },
        { id: 'e-dna-par-s', source: 'n-dna-mont-s', target: 'n-inv-par-s', type: 'dataEdge' },
        { id: 'e-cod-moeda-s', source: 'n-cod-mont-s', target: 'n-inv-moeda-s', type: 'dataEdge' },
        { id: 'e-moeda-solda-s', source: 'n-inv-moeda-s', target: 'n-solda-s', type: 'dataEdge' },
        { id: 'e-par-solda-s', source: 'n-inv-par-s', target: 'n-solda-s', type: 'dataEdge' },
        { id: 'e-solda-gen-s', source: 'n-solda-s', target: 'n-gen-mont-s', type: 'dataEdge' }
    ]
};

export const MONTAGEM_FIX_S_EXT_FAMILIA: FamiliaComponente = {
    id: 'fam-MONTAGEM-FIX-S-EXT',
    nome: 'Montagem FIX-S EXT',
    type: 'fix_s_ext',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-S EXT',
    nodes: [
        { id: 'n-dna-mont-s-ext', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: montagemFixSDims }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-s-ext', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-moeda-s-ext', type: 'inventoryComponent', data: { label: 'Moeda FIX-S', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-S-{moedaBitola}-{headCode}', sourceFamiliaId: 'fam-FIX-S' }, position: { x: 100, y: 100 } },
        { id: 'n-inv-par-s-ext', type: 'inventoryComponent', data: { label: 'Parafuso Usinado', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'PAR-USIN-FIX-S-M{bitola}X{comprimento}', sourceFamiliaId: 'fam-USINAGEM-PARAFUSO' }, position: { x: 100, y: 300 } },
        { id: 'n-solda-s-ext', type: 'etapaFabricacao', data: { label: 'Montagem Externa (Terceirizada)', cost: 0, type: 'etapaFabricacao', operationId: 'op-montagem-externa' }, position: { x: 400, y: 200 } },
        { id: 'n-gen-mont-s-ext', type: 'productGeneratorNode', data: { label: 'Gerador FIX-S EXT', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'FIX-S EXT {headCode} M{bitola}x{comprimento}', skuTemplate: 'FIX-S-EXT-{headCode}-M{bitola}X{comprimento}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-moeda-s-ext', source: 'n-dna-mont-s-ext', target: 'n-inv-moeda-s-ext', type: 'dataEdge' },
        { id: 'e-dna-par-s-ext', source: 'n-dna-mont-s-ext', target: 'n-inv-par-s-ext', type: 'dataEdge' },
        { id: 'e-cod-moeda-s-ext', source: 'n-cod-mont-s-ext', target: 'n-inv-moeda-s-ext', type: 'dataEdge' },
        { id: 'e-moeda-solda-s-ext', source: 'n-inv-moeda-s-ext', target: 'n-solda-s-ext', type: 'dataEdge' },
        { id: 'e-par-solda-s-ext', source: 'n-inv-par-s-ext', target: 'n-solda-s-ext', type: 'dataEdge' },
        { id: 'e-solda-gen-s-ext', source: 'n-solda-s-ext', target: 'n-gen-mont-s-ext', type: 'dataEdge' }
    ]
};

export const MONTAGEM_FIX_P_FAMILIA: FamiliaComponente = {
    id: 'fam-MONTAGEM-FIX-P',
    nome: 'Montagem FIX-P',
    type: 'fix_p',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-P',
    nodes: [
        { id: 'n-dna-mont-p', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: montagemFixPDims }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-p', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-moeda-p', type: 'inventoryComponent', data: { label: 'Moeda FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-P-{moedaBitola}-{headCode}', sourceFamiliaId: 'fam-FIX-P' }, position: { x: 100, y: 50 } },
        { id: 'n-inv-corpo-p', type: 'inventoryComponent', data: { label: 'Copo FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'COPO-{diametro}', sourceFamiliaId: 'fam-MONTAGEM-COPO' }, position: { x: 100, y: 200 } },
        { id: 'n-inv-barra-p', type: 'inventoryComponent', data: { label: 'Barra Usinada', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'BARRA-USIN-FIX-P-M{bitola}X{comprimento}', sourceFamiliaId: 'fam-USINAGEM-BARRA' }, position: { x: 100, y: 350 } },
        { id: 'n-solda-p1', type: 'etapaFabricacao', data: { label: 'Solda Moeda+Corpo', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 100 } },
        { id: 'n-solda-p2', type: 'etapaFabricacao', data: { label: 'Solda Corpo+Barra', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 300 } },
        { id: 'n-gen-mont-p', type: 'productGeneratorNode', data: { label: 'Gerador FIX-P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'FIX-P {headCode} M{bitola}x{comprimento}', skuTemplate: 'FIX-P-{headCode}-M{bitola}X{comprimento}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-moeda-p', source: 'n-dna-mont-p', target: 'n-inv-moeda-p', type: 'dataEdge' },
        { id: 'e-dna-corpo-p', source: 'n-dna-mont-p', target: 'n-inv-corpo-p', type: 'dataEdge' },
        { id: 'e-dna-barra-p', source: 'n-dna-mont-p', target: 'n-inv-barra-p', type: 'dataEdge' },
        { id: 'e-cod-moeda-p', source: 'n-cod-mont-p', target: 'n-inv-moeda-p', type: 'dataEdge' },
        { id: 'e-moeda-solda-p1', source: 'n-inv-moeda-p', target: 'n-solda-p1', type: 'dataEdge' },
        { id: 'e-corpo-solda-p1', source: 'n-inv-corpo-p', target: 'n-solda-p1', type: 'dataEdge' },
        { id: 'e-solda-p1-p2', source: 'n-solda-p1', target: 'n-solda-p2', type: 'dataEdge' },
        { id: 'e-barra-solda-p2', source: 'n-inv-barra-p', target: 'n-solda-p2', type: 'dataEdge' },
        { id: 'e-solda-gen-p', source: 'n-solda-p2', target: 'n-gen-mont-p', type: 'dataEdge' }
    ]
};

export const MONTAGEM_POR_P_FAMILIA: FamiliaComponente = {
    id: 'fam-MONTAGEM-POR-P',
    nome: 'Montagem POR-P',
    type: 'por_p',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-P',
    nodes: [
        { id: 'n-dna-mont-por', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: montagemPorPDims }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-por', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-moeda-por', type: 'inventoryComponent', data: { label: 'Moeda FIX-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'MOEDA-FIX-P-{moedaBitola}-{headCode}', sourceFamiliaId: 'fam-FIX-P' }, position: { x: 100, y: 100 } },
        { id: 'n-inv-corpo-por', type: 'inventoryComponent', data: { label: 'Copo POR-P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'COPO-{diametro}', sourceFamiliaId: 'fam-MONTAGEM-COPO' }, position: { x: 100, y: 300 } },
        { id: 'n-solda-por', type: 'etapaFabricacao', data: { label: 'Solda Inox', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 200 } },
        { id: 'n-gen-mont-por', type: 'productGeneratorNode', data: { label: 'Gerador POR-P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'POR-P {headCode} M{bitola}', skuTemplate: 'POR-P-{headCode}-M{bitola}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-moeda-por', source: 'n-dna-mont-por', target: 'n-inv-moeda-por', type: 'dataEdge' },
        { id: 'e-dna-corpo-por', source: 'n-dna-mont-por', target: 'n-inv-corpo-por', type: 'dataEdge' },
        { id: 'e-cod-moeda-por', source: 'n-cod-mont-por', target: 'n-inv-moeda-por', type: 'dataEdge' },
        { id: 'e-moeda-solda-por', source: 'n-inv-moeda-por', target: 'n-solda-por', type: 'dataEdge' },
        { id: 'e-corpo-solda-por', source: 'n-inv-corpo-por', target: 'n-solda-por', type: 'dataEdge' },
        { id: 'e-solda-gen-por', source: 'n-solda-por', target: 'n-gen-mont-por', type: 'dataEdge' }
    ]
};

export const SEGREDO_CHAVE_S_FAMILIA: FamiliaComponente = {
    id: 'fam-SEGREDO-CHAVE-S',
    nome: 'Segredo Chave FIX-S',
    type: 'moeda',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-segredo', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: [{ id: 'dim-seg-22', bitola: 22.22, comprimento: 0 }] }, position: { x: 100, y: 100 } },
        { id: 'n-mat-segredo', type: 'materiaPrima', data: { label: 'Chapa (MP)', cost: 0, type: 'materiaPrima', baseMaterialId: 'comp-RM-CHAPA', consumption: 0 }, position: { x: 100, y: 250 } },
        { id: 'n-cod-segredo', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 250, y: 100 } },
        { id: 'n-corte-laser-segredo', type: 'etapaFabricacao', data: { label: 'Corte a Laser', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte-laser' }, position: { x: 400, y: 100 } },
        { id: 'n-gen-segredo', type: 'productGeneratorNode', data: { label: 'Gerador Segredo', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Segredo Chave FIX-S {headCode}', skuTemplate: 'SEGREDO-CHAVE-S-{headCode}' } }, position: { x: 550, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-cod-segredo', source: 'n-dna-segredo', target: 'n-cod-segredo', type: 'dataEdge' },
        { id: 'e-mat-corte-segredo', source: 'n-mat-segredo', target: 'n-corte-laser-segredo', type: 'dataEdge' },
        { id: 'e-cod-corte-segredo', source: 'n-cod-segredo', target: 'n-corte-laser-segredo', type: 'dataEdge' },
        { id: 'e-corte-gen-segredo', source: 'n-corte-laser-segredo', target: 'n-gen-segredo', type: 'dataEdge' }
    ]
};

const hasteChaveDims: ProcessDimension[] = [
    { id: 'dim-haste-70', bitola: 9.52, comprimento: 70, baseMaterialId: 'comp-RM-BARRA-INOX-3-8', consumption: 0.07 }
];

export const HASTE_CHAVE_S_FAMILIA: FamiliaComponente = {
    id: 'fam-HASTE-CHAVE-S',
    nome: 'Haste Chave T 70mm',
    type: 'haste',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-haste', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: hasteChaveDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-haste', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: hasteChaveDims }, position: { x: 300, y: 100 } },
        { id: 'n-usinagem-haste', type: 'etapaFabricacao', data: { label: 'Corte e Usinagem', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-haste', type: 'productGeneratorNode', data: { label: 'Gerador Haste', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Haste Chave T 3/8x70mm', skuTemplate: 'HASTE-CHAVE-T-3-8X70' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-haste', source: 'n-dna-haste', target: 'n-mat-haste', type: 'dataEdge' },
        { id: 'e-mat-usinagem-haste', source: 'n-mat-haste', target: 'n-usinagem-haste', type: 'dataEdge' },
        { id: 'e-usinagem-gen-haste', source: 'n-usinagem-haste', target: 'n-gen-haste', type: 'dataEdge' }
    ]
};

const caboChaveDims: ProcessDimension[] = [
    { id: 'dim-cabo-40', bitola: 9.52, comprimento: 40, baseMaterialId: 'comp-RM-BARRA-INOX-3-8', consumption: 0.04 }
];

export const CABO_CHAVE_S_FAMILIA: FamiliaComponente = {
    id: 'fam-CABO-CHAVE-S',
    nome: 'Cabo Chave T 40mm',
    type: 'cabo',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-cabo', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: caboChaveDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-cabo', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: caboChaveDims }, position: { x: 300, y: 100 } },
        { id: 'n-corte-cabo', type: 'etapaFabricacao', data: { label: 'Corte', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-cabo', type: 'productGeneratorNode', data: { label: 'Gerador Cabo', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Cabo Chave T 3/8x40mm', skuTemplate: 'CABO-CHAVE-T-3-8X40' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-cabo', source: 'n-dna-cabo', target: 'n-mat-cabo', type: 'dataEdge' },
        { id: 'e-mat-corte-cabo', source: 'n-mat-cabo', target: 'n-corte-cabo', type: 'dataEdge' },
        { id: 'e-corte-gen-cabo', source: 'n-corte-cabo', target: 'n-gen-cabo', type: 'dataEdge' }
    ]
};

export const MONTAGEM_CHAVE_S_FAMILIA: FamiliaComponente = {
    id: 'fam-chave-t-s',
    nome: 'Montagem Chave T (FIX-S)',
    type: 'chave_t_s',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-S',
    nodes: [
        { id: 'n-dna-mont-chave', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: [{ id: 'dim-chave-t-s', bitola: 9.52, comprimento: 70 }] }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-chave', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-segredo', type: 'inventoryComponent', data: { label: 'Segredo Chave', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'SEGREDO-CHAVE-S-{headCode}', sourceFamiliaId: 'fam-SEGREDO-CHAVE-S' }, position: { x: 100, y: 50 } },
        { id: 'n-inv-haste', type: 'inventoryComponent', data: { label: 'Haste 70mm', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'HASTE-CHAVE-T-3-8X70', sourceFamiliaId: 'fam-HASTE-CHAVE-S' }, position: { x: 100, y: 200 } },
        { id: 'n-inv-cabo', type: 'inventoryComponent', data: { label: 'Cabo 40mm', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'CABO-CHAVE-T-3-8X40', sourceFamiliaId: 'fam-CABO-CHAVE-S' }, position: { x: 100, y: 350 } },
        { id: 'n-solda-chave1', type: 'etapaFabricacao', data: { label: 'Solda Segredo+Haste', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 100 } },
        { id: 'n-solda-chave2', type: 'etapaFabricacao', data: { label: 'Solda Haste+Cabo', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 300 } },
        { id: 'n-gen-mont-chave', type: 'productGeneratorNode', data: { label: 'Gerador Chave T', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Chave T (FIX-S) {headCode}', skuTemplate: 'CH-T-FIXS-{headCode}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-segredo', source: 'n-dna-mont-chave', target: 'n-inv-segredo', type: 'dataEdge' },
        { id: 'e-cod-segredo', source: 'n-cod-mont-chave', target: 'n-inv-segredo', type: 'dataEdge' },
        { id: 'e-segredo-solda1', source: 'n-inv-segredo', target: 'n-solda-chave1', type: 'dataEdge' },
        { id: 'e-haste-solda1', source: 'n-inv-haste', target: 'n-solda-chave1', type: 'dataEdge' },
        { id: 'e-solda1-solda2', source: 'n-solda-chave1', target: 'n-solda-chave2', type: 'dataEdge' },
        { id: 'e-cabo-solda2', source: 'n-inv-cabo', target: 'n-solda-chave2', type: 'dataEdge' },
        { id: 'e-solda2-gen', source: 'n-solda-chave2', target: 'n-gen-mont-chave', type: 'dataEdge' }
    ]
};

const corpoPitoDims: ProcessDimension[] = [
    { id: 'dim-corpo-pito-40', bitola: 9.52, comprimento: 40, baseMaterialId: 'comp-RM-BARRA-SEXT-3-8', consumption: 0.04 }
];

export const CORPO_CHAVE_PITO_FAMILIA: FamiliaComponente = {
    id: 'fam-CORPO-CHAVE-PITO',
    nome: 'Corpo Chave Pito 40mm',
    type: 'corpo_pito',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-corpo-pito', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: corpoPitoDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-corpo-pito', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: corpoPitoDims }, position: { x: 300, y: 100 } },
        { id: 'n-usinagem-corpo-pito', type: 'etapaFabricacao', data: { label: 'Corte e Usinagem', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-corpo-pito', type: 'productGeneratorNode', data: { label: 'Gerador Corpo Pito', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Corpo Chave Pito 3/8x40mm', skuTemplate: 'CORPO-CHAVE-PITO-3-8X40' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-corpo-pito', source: 'n-dna-corpo-pito', target: 'n-mat-corpo-pito', type: 'dataEdge' },
        { id: 'e-mat-usinagem-corpo-pito', source: 'n-mat-corpo-pito', target: 'n-usinagem-corpo-pito', type: 'dataEdge' },
        { id: 'e-usinagem-gen-corpo-pito', source: 'n-usinagem-corpo-pito', target: 'n-gen-corpo-pito', type: 'dataEdge' }
    ]
};

export const MONTAGEM_CHAVE_PITO_S_FAMILIA: FamiliaComponente = {
    id: 'fam-chave-pito-s',
    nome: 'Montagem Chave Pito (FIX-S)',
    type: 'chave_pito_s',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-S',
    nodes: [
        { id: 'n-dna-mont-pito', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: [{ id: 'dim-chave-pito-s', bitola: 9.52, comprimento: 40 }] }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-pito', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-segredo', type: 'inventoryComponent', data: { label: 'Segredo Chave', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'SEGREDO-CHAVE-S-{headCode}', sourceFamiliaId: 'fam-SEGREDO-CHAVE-S' }, position: { x: 100, y: 50 } },
        { id: 'n-inv-porca-pito', type: 'inventoryComponent', data: { label: 'Porca M10', cost: 0, type: 'inventoryComponent', componentId: 'comp-RM-NUT-M10' }, position: { x: 100, y: 150 } },
        { id: 'n-inv-corpo-pito', type: 'inventoryComponent', data: { label: 'Corpo Pito 40mm', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'CORPO-CHAVE-PITO-3-8X40', sourceFamiliaId: 'fam-CORPO-CHAVE-PITO' }, position: { x: 100, y: 250 } },
        { id: 'n-solda-pito', type: 'etapaFabricacao', data: { label: 'Solda Segredo+Corpo', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 100 } },
        { id: 'n-gen-mont-pito', type: 'productGeneratorNode', data: { label: 'Gerador Chave Pito', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Chave Pito (FIX-S) {headCode}', skuTemplate: 'CH-P-FIXS-{headCode}' } }, position: { x: 700, y: 200 } },
    ],
    edges: [
        { id: 'e-dna-segredo-pito', source: 'n-dna-mont-pito', target: 'n-inv-segredo', type: 'dataEdge' },
        { id: 'e-cod-segredo-pito', source: 'n-cod-mont-pito', target: 'n-inv-segredo', type: 'dataEdge' },
        { id: 'e-segredo-solda-pito', source: 'n-inv-segredo', target: 'n-solda-pito', type: 'dataEdge' },
        { id: 'e-porca-solda-pito', source: 'n-inv-porca-pito', target: 'n-solda-pito', type: 'dataEdge' },
        { id: 'e-corpo-solda-pito', source: 'n-inv-corpo-pito', target: 'n-solda-pito', type: 'dataEdge' },
        { id: 'e-solda-gen-pito', source: 'n-solda-pito', target: 'n-gen-mont-pito', type: 'dataEdge' }
    ]
};

const corpoChavePDims: ProcessDimension[] = [
    { id: 'dim-corpo-p-19-05', bitola: 19.05, comprimento: 35, baseMaterialId: 'comp-RM-TUBO-12-7', consumption: 0.035 },
    { id: 'dim-corpo-p-22-22', bitola: 22.22, comprimento: 35, baseMaterialId: 'comp-RM-TUBO-15-87', consumption: 0.035 },
    { id: 'dim-corpo-p-25-4', bitola: 25.4, comprimento: 35, baseMaterialId: 'comp-RM-TUBO-19-05', consumption: 0.035 }
];

export const CORPO_CHAVE_P_FAMILIA: FamiliaComponente = {
    id: 'fam-CORPO-CHAVE-P',
    nome: 'Corpo Chave P',
    type: 'corpo_chave_p',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-corpo-p', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: corpoChavePDims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-corpo-p', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: corpoChavePDims }, position: { x: 300, y: 100 } },
        { id: 'n-corte-corpo-p', type: 'etapaFabricacao', data: { label: 'Corte', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte' }, position: { x: 500, y: 50 } },
        { id: 'n-usinagem-corpo-p', type: 'etapaFabricacao', data: { label: 'Usinagem CNC', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 150 } },
        { id: 'n-gen-corpo-p', type: 'productGeneratorNode', data: { label: 'Gerador Corpo Chave P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Corpo Chave P {bitola}', skuTemplate: 'CORPO-CHAVE-P-{bitola}' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-corpo-p', source: 'n-dna-corpo-p', target: 'n-mat-corpo-p', type: 'dataEdge' },
        { id: 'e-mat-corte-corpo-p', source: 'n-mat-corpo-p', target: 'n-corte-corpo-p', type: 'dataEdge' },
        { id: 'e-corte-usinagem-corpo-p', source: 'n-corte-corpo-p', target: 'n-usinagem-corpo-p', type: 'dataEdge' },
        { id: 'e-usinagem-gen-corpo-p', source: 'n-usinagem-corpo-p', target: 'n-gen-corpo-p', type: 'dataEdge' }
    ]
};

export const SEGREDO_FIX_P_FAMILIA: FamiliaComponente = {
    id: 'fam-SEGREDO-FIX-P',
    nome: 'Segredo Chave FIX-P',
    type: 'moeda',
    sourcing: 'manufactured',
    category: 'manufacturing',
    nodes: [
        { id: 'n-dna-segredo-p', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: [
            { id: 'dim-seg-p-19-05', bitola: 19.05, comprimento: 0 },
            { id: 'dim-seg-p-22-22', bitola: 22.22, comprimento: 0 },
            { id: 'dim-seg-p-25-4', bitola: 25.4, comprimento: 0 }
        ] }, position: { x: 100, y: 100 } },
        { id: 'n-mat-segredo-p', type: 'materiaPrima', data: { label: 'Chapa (MP)', cost: 0, type: 'materiaPrima', baseMaterialId: 'comp-RM-CHAPA', consumption: 0 }, position: { x: 100, y: 250 } },
        { id: 'n-cod-segredo-p', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 250, y: 100 } },
        { id: 'n-corte-laser-segredo-p', type: 'etapaFabricacao', data: { label: 'Corte a Laser', cost: 0, type: 'etapaFabricacao', operationId: 'op-corte-laser' }, position: { x: 400, y: 100 } },
        { id: 'n-gen-segredo-p', type: 'productGeneratorNode', data: { label: 'Gerador Segredo', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Segredo FIX-P {bitola} {headCode}', skuTemplate: 'SEGREDO-FIX-P-{bitola}-{headCode}' } }, position: { x: 550, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-cod-segredo-p', source: 'n-dna-segredo-p', target: 'n-cod-segredo-p', type: 'dataEdge' },
        { id: 'e-mat-corte-segredo-p', source: 'n-mat-segredo-p', target: 'n-corte-laser-segredo-p', type: 'dataEdge' },
        { id: 'e-cod-corte-segredo-p', source: 'n-cod-segredo-p', target: 'n-corte-laser-segredo-p', type: 'dataEdge' },
        { id: 'e-corte-gen-segredo-p', source: 'n-corte-laser-segredo-p', target: 'n-gen-segredo-p', type: 'dataEdge' }
    ]
};

const montagemChavePDims: ProcessDimension[] = [
    { id: 'dim-mont-p-19-05', bitola: 19.05, comprimento: 35, baseMaterialId: 'comp-RM-NUT-M6', consumption: 1 },
    { id: 'dim-mont-p-22-22', bitola: 22.22, comprimento: 35, baseMaterialId: 'comp-RM-NUT-M8', consumption: 1 },
    { id: 'dim-mont-p-25-4', bitola: 25.4, comprimento: 35, baseMaterialId: 'comp-RM-NUT-M10', consumption: 1 }
];

export const MONTAGEM_CHAVE_P_FAMILIA: FamiliaComponente = {
    id: 'fam-chave-p',
    nome: 'Montagem Chave P',
    type: 'chave_p',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'FIX-P',
    nodes: [
        { id: 'n-dna-mont-chave-p', type: 'dnaTableNode', data: { label: 'DNA Montagem', cost: 0, type: 'dnaTable', dimensions: montagemChavePDims }, position: { x: 100, y: -150 } },
        { id: 'n-cod-mont-chave-p', type: 'codificationTable', data: { label: 'Tabela de Códigos', cost: 0, type: 'codificationTable', headCodes: SHARED_HEAD_CODES.filter(hc => hc.type === 'MOEDA') }, position: { x: 350, y: -150 } },
        { id: 'n-inv-segredo-p', type: 'inventoryComponent', data: { label: 'Segredo Chave', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'SEGREDO-FIX-P-{bitola}-{headCode}', sourceFamiliaId: 'fam-SEGREDO-FIX-P' }, position: { x: 100, y: 50 } },
        { id: 'n-inv-corpo-chave-p', type: 'inventoryComponent', data: { label: 'Corpo Chave P', cost: 0, type: 'inventoryComponent', componentIdTemplate: 'CORPO-CHAVE-P-{bitola}', sourceFamiliaId: 'fam-CORPO-CHAVE-P' }, position: { x: 100, y: 200 } },
        { id: 'n-inv-porca-p', type: 'materialMapping', data: { label: 'Porca Mapeada', cost: 0, type: 'materialMapping', dimensions: montagemChavePDims }, position: { x: 100, y: 350 } },
        { id: 'n-solda-chave-p1', type: 'etapaFabricacao', data: { label: 'Solda Segredo+Corpo', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 100 } },
        { id: 'n-solda-chave-p2', type: 'etapaFabricacao', data: { label: 'Solda Corpo+Porca', cost: 0, type: 'etapaFabricacao', operationId: 'op-solda' }, position: { x: 400, y: 250 } },
        { id: 'n-gravacao-chave-p', type: 'etapaFabricacao', data: { label: 'Gravação a Laser', cost: 0, type: 'etapaFabricacao', operationId: 'op-gravacao' }, position: { x: 550, y: 150 } },
        { id: 'n-gen-mont-chave-p', type: 'productGeneratorNode', data: { label: 'Gerador Chave P', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Chave P {bitola} {headCode}', skuTemplate: 'CHAVE-P-{bitola}-{headCode}' } }, position: { x: 750, y: 150 } },
    ],
    edges: [
        { id: 'e-dna-segredo-p', source: 'n-dna-mont-chave-p', target: 'n-inv-segredo-p', type: 'dataEdge' },
        { id: 'e-dna-corpo-p', source: 'n-dna-mont-chave-p', target: 'n-inv-corpo-chave-p', type: 'dataEdge' },
        { id: 'e-dna-porca-p', source: 'n-dna-mont-chave-p', target: 'n-inv-porca-p', type: 'dataEdge' },
        { id: 'e-cod-segredo-p', source: 'n-cod-mont-chave-p', target: 'n-inv-segredo-p', type: 'dataEdge' },
        { id: 'e-segredo-solda-p1', source: 'n-inv-segredo-p', target: 'n-solda-chave-p1', type: 'dataEdge' },
        { id: 'e-corpo-solda-p1', source: 'n-inv-corpo-chave-p', target: 'n-solda-chave-p1', type: 'dataEdge' },
        { id: 'e-solda-p1-p2', source: 'n-solda-chave-p1', target: 'n-solda-chave-p2', type: 'dataEdge' },
        { id: 'e-porca-solda-p2', source: 'n-inv-porca-p', target: 'n-solda-chave-p2', type: 'dataEdge' },
        { id: 'e-solda-p2-grav', source: 'n-solda-chave-p2', target: 'n-gravacao-chave-p', type: 'dataEdge' },
        { id: 'e-grav-gen-p', source: 'n-gravacao-chave-p', target: 'n-gen-mont-chave-p', type: 'dataEdge' }
    ]
};

export const FIX_GENERIC_FAMILIA: FamiliaComponente = {
    id: 'fam-fixadores',
    nome: 'Processo Genérico de Fixadores',
    type: 'fix_s',
    sourcing: 'manufactured',
    category: 'manufacturing',
    masterProcessTag: 'Generico',
    nodes: [
        { id: 'n-dna-fix', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: dims }, position: { x: 100, y: 100 } },
        { id: 'n-mat-fix', type: 'materialMapping', data: { label: 'Mapeamento de Material', cost: 0, type: 'materialMapping', dimensions: dims }, position: { x: 300, y: 100 } },
        { id: 'n-usin-fix', type: 'etapaFabricacao', data: { label: 'Usinagem', cost: 0, type: 'etapaFabricacao', operationId: 'op-usin-cnc' }, position: { x: 500, y: 100 } },
        { id: 'n-gen-fix', type: 'productGeneratorNode', data: { label: 'Gerador FIX-S', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Fixador Genérico {bitola}x{comprimento}', skuTemplate: 'FIX-S-GENERIC-{bitola}x{comprimento}mm' } }, position: { x: 700, y: 100 } },
    ],
    edges: [
        { id: 'e-dna-mat-fix', source: 'n-dna-fix', target: 'n-mat-fix', type: 'dataEdge' },
        { id: 'e-mat-usin-fix', source: 'n-mat-fix', target: 'n-usin-fix', type: 'dataEdge' },
        { id: 'e-usin-gen-fix', source: 'n-usin-fix', target: 'n-gen-fix', type: 'dataEdge' }
    ]
};

export const EMBALAGENS_FAMILIA: FamiliaComponente = {
    id: 'fam-embalagens',
    nome: 'Embalagens e Acessórios',
    type: 'embalagem',
    sourcing: 'purchased',
    category: 'kit_assembly',
    nodes: [],
    edges: []
};

export const INITIAL_FAMILIAS: FamiliaComponente[] = [FIX_GENERIC_FAMILIA, FIX_S_FAMILIA, FIX_P_FAMILIA, USINAGEM_PARAFUSO_FAMILIA, USINAGEM_BARRA_FAMILIA, CORTE_TUBOS_FAMILIA, MONTAGEM_COPO_FAMILIA, MONTAGEM_FIX_S_FAMILIA, MONTAGEM_FIX_S_EXT_FAMILIA, MONTAGEM_FIX_P_FAMILIA, MONTAGEM_POR_P_FAMILIA, SEGREDO_CHAVE_S_FAMILIA, HASTE_CHAVE_S_FAMILIA, CABO_CHAVE_S_FAMILIA, MONTAGEM_CHAVE_S_FAMILIA, CORPO_CHAVE_PITO_FAMILIA, MONTAGEM_CHAVE_PITO_S_FAMILIA, SEGREDO_FIX_P_FAMILIA, CORPO_CHAVE_P_FAMILIA, MONTAGEM_CHAVE_P_FAMILIA, EMBALAGENS_FAMILIA];
