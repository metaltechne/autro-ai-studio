import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useToast } from '../../hooks/useToast';

interface CameraCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
    const { addToast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        const startStream = async () => {
            if (isOpen && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    addToast("Não foi possível acessar a câmera. Verifique as permissões.", 'error');
                    onClose();
                }
            }
        };

        if (isOpen) {
            startStream();
        } else {
            stopStream();
        }

        return () => {
            stopStream();
        };
    }, [isOpen, onClose, addToast, stopStream]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            setIsCapturing(true);
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (blob) {
                        const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
                        onCapture(file);
                    } else {
                        addToast('Falha ao capturar imagem.', 'error');
                    }
                    setIsCapturing(false);
                    onClose();
                }, 'image/png');
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Capturar Documento com a Câmera" size="2xl">
            <div className="flex flex-col items-center">
                <div className="w-full bg-black rounded-lg overflow-hidden relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                    <canvas ref={canvasRef} className="hidden" />
                </div>
                <p className="text-sm text-gray-500 mt-4 mb-6">Enquadre o documento e clique em capturar.</p>
                <div className="flex justify-center gap-4 w-full">
                    <Button variant="secondary" onClick={onClose} disabled={isCapturing}>Cancelar</Button>
                    <Button onClick={handleCapture} disabled={isCapturing}>
                        {isCapturing ? 'Capturando...' : 'Capturar Imagem'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};