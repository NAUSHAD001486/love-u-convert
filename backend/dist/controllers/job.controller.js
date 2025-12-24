"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJob = void 0;
const convert_queue_1 = require("../queue/convert.queue");
const apiResponse_1 = require("../utils/apiResponse");
const getJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return (0, apiResponse_1.fail)(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
        }
        const job = await (0, convert_queue_1.getJob)(jobId);
        if (!job) {
            return (0, apiResponse_1.fail)(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
        }
        // Handle different job statuses
        if (job.status === 'queued' || job.status === 'processing') {
            const totalCount = job.data.files.length;
            const processedCount = job.processedCount || 0;
            return (0, apiResponse_1.ok)(res, {
                job: {
                    id: jobId,
                    status: job.status,
                    progress: {
                        processed: processedCount,
                        total: totalCount,
                    },
                },
            });
        }
        if (job.status === 'completed' && job.result) {
            const result = job.result;
            // Single file: return direct download URL
            if (result.downloadUrl) {
                const expiresIn = result.ttlSeconds || 86400;
                return (0, apiResponse_1.ok)(res, {
                    job: {
                        id: jobId,
                        status: job.status,
                        result: {
                            downloadUrl: result.downloadUrl,
                            fileCount: result.fileCount,
                            expiresIn,
                        },
                    },
                });
            }
            // Multi-file: return ZIP download endpoint
            if (result.zipPath) {
                return (0, apiResponse_1.ok)(res, {
                    job: {
                        id: jobId,
                        status: job.status,
                        result: {
                            downloadUrl: `/api/download/zip/${jobId}`,
                            fileCount: result.fileCount,
                            zipFileName: result.zipFileName,
                        },
                    },
                });
            }
        }
        if (job.status === 'completed_with_errors' && job.result) {
            const result = job.result;
            // Multi-file with errors: return ZIP download endpoint
            if (result.zipPath) {
                return (0, apiResponse_1.ok)(res, {
                    job: {
                        id: jobId,
                        status: job.status,
                        result: {
                            downloadUrl: `/api/download/zip/${jobId}`,
                            fileCount: result.fileCount,
                            failedFiles: result.failedFiles || [],
                            zipFileName: result.zipFileName,
                        },
                    },
                });
            }
        }
        if (job.status === 'failed' && job.error) {
            // Never return 500 - return error in job status instead
            return (0, apiResponse_1.ok)(res, {
                job: {
                    id: jobId,
                    status: job.status,
                    error: job.error,
                },
            });
        }
        // Fallback for unknown status
        return (0, apiResponse_1.ok)(res, {
            job: {
                id: jobId,
                status: job.status,
            },
        });
    }
    catch (error) {
        console.error('Get job error:', error);
        return (0, apiResponse_1.fail)(res, 500, 'JOB_STATUS_FETCH_FAILED', error.message || 'An error occurred');
    }
};
exports.getJob = getJob;
