
import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportEngineeringBackup, importEngineeringBackup } from '../../services/manufacturingExcel';
import { ManufacturingHook } from '../../types';

interface ManufacturingBackupModalProps {
    isOpen: boolean;
    onClose: () => void;
    manufacturing: ManufacturingHook;
}

export const ManufacturingBackupModal: React.FC<ManufacturingBackupModalProps> = ({
    isOpen,
    onClose,
    manufacturing
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        setIsExporting(true);
        setStatus(null);
        try {
            await exportEngineeringBackup({
                familias: manufacturing.familias,
                workStations: manufacturing.workStations,
                consumables: manufacturing.consumables,
                standardOperations: manufacturing.standardOperations
            });
            setStatus({ type: 'success', message: 'Backup exportado com sucesso!' });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Erro ao exportar backup.' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setStatus(null);
        try {
            const data = await importEngineeringBackup(file);
            
            // Confirm with user
            if (window.confirm('Isso substituirá as Famílias, Postos, Consumíveis e Operações existentes. Deseja continuar?')) {
                // Bulk save to the hook which then triggers isDirty or saves accordingly
                // Based on useManufacturing.ts, we need to call the save handlers
                await manufacturing.saveMultipleFamilias(data.familias);
                await manufacturing.saveWorkStations(data.workStations);
                await manufacturing.saveConsumables(data.consumables);
                await manufacturing.saveOperations(data.standardOperations);
                
                setStatus({ type: 'success', message: 'Dados importados com sucesso! Não esqueça de Salvar Alterações.' });
            }
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Erro ao importar arquivo. Verifique se o formato está correto.' });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Backup e Importação da Engenharia">
            <div className="p-6 space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                        Utilize esta ferramenta para exportar todos os dados de engenharia (processos, postos de trabalho, 
                        consumíveis e operações padrão) para um arquivo Excel que pode ser editado ou usado como backup.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={handleExport}
                        disabled={isExporting || isImporting}
                        className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-3xl hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
                            {isExporting ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Download className="w-8 h-8 text-blue-500" />}
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Exportar Backup</h4>
                        <p className="text-xs text-slate-500 font-medium">Baixar planilha .xlsx</p>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExporting || isImporting}
                        className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 rounded-3xl hover:border-green-500 hover:bg-green-50/50 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4 group-hover:bg-green-100 group-hover:scale-110 transition-all">
                            {isImporting ? <Loader2 className="w-8 h-8 text-green-500 animate-spin" /> : <Upload className="w-8 h-8 text-green-500" />}
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Importar Planilha</h4>
                        <p className="text-xs text-slate-500 font-medium">Carregar backup existente</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx"
                            onChange={handleImport}
                        />
                    </button>
                </div>

                {status && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <p className="text-sm font-bold uppercase tracking-tight">{status.message}</p>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </Modal>
    );
};
