'use client';

import { useState, useRef, useEffect } from 'react';
import { OutputFormat } from '@/types';

interface OutputSettingsProps {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

const OUTPUT_FORMATS: OutputFormat[] = [
  'PNG',
  'BMP',
  'EPS',
  'GIF',
  'ICO',
  'JPEG',
  'JPG',
  'SVG',
  'PSD',
  'TGA',
  'TIFF',
  'WEBP',
];

export default function OutputSettings({ value, onChange }: OutputSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Calculate position based on available space
      if (containerRef.current && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 300; // Approximate dropdown height
        
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          setPosition('top');
        } else {
          setPosition('bottom');
        }
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (format: OutputFormat) => {
    onChange(format);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-3 relative">
      <label className="text-sm font-medium text-gray-700">Output:</label>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 min-w-[120px] border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-200/30 focus:border-purple-300/50 bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span>{value}</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-lg shadow-xl py-2 min-w-[120px] z-50 animate-fadeIn`}
          >
            <div 
              className={`overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
                OUTPUT_FORMATS.length > 5 ? 'max-h-[200px]' : ''
              }`}
            >
              {OUTPUT_FORMATS.map((format, index) => (
                <button
                  key={format}
                  onClick={() => handleSelect(format)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-purple-50 transition-colors text-sm font-medium ${
                    value === format ? 'text-[#7C3AED] bg-purple-50 font-semibold' : 'text-gray-700'
                  } ${index === 0 ? 'rounded-t-lg' : ''} ${index === OUTPUT_FORMATS.length - 1 ? 'rounded-b-lg' : ''}`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

