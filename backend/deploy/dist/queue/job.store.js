"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextQueuedJobId = exports.getJob = exports.updateJob = exports.createJobRecord = void 0;
// In-memory job storage (unified: status + data in one object)
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
/**
 * Create a new job record with data
 */
const createJobRecord = (jobId, data) => {
    const now = Date.now();
    const job = {
        jobId,
        status: 'queued',
        progress: 0,
        data,
        createdAt: now,
        updatedAt: now,
    };
    jobs.set(jobId, job);
};
exports.createJobRecord = createJobRecord;
/**
 * Update job with partial data
 */
const updateJob = (jobId, partialJob) => {
    const existing = jobs.get(jobId);
    if (!existing) {
        return false;
    }
    const updated = {
        ...existing,
        ...partialJob,
        updatedAt: Date.now(), // Always update updatedAt
    };
    jobs.set(jobId, updated);
    return true;
};
exports.updateJob = updateJob;
/**
 * Get job by ID
 */
const getJob = (jobId) => {
    const job = jobs.get(jobId);
    return job || null;
};
exports.getJob = getJob;
/**
 * Get the first queued job ID
 */
const getNextQueuedJobId = () => {
    for (const [jobId, job] of jobs.entries()) {
        if (job.status === 'queued') {
            return jobId;
        }
    }
    return null;
};
exports.getNextQueuedJobId = getNextQueuedJobId;
