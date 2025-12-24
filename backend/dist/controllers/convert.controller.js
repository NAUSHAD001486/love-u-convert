"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImageFromUrl = exports.convertImage = void 0;
const convert_queue_1 = require("../queue/convert.queue");
const ip_1 = require("../utils/ip");
const formats_1 = require("../config/formats");
const apiResponse_1 = require("../utils/apiResponse");
const convertImage = async (req, res) => {
    try {
        const files = req.files;
        const targetFormatRaw = req.body?.targetFormat || req.query?.targetFormat;
        const quotaInfo = req.quotaInfo || {};
        if (!files || !Array.isArray(files) || files.length === 0) {
            return (0, apiResponse_1.fail)(res, 400, 'NO_FILES_PROVIDED', 'At least one file is required');
        }
        if (!targetFormatRaw) {
            return (0, apiResponse_1.fail)(res, 400, 'MISSING_TARGET_FORMAT', 'targetFormat parameter is required');
        }
        // Normalize and validate target format early
        const targetFormat = (0, formats_1.normalizeFormat)(targetFormatRaw);
        // Block unsupported formats explicitly
        if (targetFormat === 'odd' || targetFormat === 'exe') {
            return (0, apiResponse_1.fail)(res, 400, 'UNSUPPORTED_TARGET_FORMAT', `${targetFormat.toUpperCase()} format is not supported for image conversion`);
        }
        if (!(0, formats_1.isSupportedOutputFormat)(targetFormat)) {
            const allowedFormatsList = Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
            const message = `Target format "${targetFormatRaw}" is not supported. Allowed formats: ${allowedFormatsList}`;
            return (0, apiResponse_1.fail)(res, 400, 'UNSUPPORTED_TARGET_FORMAT', message, {
                allowedFormats: Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort(),
            });
        }
        const clientIP = (0, ip_1.extractClientIP)(req);
        // Extract only metadata - NO file reading or buffering
        // createJob() uses in-memory Map, no Redis dependency
        const jobId = await (0, convert_queue_1.createJob)({
            files: files.map((file) => ({
                filename: file.filename,
                mimeType: file.mimeType,
                detectedMime: file.detectedMime,
                size: file.size,
                tempPath: file.tempPath, // Store temp file path instead of buffer
                targetFormat: targetFormat, // Use normalized format
            })),
            targetFormat: targetFormat, // Use normalized format
            clientIP,
            quotaLimit: quotaInfo.quotaLimit || 1610612736,
            quotaUsed: quotaInfo.quotaUsed || 0,
        });
        // Return immediately - no blocking operations
        return (0, apiResponse_1.ok)(res, {
            job: {
                id: jobId,
                status: 'queued',
            },
        });
    }
    catch (error) {
        console.error('Create job error:', error);
        return (0, apiResponse_1.fail)(res, 500, 'JOB_CREATION_FAILED', error.message || 'An error occurred');
    }
};
exports.convertImage = convertImage;
const convertImageFromUrl = (req, res) => {
    res.json({ message: 'Image conversion from URL endpoint - not implemented yet' });
};
exports.convertImageFromUrl = convertImageFromUrl;
