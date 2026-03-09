
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
];

// --- 3. OPERAÇÕES PADRÃO ---
export const INITIAL_OPERATIONS: StandardOperation[] = [
    { id: 'op-usin-cnc', name: 'Usinagem CNC', category: 'CNC', workStationId: 'ws-cnc', timeSeconds: 300, operationConsumables: [{ consumableId: 'cons-pastilha', quantity: 0.2 }] },
    { id: 'op-solda', name: 'Solda Inox', category: 'SOLDA', workStationId: 'ws-soldador', timeSeconds: 60, operationConsumables: [{ consumableId: 'cons-gas', quantity: 1 }] },
];

// --- 4. MATÉRIAS-PRIMAS ---
export const INITIAL_COMPONENTS: Component[] = [
    { id: 'comp-RM-PAR-M8x40', name: 'Parafuso Sextavado M8x40', sku: 'RM-PAR-M8x40', type: 'raw_material', stock: 500, purchaseCost: 0.86, custoFabricacao: 0, custoMateriaPrima: 0 },
    { id: 'comp-RM-PAR-M10x45', name: 'Parafuso Sextavado M10x45', sku: 'RM-PAR-M10x45', type: 'raw_material', stock: 500, purchaseCost: 1.54, custoFabricacao: 0, custoMateriaPrima: 0 },
];

export const INITIAL_KITS: Kit[] = [];
export const INITIAL_INVENTORY_LOGS: InventoryLog[] = [];

// --- 5. CÓDIGOS GEOMÉTRICOS ---
export const SHARED_HEAD_CODES: ProcessHeadCode[] = [
    { id: 'c-A0002', code: 'A-0002', type: 'FIX' },
];

// --- 6. PROCESSOS (EXEMPLO DE RAMIFICAÇÃO) ---

const dims: ProcessDimension[] = [
    { id: 'dim-m8', bitola: 8, comprimento: 40, baseMaterialId: 'comp-RM-PAR-M8x40', consumption: 1 },
    { id: 'dim-m10', bitola: 10, comprimento: 45, baseMaterialId: 'comp-RM-PAR-M10x45', consumption: 1 },
];

export const INITIAL_FAMILIAS: FamiliaComponente[] = [
    {
        id: 'fam-fixadores',
        nome: 'Fixadores Usinados (Ramificados)',
        sourcing: 'manufactured',
        category: 'manufacturing',
        nodes: [
            { id: 'n-dna', type: 'dnaTableNode', data: { label: 'DNA Geométrico', cost: 0, type: 'dnaTable', dimensions: dims }, position: { x: -600, y: 150 } },
            { id: 'n-map', type: 'materialMappingNode', data: { label: 'Mapeamento Insumos', cost: 0, type: 'materialMapping', dimensions: dims }, position: { x: -150, y: 150 } },
            
            // Ramificação M8
            { id: 'n-proc-m8', type: 'etapaFabricacaoNode', data: { label: 'Torneamento M8', cost: 0, type: 'etapaFabricacao', manualTimeSeconds: 120, manualOperatorId: 'ws-torneiro' }, position: { x: 300, y: 50 } },
            
            // Ramificação M10
            { id: 'n-proc-m10', type: 'etapaFabricacaoNode', data: { label: 'Usinagem CNC M10', cost: 0, type: 'etapaFabricacao', manualTimeSeconds: 400, manualOperatorId: 'ws-cnc' }, position: { x: 300, y: 300 } },
            
            { id: 'n-gen', type: 'productGeneratorNode', data: { label: 'Gerador Final', cost: 0, type: 'productGenerator', generationConfig: { nameTemplate: 'Fixador M{bitola}x{comprimento}', skuTemplate: 'FIX-M{bitola}X{comprimento}' } }, position: { x: 800, y: 180 } },
        ],
        edges: [
            // Ligação de Dados Master (DNA -> MAPEAMENTO) usando os novos IDs
            { id: 'e-dna-map', source: 'n-dna', sourceHandle: 'data-out', target: 'n-map', targetHandle: 'data-in', type: 'dataEdge' },
            
            // Conexões isoladas pelo handle row-dim-m8
            { id: 'e-m8-in', source: 'n-map', sourceHandle: 'row-dim-m8', target: 'n-proc-m8', type: 'processEdge' },
            { id: 'e-m8-out', source: 'n-proc-m8', target: 'n-gen', targetHandle: 'process-in', type: 'processEdge' },
            
            // Conexões isoladas pelo handle row-dim-m10
            { id: 'e-m10-in', source: 'n-map', sourceHandle: 'row-dim-m10', target: 'n-proc-m10', type: 'processEdge' },
            { id: 'e-m10-out', source: 'n-proc-m10', target: 'n-gen', targetHandle: 'process-in', type: 'processEdge' },
        ]
    }
];
