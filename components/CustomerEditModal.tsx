import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Customer } from '../types';
import { Textarea } from './ui/Textarea';

interface CustomerEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customerData: Customer | Omit<Customer, 'id' | 'createdAt'>) => void;
    customerToEdit: Customer | null;
}

const emptyCustomer: Omit<Customer, 'id' | 'createdAt'> = {
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
};

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({ isOpen, onClose, onSave, customerToEdit }) => {
    const [customerData, setCustomerData] = useState(customerToEdit || emptyCustomer);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCustomerData(customerToEdit || emptyCustomer);
            setIsSaving(false);
        }
    }, [isOpen, customerToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCustomerData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!customerData.name) {
            alert('O nome do cliente é obrigatório.');
            return;
        }
        setIsSaving(true);
        onSave(customerData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={customerToEdit ? 'Editar Cliente' : 'Novo Cliente'}>
            <div className="space-y-4">
                <Input label="Nome Completo / Razão Social" name="name" value={customerData.name} onChange={handleChange} required />
                <Input label="CPF / CNPJ" name="document" value={customerData.document} onChange={handleChange} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Telefone" name="phone" value={customerData.phone} onChange={handleChange} />
                    <Input label="Email" name="email" type="email" value={customerData.email} onChange={handleChange} />
                </div>
                <Textarea label="Endereço" name="address" value={customerData.address} onChange={handleChange} rows={3} />
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar Cliente'}
                </Button>
            </div>
        </Modal>
    );
};