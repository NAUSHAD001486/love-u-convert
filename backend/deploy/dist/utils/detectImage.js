"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectImageFromBuffer = exports.detectImage = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Detect if a file is an image by reading its content (magic bytes)
 * Supports:
 * - Bitmap formats (PNG, JPEG, GIF, WEBP, etc.) via file-type
 * - Vector formats (SVG, EPS) via content inspection
 * - TIFF files via extension
 * - ICO files
 * - PSD files
 * - Screenshots
 * - Renamed files (content-based detection, not extension-based)
 *
 * @param filePath - Path to the file on disk
 * @returns Detection result with image information
 */
const detectImage = async (filePath) => {
    try {
        // Get file extension for vector format detection
        const ext = (0, path_1.extname)(filePath).toLowerCase().slice(1); // Remove leading dot
        // Vector format detection (SVG, EPS)
        if (ext === 'svg' || ext === 'eps') {
            const fileContent = (0, fs_1.readFileSync)(filePath, 'utf8');
            if (ext === 'svg') {
                // SVG valid if starts with "<svg" OR contains "<svg"
                const isSvg = fileContent.trim().startsWith('<svg') || fileContent.includes('<svg');
                if (isSvg) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Detected vector image (svg)');
                    }
                    return {
                        isImage: true,
                        format: 'svg',
                        mimeType: 'image/svg+xml',
                    };
                }
            }
            else if (ext === 'eps') {
                // EPS valid if starts with "%!PS-Adobe"
                const isEps = fileContent.trim().startsWith('%!PS-Adobe');
                if (isEps) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Detected vector image (eps)');
                    }
                    return {
                        isImage: true,
                        format: 'eps',
                        mimeType: 'application/postscript',
                    };
                }
            }
        }
        // TIFF detection via extension (tif, tiff)
        if (ext === 'tif' || ext === 'tiff') {
            if (process.env.NODE_ENV !== 'production') {
                console.log('Detected tiff image');
            }
            return {
                isImage: true,
                format: 'tiff',
                mimeType: 'image/tiff',
            };
        }
        // RAW format detection via extension (many RAW formats don't have standard MIME types)
        const rawFormats = ['raw', 'cr2', 'nef', 'orf', 'sr2', 'arw', 'dng', 'crw', 'raf', 'rw2', 'pef', 'srw', '3fr', 'mrw', 'x3f'];
        if (rawFormats.includes(ext)) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Detected RAW image format: ${ext}`);
            }
            return {
                isImage: true,
                format: ext,
                mimeType: 'image/x-raw', // Generic RAW MIME type
            };
        }
        // PDF detection via extension
        if (ext === 'pdf') {
            if (process.env.NODE_ENV !== 'production') {
                console.log('Detected PDF document');
            }
            return {
                isImage: true, // Treat PDF as processable image document
                format: 'pdf',
                mimeType: 'application/pdf',
            };
        }
        // Bitmap format detection using file-type (magic bytes)
        // Read first bytes for magic byte detection (file-type needs at least 4100 bytes for some formats)
        const fullBuffer = (0, fs_1.readFileSync)(filePath);
        const buffer = fullBuffer.slice(0, Math.min(4100, fullBuffer.length));
        // Use file-type to detect image from content
        const { fileTypeFromBuffer } = await Promise.resolve().then(() => __importStar(require('file-type')));
        const fileType = await fileTypeFromBuffer(buffer);
        if (!fileType) {
            return {
                isImage: false,
            };
        }
        // Check if detected MIME type is an image
        const isImage = fileType.mime.startsWith('image/');
        if (!isImage) {
            return {
                isImage: false,
                mimeType: fileType.mime,
            };
        }
        // Extract format from MIME type or extension
        let format;
        if (fileType.ext) {
            format = fileType.ext;
        }
        else if (fileType.mime) {
            // Extract format from MIME type (e.g., "image/png" -> "png")
            const mimeParts = fileType.mime.split('/');
            if (mimeParts.length === 2) {
                format = mimeParts[1].split('+')[0]; // Handle "image/svg+xml" -> "svg"
            }
        }
        if (process.env.NODE_ENV !== 'production') {
            console.log('Detected bitmap image');
        }
        // Try to get dimensions using image-size if available
        // For now, we'll just return the format and let Cloudinary handle dimensions
        let width;
        let height;
        try {
            // Try to read more bytes for dimension detection if needed
            // For most formats, file-type is sufficient
            // Dimensions can be extracted later by Cloudinary if needed
        }
        catch {
            // Dimension detection is optional
        }
        return {
            isImage: true,
            format,
            mimeType: fileType.mime,
            width,
            height,
        };
    }
    catch (error) {
        console.error('Image detection error:', error);
        return {
            isImage: false,
        };
    }
};
exports.detectImage = detectImage;
/**
 * Detect image from buffer (for streaming scenarios)
 * @param buffer - File buffer (first bytes)
 * @returns Detection result
 */
const detectImageFromBuffer = async (buffer) => {
    try {
        const { fileTypeFromBuffer } = await Promise.resolve().then(() => __importStar(require('file-type')));
        const fileType = await fileTypeFromBuffer(buffer);
        if (!fileType) {
            return {
                isImage: false,
            };
        }
        const isImage = fileType.mime.startsWith('image/');
        if (!isImage) {
            return {
                isImage: false,
                mimeType: fileType.mime,
            };
        }
        let format;
        if (fileType.ext) {
            format = fileType.ext;
        }
        else if (fileType.mime) {
            const mimeParts = fileType.mime.split('/');
            if (mimeParts.length === 2) {
                format = mimeParts[1].split('+')[0];
            }
        }
        return {
            isImage: true,
            format,
            mimeType: fileType.mime,
        };
    }
    catch (error) {
        console.error('Image detection from buffer error:', error);
        return {
            isImage: false,
        };
    }
};
exports.detectImageFromBuffer = detectImageFromBuffer;
