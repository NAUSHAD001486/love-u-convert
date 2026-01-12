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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMimeFromBuffer = exports.mimeTypeGuard = void 0;
const formats_1 = require("../config/formats");
const detectImage_1 = require("../utils/detectImage");
const path_1 = __importDefault(require("path"));
/**
 * MIME type guard middleware
 * - Validates target format against allowlist
 * - Performs content-based image detection (not MIME-based)
 * - Calls next() with error object on validation failure (errorHandler sends response)
 * - Attaches fileMeta to request for downstream use
 * - Pure validation only - never sends responses directly
 */
const mimeTypeGuard = async (req, res, next) => {
    // Get targetFormat from query params or body
    const targetFormatRaw = req.query.targetFormat ||
        req.body?.targetFormat;
    if (!targetFormatRaw) {
        return next({
            statusCode: 400,
            code: 'MISSING_TARGET_FORMAT',
            message: 'targetFormat parameter is required',
        });
    }
    // Normalize and validate target format
    const targetFormat = (0, formats_1.normalizeFormat)(targetFormatRaw);
    if (!(0, formats_1.isSupportedOutputFormat)(targetFormat)) {
        const allowedFormatsList = Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
        const message = `Target format "${targetFormatRaw}" is not supported. Allowed formats: ${allowedFormatsList}`;
        return next({
            statusCode: 415,
            code: 'UNSUPPORTED_TARGET_FORMAT',
            message,
            details: {
                allowedFormats: Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort(),
            },
        });
    }
    // Validate files that were processed by uploadStream using extension-based validation
    // Extension-first validation (MANDATORY) - MIME type is ignored for validation
    if (req.files && Array.isArray(req.files)) {
        const files = req.files;
        const invalidFiles = [];
        // ALLOWED_EXTENSIONS list (ICO and TGA enabled as input - will be normalized to PNG)
        const ALLOWED_EXTENSIONS = [
            'jpg', 'jpeg', 'png', 'webp', 'gif',
            'bmp', 'tiff', 'psd', 'eps', 'svg',
            'ico', 'tga', 'heic', 'heif', 'avif',
            'jxl', 'apng', 'jp2', 'j2k', 'jpx',
            'pcx', 'dib', 'xbm', 'xpm', 'wbmp',
            'pdf', 'raw', 'cr2', 'nef', 'orf',
            'sr2', 'arw', 'dng', 'crw', 'raf',
            'rw2', 'pef', 'srw', '3fr', 'mrw', 'x3f'
        ];
        // Check each file using extension-based validation ONLY
        for (const file of files) {
            if (!file.tempPath) {
                invalidFiles.push({
                    filename: file.filename || 'unknown',
                    reason: 'File not uploaded',
                });
                continue;
            }
            // Extension-first validation (ONLY EXTENSION decides image validity)
            const ext = path_1.default.extname(file.filename || '').toLowerCase().replace('.', '');
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                invalidFiles.push({
                    filename: file.filename || 'unknown',
                    reason: 'Invalid image file',
                });
                continue;
            }
            // MIME type is IGNORED for validation (TGA, EPS, PSD, RAW formats often have non-image MIME types)
            // Actual decoding/validation happens at conversion layer
            // Still try to detect MIME for downstream use, but don't block on it
            try {
                const detectionResult = await (0, detectImage_1.detectImage)(file.tempPath);
                if (detectionResult.mimeType) {
                    file.detectedMime = detectionResult.mimeType;
                }
                else if (detectionResult.isImage) {
                    // For RAW formats and other formats that might not have standard MIME types
                    // but are detected as images, set a generic MIME type
                    const rawFormats = ['raw', 'cr2', 'nef', 'orf', 'sr2', 'arw', 'dng', 'crw', 'raf', 'rw2', 'pef', 'srw', '3fr', 'mrw', 'x3f'];
                    if (rawFormats.includes(ext)) {
                        file.detectedMime = 'image/x-raw';
                    }
                    else if (ext === 'pdf') {
                        file.detectedMime = 'application/pdf';
                    }
                }
            }
            catch (error) {
                // MIME detection failure is not a blocker - extension validation passed
                // For RAW formats, set generic MIME type if detection fails
                const rawFormats = ['raw', 'cr2', 'nef', 'orf', 'sr2', 'arw', 'dng', 'crw', 'raf', 'rw2', 'pef', 'srw', '3fr', 'mrw', 'x3f'];
                if (rawFormats.includes(ext)) {
                    file.detectedMime = 'image/x-raw';
                }
                else if (ext === 'pdf') {
                    file.detectedMime = 'application/pdf';
                }
                // detectedMime can remain null or use default for other formats
            }
        }
        if (invalidFiles.length > 0) {
            return next({
                statusCode: 415,
                code: 'INVALID_IMAGE_FILE',
                message: 'Uploaded file is not a valid image',
                details: {
                    invalidFiles,
                },
            });
        }
        // Attach fileMeta to request with normalized format
        req.fileMeta = {
            detectedMime: files[0]?.detectedMime || null,
            targetFormat,
            isValid: true,
        };
        next();
    }
    else {
        // If no files yet (shouldn't happen with correct middleware order), allow through
        // uploadStream will handle file processing
        req.fileMeta = {
            detectedMime: null,
            targetFormat,
            isValid: true,
        };
        next();
    }
};
exports.mimeTypeGuard = mimeTypeGuard;
/**
 * Helper function to detect MIME from buffer (used by uploadStream)
 * @param buffer - First bytes of file (magic bytes)
 * @returns Detected MIME type or null
 */
const detectMimeFromBuffer = async (buffer) => {
    try {
        const { fileTypeFromBuffer } = await Promise.resolve().then(() => __importStar(require('file-type')));
        const fileType = await fileTypeFromBuffer(buffer);
        return fileType ? fileType.mime : null;
    }
    catch (error) {
        console.error('MIME detection error:', error);
        return null;
    }
};
exports.detectMimeFromBuffer = detectMimeFromBuffer;
