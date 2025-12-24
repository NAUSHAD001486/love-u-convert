"use strict";
/**
 * Conversion Router - Core routing layer for image conversions
 * Routes conversions based on input/output type combinations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeConversion = exports.determineConversionRoute = void 0;
const cloudinary_service_1 = require("./cloudinary.service");
/**
 * Classify input format as raster or vector
 */
const isRasterFormat = (format) => {
    if (!format)
        return false;
    const normalized = format.toLowerCase();
    const rasterFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'gif', 'ico', 'tga', 'psd'];
    return rasterFormats.includes(normalized);
};
const isVectorFormat = (format) => {
    if (!format)
        return false;
    const normalized = format.toLowerCase();
    return normalized === 'svg' || normalized === 'eps';
};
/**
 * Extract format from MIME type
 */
const extractFormatFromMime = (mime) => {
    if (!mime)
        return null;
    if (mime.includes('/')) {
        const parts = mime.split('/');
        if (parts.length === 2) {
            return parts[1].split('+')[0]; // Handle "image/svg+xml" -> "svg"
        }
    }
    return mime.toLowerCase();
};
/**
 * Determine conversion route based on input/output types
 */
const determineConversionRoute = (context) => {
    const inputFormat = extractFormatFromMime(context.detectedMime) || context.inputFormat;
    const targetFormat = context.targetFormat.toLowerCase();
    // ICO generation: special handling
    if (targetFormat === 'ico') {
        return 'ico-generation';
    }
    // GIF conversion: Cloudinary only, no SVG output
    if (targetFormat === 'gif' || inputFormat === 'gif') {
        return 'gif-conversion';
    }
    // SVG → SVG: Passthrough
    if (isVectorFormat(inputFormat) && targetFormat === 'svg') {
        return 'svg-to-svg';
    }
    // SVG → Raster: High DPI rasterization
    if (isVectorFormat(inputFormat) && isRasterFormat(targetFormat)) {
        return 'svg-to-raster';
    }
    // Raster → SVG: Local vectorization (not Cloudinary)
    if (isRasterFormat(inputFormat) && targetFormat === 'svg') {
        return 'raster-to-svg-local';
    }
    // Raster → Raster: Standard Cloudinary conversion
    if (isRasterFormat(inputFormat) && isRasterFormat(targetFormat)) {
        return 'raster-to-raster';
    }
    // Default: raster-to-raster (fallback)
    return 'raster-to-raster';
};
exports.determineConversionRoute = determineConversionRoute;
/**
 * Execute conversion based on route
 * Returns Cloudinary URL (never returns filePath - local vectorization handled separately)
 */
const executeConversion = async (fileStream, context, publicId) => {
    const route = (0, exports.determineConversionRoute)(context);
    const targetFormat = context.targetFormat.toLowerCase();
    // Generate final filename with correct extension
    let extension = targetFormat;
    if (targetFormat === 'jpeg') {
        extension = 'jpeg';
    }
    else if (targetFormat === 'jpg') {
        extension = 'jpg';
    }
    const baseFilename = context.originalFilename.replace(/\.[^/.]+$/, '') || 'image';
    const finalFilename = `${baseFilename}.${extension}`;
    // Route: Raster → SVG (local vectorization - skip Cloudinary)
    // This route should never reach here - handled in jobProcessor
    if (route === 'raster-to-svg-local') {
        throw new Error('Raster to SVG conversion must be handled via local vectorization service');
    }
    // Route: SVG → SVG (passthrough)
    if (route === 'svg-to-svg') {
        // Passthrough: minimal transformations
        return (0, cloudinary_service_1.uploadImageStream)(fileStream, {
            targetFormat: 'svg',
            publicId,
            originalFilename: finalFilename,
            context: {
                originalFormat: context.detectedMime || 'unknown',
            },
            quotaLimit: 0,
            quotaUsed: 0,
        });
    }
    // Route: SVG → Raster (high DPI)
    if (route === 'svg-to-raster') {
        // High resolution rendering for vector to raster
        return (0, cloudinary_service_1.uploadImageStream)(fileStream, {
            targetFormat,
            publicId,
            originalFilename: finalFilename,
            context: {
                originalFormat: context.detectedMime || 'unknown',
                vectorToRaster: 'true',
            },
            quotaLimit: 0,
            quotaUsed: 0,
        });
    }
    // Route: ICO generation
    if (route === 'ico-generation') {
        return (0, cloudinary_service_1.uploadImageStream)(fileStream, {
            targetFormat: 'ico',
            publicId,
            originalFilename: finalFilename,
            context: {
                originalFormat: context.detectedMime || 'unknown',
            },
            quotaLimit: 0,
            quotaUsed: 0,
        });
    }
    // Route: Raster → Raster or GIF conversion (standard)
    return (0, cloudinary_service_1.uploadImageStream)(fileStream, {
        targetFormat,
        publicId,
        originalFilename: finalFilename,
        context: {
            originalFormat: context.detectedMime || 'unknown',
        },
        quotaLimit: 0,
        quotaUsed: 0,
    });
};
exports.executeConversion = executeConversion;
