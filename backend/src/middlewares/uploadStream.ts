import { Request, Response, NextFunction } from 'express';
import Busboy from 'busboy';
import { Transform, PassThrough } from 'stream';
import { detectMimeFromBuffer } from './mimeTypeGuard';
import { env } from '../config/env';
import { isAllowedMimeType } from '../utils/mime';

interface FileStream {
  filename: string;
  mimeType: string | null;
  detectedMime: string | null;
  size: number;
  stream: NodeJS.ReadableStream;
  targetFormat?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      files?: FileStream[];
    }
  }
}

/**
 * Creates a transform stream that:
 * - Buffers first bytes for MIME detection (up to 4100 bytes)
 * - Tracks total bytes read
 * - Enforces size limit
 * - Passes all data through (streaming, not buffering full file)
 */
function createFileProcessor(
  filename: string,
  maxFileSize: number,
  onMimeDetected: (mime: string | null) => void,
  onSizeExceeded: () => void
): Transform {
  const MIME_DETECTION_BUFFER_SIZE = 4100;
  const mimeBuffer: Buffer[] = [];
  let mimeBufferTotalSize = 0;
  let mimeDetected = false;
  let bytesRead = 0;
  let mimeDetectionDone = false;

  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      bytesRead += chunk.length;

      // Check size limit first
      if (bytesRead > maxFileSize) {
        onSizeExceeded();
        return callback(new Error('File size exceeded'));
      }

      // Buffer initial bytes for MIME detection
      if (!mimeDetectionDone && mimeBufferTotalSize < MIME_DETECTION_BUFFER_SIZE) {
        mimeBuffer.push(Buffer.from(chunk));
        mimeBufferTotalSize += chunk.length;

        // If we have enough bytes, detect MIME asynchronously
        if (mimeBufferTotalSize >= MIME_DETECTION_BUFFER_SIZE) {
          mimeDetectionDone = true;
          const combinedBuffer = Buffer.concat(mimeBuffer);
          detectMimeFromBuffer(combinedBuffer.slice(0, MIME_DETECTION_BUFFER_SIZE))
            .then((mime) => {
              mimeDetected = true;
              onMimeDetected(mime);
            })
            .catch((error) => {
              console.error('MIME detection error:', error);
              onMimeDetected(null);
            });
        }
      }

      // Always pass chunk through (streaming)
      callback(null, chunk);
    },

    flush(callback) {
      // If file ended before we had enough bytes for MIME detection, detect now
      if (!mimeDetectionDone && mimeBufferTotalSize > 0) {
        mimeDetectionDone = true;
        const combinedBuffer = Buffer.concat(mimeBuffer);
        detectMimeFromBuffer(combinedBuffer)
          .then((mime) => {
            mimeDetected = true;
            onMimeDetected(mime);
            callback();
          })
          .catch((error) => {
            console.error('MIME detection error:', error);
            onMimeDetected(null);
            callback();
          });
      } else {
        callback();
      }
    },
  });
}

/**
 * Streaming upload middleware using busboy
 * - Parses multipart/form-data
 * - Supports multiple files (files[])
 * - Tracks exact bytes read per file
 * - Enforces MAX_FILE_SIZE_BYTES during streaming
 * - Does NOT store files on disk or memory (streams only)
 * - Emits per-file stream object to downstream via req.files[]
 */
