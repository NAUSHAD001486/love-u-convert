import { Request, Response } from 'express';
import { getJob as getJobFromStore } from '../queue/convert.queue';
import { ok, fail } from '../utils/apiResponse';

export const getJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return fail(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
    }

    const job = await getJobFromStore(jobId);

    if (!job) {
      return fail(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    // Handle different job statuses
    if (job.status === 'queued' || job.status === 'processing') {
      const totalCount = job.data.files.length;
      const processedCount = job.processedCount || 0;
      
      return ok(res, {
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
        return ok(res, {
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
        return ok(res, {
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
        return ok(res, {
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
      return ok(res, {
        job: {
          id: jobId,
          status: job.status,
          error: job.error,
        },
      });
    }

    // Fallback for unknown status
    return ok(res, {
      job: {
        id: jobId,
        status: job.status,
      },
    });
  } catch (error: any) {
    console.error('Get job error:', error);
    return fail(res, 500, 'JOB_STATUS_FETCH_FAILED', error.message || 'An error occurred');
  }
};
