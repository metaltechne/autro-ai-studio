import React, { useState, useMemo, useEffect } from 'react';
import { InventoryHook, Kit, Component, ScannedQRCodeData } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import QRCode from 'qrcode';
import { useToast } from '../hooks/useToast';

interface PrintQueueItem {
    id: string;
    name: string;
    sku: string;
    type: 'component' | 'kit';
    quantity: number;
}

type PaperType = 'a4' | 'zebra';

const LOCAL_STORAGE_KEY = 'autro_labelPrinting_queue';

const generateLabelsHtml = async (queue: PrintQueueItem[], paperType: PaperType): Promise<string> => {
    let labelsHtml = '';
    const uniqueItems = Array.from(new Map(queue.map(item => [item.id, item])).values());

    const qrCodePromises = uniqueItems.map(item => {
        const qrData: ScannedQRCodeData = { type: item.type, id: item.id };
        return QRCode.toDataURL(JSON.stringify(qrData), { width: 256, margin: 2, errorCorrectionLevel: 'H' });
    });
    const qrCodeUrls = await Promise.all(qrCodePromises);
    const qrCodeMap = new Map(uniqueItems.map((item, index) => [item.id, qrCodeUrls[index]]));

    queue.forEach(item => {
        const qrUrl = qrCodeMap.get(item.id);
        for (let i = 0; i < item.quantity; i++) {
            labelsHtml += `
                <div class="label-cell">
                    <img src="${qrUrl}" alt="QR Code" class="qr-code" />
                    <div class="label-info">
                        <p class="label-name">${item.name}</p>
                        <p class="label-sku">${item.sku}</p>
                    </div>
                </div>
            `;
        }
    });

    const a4Styles = `
        @page {
            size: a4;
            margin: 1cm;
        }
        .label-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            width: 100%;
        }
    `;

    const zebraStyles = `
        @page {
            size: 110mm 297mm; /* Standard width, A4 height for continuous printing */
            margin: 0;
        }
        .label-grid {
            display: flex;
            flex-wrap: wrap;
            align-content: flex-start;
            row-gap: 0;
            column-gap: 0.75mm;
            width: 110mm;
            padding-left: 3.5mm;
            padding-right: 3.5mm;
            box-sizing: border-box;
        }
        .label-cell {
            flex-shrink: 0;
        }
    `;

    const css = `
        <style>
            @media screen {
                body { background-color: #f0f0f0; padding: 1rem; }
            }
            @media print {
                body { margin: 0; padding: 0; }
                .print-controls { display: none !important; }
                ${paperType === 'a4' ? a4Styles : zebraStyles}
            }
            .print-controls {
                text-align: center;
                margin-bottom: 1rem;
                padding: 0.5rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .label-grid {
                background-color: white;
            }
            .label-cell {
                width: 20mm;
                height: 20mm;
                box-sizing: border-box;
                padding: 1mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                outline: 1px dotted #ccc;
                page-break-inside: avoid;
                text-align: center;
                border-radius: 50%;
            }
            @media print {
                .label-cell { outline: none; }
            }
            .qr-code {
                width: 12mm;
                height: 12mm;
                flex-shrink: 0;
                display: block;
                margin-bottom: 1mm;
            }
            .label-info {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
                width: 100%;
            }
            .label-name {
                font-family: Arial, sans-serif;
                font-size: 7pt;
                font-weight: bold;
                margin: 0;
                white-space: normal;
                word-wrap: break-word;
                line-height: 1.1;
            }
            .label-sku {
                font-family: 'Courier New', monospace;
                font-size: 6pt;
                margin: 0;
                line-height: 1.1;
            }
        </style>
    `;
    
    const printInstructions = paperType === 'a4'
        ? 'Para melhores resultados, use papel de etiqueta apropriado. Configure a impressão para 100% de escala e sem margens.'
        : 'Verifique se as configurações da sua impressora Zebra ZD220 correspondem a um rolo de 110mm de largura.';

    return `<html><head><title>Imprimir Etiquetas - AUTRO</title>${css}</head><body>
        <div class="print-controls">
            <p><strong>Pré-visualização da Impressão</strong></p>
            <p style="font-size: 12px;">${printInstructions}</p>
            <button onclick="window.print()">Imprimir</button>
        </div>
        <div class="label-grid">${labelsHtml}</div>
    </body></html>`;
};

