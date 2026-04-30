import React from 'react';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: number | string;
  displayValue: string;
}

export const Slider: React.FC<SliderProps> = ({ label, value, displayValue, ...props }) => {
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        <span className="text-sm font-semibold text-white bg-white/10 px-2 py-0.5 rounded">{displayValue}</span>
      </div>
      <input
        type="range"
        value={value}
        {...props}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
      />
    </div>
  );
};