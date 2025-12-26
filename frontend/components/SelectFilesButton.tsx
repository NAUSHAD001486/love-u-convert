'use client';

import { useRef, useEffect, useState } from 'react';
import { FileSource } from '@/types';

interface SelectFilesButtonProps {
  onSelect: (source: FileSource) => void;
  onFileInputClick: () => void;
}

const fileSources: Array<{ source: FileSource; icon: JSX.Element; label: string }> = [
  {
    source: 'From Device',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    label: 'From Device',
  },
  {
    source: 'Google Drive',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.71 12.29L3.5 20.5h6.5l4.21-8.21-2.5-5-4.21 5zM12 2L2 19h20L12 2zm5.5 17.5h-6.5l3.25-6.5L17.5 19.5z" />
      </svg>
    ),
    label: 'Google Drive',
  },
  {
    source: 'OneDrive',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-6.78 2.096A4.001 4.001 0 003 15z"
        />
      </svg>
    ),
    label: 'OneDrive',
  },
  {
    source: 'From URL',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    label: 'From Link',
  },
  {
    source: 'Dropbox',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 2L12 6.5 6 11 0 6.5 6 2zm12 0l6 4.5L18 11l-6-4.5L12 6.5 18 2zm-6 9l6 4.5-6 4.5-6-4.5 6-4.5zm12 0l6 4.5-6 4.5-6-4.5 6-4.5z" />
      </svg>
    ),
    label: 'Dropbox',
  },
];

export default function SelectFilesButton({ onSelect, onFileInputClick }: SelectFilesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (source: FileSource) => {
    if (source === 'From Device') {
      onFileInputClick();
      setIsOpen(false);
    }
    // Other sources are disabled, don't close dropdown or do anything
  };

  const isDisabled = (source: FileSource) => source !== 'From Device';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-[200px] px-6 py-3 bg-gradient-to-r from-[#7D3CFF] to-[#A066FF] text-white rounded-lg font-bold text-base hover:from-[#6D2CE6] hover:to-[#9055E6] active:from-[#5D1CD6] active:to-[#8045D6] transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none flex items-center justify-between"
      >
        <span>Select Files</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg py-2 w-[200px] z-50 animate-fadeIn"
        >
          {fileSources.map((item) => {
            const disabled = isDisabled(item.source);
            return (
              <button
                key={item.source}
                onClick={() => handleSelect(item.source)}
                disabled={disabled}
                className={`w-full text-left px-4 py-3 transition-all flex items-center gap-3 text-sm font-medium first:rounded-t-xl last:rounded-b-xl relative group ${
                  disabled
                    ? 'text-gray-400 cursor-not-allowed opacity-75'
                    : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <span className={disabled ? 'text-gray-400' : 'text-gray-600'}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {disabled && (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

