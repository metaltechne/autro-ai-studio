
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Component, FamiliaComponente } from '../types';

interface ComponentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (component: Component) => Promise<void>;
    componentToEdit: Component | null;
    familias: FamiliaComponente[];
}

export const ComponentEditModal: React.FC<ComponentEditModalProps> = ({ isOpen, onClose, onSave, componentToEdit, familias }) => {
    const [data, setData] = useState<Partial<Component>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && componentToEdit) {
            setData(componentToEdit);
        } else {
            setData({});
        }
        setIsSaving(false);
    }, [isOpen, componentToEdit]);

    const processControlledFamiliaIds = useMemo(() => new Set(familias.filter(f => f.nodes?.some(n => n.data.type === 'productGenerator')).map(f => f.id)), [familias]);
    const familiaMap = useMemo(() => new Map(familias.map(f => [f.id, f])), [familias]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        let parsedValue: string | number | undefined = value;
        if (type === 'number') {
            parsedValue = value === '' ? undefined : parseFloat(value.replace(',', '.'));
        }

        if (name === 'familiaId') {
            const selectedFamilia = familiaMap.get(value);
            setData(prev => ({ ...prev, [name]: value, sourcing: selectedFamilia?.sourcing || 'manufactured' }));
        } else {
            setData(prev => ({ ...prev, [name]: parsedValue }));
        }
    };

    const handleSave = async () => {
        if (!data.name || !data.sku || !data.familiaId) {
            alert('Por favor, preencha Nome, SKU e Família.');
            return;
        }
        setIsSaving(true);
        await onSave(data as Component);
        setIsSaving(false);
        onClose();
    };

    if (!isOpen || !componentToEdit) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Componente: ${componentToEdit.name}`}>
            <div className="space-y-4">
                <Input label="Nome do Componente" name="name" value={data.name || ''} onChange={handleChange} />
                <Input label="SKU" name="sku" value={data.sku || ''} onChange={handleChange} />
                <Select label="Família de Produto (Processo)" name="familiaId" value={data.familiaId || ''} onChange={handleChange}>
                    <option value="" disabled>Selecione uma família...</option>
                    {familias.filter(f => !processControlledFamiliaIds.has(f.id)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
                <Select label="Origem" name="sourcing" value={data.sourcing || 'manufactured'} onChange={handleChange}>
                    <option value="manufactured">Fabricado</option>
                    <option value="purchased">Comprado</option>
                    <option value="beneficiado">Beneficiado</option>
                </Select>

                {data.sourcing === 'purchased' && (
                    <Input 
                        label="Custo de Compra" 
                        name="purchaseCost" 
                        type="number" 
                        step="0.01"
                        value={data.purchaseCost || ''} 
                        onChange={handleChange} 
                    />
                )}
                
                <div className="flex justify-end pt-4 border-t mt-4 gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
