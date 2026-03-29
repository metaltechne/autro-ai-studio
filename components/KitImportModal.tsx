import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Kit, KitImportData, InventoryHook, KitComponent } from '../types';

interface KitImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
    inventory: InventoryHook;
}

type ImportMode = 'create' | 'update' | 'mixed';

interface ValidatedRow {
    data: KitImportData;
    isValid: boolean;
    error?: string;
    mode: 'create' | 'update';
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full">
        <svg className="animate-spin h-8 w-8 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

// Helper function to parse composition strings, needed for updating kits.
const parseCompositionString = (str: string, isFastener: boolean): (KitComponent | { dimension: string; quantity: number })[] => {
    if (!str) return [];
    return str.split(',').map(part => {
        const [key, qtyStr] = part.split(':');
        const quantity = parseInt(qtyStr, 10);
        if (!key || isNaN(quantity)) return null;
        if (isFastener) return { dimension: key.trim(), quantity };
        return { componentSku: key.trim(), quantity };
    }).filter(Boolean) as any;
};

export const KitImportModal: React.FC<KitImportModalProps> = ({ isOpen, onClose, file, inventory }) => {
    const { kits: existingKits, components, addMultipleKits, updateMultipleKits } = inventory;
    const [status, setStatus] = useState<'idle' | 'parsing' | 'validating' | 'ready' | 'importing' | 'error'>('idle');
    const [validatedData, setValidatedData] = useState<ValidatedRow[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [importMode, setImportMode] = useState<ImportMode | null>(null);

    const existingKitSkuMap = useMemo(() => new Map(existingKits.map(k => [k.sku.toLowerCase(), k])), [existingKits]);
    const existingComponentSkuMap = useMemo(() => new Map(components.map(c => [c.sku.toLowerCase(), c])), [components]);

    useEffect(() => {
        if (isOpen && file) {
            processFile();
        } else {
            setStatus('idle');
            setValidatedData([]);
            setErrorMessage('');
            setImportMode(null);
        }
    }, [isOpen, file]);

    const processFile = async () => {
        if (!file) return;
        setStatus('parsing');

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<KitImportData>(worksheet, { defval: null });

            if (jsonData.length === 0) {
                setErrorMessage("A planilha está vazia.");
                setStatus('error');
                return;
            }

            setStatus('validating');
            validateData(jsonData);
        } catch (error) {
            console.error("Error parsing file:", error);
            setErrorMessage("Falha ao ler o arquivo. Verifique se o formato está correto.");
            setStatus('error');
        }
    };

    const validateData = (data: KitImportData[]) => {
        const seenSkus = new Set<string>();
        let createCount = 0;
        let updateCount = 0;

        const results: ValidatedRow[] = data.map(row => {
            const sku = row.SKU?.trim();
            const mode = existingKitSkuMap.has(sku?.toLowerCase()) ? 'update' : 'create';

            // Basic field validation
            if (!row['Nome do Kit'] || !sku || !row.Marca || !row.Modelo || !row.Ano) {
                return { data: row, isValid: false, error: "Todas as colunas básicas (Nome, SKU, Marca, Modelo, Ano) são obrigatórias.", mode };
            }

            // SKU uniqueness validation
            if (mode === 'create') {
                if (seenSkus.has(sku.toLowerCase())) {
                    return { data: row, isValid: false, error: `SKU '${sku}' está duplicado na planilha.`, mode };
                }
                seenSkus.add(sku.toLowerCase());
            }

            // Composition validation
            const componentStr = row['Componentes (SKU:Qtd)'] || '';
            const fastenerStr = row['Fixadores (Dimensao:Qtd)'] || '';
            let compositionErrors: string[] = [];

            if (componentStr) {
                componentStr.split(',').forEach(part => {
                    const [compSku, qtyStr] = part.split(':').map(s => s.trim());
                    if (!compSku || isNaN(parseInt(qtyStr, 10))) compositionErrors.push(`Formato inválido: '${part}'.`);
                    else if (!existingComponentSkuMap.has(compSku.toLowerCase())) compositionErrors.push(`SKU do componente '${compSku}' não existe.`);
                });
            }
            if (fastenerStr) {
                fastenerStr.split(',').forEach(part => {
                    const [dim, qtyStr] = part.split(':').map(s => s.trim());
                    if (!dim || isNaN(parseInt(qtyStr, 10)) || !dim.match(/^(?:M)?\d+x\d+(?:mm)?$/i)) {
                        compositionErrors.push(`Formato do fixador inválido: '${part}'. Use '8x40mm:2' ou 'M6x20:4'.`);
                    }
                });
            }
            
            if (compositionErrors.length > 0) {
                return { data: row, isValid: false, error: compositionErrors.join(' '), mode };
            }

            if (mode === 'create') createCount++;
            else updateCount++;

            return { data: row, isValid: true, mode };
        });

        if (createCount > 0 && updateCount > 0) setImportMode('mixed');
        else if (createCount > 0) setImportMode('create');
        else if (updateCount > 0) setImportMode('update');

        setValidatedData(results);
        setStatus('ready');
    };

    const handleConfirm = async () => {
        setStatus('importing');
        try {
            const kitsToCreateData = validatedData.filter(r => r.isValid && r.mode === 'create').map(r => r.data);
            const kitsToUpdateData = validatedData.filter(r => r.isValid && r.mode === 'update').map(r => r.data);

            if (kitsToCreateData.length > 0) {
                const kitsToCreate: Kit[] = kitsToCreateData.map(item => {
                    const components = parseCompositionString(item['Componentes (SKU:Qtd)'], false) as KitComponent[];
                    const fasteners = parseCompositionString(item['Fixadores (Dimensao:Qtd)'], true) as { dimension: string; quantity: number }[];
                    return {
                        id: `kit-${item.SKU}-${Date.now()}`,
                        name: item['Nome do Kit'],
                        sku: item.SKU,
                        marca: item.Marca,
                        modelo: item.Modelo,
                        ano: item.Ano,
                        components: components,
                        requiredFasteners: fasteners,
                        sellingPriceOverride: item['Preco de Venda (Opcional)'],
                    };
                });
                await addMultipleKits(kitsToCreate);
            }
            
            if (kitsToUpdateData.length > 0) {
                const kitsToUpdate: Kit[] = kitsToUpdateData.map(item => {
                    const existingKit = existingKitSkuMap.get(item.SKU.toLowerCase())!;
                    const components = parseCompositionString(item['Componentes (SKU:Qtd)'], false) as KitComponent[];
                    const fasteners = parseCompositionString(item['Fixadores (Dimensao:Qtd)'], true) as { dimension: string; quantity: number }[];
                    return {
                        id: existingKit.id, // Keep existing ID for update
                        name: item['Nome do Kit'],
                        sku: item.SKU,
                        marca: item.Marca,
                        modelo: item.Modelo,
                        ano: item.Ano,
                        components: components,
                        requiredFasteners: fasteners,
                    };
                });
                await updateMultipleKits(kitsToUpdate);
            }

            onClose();
        } catch (error) {
            console.error("Import failed:", error);
            setErrorMessage("Ocorreu um erro durante a importação.");
            setStatus('error');
        }
    };

    const { validCount, invalidCount } = useMemo(() => {
        return validatedData.reduce((acc, row) => {
            if (row.isValid) acc.validCount++;
            else acc.invalidCount++;
            return acc;
        }, { validCount: 0, invalidCount: 0 });
    }, [validatedData]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar/Atualizar Kits via Planilha" size="4xl">
            {status === 'parsing' || status === 'validating' ? <div className="py-20"><Spinner /></div> :
             status === 'error' ? <div className="text-center py-10 text-red-600 bg-red-50 p-4 rounded-md">{errorMessage}</div> :
             status === 'importing' ? <div className="py-20 flex flex-col items-center gap-4"><Spinner /><p>Importando dados...</p></div> :
             (
                <div>
                    <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-md">
                        <h4 className="font-semibold text-black">Pré-visualização da Importação</h4>
                        <div className="flex gap-4 text-sm font-medium">
                            <span className="text-green-600">{validCount} linhas válidas</span>
                            <span className="text-red-600">{invalidCount} linhas com erros</span>
                        </div>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome do Kit</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {validatedData.map((row, index) => (
                                    <tr key={index} className={!row.isValid ? 'bg-red-50' : ''}>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                row.mode === 'create' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {row.mode === 'create' ? 'Criar' : 'Atualizar'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-black">{row.data['Nome do Kit']}</td>
                                        <td className="px-3 py-2 text-gray-600">{row.data.SKU}</td>
                                        <td className="px-3 py-2 text-red-700 text-xs">{row.error || '---'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
            <div className="flex justify-end pt-6 border-t mt-4 gap-2">
                <Button variant="secondary" onClick={onClose} disabled={status === 'importing'}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={status !== 'ready' || validCount === 0}>
                    {status === 'importing' ? 'Importando...' : `Confirmar e Processar ${validCount} Kits`}
                </Button>
            </div>
        </Modal>
    );
};