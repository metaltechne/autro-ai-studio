import React from 'react';
import { ManufacturingHook } from '../types';
import { ManufacturingTreeView } from './ui/ManufacturingTreeView';

export const ManufacturingStructureView: React.FC<{ manufacturing: ManufacturingHook }> = ({ manufacturing }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Estrutura de Produção</h2>
            <ManufacturingTreeView familias={manufacturing.familias} />
        </div>
    );
};
