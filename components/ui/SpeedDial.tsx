import React, { useState, useEffect, useRef } from 'react';

export interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface SpeedDialProps {
  actions: ActionItem[];
  isMobile?: boolean;
}

export const SpeedDial: React.FC<SpeedDialProps> = ({ actions, isMobile = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);


  const getActionStyle = (index: number): React.CSSProperties => {
    if (!isOpen) {
      return { transform: 'translateY(10px) scale(0.8)', opacity: 0, pointerEvents: 'none' };
    }
    return {
      transform: `translateY(-${(index + 1) * 60}px) scale(1)`,
      opacity: 1,
      transitionDelay: `${index * 0.04}s`,
      pointerEvents: 'auto',
    };
  };

  return (
    <div ref={wrapperRef} className={`fixed ${isMobile ? 'bottom-20' : 'bottom-6'} right-6 z-[45] print-hide`}>
      <div className="relative flex flex-col items-center gap-4">
        {/* Action buttons */}
        <div className="flex flex-col items-center gap-4">
            {actions.map((action, index) => (
            <div
                key={action.label}
                className="transition-all duration-300 ease-out"
                style={getActionStyle(index)}
            >
                <div className="relative group flex items-center">
                     <div className="absolute right-full mr-4 px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        {action.label}
                    </div>
                    <button
                        onClick={() => {
                            action.onClick();
                            setIsOpen(false);
                        }}
                        title={action.label}
                        aria-label={action.label}
                        className="bg-white text-autro-blue w-14 h-14 rounded-full shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-autro-blue transition-transform hover:scale-105"
                    >
                    {action.icon}
                    </button>
                </div>
            </div>
            ))}
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fechar menu de ações" : "Abrir menu de ações"}
          className="bg-autro-blue text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-autro-blue transition-transform duration-200 hover:scale-110 z-10"
        >
          <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v12m6-6H6" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
};