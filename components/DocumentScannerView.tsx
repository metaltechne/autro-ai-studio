
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from '../hooks/useToast';
import * as api from '../hooks/api';
import { PurchaseOrdersHook, ManufacturingOrdersHook, Installment } from '../types';
import { ReviewScanModal } from './ReviewScanModal';
import { CameraCaptureModal } from './ui/CameraCaptureModal';

interface DocumentScannerViewProps {
    purchaseOrdersHook: PurchaseOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
}

interface ExtractedData {
    supplier: string;
    totalValue: number;
    installments: {
        value: number;
        dueDate: string; // YYYY-MM-DD
    }[];
    error?: string;
}

const AppLoader: React.FC<{message: string}> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-8">
        <svg className="animate-spin h-10 w-10 text-autro-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-600">{message}</p>
    </div>
);

export const DocumentScannerView: React.FC<DocumentScannerViewProps> = (props) => {
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

    const fileToGenerativePart = async (file: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    };

    const processImageFile = async (file: File) => {
        setPreviewImage(URL.createObjectURL(file));
        setIsLoading(true);
        setExtractedData(null);

        try {
            /* Fix: Obtain API key directly from environment and follow GoogleGenAI initialization guidelines. */
            if (!process.env.API_KEY) throw new Error("Chave de API do Gemini não configurada.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `Você é um assistente de contas a pagar. Sua tarefa é extrair informações de notas fiscais e boletos. Analise a imagem fornecida e retorne um objeto JSON com a seguinte estrutura, e nada mais:
{
  "supplier": "string",
  "totalValue": "number",
  "installments": [
    {
      "value": "number",
      "dueDate": "string"
    }
  ]
}
O campo 'dueDate' deve estar no formato AAAA-MM-DD. Se uma informação não puder ser encontrada, retorne null para aquele campo. Se a imagem não for um documento financeiro válido, retorne um JSON com um campo de erro: { "error": "Documento inválido." }`;

            const imagePart = await fileToGenerativePart(file);

            /* Fix: Using recommended gemini-3-pro-preview model for complex multimodal text extraction. */
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [imagePart, { text: 'Extraia os dados deste documento.' }] },
                config: { systemInstruction, responseMimeType: 'application/json' },
            });

            const data = JSON.parse(response.text) as ExtractedData;
            
            if (data.error) {
                addToast(data.error, 'error');
                resetState();
            } else if (!data.totalValue || !data.installments || data.installments.length === 0) {
                 addToast("IA não conseguiu extrair dados válidos. Tente uma imagem mais nítida.", 'error');
                 resetState();
            }
            else {
                setExtractedData(data);
                setIsReviewModalOpen(true);
            }

        } catch (error) {
            console.error("Error processing document:", error);
            addToast("Falha ao analisar o documento. Verifique sua chave de API e a imagem.", 'error');
            resetState();
        } finally {
            setIsLoading(false);
             if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processImageFile(file);
        }
    };
    
    const handleCapture = (file: File) => {
        processImageFile(file);
    };
    
    const resetState = () => {
        setIsLoading(false);
        setPreviewImage(null);
        setExtractedData(null);
        setIsReviewModalOpen(false);
        setIsCameraModalOpen(false);
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Entrada Inteligente de Documentos</h2>
            <Card>
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    
                    <h3 className="text-xl font-semibold text-black">Escanear Nota Fiscal ou Boleto</h3>
                    <p className="text-gray-500 mt-2 mb-6 text-center">Use a câmera para uma entrada rápida ou envie um arquivo de imagem.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={() => setIsCameraModalOpen(true)} disabled={isLoading} size="lg">
                            Usar Câmera
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} variant="secondary" size="lg">
                            Enviar Arquivo
                        </Button>
                    </div>
                </div>

                {isLoading && (
                    <div className="mt-6">
                        <AppLoader message="Analisando documento com IA..." />
                    </div>
                )}
                
                {previewImage && !isLoading && (
                    <div className="mt-6">
                        <h4 className="font-semibold text-center mb-2">Imagem Capturada:</h4>
                        <img src={previewImage} alt="Pré-visualização do documento" className="max-w-md mx-auto rounded-lg shadow-md" />
                    </div>
                )}

            </Card>

            <CameraCaptureModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={handleCapture}
            />

            {isReviewModalOpen && extractedData && (
                <ReviewScanModal
                    isOpen={isReviewModalOpen}
                    onClose={resetState}
                    data={extractedData}
                    {...props}
                />
            )}
        </div>
    );
};
