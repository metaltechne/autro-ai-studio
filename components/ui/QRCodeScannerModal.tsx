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
    useEffect(() => {
        let scanner: any = null;

        if (isOpen && window.Html5Qrcode) {
            scanner = new window.Html5Qrcode(qrcodeRegionId);
            
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    onScanSuccess(decodedText);
                    onClose();
                },
                () => {}
            ).catch((err: any) => {
                console.error("Unable to start scanning.", err);
            });
        }

        return () => {
            if (scanner) {
                if (scanner.isScanning) {
                    scanner.stop().then(() => {
                        try { scanner.clear(); } catch (e) {}
                    }).catch(() => {});
                } else {
                    try { scanner.clear(); } catch (e) {}
                }
            }
        };
    }, [isOpen, onScanSuccess]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Escanear QR Code">
             <div id={qrcodeRegionId} className="w-full min-h-[300px] bg-black rounded-lg overflow-hidden"></div>
             <p className="text-center text-sm text-gray-500 mt-4 font-medium">Aponte a câmera para o QR Code.</p>
        </Modal>
    );
};
