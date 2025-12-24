"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFormat = exports.isSupportedOutputFormat = exports.SUPPORTED_OUTPUT_FORMATS = void 0;
/**
 * Supported output formats for image conversion (final locked list)
 * These are the formats that Cloudinary can convert images to
 *
 * Final list: png, jpg, jpeg, webp, bmp, tiff, ico, psd, eps, svg, tga, gif
 */
exports.SUPPORTED_OUTPUT_FORMATS = new Set([
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
const isSupportedOutputFormat = (format) => {
    const normalized = (0, exports.normalizeFormat)(format);
    return exports.SUPPORTED_OUTPUT_FORMATS.has(normalized);
};
exports.isSupportedOutputFormat = isSupportedOutputFormat;
/**
 * Normalize format string (lowercase, trim)
 * @param format - Format string to normalize
 * @returns Normalized format string
 */
const normalizeFormat = (format) => {
    return format.toLowerCase().trim();
};
exports.normalizeFormat = normalizeFormat;
