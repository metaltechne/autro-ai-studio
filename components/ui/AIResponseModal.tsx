import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface AIResponseModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    error: string;
    response: string;
    title: string;
}

const AILoader: React.FC = () => (
    <div className="flex flex-col items-center justify-center p-8 text-black">
        <svg className="animate-spin h-8 w-8 text-autro-blue mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="font-semibold">Analisando dados...</p>
        <p className="text-sm text-gray-600">Aguarde enquanto a IA processa sua solicitação.</p>
    </div>
);

export const AIResponseModal: React.FC<AIResponseModalProps> = ({ isOpen, onClose, isLoading, error, response, title }) => {
    
    // A simple markdown-like parser for the response
    const formatResponse = (text: string) => {
        return text.split('\n').map((line, index) => {
            if (line.startsWith('- ')) {
                return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
            }
            if (line.trim() === '') {
                return <br key={index} />;
            }
            return <p key={index}>{line}</p>;
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="min-h-[200px]">
                {isLoading ? (
                    <AILoader />
                ) : error ? (
                    <div className="text-center p-4 bg-red-50 text-red-700 rounded-md">
                        <p className="font-semibold">Ocorreu um Erro</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : (
                    <div className="text-sm text-black bg-gray-50/50 p-4 rounded-md space-y-2 prose prose-sm max-w-none">
                        {formatResponse(response)}
                    </div>
                )}
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t border-black/10">
                <Button variant="secondary" onClick={onClose}>Fechar</Button>
            </div>
        </Modal>
    );
};