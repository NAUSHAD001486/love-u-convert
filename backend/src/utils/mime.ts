import { allowedFormats, AllowedFormat } from './formats';

// Format -> allowed MIME types mapping
export const formatToMimeTypes: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  svg: ['image/svg+xml'],
  tiff: ['image/tiff'],
  bmp: ['image/bmp'],
};

// MIME type -> formats mapping (reverse lookup)
export const allowedMimeTypes: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/bmp': ['bmp'],
  'image/tiff': ['tiff'],
  'image/svg+xml': ['svg'],
};

/**
 * Check if a detected MIME type is allowed for the target format
 * @param detectedMime - MIME type detected from magic bytes
 * @param targetFormat - Target format requested by user
 * @returns true if MIME is allowed for target format
 */
export const isMimeAllowedForFormat = (
  detectedMime: string | undefined,
  targetFormat: string
): boolean => {
  if (!detectedMime) {
    return false;
  }

  const allowedMimes = formatToMimeTypes[targetFormat.toLowerCase()];
  if (!allowedMimes) {
    return false;
  }

  return allowedMimes.includes(detectedMime);
};

/**
 * Get all allowed MIME types for a given format
 * @param format - Target format
 * @returns Array of allowed MIME types
 */
export const getAllowedMimesForFormat = (format: string): string[] => {
  return formatToMimeTypes[format.toLowerCase()] || [];
};

/**
 * Check if a MIME type is in the allowed list
 * @param mime - MIME type to check
 * @returns true if MIME is allowed
 */
export const isAllowedMimeType = (mime: string): boolean => {
  return mime in allowedMimeTypes;
};
