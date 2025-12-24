"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadZip = void 0;
const convert_queue_1 = require("../queue/convert.queue");
const apiResponse_1 = require("../utils/apiResponse");
const fs_1 = require("fs");
const zipLocal_util_1 = require("../utils/zipLocal.util");
/**
 * Download ZIP file for completed job
 * GET /api/download/zip/:jobId
 */
const downloadZip = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return (0, apiResponse_1.fail)(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
        }
        const job = await (0, convert_queue_1.getJob)(jobId);
        if (!job) {
            return (0, apiResponse_1.fail)(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
        }
        // Only allow download for completed jobs
        if (job.status !== 'completed' && job.status !== 'completed_with_errors') {
            return (0, apiResponse_1.fail)(res, 400, 'JOB_NOT_READY', `Job ${jobId} is not ready for download. Status: ${job.status}`);
        }
        if (!job.result || !job.result.zipPath) {
            return (0, apiResponse_1.fail)(res, 404, 'ZIP_NOT_FOUND', `ZIP file not found for job ${jobId}`);
        }
        const zipPath = job.result.zipPath;
        const zipFileName = job.result.zipFileName || `convert_zip_${jobId}.zip`;
        // Verify ZIP file exists
        if (!(0, fs_1.existsSync)(zipPath)) {
            return (0, apiResponse_1.fail)(res, 404, 'ZIP_FILE_MISSING', `ZIP file no longer exists: ${zipFileName}`);
        }
        // Set headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        // Stream ZIP file to response
        const zipBuffer = (0, fs_1.readFileSync)(zipPath);
        res.send(zipBuffer);
        // Clean up ZIP file after download (async, don't block response)
        (0, zipLocal_util_1.cleanupZip)(zipPath).catch((error) => {
            console.error(`Failed to cleanup ZIP ${zipPath}:`, error);
        });
    }
    catch (error) {
        console.error('Download ZIP error:', error);
        return (0, apiResponse_1.fail)(res, 500, 'DOWNLOAD_FAILED', error.message || 'An error occurred');
    }
};
exports.downloadZip = downloadZip;
