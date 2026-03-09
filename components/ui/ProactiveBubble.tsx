import React, { useEffect, useState } from 'react';

interface ProactiveBubbleProps {
    message: string;
    onClose: () => void;
    onClick: () => void;
}

export const ProactiveBubble: React.FC<ProactiveBubbleProps> = ({ message, onClose, onClick }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fade in
        const enterTimer = setTimeout(() => setIsVisible(true), 100);
        
        // Auto-dismiss after some time
        const exitTimer = setTimeout(() => {
            setIsVisible(false);
            const closeTimer = setTimeout(onClose, 300); // Wait for fade-out animation
            return () => clearTimeout(closeTimer);
        }, 15000); // 15 seconds

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(exitTimer);
        };
    }, [message, onClose]);

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    return (
        <div
            onClick={onClick}
            className={`absolute bottom-full mb-3 right-0 w-64 p-3 bg-white rounded-lg shadow-2xl border border-gray-200 cursor-pointer transition-all duration-300 ease-out transform-gpu ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <button
                onClick={handleClose}
                className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-700 rounded-full"
                aria-label="Fechar"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <p className="text-sm text-black pr-4">{message}</p>
            <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white" />
        </div>
    );
};