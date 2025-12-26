'use client';

import { useRef, useState, useCallback } from 'react';
import { FileWithId } from '@/types';
import { isValidFileType, isRejectedFileType } from '@/utils/fileValidation';
import FileList from './FileList';
import SelectFilesButton from './SelectFilesButton';
import { FileSource } from '@/types';

interface UploadBoxProps {
  files: FileWithId[];
  onFilesChange: (files: FileWithId[]) => void;
  onFileDelete: (id: string) => void;
  onRejectedFiles?: (count: number) => void;
  onMaxFilesReached?: () => void;
}

export default function UploadBox({ files, onFilesChange, onFileDelete, onRejectedFiles, onMaxFilesReached }: UploadBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const processFiles = useCallback(
    (fileList: FileList | null): FileWithId[] => {
      if (!fileList) return [];

      const newFiles: FileWithId[] = [];
      const existingNames = new Set(files.map((f) => f.name));
      let rejectedCount = 0;

      Array.from(fileList).forEach((file) => {
        // Limit to 10 files total
        if (files.length + newFiles.length >= 10) {
          if (onMaxFilesReached && files.length + newFiles.length === 10) {
            onMaxFilesReached();
          }
          return;
        }
        
        if (isRejectedFileType(file.name)) {
          // Block ICO and TGA files - don't add to list
          rejectedCount++;
          return;
        }
        
        // Accept any file with an extension that's in the allowed list
        // This ensures RAW formats and other image types are accepted
        // Don't rely on browser MIME type detection for RAW formats
        if (isValidFileType(file.name)) {
          if (!existingNames.has(file.name)) {
            newFiles.push({
              id: generateId(),
              file,
              name: file.name,
              size: file.size,
            });
          }
        } else {
          // Also accept files with image MIME types or PDF, even if not in allowed list
          // Backend will do final validation
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (ext && !existingNames.has(file.name)) {
            if (file.type?.startsWith('image/') || file.type === 'application/pdf') {
              newFiles.push({
                id: generateId(),
                file,
                name: file.name,
                size: file.size,
              });
            }
          }
        }
      });

      if (rejectedCount > 0 && onRejectedFiles) {
        onRejectedFiles(rejectedCount);
      }

      return [...files, ...newFiles];
    },
    [files, onRejectedFiles]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const newFiles = processFiles(droppedFiles);
      onFilesChange(newFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles = processFiles(selectedFiles);
      onFilesChange(newFiles);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSourceSelect = (source: FileSource) => {
    if (source === 'From Device') {
      fileInputRef.current?.click();
    }
    // Other sources (Google Drive, OneDrive, etc.) are disabled in the UI
  };

  return (
    <div className="relative w-full">
      <div
        className={`w-[90%] mx-auto h-[315px] border-2 border-dashed rounded-lg transition-all duration-300 ${
          isDragging
            ? 'border-[#7C3AED] bg-purple-50 shadow-lg shadow-purple-200/50'
            : 'border-gray-300 bg-gray-50 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-200/40'
        } flex flex-col items-center justify-center p-6`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <SelectFilesButton
            onSelect={handleSourceSelect}
            onFileInputClick={() => fileInputRef.current?.click()}
          />
          <p className="text-sm text-gray-600">Or drag and drop files here</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          onChange={handleFileInput}
          className="hidden"
          aria-label="Select files to upload"
        />
      </div>
    </div>
  );
}

