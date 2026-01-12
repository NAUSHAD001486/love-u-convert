"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImageFromUrl = exports.convertImage = void 0;
const convert_queue_1 = require("../queue/convert.queue");
const ip_1 = require("../utils/ip");
const formats_1 = require("../config/formats");
const convertImage = async (req, res) => {
    try {
        const files = req.uploadedFiles;
        const targetFormatRaw = req.body?.targetFormat || req.query?.targetFormat;
        const quotaInfo = req.quotaInfo || {};
        // Validation: No files
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILES_PROVIDED',
                    message: 'At least one file is required',
                },
            });
        }
        // Validation: Missing target format
        if (!targetFormatRaw) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_TARGET_FORMAT',
                    message: 'targetFormat parameter is required',
                },
            });
        }
        // Normalize and validate target format
        const targetFormat = (0, formats_1.normalizeFormat)(targetFormatRaw);
        // Block unsupported formats explicitly
        if (targetFormat === 'odd' || targetFormat === 'exe') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_TARGET_FORMAT',
                    message: `${targetFormat.toUpperCase()} format is not supported for image conversion`,
                },
            });
        }
        if (!(0, formats_1.isSupportedOutputFormat)(targetFormat)) {
            const allowedFormatsList = Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
            const message = `Target format "${targetFormatRaw}" is not supported. Allowed formats: ${allowedFormatsList}`;
            return res.status(400).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_TARGET_FORMAT',
                    message,
                    details: {
                        allowedFormats: Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort(),
                    },
                },
            });
        }
        const clientIP = (0, ip_1.extractClientIP)(req);
        // Create job (synchronous - just in-memory storage)
        // NO heavy work here - all conversion happens in background worker
        const jobId = (0, convert_queue_1.createJob)({
            files: files.map((file) => ({
                filename: file.filename,
                mimeType: file.mimeType,
                detectedMime: file.detectedMime,
                size: file.size,
                tempPath: file.tempPath,
                targetFormat: targetFormat,
            })),
            targetFormat: targetFormat,
            clientIP,
            quotaLimit: quotaInfo.quotaLimit || 1610612736,
            quotaUsed: quotaInfo.quotaUsed || 0,
        });
        // Send response IMMEDIATELY - no await, no blocking operations
        // Background worker will process the job asynchronously
        res.status(200).json({
            jobId,
            status: 'queued',
        });
        // Explicitly end response and return to prevent any further execution
        res.end();
        return;
    }
    catch (err) {
        if (res.headersSent)
            return;
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: err?.message || 'Internal server error',
            },
        });
        return;
    }
};
exports.convertImage = convertImage;
const convertImageFromUrl = (req, res) => {
    res.status(200).json({ message: 'Image conversion from URL endpoint - not implemented yet' });
};
exports.convertImageFromUrl = convertImageFromUrl;
