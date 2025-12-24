"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setJobProcessing = exports.getNextQueuedJob = exports.updateJobProgress = exports.updateJobStatus = exports.getJob = exports.createJob = void 0;
const crypto_1 = require("crypto");
// In-memory job storage
const jobs = new Map();
// Clean up old jobs (older than 24 hours)
const JOB_TTL_MS = 86400000; // 24 hours in milliseconds
setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs.entries()) {
        if (now - job.createdAt > JOB_TTL_MS) {
            jobs.delete(jobId);
        }
    }
}, 3600000); // Run cleanup every hour
const createJob = async (jobData) => {
    // Generate random jobId (uuid-like)
    const jobId = `${Date.now()}_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
    const jobStore = {
        status: 'queued',
        data: jobData,
        createdAt: Date.now(),
        processedCount: 0,
        totalCount: jobData.files.length,
    };
    // Store job in in-memory Map
    jobs.set(jobId, jobStore);
    return jobId;
};
exports.createJob = createJob;
const getJob = async (jobId) => {
    const job = jobs.get(jobId);
    return job || null;
};
exports.getJob = getJob;
const updateJobStatus = async (jobId, status, result, error) => {
    const existing = jobs.get(jobId);
    if (!existing) {
        return false;
    }
    const updated = {
        ...existing,
        status,
        ...(result !== undefined && { result }),
        ...(error !== undefined && { error }),
    };
    jobs.set(jobId, updated);
    return true;
};
exports.updateJobStatus = updateJobStatus;
const updateJobProgress = async (jobId, processedCount) => {
    const existing = jobs.get(jobId);
    if (!existing) {
        return false;
    }
    existing.processedCount = processedCount;
    jobs.set(jobId, existing);
    return true;
};
exports.updateJobProgress = updateJobProgress;
const getNextQueuedJob = async () => {
    // Find first job with status 'queued'
    for (const [jobId, job] of jobs.entries()) {
        if (job.status === 'queued') {
            return {
                jobId,
                data: job.data,
            };
        }
    }
    return null;
};
exports.getNextQueuedJob = getNextQueuedJob;
const setJobProcessing = async (jobId) => {
    const existing = jobs.get(jobId);
    if (!existing) {
        return false;
    }
    // Atomic check-and-set
    if (existing.status !== 'queued') {
        return false;
    }
    existing.status = 'processing';
    jobs.set(jobId, existing);
    return true;
};
exports.setJobProcessing = setJobProcessing;
