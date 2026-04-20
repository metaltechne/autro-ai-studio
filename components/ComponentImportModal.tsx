
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Component, FamiliaComponente, ComponentImportData, StockAdjustmentImportData, InventoryHook, ManufacturingHook } from '../types';

interface ComponentImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
    inventory: InventoryHook;
    manufacturing: ManufacturingHook;
}

type ImportMode = 'create' | 'adjust' | null;

interface ValidatedRow {
    data: ComponentImportData | StockAdjustmentImportData;
    isValid: boolean;
    error?: string;
    // For adjustment mode
    currentStock?: number;
    adjustment?: number;
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full">
        <svg className="animate-spin h-8 w-8 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

export const ComponentImportModal: React.FC<ComponentImportModalProps> = ({
    isOpen,
    onClose,
    file,
    inventory,
    manufacturing,
}) => {
    const { components: existingComponents, addMultipleComponents, adjustStockFromImport, recalculateAllComponentCosts } = inventory;
    const { familias } = manufacturing;

    const [status, setStatus] = useState<'idle' | 'parsing' | 'validating' | 'ready' | 'importing' | 'error'>('idle');
    const [validatedData, setValidatedData] = useState<ValidatedRow[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [importMode, setImportMode] = useState<ImportMode>(null);

    const familiaMap = useMemo(() => new Map(familias.map(f => [f.id, f.nome])), [familias]);
    const processControlledFamiliaIds = useMemo(() => new Set(familias.filter(f => f.nodes?.some(n => n.data.type === 'productGenerator')).map(f => f.id)), [familias]);
    const existingSkuMap = useMemo(() => new Map(existingComponents.map(c => [c.sku.toLowerCase(), c])), [existingComponents]);
    
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
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null });

            if (jsonData.length === 0) {
                setErrorMessage("A planilha está vazia.");
                setStatus('error');
                return;
            }

            const headers = Object.keys(jsonData[0]);
            // Adjustment file headers from export: 'Nome', 'SKU', 'Estoque', ...
            const isAdjustmentFile = headers.includes('SKU') && headers.includes('Estoque') && !headers.includes('familiaId') && !headers.includes('Estoque_Inicial');
            // Creation file headers from template: 'Nome', 'SKU', 'familiaId', 'Estoque_Inicial'
            const isCreationFile = headers.includes('Nome') && headers.includes('SKU') && headers.includes('familiaId') && headers.includes('Estoque_Inicial');

