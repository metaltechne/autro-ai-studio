import React, { useEffect, useRef } from 'react';
import { Modal } from './Modal';

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

interface QRCodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
}

const qrcodeRegionId = "html5qr-code-full-region";

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const scannerRef = useRef<any | null>(null);

    useEffect(() => {
        if (isOpen && window.Html5Qrcode) {
            const html5QrcodeScanner = new window.Html5Qrcode(qrcodeRegionId, {
                verbose: false 
            });
            scannerRef.current = html5QrcodeScanner;

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrcodeScanner.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    onScanSuccess(decodedText);
                    handleClose();
                },
                (errorMessage: string) => {
                    // parse error, ignore.
                }
            ).catch((err: any) => {
                console.error("Unable to start scanning.", err);
                alert("Não foi possível iniciar a câmera. Verifique as permissões do seu navegador para este site.");
                handleClose();
            });
        }

        return () => {
            if (scannerRef.current) {
                handleClose();
            }
        };
    }, [isOpen]);

    const handleClose = () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {}).catch((err: any) => {
                // This can fail if the scanner is already stopped or not initialized, which is fine.
            });
        }
        scannerRef.current = null;
        if(isOpen) { 
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Escanear QR Code">
             <div id={qrcodeRegionId} style={{ width: '100%', minHeight: '300px' }}></div>
             <p className="text-center text-sm text-gray-500 mt-4">Aponte a câmera para o QR Code.</p>
        </Modal>
    );
};