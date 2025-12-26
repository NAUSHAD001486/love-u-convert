'use client';

import { useRef, useEffect } from 'react';
import { FileSource } from '@/types';

interface FileSourceDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (source: FileSource) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

export default function FileSourceDropdown({
  isOpen,
  onClose,
  onSelect,
  triggerRef,
}: FileSourceDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sources: FileSource[] = ['From Device', 'Google Drive', 'OneDrive', 'From URL', 'Dropbox'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[180px] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {sources.map((source) => (
        <button
          key={source}
          onClick={() => {
            onSelect(source);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-sm"
        >
          {source}
        </button>
      ))}
    </div>
  );
}

