"use strict";
/**
 * Filename normalization utility
 * SINGLE SOURCE OF TRUTH for output filename extensions
 *
 * Rule: JPEG and JPG are the same format, but extension MUST match targetFormat
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOutputFilename = void 0;
/**
 * Normalize output filename with correct extension based on targetFormat
 *
 * @param originalFilename - Original filename (may have any extension)
 * @param targetFormat - Target format (must be lowercase)
 * @returns Filename with correct extension matching targetFormat
 *
 * Examples:
 * - normalizeOutputFilename("image.jpg", "jpeg") → "image.jpeg"
 * - normalizeOutputFilename("image.jpeg", "jpg") → "image.jpg"
 * - normalizeOutputFilename("photo.png", "png") → "photo.png"
 */
const normalizeOutputFilename = (originalFilename, targetFormat) => {
    // Remove existing extension
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, '') || 'image';
    // Normalize target format
    const normalizedFormat = targetFormat.toLowerCase().trim();
    // Determine extension based on targetFormat (CRITICAL: respect jpeg vs jpg)
    let extension;
    if (normalizedFormat === 'jpeg') {
        extension = 'jpeg'; // Force .jpeg extension
    }
    else if (normalizedFormat === 'jpg') {
        extension = 'jpg'; // Force .jpg extension
    }
    else {
        extension = normalizedFormat; // Use targetFormat as-is for all other formats
    }
    return `${baseFilename}.${extension}`;
};
exports.normalizeOutputFilename = normalizeOutputFilename;
