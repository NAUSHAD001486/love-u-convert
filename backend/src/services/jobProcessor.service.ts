import { createReadStream, unlink, mkdir, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { executeConversion, determineConversionRoute } from './conversionRouter.service';
import { vectorizeToSvg } from './vectorize.service';
import { downloadFileToDisk } from '../utils/downloadFile.util';
import { buildLocalZip } from '../utils/zipLocal.util';
import { normalizeOutputFilename } from '../utils/filename.util';
import { getUTCTimestamp } from '../utils/time';
import { ConvertJobData } from '../queue/convert.queue';
import { env } from '../config/env';
import os from 'os';

const mkdirAsync = promisify(mkdir);

// Temp directory for downloaded files
const TEMP_DOWNLOAD_DIR = join(process.cwd(), 'temp', 'downloads');

const MAX_FILES_PER_JOB = 100;
const PARALLEL_CONVERSION_LIMIT = Math.max(1, os.cpus().length); // CPU cores for parallel processing
const MAX_RETRIES = 2; // Smart retry: max 2 attempts for network/transient errors only

// Clean up temp file
// Guard with existsSync to avoid attempting to delete files that were never created
const cleanupTempFile = (tempPath: string): void => {
  if (!existsSync(tempPath)) {
    return; // File doesn't exist, skip cleanup
  }
  unlink(tempPath, (err) => {
    if (err) {
      console.error(`Failed to delete temp file ${tempPath}:`, err);
    }
  });
};

/**
 * Pre-convert TGA to PNG before Cloudinary (TGA not supported by Cloudinary)
 * Uses ImageMagick CLI for robust TGA decoding (supports RLE, indexed, Photoshop TGA)
 * Returns converted file path and updated MIME type, or original if not TGA
 */
const preConvertTgaIfNeeded = async (
  filePath: string,
  filename: string,
  tempFilesToCleanup: string[]
): Promise<{ convertedPath: string; detectedMime: string | null }> => {
  const ext = extname(filename).toLowerCase().replace('.', '');
  
  // Only convert TGA files
  if (ext !== 'tga') {
    return {
      convertedPath: filePath,
      detectedMime: null, // Keep original detectedMime
    };
  }

  // Convert TGA → PNG using ImageMagick CLI (supports all TGA variants)
  const pngPath = filePath.replace(/\.tga$/i, '.png');
  tempFilesToCleanup.push(pngPath); // Track for cleanup

  try {
    // Use ImageMagick CLI: magick input.tga output.png
    await new Promise<void>((resolve, reject) => {
      execFile(
        'magick',
        [filePath, pngPath],
        (error, stdout, stderr) => {
          if (error) {
            console.error(`ImageMagick TGA conversion failed: ${error.message}`);
            reject(new Error('TGA file format is not supported for conversion'));
            return;
          }
          
          // Verify PNG file was created
          if (!existsSync(pngPath)) {
            reject(new Error('TGA file format is not supported for conversion'));
            return;
          }
          
          resolve();
        }
      );
    });

    // Return converted PNG path and updated MIME
    return {
      convertedPath: pngPath,
      detectedMime: 'image/png',
    };
  } catch (error) {
    console.error(`Failed to convert TGA to PNG using ImageMagick: ${error}`);
    // If conversion fails, throw clear error
    throw new Error('TGA file format is not supported for conversion');
  }
};

/**
 * Normalize error to a human-readable string
 * Prevents "[object Object]" errors by properly serializing all error types
 */
const normalizeErrorReason = (err: unknown): string => {
  // If err is instance of Error
  if (err instanceof Error) {
    return err.message || String(err);
  }

  // If err is string
  if (typeof err === 'string') {
    return err;
  }

  // If err is an object
  if (err && typeof err === 'object') {
    const errorObj = err as { message?: unknown; code?: unknown; error?: unknown };
    
    // Try message first
    if (errorObj.message !== undefined && errorObj.message !== null) {
      return String(errorObj.message);
    }
    
    // Try error property
    if (errorObj.error !== undefined && errorObj.error !== null) {
      return String(errorObj.error);
    }
    
    // Try code second
    if (errorObj.code !== undefined && errorObj.code !== null) {
      return String(errorObj.code);
    }
    
    // Fallback to JSON stringify (prevents [object Object])
    try {
      return JSON.stringify(errorObj);
    } catch {
      return 'Unknown error (object)';
    }
  }

  // Fallback
  return 'Unknown error';
};

/**
 * Check if an error is retryable (transient network/Cloudinary error only)
 * NO retry for: invalid image, unsupported conversion, rule violation
 */
const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; message?: string };

  // Non-retryable errors (conversion/rule violations)
  if (err.message && typeof err.message === 'string') {
    const message = err.message.toLowerCase();
    if (
      message.includes('unsupported') ||
      message.includes('not supported') ||
      message.includes('invalid') ||
      message.includes('raster to svg') ||
      message.includes('can\'t resize')
    ) {
      return false; // Never retry rule violations
    }
  }

  // Retryable: network errors only
  if (err.code && ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
    return true;
  }

  // Retryable: timeout in message (Cloudinary transient failure)
  if (err.message && typeof err.message === 'string') {
    const message = err.message.toLowerCase();
    if (message.includes('timeout') || message.includes('temporary') || message.includes('retry')) {
      return true;
    }
  }

  return false;
};