            setStatus('validating');
            if (isAdjustmentFile) {
                setImportMode('adjust');
                validateStockAdjustmentData(jsonData);
            } else if (isCreationFile) {
                setImportMode('create');
                validateCreationData(jsonData);
            } else {
                setErrorMessage("Formato de planilha inválido. Verifique se as colunas correspondem ao modelo de importação ou ao arquivo de exportação de componentes.");
                setStatus('error');
            }
        } catch (error) {
            console.error("Error parsing file:", error);
            setErrorMessage("Falha ao ler o arquivo. Verifique se o formato está correto.");
            setStatus('error');
        }
    };

    const validateCreationData = (data: ComponentImportData[]) => {
        const seenSkus = new Set<string>();
        const results: ValidatedRow[] = data.map(row => {
            const { Nome, SKU, familiaId, Estoque_Inicial } = row;

            if (!Nome || !SKU || !familiaId) {
                return { data: row, isValid: false, error: "As colunas 'Nome', 'SKU' e 'familiaId' são obrigatórias." };
            }
            if (!familiaMap.has(familiaId)) {
                return { data: row, isValid: false, error: `ID de família '${familiaId}' inválido.` };
            }
            if (processControlledFamiliaIds.has(familiaId)) {
                return { data: row, isValid: false, error: `A família '${familiaMap.get(familiaId)}' é controlada por processo e não permite importação manual.` };
            }
            if (existingSkuMap.has(SKU.toLowerCase())) {
                return { data: row, isValid: false, error: `SKU '${SKU}' já existe no sistema.` };
            }
            if (seenSkus.has(SKU.toLowerCase())) {
                 return { data: row, isValid: false, error: `SKU '${SKU}' está duplicado na planilha.` };
            }
            if (Estoque_Inicial !== null && Estoque_Inicial !== undefined && (typeof Estoque_Inicial !== 'number' || Estoque_Inicial < 0)) {
                return { data: row, isValid: false, error: "Estoque Inicial deve ser um número positivo." };
            }
            
            seenSkus.add(SKU.toLowerCase());
            return { data: { ...row, Estoque_Inicial: Estoque_Inicial || 0 }, isValid: true };
        });
        setValidatedData(results);
        setStatus('ready');
    };

    const validateStockAdjustmentData = (data: StockAdjustmentImportData[]) => {
        const results: ValidatedRow[] = data.map(row => {
            const { SKU, Estoque } = row;
            if (!SKU) {
                return { data: row, isValid: false, error: "Coluna 'SKU' é obrigatória." };
            }
            if (Estoque === null || Estoque === undefined || typeof Estoque !== 'number' || Estoque < 0) {
                return { data: row, isValid: false, error: "'Estoque' deve ser um número positivo." };
            }

            const component = existingSkuMap.get(String(SKU).toLowerCase());
            if (!component) {
                return { data: row, isValid: false, error: `SKU '${SKU}' não encontrado no sistema.` };
            }

            return {
                data: row,
                isValid: true,
                currentStock: component.stock,
                adjustment: Estoque - component.stock
            };
        });
        setValidatedData(results);
        setStatus('ready');
    };

    const handleConfirm = async () => {
        setStatus('importing');
        try {
            if (importMode === 'create') {
                const dataToImport = validatedData.filter(r => r.isValid).map(r => r.data as ComponentImportData);
                await addMultipleComponents(dataToImport);
                // After importing, trigger a cost recalculation to update the new components
                await recalculateAllComponentCosts(familias, inventory.components);
            } else if (importMode === 'adjust') {
                const dataToAdjust = validatedData.filter(r => r.isValid).map(r => r.data as StockAdjustmentImportData);
                await adjustStockFromImport(dataToAdjust);
            }
            onClose();
        } catch (error) {
            console.error("Import failed:", error);
            setErrorMessage("Ocorreu um erro durante a importação. Tente novamente.");
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

    const renderContent = () => {
        switch (status) {
            case 'parsing':
            case 'validating':
                return <div className="py-20"><Spinner /></div>;
            case 'error':
                return <div className="text-center py-10 text-red-600 bg-red-50 p-4 rounded-md">{errorMessage}</div>;
            case 'importing':
                 return <div className="py-20 flex flex-col items-center gap-4"><Spinner /><p className="text-black">Importando dados...</p></div>;
            case 'ready':
                if (importMode === 'create') {
                    return (
                        <div>
                            <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-md">
                                <h4 className="font-semibold text-black">Pré-visualização da Criação</h4>
                                <div className="flex gap-4 text-sm font-medium">
                                    <span className="text-green-600">{validCount} linhas válidas</span>
                                    <span className="text-red-600">{invalidCount} linhas com erros</span>
                                </div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Família</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estoque</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {validatedData.map((row, index) => {
                                            const rowData = row.data as ComponentImportData;
                                            return (
                                                <tr key={index} className={!row.isValid ? 'bg-red-50' : ''}>
                                                    <td className="px-3 py-2 text-center">
                                                        {row.isValid 
                                                            ? <span title="Válido" className="text-green-500">✅</span> 
                                                            : <span title={row.error} className="text-red-500 cursor-help">❌</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-black">{rowData.Nome}</td>
                                                    <td className="px-3 py-2 text-gray-600">{rowData.SKU}</td>
                                                    <td className="px-3 py-2 text-gray-600" title={rowData.familiaId}>{familiaMap.get(rowData.familiaId) || 'Inválida'}</td>
                                                    <td className="px-3 py-2 text-gray-600">{rowData.Estoque_Inicial || 0}</td>
                                                    <td className="px-3 py-2 text-red-700 text-xs">{row.error || '---'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                }
                if (importMode === 'adjust') {
                     return (
                        <div>
                            <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-md">
                                <h4 className="font-semibold text-black">Pré-visualização do Ajuste de Estoque</h4>
                                 <div className="flex gap-4 text-sm font-medium">
                                    <span className="text-green-600">{validCount} linhas válidas</span>
                                    <span className="text-red-600">{invalidCount} linhas com erros</span>
                                </div>
                            </div>
                             <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque Atual</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Novo Estoque</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ajuste</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {validatedData.map((row, index) => {
                                            const rowData = row.data as StockAdjustmentImportData;
                                            return (
                                                <tr key={index} className={!row.isValid ? 'bg-red-50' : ''}>
                                                    <td className="px-3 py-2 text-gray-600 font-medium">{rowData.SKU}</td>
                                                    <td className="px-3 py-2 text-gray-600 text-right">{row.isValid ? row.currentStock : 'N/A'}</td>
                                                    <td className="px-3 py-2 text-black font-semibold text-right">{rowData.Estoque}</td>
                                                    <td className={`px-3 py-2 font-bold text-right ${row.adjustment === 0 ? 'text-gray-500' : (row.adjustment || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {row.isValid ? `${(row.adjustment || 0) > 0 ? '+' : ''}${row.adjustment}` : 'N/A'}
                                                    </td>
                                                    <td className="px-3 py-2 text-red-700 text-xs">{row.error || '---'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                }
                return null;
            default:
                return null;
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Componentes via Planilha" size="4xl">
            {renderContent()}
            <div className="flex justify-end pt-6 border-t mt-4 gap-2">
                <Button variant="secondary" onClick={onClose} disabled={status === 'importing'}>Cancelar</Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={status !== 'ready' || validCount === 0}
                >
                    {status === 'importing' ? 'Importando...' : `Confirmar e Importar ${validCount} Itens`}
                </Button>
            </div>
        </Modal>
    );
};
