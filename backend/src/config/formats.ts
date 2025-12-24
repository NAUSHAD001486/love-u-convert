/**
 * Supported output formats for image conversion (final locked list)
 * These are the formats that Cloudinary can convert images to
 * 
 * Final list: png, jpg, jpeg, webp, bmp, tiff, ico, psd, eps, svg, tga, gif
 */
export const SUPPORTED_OUTPUT_FORMATS = new Set<string>([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'bmp',
  'tiff',
  'ico',
  'psd',
  'eps',
  'svg',
  'tga',
  'gif',
]);

/**
 * Check if a format is in the supported output formats list
 * @param format - Format string to check
 * @returns true if format is supported
 */
export const isSupportedOutputFormat = (format: string): boolean => {
  const normalized = normalizeFormat(format);
  return SUPPORTED_OUTPUT_FORMATS.has(normalized);
};

/**
 * Normalize format string (lowercase, trim)
 * @param format - Format string to normalize
 * @returns Normalized format string
 */
export const normalizeFormat = (format: string): string => {
  return format.toLowerCase().trim();
};

