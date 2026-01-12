"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJob = void 0;
const job_store_1 = require("../queue/job.store");
const getJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_JOB_ID',
                    message: 'jobId parameter is required',
                },
            });
            return;
        }
        const job = (0, job_store_1.getJob)(jobId);
        if (!job) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: `Job ${jobId} does not exist`,
                },
            });
            return;
        }
        // Return job status
        res.status(200).json({
            jobId: job.jobId,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error,
        });
    }
    catch (error) {
        console.error('Get job error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        res.status(500).json({
            success: false,
            error: {
                code: 'JOB_STATUS_FETCH_FAILED',
                message: errorMessage,
            },
        });
    }
};
exports.getJob = getJob;
