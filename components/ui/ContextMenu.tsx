import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ContextMenuProps {
    isOpen: boolean;
    onClose: () => void;
    position: { top: number; left: number };
    menuItems: { label: string; onClick: () => void }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, onClose, position, menuItems }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const handleItemClick = (onClick: () => void) => {
        onClick();
        onClose();
    };

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            className="absolute z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1"
            style={{ top: position.top, left: position.left }}
        >
            <ul>
                {menuItems.map((item, index) => (
                    <li key={index}>
                        <button
                            onClick={() => handleItemClick(item.onClick)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>,
        document.body
    );
};
