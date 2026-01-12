"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJob = void 0;
const crypto_1 = require("crypto");
const job_store_1 = require("./job.store");
/**
 * Create a new job with data
 * Stores job status and data in unified job.store.ts
 * Synchronous operation - no async work, just in-memory storage
 */
const createJob = (jobData) => {
    // Generate random jobId (uuid-like)
    const jobId = `${Date.now()}_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
    // Create job record with data (unified storage)
    // This stores: status = 'queued', progress = 0, data = jobData
    (0, job_store_1.createJobRecord)(jobId, jobData);
    // Job is now stored in job.store.ts with:
    // - status = 'queued'
    // - progress = 0
    // - data = jobData (includes files, targetFormat, quotaLimit, quotaUsed, clientIP)
    return jobId;
};
exports.createJob = createJob;
