"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadZip = exports.downloadFile = void 0;
const job_store_1 = require("../queue/job.store");
const apiResponse_1 = require("../utils/apiResponse");
const cloudinary_service_1 = require("../services/cloudinary.service");
const archiver_1 = __importDefault(require("archiver"));
/**
 * Download single file for completed job
 * GET /api/download/file/:jobId
 */
const downloadFile = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            (0, apiResponse_1.fail)(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
            return;
        }
        const job = (0, job_store_1.getJob)(jobId);
        if (!job) {
            (0, apiResponse_1.fail)(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
            return;
        }
        if (job.status !== 'completed') {
            (0, apiResponse_1.fail)(res, 400, 'JOB_NOT_READY', `Job ${jobId} is not ready for download. Status: ${job.status}`);
            return;
        }
        if (!job.result || !job.result.outputUrl) {
            (0, apiResponse_1.fail)(res, 500, 'MISSING_RESULT', `Job ${jobId} has no result data`);
            return;
        }
        const outputUrl = job.result.outputUrl;
        // Handle single file download
        if (typeof outputUrl === 'string') {
            try {
                const fileStream = await (0, cloudinary_service_1.downloadFileAsStream)(outputUrl);
                // Extract filename from URL or use default
                const urlParts = outputUrl.split('/');
                const filename = urlParts[urlParts.length - 1].split('?')[0] || 'converted-file';
                // Set headers for file download
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                // Stream file to response
                fileStream.pipe(res);
                fileStream.on('error', (error) => {
                    if (!res.headersSent) {
                        (0, apiResponse_1.fail)(res, 500, 'DOWNLOAD_STREAM_ERROR', `Failed to stream file: ${error.message}`);
                    }
                });
                res.on('close', () => {
                    if (fileStream && typeof fileStream.destroy === 'function') {
                        fileStream.destroy();
                    }
                });
            }
            catch (error) {
                if (!res.headersSent) {
                    (0, apiResponse_1.fail)(res, 500, 'DOWNLOAD_FAILED', error.message || 'Failed to download file');
                }
            }
        }
        else {
            // Multiple files - should use ZIP endpoint
            (0, apiResponse_1.fail)(res, 400, 'MULTIPLE_FILES', `Job ${jobId} has multiple files. Use /api/download/zip/:jobId`);
        }
    }
    catch (error) {
        if (!res.headersSent) {
            (0, apiResponse_1.fail)(res, 500, 'DOWNLOAD_ERROR', error.message || 'An error occurred');
        }
    }
};
exports.downloadFile = downloadFile;
/**
 * Download ZIP file for completed job with multiple files
 * GET /api/download/zip/:jobId
 */
const downloadZip = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            (0, apiResponse_1.fail)(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
            return;
        }
        const job = (0, job_store_1.getJob)(jobId);
        if (!job) {
            (0, apiResponse_1.fail)(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
            return;
        }
        if (job.status !== 'completed') {
            (0, apiResponse_1.fail)(res, 400, 'JOB_NOT_READY', `Job ${jobId} is not ready for download. Status: ${job.status}`);
            return;
        }
        if (!job.result || !job.result.outputUrl) {
            (0, apiResponse_1.fail)(res, 500, 'MISSING_RESULT', `Job ${jobId} has no result data`);
            return;
        }
        const outputUrl = job.result.outputUrl;
        const urls = Array.isArray(outputUrl) ? outputUrl : [outputUrl];
        if (urls.length === 0) {
            (0, apiResponse_1.fail)(res, 500, 'NO_FILES', `Job ${jobId} has no output URLs`);
            return;
        }
        // Set headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="converted-files.zip"');
        // Create ZIP archive stream
        const archive = (0, archiver_1.default)('zip', {
            zlib: { level: 9 },
        });
        // Handle archive errors
        archive.on('error', (error) => {
            if (!res.headersSent) {
                (0, apiResponse_1.fail)(res, 500, 'ZIP_CREATION_ERROR', `Failed to create ZIP: ${error.message}`);
            }
        });
        // Pipe archive to response
        archive.pipe(res);
        // Download and add each file to ZIP sequentially
        try {
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                try {
                    const fileStream = await (0, cloudinary_service_1.downloadFileAsStream)(url);
                    // Extract filename from URL
                    const urlParts = url.split('/');
                    const filename = urlParts[urlParts.length - 1].split('?')[0] || `file-${i + 1}`;
                    // Add file to ZIP
                    archive.append(fileStream, { name: filename });
                    // Handle stream errors
                    fileStream.on('error', (error) => {
                        console.error(`Error streaming file ${i + 1} from ${url}:`, error);
                        // Continue with other files even if one fails
                    });
                }
                catch (error) {
                    console.error(`Failed to download file ${i + 1} from ${url}:`, error);
                    // Continue with other files even if one fails
                }
            }
            // Finalize ZIP (this will trigger the response)
            archive.finalize();
        }
        catch (error) {
            archive.abort();
            if (!res.headersSent) {
                (0, apiResponse_1.fail)(res, 500, 'ZIP_DOWNLOAD_ERROR', error.message || 'Failed to download files for ZIP');
            }
        }
        // Handle response close
        res.on('close', () => {
            archive.abort();
        });
    }
    catch (error) {
        if (!res.headersSent) {
            (0, apiResponse_1.fail)(res, 500, 'DOWNLOAD_ZIP_ERROR', error.message || 'An error occurred');
        }
    }
};
exports.downloadZip = downloadZip;
