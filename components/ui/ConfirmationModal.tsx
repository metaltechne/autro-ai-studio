import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  variant?: 'primary' | 'danger';
}

/**
 * A reusable modal for confirming user actions.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isConfirming = false,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-black">{children}</div>
      <div className="flex justify-end pt-6 border-t mt-6 gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? 'Confirmando...' : confirmText}
        </Button>
      </div>
    </Modal>
  );
};
