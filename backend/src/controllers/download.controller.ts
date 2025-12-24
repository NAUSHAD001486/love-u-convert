import { Request, Response } from 'express';
import { getJob as getJobFromStore } from '../queue/convert.queue';
import { ok, fail } from '../utils/apiResponse';
import { readFileSync, existsSync } from 'fs';
import { cleanupZip } from '../utils/zipLocal.util';

/**
 * Download ZIP file for completed job
 * GET /api/download/zip/:jobId
 */
export const downloadZip = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return fail(res, 400, 'MISSING_JOB_ID', 'jobId parameter is required');
    }

    const job = await getJobFromStore(jobId);

    if (!job) {
      return fail(res, 404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    // Only allow download for completed jobs
    if (job.status !== 'completed' && job.status !== 'completed_with_errors') {
      return fail(res, 400, 'JOB_NOT_READY', `Job ${jobId} is not ready for download. Status: ${job.status}`);
    }

    if (!job.result || !job.result.zipPath) {
      return fail(res, 404, 'ZIP_NOT_FOUND', `ZIP file not found for job ${jobId}`);
    }

    const zipPath = job.result.zipPath;
    const zipFileName = job.result.zipFileName || `convert_zip_${jobId}.zip`;

    // Verify ZIP file exists
    if (!existsSync(zipPath)) {
      return fail(res, 404, 'ZIP_FILE_MISSING', `ZIP file no longer exists: ${zipFileName}`);
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    // Stream ZIP file to response
    const zipBuffer = readFileSync(zipPath);
    res.send(zipBuffer);

    // Clean up ZIP file after download (async, don't block response)
    cleanupZip(zipPath).catch((error) => {
      console.error(`Failed to cleanup ZIP ${zipPath}:`, error);
    });

  } catch (error: any) {
    console.error('Download ZIP error:', error);
    return fail(res, 500, 'DOWNLOAD_FAILED', error.message || 'An error occurred');
  }
};