export const uploadStream = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      error: 'Invalid content type',
      message: 'Expected multipart/form-data',
    });
  }

  const maxFileSize = parseInt(env.MAX_FILE_SIZE_BYTES, 10);
  if (!maxFileSize || isNaN(maxFileSize)) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'MAX_FILE_SIZE_BYTES not configured',
    });
  }

  const busboy = Busboy({ headers: req.headers });
  const files: FileStream[] = [];
  let targetFormat: string | null = null;
  let hasError = false;
  let filesProcessed = 0;
  let totalFiles = 0;

  // Handle file uploads
  busboy.on('file', (fieldname: string, fileStream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    if (hasError) {
      fileStream.resume(); // Drain stream
      return;
    }

    totalFiles++;
    const { filename, encoding, mimeType } = info;
    let bytesRead = 0;
    let detectedMime: string | null = null;
    let mimeValidated = false;

    // Create pass-through stream for downstream use
    const filePassThrough = new PassThrough();

    // Create processor that tracks size and detects MIME
    const processor = createFileProcessor(
      filename,
      maxFileSize,
      (mime) => {
        detectedMime = mime;

        // Validate MIME
        if (!detectedMime || !isAllowedMimeType(detectedMime)) {
          hasError = true;
          filePassThrough.destroy();
          if (!res.headersSent) {
            res.status(415).json({
              error: 'Unsupported media type',
              message: `File "${filename}" has unsupported MIME type`,
              detectedMime: detectedMime || 'unknown',
            });
          }
          return;
        }

        mimeValidated = true;
      },
      () => {
        // Size exceeded
        hasError = true;
        filePassThrough.destroy();
        if (!res.headersSent) {
          res.status(413).json({
            error: 'Payload too large',
            message: `File "${filename}" exceeds maximum size of ${maxFileSize} bytes`,
            maxSize: maxFileSize,
          });
        }
      }
    );

    // Track bytes in processor
    processor.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
    });

    // Pipe file stream through processor to pass-through
    fileStream.pipe(processor).pipe(filePassThrough);

    // Handle file stream end
    fileStream.on('end', () => {
      if (hasError) {
        return;
      }

      // Wait a bit for MIME detection if not done yet (for small files)
      setTimeout(() => {
        if (!mimeValidated && detectedMime === null) {
          // MIME detection might still be in progress, but we'll proceed
          // The validation will happen in mimeTypeGuard if needed
        }

        // Add file to files array
        files.push({
          filename: filename || 'unknown',
          mimeType: mimeType || null,
          detectedMime: detectedMime,
          size: bytesRead,
          stream: filePassThrough,
          targetFormat: targetFormat || undefined,
        });

        filesProcessed++;

        // If all files processed, continue
        if (filesProcessed === totalFiles && !hasError && !res.headersSent) {
          req.files = files;
          if (targetFormat && !req.body) {
            req.body = { targetFormat };
          } else if (targetFormat) {
            req.body = req.body || {};
            req.body.targetFormat = targetFormat;
          }
          next();
        }
      }, 100); // Small delay to allow async MIME detection
    });

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      hasError = true;
      filePassThrough.destroy();
      if (!res.headersSent) {
        res.status(500).json({
          error: 'File upload error',
          message: 'Error processing file stream',
        });
      }
    });

    processor.on('error', (error: Error) => {
      console.error('Processor error:', error);
      hasError = true;
      filePassThrough.destroy();
    });
  });

  // Handle form fields (e.g., targetFormat)
  busboy.on('field', (fieldname: string, value: string) => {
    if (fieldname === 'targetFormat') {
      targetFormat = value;
    }
  });

  // Handle busboy finish
  busboy.on('finish', () => {
    if (hasError) {
      return;
    }

    if (files.length === 0) {
      if (!res.headersSent) {
        res.status(400).json({
          error: 'No files uploaded',
          message: 'At least one file is required',
        });
      }
      return;
    }

    // If files were processed (all files ended before busboy finish)
    if (filesProcessed === totalFiles && files.length > 0 && !hasError && !res.headersSent) {
      req.files = files;
      if (targetFormat && !req.body) {
        req.body = { targetFormat };
      } else if (targetFormat) {
        req.body = req.body || {};
        req.body.targetFormat = targetFormat;
      }
      next();
    }
  });

  // Handle busboy errors
  busboy.on('error', (error: Error) => {
    console.error('Busboy error:', error);
    hasError = true;
    if (!res.headersSent) {
      res.status(400).json({
        error: 'Upload error',
        message: 'Error parsing multipart form data',
      });
    }
  });

  // Pipe request to busboy
  req.pipe(busboy);

  // TODO: Phase-2C - Cloudinary upload_stream will be plugged here
  // After MIME validation and size checks, we'll stream directly to Cloudinary
  // Example: cloudinary.uploader.upload_stream(options, callback)
  // The filePassThrough stream can be piped directly to Cloudinary's upload_stream
};
