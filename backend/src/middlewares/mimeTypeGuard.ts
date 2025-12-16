import { Request, Response, NextFunction } from 'express';
import { isMimeAllowedForFormat } from '../utils/mime';

interface FileMeta {
  detectedMime: string | null;
  targetFormat: string | null;
  isValid: boolean;
}

// Extend Express Request to include fileMeta
declare global {
  namespace Express {
    interface Request {
      fileMeta?: FileMeta;
    }
  }
}

/**
 * MIME type guard middleware
 * - Validates detected MIME (from uploadStream) against allowed MIME for targetFormat
 * - Returns 415 if MIME not allowed for target format
 * - Attaches fileMeta to request for downstream use
 */
export const mimeTypeGuard = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get targetFormat from query params or body
  const targetFormat = (req.query.targetFormat as string) || 
                       (req.body?.targetFormat as string);

  if (!targetFormat) {
    return res.status(400).json({
      error: 'Missing target format',
      message: 'targetFormat parameter is required',
    });
  }

  // Validate files that were processed by uploadStream
  if ((req as any).files && Array.isArray((req as any).files)) {
    const files = (req as any).files;
    const invalidFiles: Array<{ filename: string; detectedMime: string | null }> = [];

    for (const file of files) {
      if (file.detectedMime) {
        const isValid = isMimeAllowedForFormat(file.detectedMime, targetFormat);
        if (!isValid) {
          invalidFiles.push({
            filename: file.filename || 'unknown',
            detectedMime: file.detectedMime,
          });
        }
      } else {
        // MIME not detected
        invalidFiles.push({
          filename: file.filename || 'unknown',
          detectedMime: null,
        });
      }
    }

    if (invalidFiles.length > 0) {
      return res.status(415).json({
        error: 'Unsupported media type',
        message: `File(s) MIME type not allowed for target format: ${targetFormat}`,
        invalidFiles,
        targetFormat,
      });
    }

    // Attach fileMeta to request
    req.fileMeta = {
      detectedMime: files[0]?.detectedMime || null,
      targetFormat,
      isValid: true,
    };

    return next();
  }

  // If no files yet (shouldn't happen with correct middleware order), allow through
  // uploadStream will handle file processing
  req.fileMeta = {
    detectedMime: null,
    targetFormat,
    isValid: true,
  };

  next();
};

/**
 * Helper function to detect MIME from buffer (used by uploadStream)
 * @param buffer - First bytes of file (magic bytes)
 * @returns Detected MIME type or null
 */
export const detectMimeFromBuffer = async (
  buffer: Buffer
): Promise<string | null> => {
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const fileType = await fileTypeFromBuffer(buffer);
    return fileType ? fileType.mime : null;
  } catch (error) {
    console.error('MIME detection error:', error);
    return null;
  }
};
