import { Request, Response, NextFunction } from 'express';
import Busboy from 'busboy';
import { Transform, PassThrough } from 'stream';
import { detectMimeFromBuffer } from './mimeTypeGuard';
import { env } from '../config/env';
import { mkdir } from 'fs/promises';
import { createWriteStream, createReadStream, unlink } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

interface FileStream {
  filename: string;
  mimeType: string | null;
  detectedMime: string | null;
  size: number;
  stream: NodeJS.ReadableStream;
  targetFormat?: string;
  tempPath?: string; // Path to temporary file on disk
}

// Normalized file structure attached to req.files
interface NormalizedFile {
  filename: string;
  mimeType: string;
  detectedMime: string;
  size: number;
  tempPath: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      // req.files is set by uploadStream middleware as normalized array
      // Structure: Array<{ filename: string; mimeType: string; detectedMime: string; size: number; tempPath: string; }>
      files?: NormalizedFile[];
    }
  }
}

const TEMP_DIR = join(process.cwd(), 'temp', 'uploads');

// Ensure temp directory exists
const ensureTempDir = async (): Promise<void> => {
  try {
    await mkdir(TEMP_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
};

/**
 * Normalizes file array and attaches to req.files
 * Ensures req.files is always an array with the required structure
 */
const normalizeAndAttachFiles = (
  req: Request,
  files: FileStream[]
): void => {
  // req.files is normalized here to ensure consistent structure
  // Always an array with: { filename, mimeType, detectedMime, size, tempPath }
  req.files = files.map(file => ({
    filename: file.filename,
    mimeType: file.mimeType || 'application/octet-stream',
    detectedMime: file.detectedMime || 'application/octet-stream',
    size: file.size,
    tempPath: file.tempPath!, // tempPath is always present when file is saved to disk
  }));
};

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
 * - Saves files to temp directory on disk
 * - Tracks exact bytes read per file
 * - Enforces MAX_FILE_SIZE_BYTES during streaming
 * - Provides file paths in req.files[] for non-blocking controller
 */
export const uploadStream = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('uploadStream middleware HIT');
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      error: 'Invalid content type',
      message: 'Expected multipart/form-data',
    });
  }

  const maxFileSize = env.MAX_FILE_SIZE_BYTES;
  if (!maxFileSize || maxFileSize <= 0) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'MAX_FILE_SIZE_BYTES not configured',
    });
  }

  // Ensure temp directory exists - MUST be awaited before creating busboy
  try {
    await ensureTempDir();
  } catch (err) {
    console.error('Failed to create temp directory', err);
    return res.status(500).json({
      error: 'Server error',
      message: 'Upload directory not available',
    });
  }

  const busboy = Busboy({ headers: req.headers });
  const files: FileStream[] = [];
  const fileWritePromises: Promise<void>[] = [];
  let targetFormat: string | null = null;
  let hasError = false;

  // Handle file uploads
  busboy.on('file', async (fieldname: string, fileStream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    // Only accept files from specific field names: "files", "files[]", or "file"
    console.log('BUSBOY FILE EVENT:', fieldname, info.filename);
    if (!['files', 'files[]', 'file'].includes(fieldname)) {
      fileStream.resume(); // Drain stream and ignore
      return;
    }

    if (hasError) {
      fileStream.resume(); // Drain stream
      return;
    }

    const { filename, encoding, mimeType } = info;
    let bytesRead = 0;
    let detectedMime: string | null = null;
    let mimeValidated = false;

    // Generate unique temp file path
    const tempFileName = `${Date.now()}_${randomBytes(8).toString('hex')}_${filename}`;
    const tempFilePath = join(TEMP_DIR, tempFileName);
    const writeStream = createWriteStream(tempFilePath);
    let writeError: Error | null = null;

    // Create processor that tracks size and detects MIME
    const processor = createFileProcessor(
      filename,
      maxFileSize,
        (mime) => {
          detectedMime = mime;
          // MIME detection is done, but validation happens later via content-based detection
          mimeValidated = true;
        },
      () => {
        // Size exceeded
        hasError = true;
        writeStream.destroy();
        unlink(tempFilePath, () => {}); // Clean up
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

    // Pipe file stream through processor to disk
    fileStream.pipe(processor).pipe(writeStream);

    // Wrap writeStream completion in a Promise
    const fileWritePromise = new Promise<void>((resolve, reject) => {
      // Handle write stream errors
      writeStream.on('error', (error: Error) => {
        console.error('Write stream error:', error);
        writeError = error;
        hasError = true;
        unlink(tempFilePath, () => {}); // Clean up
        if (!res.headersSent) {
          res.status(500).json({
            error: 'File upload error',
            message: 'Error saving file to disk',
          });
        }
        reject(error);
      });

      // Handle file stream end
      writeStream.on('finish', () => {
        if (hasError || writeError) {
          reject(new Error('File write failed due to previous error'));
          return;
        }

        // Add file to files array
        files.push({
          filename: filename || 'unknown',
          mimeType: mimeType || 'application/octet-stream',
          detectedMime: detectedMime || 'application/octet-stream',
          size: bytesRead,
          stream: createReadStream(tempFilePath),
          targetFormat: targetFormat || undefined,
          tempPath: tempFilePath,
        });

        resolve();
      });
    });

    // Push promise immediately to track file completion
    fileWritePromises.push(fileWritePromise);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      hasError = true;
      writeStream.destroy();
      unlink(tempFilePath, () => {}); // Clean up
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
      writeStream.destroy();
      unlink(tempFilePath, () => {}); // Clean up
    });
  });

  // Handle form fields (e.g., targetFormat)
  busboy.on('field', (fieldname: string, value: string) => {
    if (fieldname === 'targetFormat') {
      targetFormat = value;
    }
  });

  // Handle busboy finish - await all file writes before completing
  busboy.on('finish', async () => {
    if (hasError) {
      return; // Error already handled, don't call next()
    }

    try {
      // Wait for all file writes to complete
      await Promise.all(fileWritePromises);

      if (hasError || res.headersSent) {
        return; // Error or response already sent
      }

      // Check files.length AFTER all writes complete
      if (files.length === 0) {
        if (!res.headersSent) {
          res.status(400).json({
            error: 'No files uploaded',
            message: 'At least one file is required',
          });
        }
        return; // No files, don't call next()
      }

      // All files are now written, normalize and attach to request
      normalizeAndAttachFiles(req, files);
      if (targetFormat && !req.body) {
        req.body = { targetFormat };
      } else if (targetFormat) {
        req.body = req.body || {};
        req.body.targetFormat = targetFormat;
      }
      next(); // Call next() only once after all files are processed
    } catch (error) {
      // Promise.all rejected - one or more file writes failed
      if (!res.headersSent) {
        res.status(500).json({
          error: 'File upload error',
          message: 'Failed to save one or more files',
        });
      }
      // Do NOT call next() on error
    }
  });

  // Handle busboy errors - send response once, do NOT call next()
  busboy.on('error', (error: Error) => {
    console.error('Busboy error:', error);
    hasError = true;
    if (!res.headersSent) {
      res.status(400).json({
        error: 'Upload error',
        message: 'Error parsing multipart form data',
      });
    }
    // Do NOT call next() on error
  });

  // Pipe request to busboy
  req.pipe(busboy);
};