/**
 * Convert a single file with retry logic and download to disk
 */
interface ConvertFileResult {
  ok: true;
  filename: string;
  filePath: string; // Path to downloaded file on disk
}

interface ConvertFileFailure {
  ok: false;
  filename: string;
  reason: string;
}

type ConvertFileResponse = ConvertFileResult | ConvertFileFailure;

/**
 * Convert a single file using conversion router with retry logic
 * Wrapped in try/catch to prevent worker crashes
 */
const convertWithRetry = async (
  file: {
    filename: string;
    tempPath: string;
    detectedMime: string | null;
  },
  index: number,
  targetFormat: string,
  createdAt: string,
  ttlSeconds: string,
  tempFilesToCleanup: string[]
): Promise<ConvertFileResponse> => {
  const originalFilename = file.filename;
  let lastError: Error | null = null;

  // Generate final filename using single source of truth (JPEG vs JPG fix)
  const finalFilename = normalizeOutputFilename(originalFilename, targetFormat);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 0: Pre-convert TGA to PNG if needed (TGA not supported by Cloudinary)
      const { convertedPath, detectedMime: updatedMime } = await preConvertTgaIfNeeded(
        file.tempPath,
        file.filename,
        tempFilesToCleanup
      );
      const effectiveMime = updatedMime || file.detectedMime;
      
      // Step 1: Convert file using conversion router
      const publicId = `convert_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
      
      // Read file from disk as stream (streaming IO, no buffer-all)
      // Use converted path if TGA was converted to PNG
      const fileStream = createReadStream(convertedPath);
      if (attempt === 1) {
        tempFilesToCleanup.push(file.tempPath);
        // If TGA was converted, the PNG path is already in tempFilesToCleanup
      }
      
      // Determine conversion route (use updated MIME for TGA→PNG conversion)
      const route = determineConversionRoute({
        inputFormat: null,
        targetFormat,
        originalFilename: finalFilename,
        detectedMime: effectiveMime,
      });

      // Route: Raster → SVG (local vectorization - no Cloudinary, no retries)
      if (route === 'raster-to-svg-local') {
        // Local vectorization: no retries on errors
        await mkdirAsync(TEMP_DOWNLOAD_DIR, { recursive: true });
        const outputPath = join(TEMP_DOWNLOAD_DIR, `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}_${finalFilename}`);
        tempFilesToCleanup.push(outputPath);

        // Pre-convert TGA to PNG if needed (before vectorization)
        const { convertedPath: vectorizeInputPath } = await preConvertTgaIfNeeded(
          file.tempPath,
          file.filename,
          tempFilesToCleanup
        );

        // Vectorize locally (no retries - errors are non-retryable)
        // Use converted PNG path if TGA was converted
        await vectorizeToSvg(vectorizeInputPath, outputPath);

        // Success: return local SVG file path
        return {
          ok: true,
          filename: finalFilename,
          filePath: outputPath,
        };
      }

      // All other routes: use Cloudinary (with updated MIME if TGA was converted)
      const result = await executeConversion(fileStream, {
        inputFormat: null,
        targetFormat,
        originalFilename: finalFilename,
        detectedMime: effectiveMime,
      }, publicId);

      if (!result || !('secure_url' in result) || !result.secure_url) {
        // Non-retryable: invalid result
        return {
          ok: false,
          filename: originalFilename,
          reason: 'Conversion returned invalid result',
        };
      }

      // Step 2: Download converted file to disk (for ZIP assembly)
      await mkdirAsync(TEMP_DOWNLOAD_DIR, { recursive: true });
      const downloadPath = join(TEMP_DOWNLOAD_DIR, `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}_${finalFilename}`);
      tempFilesToCleanup.push(downloadPath);

      await downloadFileToDisk(result.secure_url, downloadPath);

      // Success!
      return {
        ok: true,
        filename: finalFilename, // Preserve correct extension
        filePath: downloadPath,
      };
    } catch (error: unknown) {
      const normalizedReason = normalizeErrorReason(error);
      lastError = error instanceof Error ? error : new Error(normalizedReason);

      // Check if error is retryable (network/timeout only - no retries on vectorization errors)
      const reason = normalizeErrorReason(error);
      
      // Vectorization errors are never retryable
      if (reason.includes('Vectorization') || reason.includes('vectorization')) {
        return {
          ok: false,
          filename: originalFilename,
          reason: `FILE_CONVERSION_FAILED: ${reason}`,
        };
      }

      // Retry only network/timeout errors
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        console.log(`Retrying ${originalFilename} (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        continue;
      }

      // Non-retryable error (invalid conversion, rule violation, etc.)
      if (attempt >= MAX_RETRIES) {
        console.log(`File failed after retries: ${originalFilename} — ${reason}`);
      }
      return {
        ok: false,
        filename: originalFilename,
        reason,
      };
    }
  }

  const reason = lastError ? normalizeErrorReason(lastError) : 'Unknown error';
  return {
    ok: false,
    filename: originalFilename,
    reason,
  };
};