export const LabelPrintingView: React.FC<{ inventory: InventoryHook }> = ({ inventory }) => {
    const { addToast } = useToast();
    const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
    const [activeList, setActiveList] = useState<'components' | 'kits'>('components');
    const [searchTerm, setSearchTerm] = useState('');
    const [paperType, setPaperType] = useState<PaperType>('a4');
    
    // Load queue from localStorage on mount
    useEffect(() => {
        try {
            const savedQueue = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedQueue) {
                const parsedQueue = JSON.parse(savedQueue);
                if (Array.isArray(parsedQueue)) {
                    setPrintQueue(parsedQueue);
                }
            }
        } catch (error) {
            console.error("Failed to load print queue from localStorage", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }, []);

    // Save queue to localStorage on change
    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(printQueue));
    }, [printQueue]);


    const filteredComponents = useMemo(() => {
        if (!searchTerm) return inventory.components.filter(c => c.type === 'component');
        const lowerSearch = searchTerm.toLowerCase();
        return inventory.components.filter(c =>
            c.type === 'component' && (c.name.toLowerCase().includes(lowerSearch) || c.sku.toLowerCase().includes(lowerSearch))
        );
    }, [inventory.components, searchTerm]);

    const filteredKits = useMemo(() => {
        if (!searchTerm) return inventory.kits;
        const lowerSearch = searchTerm.toLowerCase();
        return inventory.kits.filter(k =>
            k.name.toLowerCase().includes(lowerSearch) || k.sku.toLowerCase().includes(lowerSearch)
        );
    }, [inventory.kits, searchTerm]);

    const addToQueue = (item: Component | Kit, type: 'component' | 'kit') => {
        if (printQueue.some(i => i.id === item.id)) {
            addToast(`"${item.name}" já está na fila.`, 'info');
            return;
        }
        setPrintQueue(prev => [...prev, {
            id: item.id,
            name: item.name,
            sku: item.sku,
            type,
            quantity: 1,
        }]);
    };

    const updateQuantity = (id: string, quantity: number) => {
        setPrintQueue(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
        ));
    };

    const removeFromQueue = (id: string) => {
        setPrintQueue(prev => prev.filter(item => item.id !== id));
    };

    const handleClearQueue = () => {
        setPrintQueue([]);
        addToast("Fila de impressão limpa.", "info");
    };
    
    const handlePrint = async () => {
        const itemsToPrint = printQueue.filter(item => item.quantity > 0);
        if (itemsToPrint.length === 0) {
            addToast('A fila de impressão está vazia ou todas as quantidades são zero.', 'error');
            return;
        }

        try {
            const htmlContent = await generateLabelsHtml(itemsToPrint, paperType);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                 addToast('Não foi possível abrir a janela de impressão. Verifique as configurações de pop-up do seu navegador.', 'error');
            }
        } catch (error) {
            console.error("Failed to generate print page:", error);
            addToast('Ocorreu um erro ao gerar as etiquetas.', 'error');
        }
    };

    const totalLabels = useMemo(() => printQueue.reduce((sum, item) => sum + item.quantity, 0), [printQueue]);

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Impressão de Etiquetas QR Code</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
                <Card className="flex flex-col">
                    <h3 className="text-xl font-semibold text-black mb-4">1. Selecionar Itens</h3>
                    <div className="flex gap-2 border-b mb-4">
                        <button onClick={() => setActiveList('components')} className={`px-4 py-2 text-sm font-medium ${activeList === 'components' ? 'border-b-2 border-autro-blue text-autro-blue' : 'text-gray-500'}`}>Componentes</button>
                        <button onClick={() => setActiveList('kits')} className={`px-4 py-2 text-sm font-medium ${activeList === 'kits' ? 'border-b-2 border-autro-blue text-autro-blue' : 'text-gray-500'}`}>Kits</button>
                    </div>
                    <Input placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4" />
                    <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                        {activeList === 'components' && filteredComponents.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                                <div>
                                    <p className="font-medium text-sm text-black">{c.name}</p>
                                    <p className="text-xs text-gray-500">{c.sku}</p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => addToQueue(c, 'component')}>Adicionar</Button>
                            </div>
                        ))}
                         {activeList === 'kits' && filteredKits.map(k => (
                            <div key={k.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                                <div>
                                    <p className="font-medium text-sm text-black">{k.name}</p>
                                    <p className="text-xs text-gray-500">{k.sku}</p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => addToQueue(k, 'kit')}>Adicionar</Button>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card className="flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-black">2. Fila de Impressão</h3>
                        <Button onClick={handleClearQueue} variant="danger" size="sm" disabled={printQueue.length === 0}>Limpar Fila</Button>
                     </div>
                     <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                        {printQueue.length === 0 ? (
                             <div className="text-center text-gray-500 py-10 border-2 border-dashed rounded-lg h-full flex items-center justify-center">
                                <p>Adicione itens da lista à esquerda.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {printQueue.map(item => (
                                    <div key={item.id} className="p-2 bg-gray-50 rounded-md border">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-medium text-black">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.sku}</p>
                                            </div>
                                            <Button size="sm" variant="danger" className="!p-1.5 flex-shrink-0" onClick={() => removeFromQueue(item.id)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </Button>
                                        </div>
                                        <div className="mt-2">
                                            <Input label="Quantidade de Etiquetas" type="number" min="0" value={item.quantity} onChange={e => updateQuantity(item.id, parseInt(e.target.value, 10))} className="w-40 text-sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                     <div className="mt-4 pt-4 border-t">
                        <div className="mb-4">
                            <h4 className="text-md font-semibold text-black mb-2">3. Tipo de Papel</h4>
                             <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="paperType" value="a4" checked={paperType === 'a4'} onChange={() => setPaperType('a4')} className="form-radio h-4 w-4 text-autro-blue" />
                                    <span className="text-sm font-medium text-black">Folha A4 Padrão</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="paperType" value="zebra" checked={paperType === 'zebra'} onChange={() => setPaperType('zebra')} className="form-radio h-4 w-4 text-autro-blue" />
                                    <span className="text-sm font-medium text-black">Rolo Zebra ZD220 (110mm)</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-between items-center border-t pt-4">
                            <p className="text-lg font-bold text-black">Total de Etiquetas: {totalLabels}</p>
                            <Button onClick={handlePrint} disabled={totalLabels === 0}>
                                Gerar Impressão
                            </Button>
                        </div>
                     </div>
                </Card>
            </div>
        </div>
    );
};