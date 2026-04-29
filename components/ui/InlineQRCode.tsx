import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ScannedQRCodeData } from '../../types';

interface InlineQRCodeProps {
  data: ScannedQRCodeData;
  size?: number;
}

export const InlineQRCode: React.FC<InlineQRCodeProps> = ({ data, size = 128 }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setError(null);

        const generateQrCode = async () => {
            try {
                const url = await QRCode.toDataURL(
                    JSON.stringify(data),
                    {
                        width: size,
                        margin: 1,
                        errorCorrectionLevel: 'H',
                        color: {
                            dark: '#000000FF',
                            light: '#FFFFFFFF', // Solid white background is more reliable
                        }
                    }
                );
                if (isMounted) {
                    setImageUrl(url);
                }
            } catch (err) {
                console.error("QR Code generation failed:", err);
                if (isMounted) {
                    setError('Falha ao gerar QR Code.');
                }
            } finally {
                if (isMounted) {
                   setIsLoading(false);
                }
            }
        };

        generateQrCode();

        return () => {
            isMounted = false;
        };
    }, [data, size]);

    if (isLoading) {
        return (
            <div
                style={{ width: size, height: size }}
                className="bg-gray-200 animate-pulse rounded-sm"
                title="Carregando QR Code..."
            ></div>
        );
    }

    if (error || !imageUrl) {
         return (
            <div
                style={{ width: size, height: size }}
                className="bg-red-100 border border-red-300 rounded-sm flex items-center justify-center text-center text-xs text-red-700 p-1"
                title={error || 'Falha ao carregar a imagem do QR Code'}
            >
                {error}
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={`QR Code for ${data.type}`}
            width={size}
            height={size}
            style={{ imageRendering: 'pixelated', width: `${size}px`, height: `${size}px` }}
        />
    );
};