export const processJob = async (jobData: ConvertJobData, jobId?: string): Promise<any> => {
  const ttlSeconds = env.CLEANUP_TTL_SECONDS || 86400;
  const createdAt = getUTCTimestamp();
  const tempFilesToCleanup: string[] = [];

  // SVG single-file rule: fail fast if multiple files for SVG conversion
  const targetFormat = jobData.targetFormat.toLowerCase();
  if (targetFormat === 'svg' && jobData.files.length > 1) {
    throw new Error('SVG conversion supports single file only.');
  }

  try {
    if (jobData.files.length === 1) {
      const file = jobData.files[0];
      const publicId = `convert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Pre-convert TGA to PNG if needed (TGA not supported by Cloudinary)
      const { convertedPath, detectedMime: updatedMime } = await preConvertTgaIfNeeded(
        file.tempPath,
        file.filename,
        tempFilesToCleanup
      );
      const effectiveMime = updatedMime || file.detectedMime;
      
      // Read file from disk as stream (use converted path if TGA was converted)
      const fileStream = createReadStream(convertedPath);
      tempFilesToCleanup.push(file.tempPath);

      // Generate final filename using single source of truth (JPEG vs JPG fix)
      const singleFinalFilename = normalizeOutputFilename(file.filename, jobData.targetFormat);
      
      // Determine route for single file (use updated MIME for TGA→PNG conversion)
      const route = determineConversionRoute({
        inputFormat: null,
        targetFormat: jobData.targetFormat,
        originalFilename: singleFinalFilename,
        detectedMime: effectiveMime,
      });

      // Route: Raster → SVG (local vectorization)
      if (route === 'raster-to-svg-local') {
        // For single file SVG, vectorize locally then upload to Cloudinary
        await mkdirAsync(TEMP_DOWNLOAD_DIR, { recursive: true });
        const outputPath = join(TEMP_DOWNLOAD_DIR, `${Date.now()}_${Math.random().toString(36).substring(7)}_${singleFinalFilename}`);
        tempFilesToCleanup.push(outputPath);
        
        // Pre-convert TGA to PNG if needed (before vectorization)
        const { convertedPath: vectorizeInputPath } = await preConvertTgaIfNeeded(
          file.tempPath,
          file.filename,
          tempFilesToCleanup
        );
        
        // Vectorize locally (use converted PNG path if TGA was converted)
        await vectorizeToSvg(vectorizeInputPath, outputPath);
        
        // Upload SVG to Cloudinary for download URL
        const svgStream = createReadStream(outputPath);
        const result = await executeConversion(svgStream, {
          inputFormat: 'svg',
          targetFormat: 'svg',
          originalFilename: singleFinalFilename,
          detectedMime: 'image/svg+xml',
        }, publicId);

        // Clean up temp files
        cleanupTempFile(file.tempPath);
        cleanupTempFile(outputPath);

        return {
          downloadUrl: result.secure_url,
          publicId: result.public_id,
          createdAt,
          ttlSeconds,
          fileCount: 1,
        };
      }

      // All other routes: use Cloudinary directly (with updated MIME if TGA was converted)
      const result = await executeConversion(fileStream, {
        inputFormat: null,
        targetFormat: jobData.targetFormat,
        originalFilename: singleFinalFilename,
        detectedMime: effectiveMime,
      }, publicId);

      // Clean up temp file
      cleanupTempFile(file.tempPath);

      return {
        downloadUrl: result.secure_url,
        publicId: result.public_id,
        createdAt,
        ttlSeconds,
        fileCount: 1,
      };
    } else {
      // Multi-file conversion: atomic ZIP generation
      
      // Safety: Check file count limit
      if (jobData.files.length > MAX_FILES_PER_JOB) {
        throw new Error('TOO_MANY_FILES');
      }

      console.log(`Atomic ZIP conversion started for job ${jobId || 'unknown'}`);

      // Step 1: Convert all files with performance guards
      // - Raster→SVG: Already validated as single-file only (fail fast above)
      // - Raster→Raster: Parallel up to CPU cores
      // Note: SVG multi-file is blocked above, so this path never executes for SVG
      const parallelLimit = PARALLEL_CONVERSION_LIMIT;

      const conversionResults: ConvertFileResponse[] = [];
      for (let i = 0; i < jobData.files.length; i += parallelLimit) {
        const batch = jobData.files.slice(i, i + parallelLimit);
        const batchResults = await Promise.all(
          batch.map(async (file, batchIndex) => {
            const index = i + batchIndex;
            return convertWithRetry(
              file,
              index,
              jobData.targetFormat,
              createdAt.toString(),
              ttlSeconds.toString(),
              tempFilesToCleanup
            );
          })
        );
        conversionResults.push(...batchResults);
      }

      // Separate successful and failed results
      const successResults = conversionResults.filter(
        (result): result is { ok: true; filename: string; filePath: string } => result.ok === true
      );
      const failedResults = conversionResults.filter((result) => !result.ok);

      // If no files succeeded, fail the job
      if (successResults.length === 0) {
        const failureMessages = failedResults.map(
          (f) => `${f.filename} — ${f.reason}`
        ).join('; ');
        throw new Error(`FILE_CONVERSION_FAILED: ${failureMessages}`);
      }

      // Step 2: Build ZIP locally (not via Cloudinary)
      if (!jobId) {
        throw new Error('Job ID required for multi-file conversion');
      }

      const zipFiles = successResults.map((result) => ({
        filePath: result.filePath,
        filename: result.filename, // Preserves .jpeg vs .jpg extension
      }));

      // Add failed.txt if there are failures
      if (failedResults.length > 0) {
        const failedTextPath = join(TEMP_DOWNLOAD_DIR, `failed_${Date.now()}.txt`);
        tempFilesToCleanup.push(failedTextPath);
        const failedTextContent = failedResults
          .map((f) => `${f.filename} — ${f.reason}`)
          .join('\n');
        writeFileSync(failedTextPath, failedTextContent);
        zipFiles.push({
          filePath: failedTextPath,
          filename: 'failed.txt',
        });
      }

      const zipFileName = `convert_zip_${jobId}.zip`;
      
      // Build ZIP locally (validates completion before response)
      const zipResult = await buildLocalZip({
        files: zipFiles,
        zipFileName,
        jobId,
      });

      // Validate ZIP exists and has size > 0 before marking job completed
      const { statSync } = require('fs');
      const zipStats = statSync(zipResult.zipPath);
      if (zipStats.size === 0) {
        throw new Error('ZIP file is empty after creation');
      }

      if (failedResults.length > 0) {
        console.log(`ZIP created for job ${jobId} with ${failedResults.length} failed file(s)`);
      } else {
        console.log(`ZIP created for job ${jobId}`);
      }

      // Clean up temp downloaded files (keep ZIP for download endpoint)
      // Note: ZIP cleanup happens after download via cleanupZip utility
      tempFilesToCleanup.forEach((path) => {
        // Don't delete ZIP file - it's needed for download endpoint
        if (!path.includes(zipResult.zipPath)) {
          cleanupTempFile(path);
        }
      });

      // Return response with local ZIP path (not Cloudinary URL)
      if (failedResults.length > 0) {
        return {
          zipPath: zipResult.zipPath,
          zipFileName: zipResult.zipFileName,
          fileCount: successResults.length,
          failedCount: failedResults.length,
          failedFiles: failedResults.map((f) => f.filename),
          status: 'completed_with_errors',
        };
      }

      // No failures - return standard response
      return {
        zipPath: zipResult.zipPath,
        zipFileName: zipResult.zipFileName,
        fileCount: zipResult.fileCount,
      };
    }
  } catch (error) {
    // Clean up temp files on error
    tempFilesToCleanup.forEach(cleanupTempFile);
    throw error;
  }
};
