import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Component, InventoryLog, InventoryLogReason } from '../types';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: Component;
  logs: InventoryLog[];
}

const reasonLabels: Record<InventoryLogReason, string> = {
    compra_fornecedor: 'Compra de Fornecedor',
    devolucao_cliente: 'Devolução de Cliente',
    ajuste_inventario_positivo: 'Ajuste de Inventário (Positivo)',
    uso_producao_kit: 'Uso em Produção de Kit',
    venda_direta: 'Venda Direta',
    ajuste_inventario_negativo: 'Ajuste de Inventário (Negativo)',
    perda_dano: 'Perda ou Dano',
    estoque_inicial: 'Estoque Inicial',
    fabricacao_interna: 'Fabricação Interna',
    corte_substituição: 'Corte (Substituição)',
    conclusao_ordem_producao: 'Conclusão de Ordem de Produção',
    consumo_fabricacao: 'Consumo em Fabricação',
    outro: 'Outro',
};

export const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({ isOpen, onClose, component, logs }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Histórico de Movimentações: ${component.name}`}>
      <div className="max-h-[60vh] overflow-y-auto">
        {logs.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map(log => (
                        <tr key={log.id}>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(log.date).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span className={`font-semibold ${log.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                                    {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-black">
                                {log.quantity.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {reasonLabels[log.reason] || 'N/A'}
                            </td>
                            <td className="px-4 py-4 whitespace-pre-wrap text-sm text-gray-500" title={log.notes}>
                                {log.notes || '---'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) : (
          <p className="text-center text-gray-500 py-8">Nenhuma movimentação registrada para este componente.</p>
        )}
      </div>
      <div className="flex justify-end pt-4 mt-4 border-t">
        <Button onClick={onClose} variant="secondary">Fechar</Button>
      </div>
    </Modal>
  );
};