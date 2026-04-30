import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import * as api from '../hooks/api';

interface SyncConflictModalProps {
  localDate: Date;
  firebaseDate: Date;
  onResolve: (decision: 'local' | 'server') => void;
}

const formatDate = (date: Date) => date.toLocaleString('pt-BR');

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ localDate, firebaseDate, onResolve }) => {

    const handleDownloadBackup = async () => {
        const localData = await api.getLocalData();
        const jsonString = JSON.stringify(localData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `autro_backup_local_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal isOpen={true} onClose={() => {}} title="Conflito de Sincronização Encontrado">
            <div className="text-black space-y-4">
                <p className="font-semibold text-lg">Foram detectadas alterações offline.</p>
                <p>O aplicativo foi usado offline e agora está online novamente. Por favor, escolha qual versão dos dados você deseja manter.</p>

                <div className="grid grid-cols-2 gap-4 my-4 text-center">
                    <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                        <h4 className="font-bold">Dados Locais (Offline)</h4>
                        <p className="text-sm">Última alteração:</p>
                        <p className="font-semibold">{formatDate(localDate)}</p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
                        <h4 className="font-bold">Dados do Servidor (Online)</h4>
                        <p className="text-sm">Última alteração:</p>
                        <p className="font-semibold">{formatDate(firebaseDate)}</p>
                    </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                    <h4 className="font-semibold text-black">Ações Recomendadas:</h4>
                    <div className="p-3 border rounded-lg bg-gray-50">
                        <p className="font-bold">Passo 1 (Opcional, mas Recomendado):</p>
                        <p className="text-sm text-gray-600 mb-2">Salve uma cópia de segurança das suas alterações offline antes de decidir.</p>
                        <Button onClick={handleDownloadBackup} variant="secondary">Baixar Backup dos Dados Locais</Button>
                    </div>
                    <div className="p-3 border rounded-lg bg-gray-50">
                        <p className="font-bold">Passo 2: Escolha qual versão manter</p>
                         <div className="flex gap-4 mt-2">
                             <Button onClick={() => onResolve('local')} className="flex-1">
                                Manter Dados Locais <span className="font-normal text-xs block">(Sobrescrever o servidor)</span>
                             </Button>
                             <Button onClick={() => onResolve('server')} variant="danger" className="flex-1">
                                Manter Dados do Servidor <span className="font-normal text-xs block">(Descartar alterações locais)</span>
                            </Button>
                         </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};