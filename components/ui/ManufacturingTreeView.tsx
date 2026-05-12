import React from 'react';
import { FamiliaComponente } from '../../types';

interface TreeViewProps {
    familias: FamiliaComponente[];
}

export const ManufacturingTreeView: React.FC<TreeViewProps> = ({ familias }) => {
    // Função recursiva para encontrar dependências (sub-processos)
    const getDependencies = (familia: FamiliaComponente): string[] => {
        const deps = new Set<string>();
        familia.nodes.forEach(node => {
            if (node.data.type === 'subProcessMapping' && node.data.dimensions) {
                node.data.dimensions.forEach(dim => {
                    if (dim.targetFamiliaId) deps.add(dim.targetFamiliaId);
                });
            }
        });
        return Array.from(deps);
    };

    // Renderiza a árvore
    const renderTree = (familiaId: string, visited: Set<string> = new Set()) => {
        if (visited.has(familiaId)) return null;
        visited.add(familiaId);
        
        const familia = familias.find(f => f.id === familiaId);
        if (!familia) return null;

        const deps = getDependencies(familia);

        return (
            <div key={familia.id} className="ml-4 border-l pl-2 py-1">
                <div className="font-semibold text-autro-blue">{familia.nome}</div>
                {deps.map(depId => renderTree(depId, new Set(visited)))}
            </div>
        );
    };

    // Encontra raízes (famílias que não são sub-processos de ninguém)
    const allDeps = new Set<string>();
    familias.forEach(f => getDependencies(f).forEach(d => allDeps.add(d)));
    const roots = familias.filter(f => !allDeps.has(f.id));

    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="font-bold mb-2">Estrutura de Produção</h3>
            {roots.map(root => renderTree(root.id))}
        </div>
    );
};
