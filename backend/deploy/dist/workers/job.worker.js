"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopJobWorker = exports.startJobWorker = void 0;
const cloudinary_service_1 = require("../services/cloudinary.service");
const job_store_1 = require("../queue/job.store");
const fs_1 = require("fs");
let workerInterval = null;
let isProcessing = false; // Prevent concurrent processing
// Process a single job
const processJob = async (jobId) => {
    console.log(`Picked job ${jobId}`);
    // Get job to access data
    const job = (0, job_store_1.getJob)(jobId);
    if (!job || !job.data) {
        throw new Error('Job or job data not found');
    }
    const { files, targetFormat, quotaLimit, quotaUsed } = job.data;
    const totalCount = files.length;
    const outputUrls = [];
    let processedCount = 0;
    // Process each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file ${i + 1}/${totalCount}`);
        try {
            // Read file from tempPath
            const fileStream = (0, fs_1.createReadStream)(file.tempPath);
            // Upload to Cloudinary with target format transformation
            const uploadResult = await (0, cloudinary_service_1.uploadImageStream)(fileStream, {
                targetFormat: targetFormat,
                context: {
                    originalFormat: file.mimeType || file.detectedMime || 'image/png',
                },
                quotaLimit: quotaLimit,
                quotaUsed: quotaUsed + processedCount * 1000000, // Approximate quota tracking
                originalFilename: file.filename,
            });
            // Store uploadResult.secure_url
            outputUrls.push(uploadResult.secure_url);
            processedCount++;
            // Update progress after each file
            const progress = Math.round((processedCount / totalCount) * 100);
            (0, job_store_1.updateJob)(jobId, {
                status: 'processing',
                progress,
            });
        }
        catch (fileError) {
            const errorMessage = fileError instanceof Error ? fileError.message : 'File processing failed';
            console.error(`Failed to process file ${file.filename} in job ${jobId}:`, errorMessage);
            throw new Error(`File processing failed: ${errorMessage}`);
        }
    }
    // All files processed successfully
    // On job completion, store actual Cloudinary output URL(s)
    (0, job_store_1.updateJob)(jobId, {
        status: 'completed',
        progress: 100,
        result: {
            outputUrl: outputUrls.length === 1 ? outputUrls[0] : outputUrls,
            fileCount: outputUrls.length,
        },
    });
    console.log(`Completed job ${jobId}`);
};
// Polling function called by setInterval
const pollForJobs = async () => {
    // Skip if already processing a job
    if (isProcessing) {
        return;
    }
    try {
        console.log('Worker polling...');
        // Find first queued job from job.store.ts
        const jobId = (0, job_store_1.getNextQueuedJobId)();
        if (!jobId) {
            // No queued jobs found - polling continues
            return;
        }
        // Get job with data (unified object)
        const job = (0, job_store_1.getJob)(jobId);
        if (!job || job.status !== 'queued') {
            // Job no longer queued or doesn't exist
            return;
        }
        // Check if job data exists
        if (!job.data) {
            console.error(`Job data not found for job ${jobId}`);
            // Mark as failed if data is missing
            (0, job_store_1.updateJob)(jobId, {
                status: 'failed',
                error: 'Job data not found',
            });
            return;
        }
        // Immediately update status to 'processing' (atomic update)
        const updated = (0, job_store_1.updateJob)(jobId, {
            status: 'processing',
            progress: 0,
        });
        if (!updated) {
            // Job was already updated by another worker
            return;
        }
        isProcessing = true;
        try {
            // Process the job (one at a time, no concurrency)
            await processJob(jobId);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Processing failed';
            console.error(`Worker failed job ${jobId}:`, errorMessage);
            // Update job status to failed
            (0, job_store_1.updateJob)(jobId, {
                status: 'failed',
                error: errorMessage,
            });
        }
        finally {
            isProcessing = false;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        console.error(`Worker polling error: ${errorMessage}`);
        isProcessing = false;
    }
};
const startJobWorker = () => {
    if (workerInterval) {
        console.log('Job worker already started');
        return;
    }
    console.log('Starting background job worker...');
    // Start polling loop using setInterval (every 1000ms = 1 second)
    workerInterval = setInterval(() => {
        pollForJobs().catch((error) => {
            console.error('Worker interval error:', error);
        });
    }, 1000);
    console.log('Job worker started');
};
exports.startJobWorker = startJobWorker;
const stopJobWorker = () => {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        console.log('Job worker stopped');
    }
};
exports.stopJobWorker = stopJobWorker;
