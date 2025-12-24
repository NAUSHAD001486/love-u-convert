"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopJobWorker = exports.startJobWorker = void 0;
const convert_queue_1 = require("../queue/convert.queue");
const jobProcessor_service_1 = require("../services/jobProcessor.service");
let isProcessing = false; // Prevent double processing
let workerInterval = null;
const processNextJob = async () => {
    // Prevent concurrent processing
    if (isProcessing) {
        return;
    }
    try {
        const job = await (0, convert_queue_1.getNextQueuedJob)();
        if (!job) {
            return; // No queued jobs
        }
        const { jobId, data } = job;
        // Atomically set to processing
        const acquired = await (0, convert_queue_1.setJobProcessing)(jobId);
        if (!acquired) {
            return; // Another worker picked it up
        }
        isProcessing = true;
        console.log('Worker picked job:', jobId);
        // Initialize progress: 0 files processed
        const totalCount = data.files.length;
        await (0, convert_queue_1.updateJobProgress)(jobId, 0);
        try {
            // Process the job (pass jobId for ZIP naming)
            const result = await (0, jobProcessor_service_1.processJob)(data, jobId);
            // Update progress: all files processed
            await (0, convert_queue_1.updateJobProgress)(jobId, totalCount);
            // Check if result has status field (partial success)
            const jobStatus = result.status === 'completed_with_errors'
                ? 'completed_with_errors'
                : 'completed';
            // Update to completed (or completed_with_errors for partial success)
            await (0, convert_queue_1.updateJobStatus)(jobId, jobStatus, result);
            if (jobStatus === 'completed_with_errors') {
                console.log(`Job completed with partial success: ${jobId}`);
            }
            else {
                console.log('Worker completed job:', jobId);
            }
        }
        catch (error) {
            console.error(`Worker failed job ${jobId}:`, error);
            // Update to failed
            await (0, convert_queue_1.updateJobStatus)(jobId, 'failed', undefined, error.message || 'Processing failed');
        }
        finally {
            isProcessing = false;
        }
    }
    catch (error) {
        console.error('Worker error:', error);
        isProcessing = false;
    }
};
const startJobWorker = () => {
    if (workerInterval) {
        console.log('Job worker already started');
        return;
    }
    console.log('Starting background job worker...');
    // Process jobs every 500ms
    workerInterval = setInterval(() => {
        processNextJob().catch((error) => {
            console.error('Worker loop error:', error);
        });
    }, 500);
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
