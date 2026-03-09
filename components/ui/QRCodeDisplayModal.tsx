import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ScannedQRCodeData } from '../../types';
import QRCode from 'qrcode';

interface QRCodeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data?: ScannedQRCodeData;
}

export const QRCodeDisplayModal: React.FC<QRCodeDisplayModalProps> = ({ isOpen, onClose, title, data }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && data) {
            let isMounted = true;
            setIsLoading(true);
            setError(null);

            const generateQrCode = async () => {
                try {
                    const url = await QRCode.toDataURL(JSON.stringify(data), {
                        width: 256,
                        margin: 2,
                        errorCorrectionLevel: 'H'
                    });
                    if (isMounted) setImageUrl(url);
                } catch (err) {
                    console.error("Modal QR Code generation failed:", err);
                    if (isMounted) setError('Falha ao gerar QR Code.');
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            };
            generateQrCode();

            return () => { isMounted = false; };
        }
    }, [isOpen, data]);

    const handlePrint = () => {
        if (!imageUrl) return;

        const printWindow = window.open('', '', 'height=400,width=400');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Imprimir QR Code</title>');
            printWindow.document.write('<style>body { text-align: center; font-family: sans-serif; } img { max-width: 80%; } h3 { margin-bottom: 1rem; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h3>${title}</h3>`);
            printWindow.document.write(`<img src="${imageUrl}" />`);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="w-64 h-64 bg-gray-200 animate-pulse rounded-md"></div>;
        }
        if (error) {
            return <div className="w-64 h-64 bg-red-100 flex items-center justify-center text-red-700 p-4 rounded-md">{error}</div>;
        }
        return <img src={imageUrl} alt={`QR Code for ${title}`} width={256} height={256} />;
    };

    if (!isOpen || !data) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`QR Code: ${title}`}>
            <div className="flex flex-col items-center gap-4">
                {renderContent()}
                <div className="flex justify-end pt-4 mt-4 border-t w-full gap-2">
                    <Button variant="secondary" onClick={onClose}>Fechar</Button>
                    <Button onClick={handlePrint} disabled={!imageUrl || isLoading}>Imprimir Etiqueta</Button>
                </div>
            </div>
        </Modal>
    );
};
