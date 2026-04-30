import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface PopoverProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    targetRef: React.RefObject<HTMLElement>;
    className?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const Popover: React.FC<PopoverProps> = ({ isOpen, onClose, children, targetRef, className = '', placement = 'right' }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                targetRef.current && !targetRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const updatePosition = () => {
            if (targetRef.current && popoverRef.current) {
                const targetRect = targetRef.current.getBoundingClientRect();
                const popoverRect = popoverRef.current.getBoundingClientRect();
                
                let top = 0, left = 0;
                
                switch (placement) {
                    case 'top':
                        top = targetRect.top - popoverRect.height - 8;
                        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
                        break;
                    case 'bottom':
                        top = targetRect.bottom + 8;
                        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
                        break;
                    case 'left':
                        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
                        left = targetRect.left - popoverRect.width - 8;
                        break;
                    case 'right':
                    default:
                        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
                        left = targetRect.right + 8;
                        break;
                }

                setPosition({ top: top + window.scrollY, left: left + window.scrollX });
            }
        };

        if (isOpen) {
            // Initial position update
            updatePosition();
            // Add listeners
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', updatePosition);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, onClose, targetRef, placement]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            ref={popoverRef}
            className={`absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 ${className}`}
            style={{ top: position.top, left: position.left }}
        >
            {children}
        </div>,
        document.body
    );
};
