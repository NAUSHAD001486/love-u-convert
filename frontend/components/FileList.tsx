'use client';

import { FileWithId } from '@/types';
import { formatFileSize } from '@/utils/fileValidation';

interface FileListProps {
  files: FileWithId[];
  onDelete: (id: string) => void;
  onSettings?: (id: string) => void;
}

export default function FileList({ files, onDelete, onSettings }: FileListProps) {
  if (files.length === 0) return null;

  // Show max 5 items, then enable scroll
  const maxVisibleItems = 5;
  const itemHeight = 54; // 25% reduced from 72px (72 × 0.75 = 54px)
  const spacing = 8; // space-y-2 = 8px
  const maxHeight = (maxVisibleItems * itemHeight) + ((maxVisibleItems - 1) * spacing);

  return (
    <div 
      className={`w-full space-y-2 ${files.length > maxVisibleItems ? 'overflow-y-auto' : 'overflow-visible'}`}
      style={{ maxHeight: files.length > maxVisibleItems ? `${maxHeight}px` : 'none' }}
    >
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 h-[54px]"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            {file.error && (
              <p className="text-xs text-red-600 mt-1">{file.error}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onSettings && (
              <button
                onClick={() => onSettings(file.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Settings"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(file.id)}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              aria-label="Delete"
            >
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

