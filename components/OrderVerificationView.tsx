import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ProductionOrdersHook, InventoryHook, ProductionOrder, ScannedQRCodeData } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from '../hooks/useToast';
import { EmptyState } from './ui/EmptyState';

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

interface OrderVerificationViewProps {
    productionOrdersHook: ProductionOrdersHook;
    inventory: InventoryHook;
}

const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const OrderVerificationView: React.FC<OrderVerificationViewProps> = ({ productionOrdersHook, inventory }) => {
    const { productionOrders, updateProductionOrderStatus, updateScannedItems } = productionOrdersHook;
    const { findComponentById } = inventory;
    const { addToast } = useToast();

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    
    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'order-verification-qr-reader';
    const isScanningRef = useRef(false);
    const isStoppingRef = useRef(false);
    const isMounted = useRef(true);

    const pendingOrders = useMemo(() => {
        return productionOrders.filter(o => o.status === 'pendente');
    }, [productionOrders]);
    
    const selectedOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return productionOrders.find(o => o.id === selectedOrderId);
    }, [selectedOrderId, productionOrders]);

    const pickingList = useMemo(() => {
        if (!selectedOrder) return [];
        return selectedOrder.selectedScenario.detailedRequirements.map(req => {
            const component = findComponentById(req.componentId) || selectedOrder.virtualComponents.find(vc => vc.id === req.componentId);
            const scanned = selectedOrder.scannedItems?.[req.componentId] || 0;
            return {
                id: req.componentId,
                sku: component?.sku || 'N/A',
                name: req.componentName,
                required: req.required,
                scanned,
                isComplete: scanned >= req.required,
            };
        }).sort((a,b) => (a.isComplete ? 1 : -1) - (b.isComplete ? 1 : -1) || a.name.localeCompare(b.name));
    }, [selectedOrder, findComponentById]);

    const isVerificationComplete = useMemo(() => {
        if (!selectedOrder || pickingList.length === 0) return false;
        return pickingList.every(item => item.isComplete);
    }, [selectedOrder, pickingList]);

    const handleUpdateQuantity = useCallback(async (componentId: string, newQuantity: number) => {
        if (!selectedOrder) return;
        const newScannedItems = { ...selectedOrder.scannedItems, [componentId]: Math.max(0, newQuantity) };
        await updateScannedItems(selectedOrder.id, newScannedItems);
    }, [selectedOrder, updateScannedItems]);

    const onScanSuccess = useCallback(async (decodedText: string) => {
        if (!selectedOrder) return;

        try {
            const data = JSON.parse(decodedText) as ScannedQRCodeData;
            if (data.type !== 'component' || !data.id) {
                addToast('QR Code inválido (não é um componente).', 'error');
                return;
            }

            const itemInList = pickingList.find(item => item.id === data.id);
            if (!itemInList) {
                const component = findComponentById(data.id);
                addToast(`Item "${component?.name || 'desconhecido'}" não pertence a esta ordem.`, 'info');
                return;
            }

            if (itemInList.isComplete) {
                addToast(`Item "${itemInList.name}" já foi totalmente conferido.`, 'info');
                return;
            }
            
            const newQuantity = itemInList.scanned + 1;
            await handleUpdateQuantity(itemInList.id, newQuantity);
            addToast(`${itemInList.name} escaneado (${newQuantity}/${itemInList.required})`, 'success');

        } catch(e) {
            addToast("QR Code inválido ou não pertence a este sistema.", 'error');
        }
    }, [selectedOrder, addToast, findComponentById, pickingList, handleUpdateQuantity]);

    const startScanner = useCallback(() => {
        if (isScanning || !window.Html5Qrcode) return;
        
        if (!scannerRef.current) {
            try {
                scannerRef.current = new window.Html5Qrcode(scannerContainerId);
            } catch (err) {
                console.error("Failed to initialize scanner instance", err);
                addToast("Erro ao inicializar câmera.", "error");
                return;
            }
        }
        
        const scanner = scannerRef.current;
        scanner.start(
            { facingMode: "environment" }, { fps: 5, qrbox: { width: 250, height: 250 } },
            onScanSuccess, (errorMessage: string) => {}
        ).then(() => {
            if (isMounted.current) {
                setIsScanning(true);
                isScanningRef.current = true;
            }
        }).catch((err: any) => {
            if (isMounted.current) {
                console.error("Scanner start error:", err);
                addToast("Erro ao iniciar a câmera. Verifique as permissões.", 'error');
            }
        });
    }, [onScanSuccess, addToast]);
    
    const stopScanner = useCallback(async () => {
        if (isScanningRef.current && scannerRef.current && !isStoppingRef.current) {
            isStoppingRef.current = true;
            try {
                await scannerRef.current.stop();
                if (isMounted.current) {
                    setIsScanning(false);
                    isScanningRef.current = false;
                }
                try { scannerRef.current.clear(); } catch (e) {}
                scannerRef.current = null;
            } catch (err: any) {
                if (isMounted.current) {
                    setIsScanning(false);
                    isScanningRef.current = false;
                }
                scannerRef.current = null;
            } finally {
                isStoppingRef.current = false;
            }
        }
    }, []);
    
    useEffect(() => {
        isMounted.current = true;
        if (selectedOrder) {
            startScanner();
        } else {
            stopScanner();
        }
        return () => { 
            isMounted.current = false;
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                if (isScanningRef.current) {
                    scanner.stop().then(() => {
                        try { scanner.clear(); } catch (e) {}
                    }).catch(() => {
                        try { scanner.clear(); } catch (e) {}
                    });
                } else {
                    try { scanner.clear(); } catch (e) {}
                }
            }
        };
    }, [selectedOrder, startScanner, stopScanner]);

    const handleUpdateStatus = async (status: 'em_montagem') => {
        if (!selectedOrder) return;
        await updateProductionOrderStatus(selectedOrder.id, status);
        addToast(`Ordem ${selectedOrder.id} movida para "Em Montagem".`, 'success');
        setSelectedOrderId(null);
    };
    
    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Conferência de Pedidos</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
                {/* Order List */}
                <Card className="lg:col-span-1 flex flex-col">
                    <h3 className="text-xl font-semibold text-black mb-4">Ordens Pendentes</h3>
                    <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                        {pendingOrders.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-10">Nenhuma ordem pendente.</p>
                        ) : (
                            pendingOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={`p-3 border rounded-md cursor-pointer mb-2 transition-all ${selectedOrderId === order.id ? 'bg-autro-blue-light border-autro-blue shadow-md' : 'hover:bg-gray-50'}`}
                                >
                                    <p className="font-bold text-black">{order.id}</p>
                                    <p className="text-xs text-gray-500">Criada em: {formatDateTime(order.createdAt)}</p>
                                    <p className={`text-xs font-semibold ${order.status === 'em_montagem' ? 'text-blue-600' : 'text-yellow-600'}`}>{order.status.replace('_', ' ')}</p>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
                {/* Verification Panel */}
                <Card className="lg:col-span-2 flex flex-col">
                    {!selectedOrder ? (
                         <EmptyState icon={<svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" /></svg>} title="Nenhuma Ordem Selecionada" message="Selecione uma ordem da lista para iniciar a conferência." />
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-semibold text-black">Conferindo Ordem: {selectedOrder.id}</h3>
                                <Button onClick={() => setSelectedOrderId(null)} variant="secondary" size="sm">&larr; Voltar</Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow min-h-0">
                                <div className="flex flex-col">
                                    <h4 className="font-semibold text-black mb-2">Lista de Separação</h4>
                                    <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-2">
                                        {pickingList.map(item => (
                                            <div key={item.id} className={`p-2 border rounded-md transition-colors ${item.isComplete ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                                <div className="flex justify-between items-start">
                                                    <p className="font-medium text-black text-sm flex-grow">{item.name}</p>
                                                    {item.isComplete && <span className="text-green-600 font-bold ml-2">✓</span>}
                                                </div>
                                                <p className="text-xs text-gray-500">{item.sku}</p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <div className="relative w-full bg-gray-200 rounded-full h-2.5">
                                                        <div className="bg-autro-blue h-2.5 rounded-full" style={{ width: `${Math.min(100, (item.scanned / item.required) * 100)}%` }}></div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <Button onClick={() => handleUpdateQuantity(item.id, item.scanned - 1)} variant="secondary" size="sm" className="!p-1 w-6 h-6">-</Button>
                                                        <span className="text-sm font-semibold w-16 text-center">{item.scanned} / {item.required}</span>
                                                        <Button onClick={() => handleUpdateQuantity(item.id, item.scanned + 1)} variant="secondary" size="sm" className="!p-1 w-6 h-6">+</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div id={scannerContainerId} className="w-full max-w-sm aspect-square bg-gray-200 rounded-lg overflow-hidden"></div>
                                    <div className="mt-4 flex gap-4">
                                        <Button onClick={startScanner} disabled={isScanning}>Iniciar Câmera</Button>
                                        <Button onClick={stopScanner} disabled={!isScanning} variant="secondary">Parar Câmera</Button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <Button onClick={() => handleUpdateStatus('em_montagem')} disabled={!isVerificationComplete} className="w-full">
                                    {isVerificationComplete ? 'Finalizar Conferência e Iniciar Montagem' : 'Conferência Incompleta'}
                                </Button>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
};