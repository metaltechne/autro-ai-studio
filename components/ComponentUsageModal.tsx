import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Component, Kit } from '../types';

interface ComponentUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: Component | null;
  kits: Kit[];
}

export const ComponentUsageModal: React.FC<ComponentUsageModalProps> = ({ isOpen, onClose, component, kits }) => {
  if (!isOpen || !component) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Onde o componente "${component.name}" é usado?`}>
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {kits.length > 0 ? (
          <ul className="space-y-2">
            {kits.map(kit => (
              <li key={kit.id} className="p-3 bg-gray-50 rounded-md border">
                <p className="font-semibold text-black">{kit.name}</p>
                <p className="text-sm text-gray-500">{kit.marca} {kit.modelo} ({kit.ano}) - SKU: {kit.sku}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>Este componente não é usado diretamente em nenhum kit.</p>
            <p className="text-xs mt-1">Nota: A análise de uso não inclui fixadores dinâmicos.</p>
          </div>
        )}
      </div>
      <div className="flex justify-end pt-4 mt-4 border-t">
        <Button onClick={onClose} variant="secondary">Fechar</Button>
      </div>
    </Modal>
  );
};
