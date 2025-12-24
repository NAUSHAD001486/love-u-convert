"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFileAsStream = exports.uploadImageStream = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const stream_1 = require("stream");
const errors_1 = require("../utils/errors");
/**
 * Check if a format is a raster image format
 */
const isRasterFormat = (format) => {
    if (!format)
        return false;
    const normalized = format.toLowerCase();
    const rasterFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'gif', 'ico', 'tga', 'psd'];
    return rasterFormats.includes(normalized);
};
/**
 * Check if a format is a vector image format
 */
const isVectorFormat = (format) => {
    if (!format)
        return false;
    const normalized = format.toLowerCase();
    return normalized === 'svg' || normalized === 'eps';
};
/**
 * Extract format from MIME type or context
 */
const extractInputFormat = (context) => {
    if (!context)
        return null;
    // Try to extract from originalFormat in context
    const originalFormat = context.originalFormat;
    if (originalFormat) {
        // Extract format from MIME type (e.g., "image/jpeg" -> "jpeg")
        if (originalFormat.includes('/')) {
            const parts = originalFormat.split('/');
            if (parts.length === 2) {
                return parts[1].split('+')[0]; // Handle "image/svg+xml" -> "svg"
            }
        }
        return originalFormat.toLowerCase();
    }
    return null;
};
const uploadImageStream = (stream, options) => {
    return new Promise((resolve, reject) => {
        // Block unsupported formats
        const targetFormat = options.targetFormat.toLowerCase();
        if (targetFormat === 'odd' || targetFormat === 'exe') {
            reject(new Error(`Unsupported output format: ${targetFormat}`));
            return;
        }
        const uploadOptions = {
            resource_type: 'image',
            format: targetFormat, // Always enforce target format (critical for format fidelity)
            eager_async: false,
        };
        const inputFormat = extractInputFormat(options.context);
        // SVG rules (locked)
        if (targetFormat === 'svg') {
            // Raster → SVG: NOT allowed
            if (isRasterFormat(inputFormat)) {
                reject(new Error('Raster to SVG conversion is not supported'));
                return;
            }
            // SVG → SVG: Passthrough (no transformations needed)
            // Vector → SVG: Passthrough
        }
        // SVG → Raster: High DPI render for sharp output
        if ((isVectorFormat(inputFormat) && isRasterFormat(targetFormat)) ||
            options.context?.vectorToRaster === 'true') {
            // High resolution rendering for vector to raster (no blur)
            uploadOptions.dpr = 2.0; // High DPI for sharp output
            uploadOptions.quality = 'auto';
        }
        // ICO output: Fixed sizes (16, 32, 48, 64, 128, 256) with square canvas
        if (targetFormat === 'ico') {
            // Generate ICO with multiple sizes (Cloudinary handles this)
            // Use fixed 256x256 as base, square canvas, center with padding
            uploadOptions.width = 256;
            uploadOptions.height = 256;
            uploadOptions.crop = 'pad';
            uploadOptions.gravity = 'center';
            uploadOptions.background = 'transparent';
        }
        // JPEG extension fix: Force .jpeg extension in filename and URL
        if (targetFormat === 'jpeg' && options.originalFilename) {
            uploadOptions.use_filename = true;
            uploadOptions.unique_filename = false;
            uploadOptions.filename_override = options.originalFilename;
            uploadOptions.format = 'jpeg';
        }
        // JPG extension fix: Force .jpg extension
        if (targetFormat === 'jpg' && options.originalFilename) {
            // Ensure .jpg extension (not .jpeg)
            const baseFilename = options.originalFilename.replace(/\.(jpeg|jpg)$/i, '');
            const jpgFilename = `${baseFilename}.jpg`;
            uploadOptions.use_filename = true;
            uploadOptions.unique_filename = false;
            uploadOptions.filename_override = jpgFilename;
            uploadOptions.format = 'jpg';
        }
        // Format enforcement (CRITICAL): Always preserve target format
        // - format: targetFormat (already set above)
        // - quality: 'auto' for raster outputs
        // - fetch_format: undefined (don't override format)
        const rasterOutputFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'ico', 'gif', 'tga', 'psd'];
        if (rasterOutputFormats.includes(targetFormat)) {
            uploadOptions.quality = 'auto';
            // Explicitly do NOT set fetch_format to preserve format fidelity
            // This prevents PNG from converting to JPG, JPEG from losing extension
        }
        if (options.publicId) {
            uploadOptions.public_id = options.publicId;
        }
        if (options.context) {
            uploadOptions.context = options.context;
        }
        let bytesUploaded = 0;
        let uploadAborted = false;
        let cloudinaryUploadStream = null;
        const quotaLimit = options.quotaLimit || 0;
        const quotaUsed = options.quotaUsed || 0;
        const byteTracker = new stream_1.Transform({
            transform(chunk, encoding, callback) {
                if (uploadAborted) {
                    return callback();
                }
                bytesUploaded += chunk.length;
                const newQuotaUsed = quotaUsed + bytesUploaded;
                if (quotaLimit > 0 && newQuotaUsed > quotaLimit) {
                    uploadAborted = true;
                    if (cloudinaryUploadStream && typeof cloudinaryUploadStream.destroy === 'function') {
                        cloudinaryUploadStream.destroy();
                    }
                    if (stream && typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                    reject(new errors_1.QuotaExceededError('Daily upload limit exceeded'));
                    return callback();
                }
                callback(null, chunk);
            },
        });
        cloudinaryUploadStream = cloudinary_1.default.uploader.upload_stream(uploadOptions, (error, result) => {
            if (uploadAborted) {
                return;
            }
            if (error) {
                reject(error);
                return;
            }
            if (!result || !result.secure_url || !result.public_id) {
                reject(new Error('Cloudinary upload failed: invalid response'));
                return;
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                bytesUploaded,
            });
        });
        stream.pipe(byteTracker).pipe(cloudinaryUploadStream);
        stream.on('error', (error) => {
            if (!uploadAborted) {
                if (cloudinaryUploadStream && typeof cloudinaryUploadStream.destroy === 'function') {
                    cloudinaryUploadStream.destroy();
                }
                reject(error);
            }
        });
        byteTracker.on('error', (error) => {
            if (!uploadAborted) {
                if (cloudinaryUploadStream && typeof cloudinaryUploadStream.destroy === 'function') {
                    cloudinaryUploadStream.destroy();
                }
                reject(error);
            }
        });
    });
};
exports.uploadImageStream = uploadImageStream;
const downloadFileAsStream = (url) => {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const http = require('http');
        const urlModule = require('url');
        const parsedUrl = urlModule.parse(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            resolve(response);
        }).on('error', (error) => {
            reject(error);
        });
    });
};
exports.downloadFileAsStream = downloadFileAsStream;
