"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedMimeType = exports.getAllowedMimesForFormat = exports.isMimeAllowedForFormat = exports.allowedMimeTypes = exports.formatToMimeTypes = void 0;
// Format -> allowed MIME types mapping
exports.formatToMimeTypes = {
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
exports.allowedMimeTypes = {
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
const isMimeAllowedForFormat = (detectedMime, targetFormat) => {
    if (!detectedMime) {
        return false;
    }
    // Error should occur ONLY when detectedMime is NOT an image/*
    if (!detectedMime.startsWith('image/')) {
        return false;
    }
    // Check if target format is valid
    const normalizedTarget = targetFormat.toLowerCase();
    if (!exports.formatToMimeTypes[normalizedTarget]) {
        return false;
    }
    // Allow all image/* MIME types to be converted to any valid image format
    // This enables conversions like:
    // - image/png → webp
    // - image/jpeg → webp
    // - image/jpg → webp (treated as image/jpeg)
    // - image/webp → png/jpeg/jpg
    // - Any image/* → Any valid image format
    return true;
};
exports.isMimeAllowedForFormat = isMimeAllowedForFormat;
/**
 * Get all allowed MIME types for a given format
 * @param format - Target format
 * @returns Array of allowed MIME types
 */
const getAllowedMimesForFormat = (format) => {
    return exports.formatToMimeTypes[format.toLowerCase()] || [];
};
exports.getAllowedMimesForFormat = getAllowedMimesForFormat;
/**
 * Check if a MIME type is in the allowed list
 * @param mime - MIME type to check
 * @returns true if MIME is allowed
 */
const isAllowedMimeType = (mime) => {
    return mime in exports.allowedMimeTypes;
};
exports.isAllowedMimeType = isAllowedMimeType;
