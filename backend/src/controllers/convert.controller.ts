import { Request, Response } from 'express';
import { createJob } from '../queue/convert.queue';
import { extractClientIP } from '../utils/ip';
import { normalizeFormat, isSupportedOutputFormat, SUPPORTED_OUTPUT_FORMATS } from '../config/formats';
import { ok, fail } from '../utils/apiResponse';

export const convertImage = async (req: Request, res: Response) => {
  try {
    const files = (req as any).files;
    const targetFormatRaw = req.body?.targetFormat || req.query?.targetFormat;
    const quotaInfo = (req as any).quotaInfo || {};

    if (!files || !Array.isArray(files) || files.length === 0) {
      return fail(res, 400, 'NO_FILES_PROVIDED', 'At least one file is required');
    }

    if (!targetFormatRaw) {
      return fail(res, 400, 'MISSING_TARGET_FORMAT', 'targetFormat parameter is required');
    }

    // Normalize and validate target format early
    const targetFormat = normalizeFormat(targetFormatRaw);
    
    // Block unsupported formats explicitly
    if (targetFormat === 'odd' || targetFormat === 'exe') {
      return fail(res, 400, 'UNSUPPORTED_TARGET_FORMAT', `${targetFormat.toUpperCase()} format is not supported for image conversion`);
    }
    
    if (!isSupportedOutputFormat(targetFormat)) {
      const allowedFormatsList = Array.from(SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
      const message = `Target format "${targetFormatRaw}" is not supported. Allowed formats: ${allowedFormatsList}`;
      return fail(res, 400, 'UNSUPPORTED_TARGET_FORMAT', message, {
        allowedFormats: Array.from(SUPPORTED_OUTPUT_FORMATS).sort(),
      });
    }

    const clientIP = extractClientIP(req);

    // Extract only metadata - NO file reading or buffering
    // createJob() uses in-memory Map, no Redis dependency
    const jobId = await createJob({
      files: files.map((file: any) => ({
        filename: file.filename,
        mimeType: file.mimeType,
        detectedMime: file.detectedMime,
        size: file.size,
        tempPath: file.tempPath, // Store temp file path instead of buffer
        targetFormat: targetFormat, // Use normalized format
      })),
      targetFormat: targetFormat, // Use normalized format
      clientIP,
      quotaLimit: quotaInfo.quotaLimit || 1610612736,
      quotaUsed: quotaInfo.quotaUsed || 0,
    });

    // Return immediately - no blocking operations
    return ok(res, {
      job: {
        id: jobId,
        status: 'queued',
      },
    });
  } catch (error: any) {
    console.error('Create job error:', error);
    return fail(res, 500, 'JOB_CREATION_FAILED', error.message || 'An error occurred');
  }
};

export const convertImageFromUrl = (req: Request, res: Response) => {
  res.json({ message: 'Image conversion from URL endpoint - not implemented yet' });
};
