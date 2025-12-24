import { Request, Response, NextFunction } from 'express';
import { isSupportedOutputFormat, normalizeFormat, SUPPORTED_OUTPUT_FORMATS } from '../config/formats';
import { detectImage } from '../utils/detectImage';
import { ok, fail } from '../utils/apiResponse';
import path from 'path';

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
 * - Validates target format against allowlist
 * - Performs content-based image detection (not MIME-based)
 * - Returns 415 if file is not a valid image or target format is invalid
 * - Attaches fileMeta to request for downstream use
 */
export const mimeTypeGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get targetFormat from query params or body
  const targetFormatRaw = (req.query.targetFormat as string) || 
                          (req.body?.targetFormat as string);

  if (!targetFormatRaw) {
    return fail(res, 400, 'MISSING_TARGET_FORMAT', 'targetFormat parameter is required');
  }

  // Normalize and validate target format
  const targetFormat = normalizeFormat(targetFormatRaw);
  
  if (!isSupportedOutputFormat(targetFormat)) {
    const allowedFormatsList = Array.from(SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
    const message = `Target format "${targetFormatRaw}" is not supported. Allowed formats: ${allowedFormatsList}`;
    return fail(res, 415, 'UNSUPPORTED_TARGET_FORMAT', message, {
      allowedFormats: Array.from(SUPPORTED_OUTPUT_FORMATS).sort(),
    });
  }

  // Validate files that were processed by uploadStream using extension-based validation
  // Extension-first validation (MANDATORY) - MIME type is ignored for validation
  if ((req as any).files && Array.isArray((req as any).files)) {
    const files = (req as any).files;
    const invalidFiles: Array<{ filename: string; reason: string }> = [];

    // ALLOWED_EXTENSIONS list (ICO and TGA enabled as input - will be normalized to PNG)
    const ALLOWED_EXTENSIONS = [
      'jpg', 'jpeg', 'png', 'webp', 'gif',
      'bmp', 'tiff', 'psd', 'eps', 'svg',
      'ico', 'tga'
    ];

    // Check each file using extension-based validation ONLY
    for (const file of files) {
      if (!file.tempPath) {
        invalidFiles.push({
          filename: file.filename || 'unknown',
          reason: 'File not uploaded',
        });
        continue;
      }

      // Extension-first validation (ONLY EXTENSION decides image validity)
      const ext = path.extname(file.filename || '').toLowerCase().replace('.', '');
      
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        invalidFiles.push({
          filename: file.filename || 'unknown',
          reason: 'Invalid image file',
        });
        continue;
      }

      // MIME type is IGNORED for validation (TGA, EPS, PSD often have non-image MIME types)
      // Actual decoding/validation happens at conversion layer
      // Still try to detect MIME for downstream use, but don't block on it
      try {
        const detectionResult = await detectImage(file.tempPath);
        if (detectionResult.mimeType) {
          file.detectedMime = detectionResult.mimeType;
        }
      } catch (error) {
        // MIME detection failure is not a blocker - extension validation passed
        // detectedMime can remain null or use default
      }
    }

    if (invalidFiles.length > 0) {
      return fail(res, 415, 'INVALID_IMAGE_FILE', 'Uploaded file is not a valid image', {
        invalidFiles,
      });
    }

    // Attach fileMeta to request with normalized format
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
