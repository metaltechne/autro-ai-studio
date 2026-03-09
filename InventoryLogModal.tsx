import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Component, InventoryLog, InventoryLogReason, InventoryLogType } from '../types';

interface InventoryLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: Component;
  onSave: (logData: Omit<InventoryLog, 'id' | 'date'>) => void;
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
    outro: 'Outro (ver notas)',
};

const entradaReasons: InventoryLogReason[] = ['compra_fornecedor', 'devolucao_cliente', 'ajuste_inventario_positivo', 'estoque_inicial', 'fabricacao_interna', 'corte_substituição', 'outro'];
const saidaReasons: InventoryLogReason[] = ['uso_producao_kit', 'venda_direta', 'ajuste_inventario_negativo', 'perda_dano', 'corte_substituição', 'conclusao_ordem_producao', 'consumo_fabricacao', 'outro'];

export const InventoryLogModal: React.FC<InventoryLogModalProps> = ({ isOpen, onClose, component, onSave }) => {
  const [type, setType] = useState<InventoryLogType>('entrada');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<InventoryLogReason>(entradaReasons[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Reset reason when type changes
    setReason(type === 'entrada' ? entradaReasons[0] : saidaReasons[0]);
  }, [type]);

  const handleSave = () => {
    if (quantity <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }
    if (reason === 'outro' && !notes.trim()) {
      alert('Por favor, adicione uma nota para o motivo "Outro".');
      return;
    }
    onSave({
      componentId: component.id,
      type,
      quantity,
      reason,
      notes,
    });
    onClose();
  };

  const reasonOptions = type === 'entrada' ? entradaReasons : saidaReasons;
  const newStock = type === 'entrada' ? component.stock + quantity : component.stock - quantity;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Movimentar Estoque: ${component.name}`}>
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-md text-center">
            <p className="text-sm text-black">Estoque Atual: <span className="font-bold">{component.stock}</span></p>
            <p className={`text-sm text-black ${newStock < 0 ? 'text-red-600' : 'text-green-600'}`}>Novo Estoque: <span className="font-bold">{newStock < 0 ? 0 : newStock}</span></p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimentação</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input type="radio" name="log-type" value="entrada" checked={type === 'entrada'} onChange={() => setType('entrada')} className="form-radio h-4 w-4 text-autro-blue focus:ring-autro-blue" />
              <span className="ml-2 text-black">Entrada</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="log-type" value="saída" checked={type === 'saída'} onChange={() => setType('saída')} className="form-radio h-4 w-4 text-autro-blue focus:ring-autro-blue" />
              <span className="ml-2 text-black">Saída</span>
            </label>
          </div>
        </div>
        
        <Input 
          label="Quantidade" 
          type="number" 
          value={quantity} 
          onChange={e => setQuantity(parseInt(e.target.value, 10) || 0)} 
          min="1" 
        />
        
        <Select label="Motivo" value={reason} onChange={e => setReason(e.target.value as InventoryLogReason)}>
          {reasonOptions.map(r => <option key={r} value={r}>{reasonLabels[r]}</option>)}
        </Select>

        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notas</label>
        <textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-autro-blue focus:border-autro-blue sm:text-sm"
          placeholder={reason === 'outro' ? 'Obrigatório para o motivo "Outro"' : 'Opcional'}
        />

        <div className="flex justify-end pt-4 border-t mt-4 gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Movimentação</Button>
        </div>
      </div>
    </Modal>
  );
};