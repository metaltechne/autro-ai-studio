import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProactiveBubble } from './ui/ProactiveBubble';

interface AssistantFabProps {
    onOpen: () => void;
    proactiveMessage: string | null;
    onDismissBubble: () => void;
}

const FAB_SIZE = 64;
const LOCAL_STORAGE_KEY = 'autro_assistantFab_position';

export const AssistantFab: React.FC<AssistantFabProps> = ({ onOpen, proactiveMessage, onDismissBubble }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - FAB_SIZE - 24, y: window.innerHeight - FAB_SIZE - 24 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const fabRef = useRef<HTMLDivElement>(null);
    const hasMoved = useRef(false);

    useEffect(() => {
        try {
            const savedPosition = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedPosition) {
                const parsed = JSON.parse(savedPosition);
                // Ensure it's within bounds on load
                parsed.x = Math.max(0, Math.min(parsed.x, window.innerWidth - FAB_SIZE));
                parsed.y = Math.max(0, Math.min(parsed.y, window.innerHeight - FAB_SIZE));
                setPosition(parsed);
            }
        } catch (e) {
            console.error("Failed to load FAB position", e);
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDragging(true);
        hasMoved.current = false;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragStartPos.current = {
            x: clientX - position.x,
            y: clientY - position.y,
        };

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    }, [position]);
    
    const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        
        hasMoved.current = true;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        let newX = clientX - dragStartPos.current.x;
        let newY = clientY - dragStartPos.current.y;

        // Constrain to viewport
        newX = Math.max(0, Math.min(newX, window.innerWidth - FAB_SIZE));
        newY = Math.max(0, Math.min(newY, window.innerHeight - FAB_SIZE));
        
        setPosition({ x: newX, y: newY });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (hasMoved.current) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(position));
        }
    }, [position]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove);
            window.addEventListener('touchend', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);
    
    const handleClick = () => {
        if (!hasMoved.current) {
            onOpen();
        }
    };

    return (
        <div
            ref={fabRef}
            className="fixed z-40 print-hide"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                cursor: isDragging ? 'grabbing' : 'grab',
            }}
        >
            {proactiveMessage && (
                <ProactiveBubble
                    message={proactiveMessage}
                    onClose={onDismissBubble}
                    onClick={() => {
                        onDismissBubble();
                        onOpen();
                    }}
                />
            )}
            <button
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onClick={handleClick}
                aria-label="Assistente Inteligente"
                className={`bg-autro-blue text-white w-16 h-16 rounded-full shadow-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-autro-blue transition-transform duration-200 hover:scale-110 ${proactiveMessage ? 'animate-pulse-effect' : ''}`}
            >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
            </button>
        </div>
    );
};