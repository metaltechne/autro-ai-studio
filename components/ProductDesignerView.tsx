
import React, { useState, useMemo, useEffect } from 'react';
import { ManufacturingHook, InventoryHook, FamiliaComponente, View, ProcessCategory, ProcessNodeData, Component } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
// FIX: Imported missing UI helpers from CustomNodes to resolve ProductDesignerView build errors.
import { DimensionTableUI, HeadCodeTableUI, ProductGeneratorFormUI } from './manufacturing/CustomNodes';
import { useToast } from '../hooks/useToast';
import { nanoid } from 'https://esm.sh/nanoid@5.0.7';

interface ProductDesignerViewProps {
    manufacturing: ManufacturingHook;
    inventory: InventoryHook;
    setCurrentView: (view: View) => void;
}

type Tab = 'config' | 'ingredients' | 'process' | 'result';

const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ProductDesignerView: React.FC<ProductDesignerViewProps> = ({ manufacturing, inventory, setCurrentView }) => {
    const { familias, addFamilia, saveMultipleFamilias, setActiveFamiliaId, addNode, updateNodeLabel, updateNodeCost, updateNodeMaterialDetails, updateNodeComponentDetails, updateNodeOperationDetails, updateNodeGenerationConfig, deleteNode } = manufacturing;
    const { addToast } = useToast();
    const [selectedFamiliaId, setSelectedFamiliaId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<ProcessCategory>('kit_assembly');

    const selectedFamilia = useMemo(() => familias.find(f => f.id === selectedFamiliaId), [familias, selectedFamiliaId]);

    const filteredFamilias = useMemo(() => {
        if (!searchTerm) return familias;
        return familias.filter(f => f.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [familias, searchTerm]);

    const findNodesByType = (type: string) => {
        if (!selectedFamilia) return [];
        return selectedFamilia.nodes.filter(n => n.data.type === type);
    };

    const dimensionTableNode = findNodesByType('dimensionTable')[0] || findNodesByType('dnaTable')[0];
    const headCodeTableNode = findNodesByType('headCodeTable')[0];
    const generatorNode = findNodesByType('productGenerator')[0];
    
    const inputNodes = useMemo(() => {
        if (!selectedFamilia) return [];
        return selectedFamilia.nodes.filter(n => 
            n.data.type === 'materiaPrima' || 
            n.data.type === 'inventoryComponent' || 
            n.data.type === 'materialMapping'
        );
    }, [selectedFamilia]);

    const operationNodes = findNodesByType('etapaFabricacao');

    const handleCreate = () => {
        if (!newName) return;
        addFamilia(newName, 'generator', newCategory);
        setNewName('');
        setIsCreating(false);
    };

    const handleAddInput = (type: 'component' | 'material') => {
        if (!selectedFamiliaId) return;
        addNode(selectedFamiliaId, type === 'component' ? 'inventoryComponent' : 'materiaPrima', { x: 0, y: 0 });
    };

    const handleAddOperation = () => {
        if (!selectedFamiliaId) return;
        addNode(selectedFamiliaId, 'etapaFabricacao', { x: 0, y: 0 });
    };

    return (
        <div className="flex h-[calc(100vh-6rem)]">
            <div className="w-80 bg-white border-r flex flex-col flex-shrink-0">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold text-black mb-4">Meus Produtos</h2>
                    <Button onClick={() => setIsCreating(true)} className="w-full mb-2">Novo Produto / Kit</Button>
                    <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex-grow overflow-y-auto">
                    {filteredFamilias.map(f => (
                        <div key={f.id} onClick={() => setSelectedFamiliaId(f.id)} className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedFamiliaId === f.id ? 'bg-blue-50 border-l-4 border-l-autro-blue' : ''}`}>
                            <p className="font-semibold text-sm text-black">{f.nome}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${f.category === 'kit_assembly' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{f.category === 'kit_assembly' ? 'Montagem de Kit' : 'Fabricação'}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-grow flex flex-col bg-gray-50 overflow-hidden">
                {selectedFamilia ? (
                    <>
                        <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
                            <div><h1 className="text-2xl font-bold text-black">{selectedFamilia.nome}</h1><p className="text-sm text-gray-500">ID: {selectedFamilia.id}</p></div>
                            <div className="flex gap-2"><Button variant="secondary" onClick={() => { setActiveFamiliaId(selectedFamilia.id); setCurrentView(View.MANUFACTURING); }}>Modo Avançado (Fluxo)</Button></div>
                        </header>
                        <div className="flex border-b bg-white px-6">
                            <button onClick={() => setActiveTab('config')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-black'}`}>1. Variações (Tabelas)</button>
                            <button onClick={() => setActiveTab('ingredients')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ingredients' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-black'}`}>2. Ingredientes</button>
                            <button onClick={() => setActiveTab('process')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'process' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-black'}`}>3. Modo de Preparo</button>
                            <button onClick={() => setActiveTab('result')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'result' ? 'border-autro-blue text-autro-blue' : 'border-transparent text-gray-500 hover:text-black'}`}>4. Produto Final</button>
                        </div>
                        <div className="flex-grow p-6 overflow-y-auto">
                            {activeTab === 'config' && (
                                <div className="space-y-6 max-w-4xl mx-auto">
                                    <Card>
                                        <div className="mb-4"><h3 className="text-lg font-bold text-black">Tabela de Dimensões (DNA)</h3><p className="text-sm text-gray-500">Defina aqui as variações do seu produto (ex: tamanhos de parafuso).</p></div>
                                        {dimensionTableNode ? (
                                            <div className="p-4 border rounded bg-gray-50">
                                                <DimensionTableUI dimensions={dimensionTableNode.data.dimensions} onUpdate={(id, data) => manufacturing.updateDimension(selectedFamiliaId, dimensionTableNode.id, id, data)} onAdd={() => manufacturing.addDimension(selectedFamiliaId, dimensionTableNode.id)} onDelete={(id) => manufacturing.deleteDimension(selectedFamiliaId, dimensionTableNode.id, id)} />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500"><p>Este processo não possui tabela de dimensões.</p><Button size="sm" className="mt-2" onClick={() => addNode(selectedFamiliaId, 'dnaTable', {x:0,y:0})}>Adicionar Tabela DNA</Button></div>
                                        )}
                                    </Card>
                                     <Card>
                                        <div className="mb-4"><h3 className="text-lg font-bold text-black">Tabela de Códigos (Segredos)</h3><p className="text-sm text-gray-500">Opcional. Use para segredos de chave.</p></div>
                                        {headCodeTableNode ? (
                                            <div className="p-4 border rounded bg-gray-50">
                                                 <HeadCodeTableUI headCodes={headCodeTableNode.data.headCodes} onUpdate={(id, data) => manufacturing.updateHeadCode(selectedFamiliaId, headCodeTableNode.id, id, data)} onAdd={(code) => manufacturing.addHeadCode(selectedFamiliaId, headCodeTableNode.id, code)} onDelete={(id) => manufacturing.deleteHeadCode(selectedFamiliaId, headCodeTableNode.id, id)} />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500"><Button size="sm" variant="secondary" onClick={() => addNode(selectedFamiliaId, 'headCodeTable', {x:0,y:0})}>Adicionar Tabela de Códigos</Button></div>
                                        )}
                                    </Card>
                                </div>
                            )}
                            {activeTab === 'ingredients' && (
                                <div className="space-y-4 max-w-4xl mx-auto">
                                    <div className="flex justify-between items-center mb-4">
                                        <div><h3 className="text-lg font-bold text-black">Lista de Materiais</h3><p className="text-sm text-gray-500">O que é necessário para fazer este produto?</p></div>
                                        <div className="flex gap-2"><Button onClick={() => handleAddInput('component')}>Adicionar Componente</Button><Button variant="secondary" onClick={() => handleAddInput('material')}>Adicionar Matéria-Prima</Button></div>
                                    </div>
                                    {inputNodes.map((node, index) => (
                                        <Card key={node.id} className="flex items-center gap-4">
                                            <div className="font-bold text-gray-400 text-xl w-8">{index + 1}.</div>
                                            <div className="flex-grow">
                                                <Input label="Nome do Item na Receita" value={node.data.label} onChange={e => updateNodeLabel(selectedFamiliaId, node.id, e.target.value)} className="mb-2" />
                                                <div className="flex gap-4 items-end">
                                                    <div className="flex-grow">
                                                        <label className="text-sm font-medium text-gray-700">SKU / Template</label>
                                                        {node.data.type === 'inventoryComponent' ? (
                                                            <div className="flex gap-2">
                                                                <Input value={node.data.componentIdTemplate || ''} onChange={e => updateNodeComponentDetails(selectedFamiliaId, node.id, { componentIdTemplate: e.target.value }, inventory.components)} placeholder="Ex: CORPO-M{bitola}" className="flex-grow" />
                                                                 <p className="text-xs text-gray-500 self-center">Use {'{bitola}'} como variável.</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="flex gap-2">
                                                                    <Input value={node.data.sourceSku || ''} onChange={e => updateNodeMaterialDetails(selectedFamiliaId, node.id, { sourceSku: e.target.value }, inventory.components)} placeholder="Ex: RM-BARRA-{diametro}" className="flex-grow" />
                                                                    <Select value={node.data.baseMaterialId || ''} onChange={e => updateNodeMaterialDetails(selectedFamiliaId, node.id, { baseMaterialId: e.target.value, sourceSku: '' }, inventory.components)} className="w-1/2">
                                                                        <option value="">Ou selecione fixo...</option>
                                                                        {inventory.components.filter(c => c.type === 'raw_material').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-24"><Input label="Qtd." type="number" value={node.data.consumption || 1} onChange={e => updateNodeMaterialDetails(selectedFamiliaId, node.id, { consumption: parseFloat(e.target.value) || 0 }, inventory.components)} /></div>
                                                </div>
                                            </div>
                                            <Button variant="danger" onClick={() => deleteNode(selectedFamiliaId, node.id)}>Remover</Button>
                                        </Card>
                                    ))}
                                    {inputNodes.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum ingrediente adicionado.</p>}
                                </div>
                            )}
                            {activeTab === 'process' && (
                                <div className="space-y-4 max-w-4xl mx-auto">
                                     <div className="flex justify-between items-center mb-4">
                                        <div><h3 className="text-lg font-bold text-black">Passo a Passo da Fabricação</h3><p className="text-sm text-gray-600">Defina as operações necessárias.</p></div>
                                        <Button onClick={handleAddOperation}>Adicionar Passo</Button>
                                    </div>
                                    {operationNodes.map((node, index) => (
                                        <Card key={node.id} className="flex items-center gap-4">
                                            <div className="font-bold text-gray-400 text-xl w-8">{index + 1}.</div>
                                            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <Input label="Nome da Operação" value={node.data.label} onChange={e => updateNodeLabel(selectedFamiliaId, node.id, e.target.value)} />
                                                 <Select label="Posto de Trabalho" value={node.data.manualOperatorId || node.data.operationId || ''} onChange={e => updateNodeOperationDetails(selectedFamiliaId, node.id, { manualOperatorId: e.target.value })}>
                                                     <option value="">Selecione...</option>
                                                     {manufacturing.workStations.map(ws => <option key={ws.id} value={ws.id}>{ws.name} ({formatCurrency(ws.hourlyRate)}/h)</option>)}
                                                </Select>
                                                <Input label="Tempo (segundos)" type="number" value={node.data.manualTimeSeconds || 0} onChange={e => updateNodeOperationDetails(selectedFamiliaId, node.id, { manualTimeSeconds: parseFloat(e.target.value) })} />
                                            </div>
                                            <div className="flex flex-col items-end"><p className="text-xs text-gray-500 mb-1">Custo Est.: {formatCurrency(node.data.cost)}</p><Button variant="danger" size="sm" onClick={() => deleteNode(selectedFamiliaId, node.id)}>X</Button></div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {activeTab === 'result' && (
                                <div className="max-w-4xl mx-auto">
                                    <Card>
                                        <h3 className="text-lg font-bold text-black mb-4">Configuração do Produto Gerado</h3>
                                        <p className="text-sm text-gray-600 mb-4">Como os itens finais serão nomeados no estoque?</p>
                                        {generatorNode ? (
                                            <div className="p-4 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700">
                                                <ProductGeneratorFormUI config={generatorNode.data.generationConfig} cost={generatorNode.data.cost} onUpdate={(config) => updateNodeGenerationConfig(selectedFamiliaId, generatorNode.id, config)} onViewProducts={generatorNode.data.onViewGeneratedProducts} />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8"><p className="text-red-500">Erro: Nó gerador não encontrado. Adicione um no modo avançado.</p></div>
                                        )}
                                    </Card>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400"><svg className="w-20 h-20 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><p className="text-lg">Selecione um produto na lista ou crie um novo.</p></div>
                )}
            </div>
            <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="Novo Produto">
                <div className="space-y-4">
                    <Input label="Nome do Produto/Processo" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Kit Antifurto Padrão" />
                    <Select label="Tipo" value={newCategory} onChange={e => setNewCategory(e.target.value as any)}>
                        <option value="kit_assembly">Montagem de Kit (Juntar peças)</option>
                        <option value="manufacturing">Fabricação (Transformar matéria-prima)</option>
                    </Select>
                    <div className="flex justify-end gap-2 pt-4"><Button variant="secondary" onClick={() => setIsCreating(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={!newName}>Criar</Button></div>
                </div>
            </Modal>
        </div>
    );
};
