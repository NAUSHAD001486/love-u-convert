"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processJob = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
const conversionRouter_service_1 = require("./conversionRouter.service");
const vectorize_service_1 = require("./vectorize.service");
const downloadFile_util_1 = require("../utils/downloadFile.util");
const zipLocal_util_1 = require("../utils/zipLocal.util");
const filename_util_1 = require("../utils/filename.util");
const time_1 = require("../utils/time");
const env_1 = require("../config/env");
const os_1 = __importDefault(require("os"));
const sharp_1 = __importDefault(require("sharp"));
const mkdirAsync = (0, util_1.promisify)(fs_1.mkdir);
// Temp directory for downloaded files
const TEMP_DOWNLOAD_DIR = (0, path_1.join)(process.cwd(), 'temp', 'downloads');
const MAX_FILES_PER_JOB = 100;
const PARALLEL_CONVERSION_LIMIT = Math.max(1, os_1.default.cpus().length); // CPU cores for parallel processing
const MAX_RETRIES = 2; // Smart retry: max 2 attempts for network/transient errors only
// Timeout constants for production safety
const SHARP_NORMALIZE_TIMEOUT_MS = 10000; // 10 seconds for ICO/TGA normalization
// Clean up temp file
// Guard with existsSync to avoid attempting to delete files that were never created
const cleanupTempFile = (tempPath) => {
    if (!(0, fs_1.existsSync)(tempPath)) {
        return; // File doesn't exist, skip cleanup
    }
    (0, fs_1.unlink)(tempPath, (err) => {
        if (err) {
            console.error(`Failed to delete temp file ${tempPath}:`, err);
        }
    });
};
/**
 * Normalize ICO/TGA input to PNG using Sharp (safe input normalization)
 * ICO and TGA are normalized to PNG before processing to ensure compatibility
 * Includes timeout protection to prevent hanging operations
 *
 * @param inputPath - Path to input file
 * @param ext - File extension (lowercase, without dot)
 * @param tempFilesToCleanup - Array to track generated files for cleanup
 * @returns Normalized PNG path if ICO/TGA, original path otherwise
 * @throws Error if normalization fails or times out
 */
async function normalizeInputIfNeeded(inputPath, ext, tempFilesToCleanup) {
    // Only normalize ICO and TGA files
    if (ext !== 'ico' && ext !== 'tga') {
        return inputPath;
    }
    // Generate PNG path (replace .ico or .tga with .png)
    const pngPath = inputPath.replace(/\.(ico|tga)$/i, '.png');
    tempFilesToCleanup.push(pngPath); // Track for cleanup
    try {
        // Convert ICO/TGA to PNG using Sharp with timeout protection
        // failOnError: false allows graceful handling of unsupported variants
        await Promise.race([
            (0, sharp_1.default)(inputPath, { failOnError: false })
                .png({ quality: 100 })
                .toFile(pngPath),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Image normalization timeout: ${ext.toUpperCase()} conversion exceeded 10 seconds`));
                }, SHARP_NORMALIZE_TIMEOUT_MS);
            }),
        ]);
        // Verify PNG was created
        if (!(0, fs_1.existsSync)(pngPath)) {
            throw new Error(`${ext.toUpperCase()} input could not be decoded. Please convert it to PNG or JPG before uploading.`);
        }
        return pngPath;
    }
    catch (error) {
        // Clear error message for unsupported ICO/TGA variants or timeout
        const errorMessage = error instanceof Error ? error.message : 'Unknown normalization error';
        if (errorMessage.includes('timeout')) {
            throw new Error(`${ext.toUpperCase()} conversion timeout. Please try a smaller file or convert it to PNG or JPG first.`);
        }
        throw new Error(`${ext.toUpperCase()} input could not be decoded. Please convert it to PNG or JPG before uploading.`);
    }
}
/**
 * Normalize error to a human-readable string
 * Prevents "[object Object]" errors by properly serializing all error types
 */
const normalizeErrorReason = (err) => {
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
        const errorObj = err;
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
        }
        catch {
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
const isRetryableError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error;
    // Non-retryable errors (conversion/rule violations)
    if (err.message && typeof err.message === 'string') {
        const message = err.message.toLowerCase();
        if (message.includes('unsupported') ||
            message.includes('not supported') ||
            message.includes('invalid') ||
            message.includes('raster to svg') ||
            message.includes('can\'t resize') ||
            message.includes('timeout') ||
            message.includes('exceeded')) {
            return false; // Never retry rule violations or timeouts
        }
    }
    // Retryable: network errors only
    if (err.code && ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
        return true;
    }
    // Retryable: timeout in message (Cloudinary transient failure) - but only if not already timed out
    if (err.message && typeof err.message === 'string') {
        const message = err.message.toLowerCase();
        if (message.includes('temporary') || message.includes('retry')) {
            return true;
        }
    }
    return false;
};
/**
 * Convert a single file using conversion router with retry logic
 * Wrapped in try/catch to prevent worker crashes
 */
const convertWithRetry = async (file, index, targetFormat, createdAt, ttlSeconds, tempFilesToCleanup) => {
    const originalFilename = file.filename;
    let lastError = null;
    // Generate final filename using single source of truth (JPEG vs JPG fix)
    const finalFilename = (0, filename_util_1.normalizeOutputFilename)(originalFilename, targetFormat);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Step 0: Normalize ICO/TGA input to PNG if needed (before any conversion)
            const fileExt = (0, path_1.extname)(file.filename).toLowerCase().replace('.', '');
            const normalizedInputPath = await normalizeInputIfNeeded(file.tempPath, fileExt, tempFilesToCleanup);
            // Step 1: Convert file using conversion router
            const publicId = `convert_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
            // Read file from disk as stream (streaming IO, no buffer-all)
            // Use normalized path (PNG for ICO/TGA, original for others)
            const fileStream = (0, fs_1.createReadStream)(normalizedInputPath);
            if (attempt === 1) {
                tempFilesToCleanup.push(file.tempPath);
            }
            // Determine conversion route
            const route = (0, conversionRouter_service_1.determineConversionRoute)({
                inputFormat: null,
                targetFormat,
                originalFilename: finalFilename,
                detectedMime: file.detectedMime,
            });
            // Route: Raster → SVG (local vectorization - no Cloudinary, no retries)
            if (route === 'raster-to-svg-local') {
                // Local vectorization: no retries on errors
                await mkdirAsync(TEMP_DOWNLOAD_DIR, { recursive: true });
                const outputPath = (0, path_1.join)(TEMP_DOWNLOAD_DIR, `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}_${finalFilename}`);
                tempFilesToCleanup.push(outputPath);
                // Vectorize locally (no retries - errors are non-retryable)
                // Use normalized path (PNG for ICO/TGA, original for others)
                await (0, vectorize_service_1.vectorizeToSvg)(normalizedInputPath, outputPath);
                // Success: return local SVG file path
                return {
                    ok: true,
                    filename: finalFilename,
                    filePath: outputPath,
                };
            }
            // All other routes: use Cloudinary
            const result = await (0, conversionRouter_service_1.executeConversion)(fileStream, {
                inputFormat: null,
                targetFormat,
                originalFilename: finalFilename,
                detectedMime: file.detectedMime,
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
            const downloadPath = (0, path_1.join)(TEMP_DOWNLOAD_DIR, `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}_${finalFilename}`);
            tempFilesToCleanup.push(downloadPath);
            await (0, downloadFile_util_1.downloadFileToDisk)(result.secure_url, downloadPath);
            // Success!
            return {
                ok: true,
                filename: finalFilename, // Preserve correct extension
                filePath: downloadPath,
            };
        }
        catch (error) {
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
            // Retry only network/timeout errors (but not timeout errors themselves)
            if (isRetryableError(error) && attempt < MAX_RETRIES) {
                console.log(`Retrying ${originalFilename} (attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
                continue;
            }
            // Non-retryable error (invalid conversion, rule violation, timeout, etc.)
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
const processJob = async (jobData, jobId) => {
    const ttlSeconds = env_1.env.CLEANUP_TTL_SECONDS || 86400;
    const createdAt = (0, time_1.getUTCTimestamp)();
    const tempFilesToCleanup = [];
    // SVG single-file rule: fail fast if multiple files for SVG conversion
    const targetFormat = jobData.targetFormat.toLowerCase();
    if (targetFormat === 'svg' && jobData.files.length > 1) {
        throw new Error('SVG conversion supports single file only.');
    }
    try {
        if (jobData.files.length === 1) {
            const file = jobData.files[0];
            const publicId = `convert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            // Normalize ICO/TGA input to PNG if needed (before any conversion)
            const fileExt = (0, path_1.extname)(file.filename).toLowerCase().replace('.', '');
            const normalizedInputPath = await normalizeInputIfNeeded(file.tempPath, fileExt, tempFilesToCleanup);
            // Read file from disk as stream (use normalized path)
            const fileStream = (0, fs_1.createReadStream)(normalizedInputPath);
            tempFilesToCleanup.push(file.tempPath);
            // Generate final filename using single source of truth (JPEG vs JPG fix)
            const singleFinalFilename = (0, filename_util_1.normalizeOutputFilename)(file.filename, jobData.targetFormat);
            // Determine route for single file
            const route = (0, conversionRouter_service_1.determineConversionRoute)({
                inputFormat: null,
                targetFormat: jobData.targetFormat,
                originalFilename: singleFinalFilename,
                detectedMime: file.detectedMime,
            });
            // Route: Raster → SVG (local vectorization)
            if (route === 'raster-to-svg-local') {
                // For single file SVG, vectorize locally then upload to Cloudinary
                await mkdirAsync(TEMP_DOWNLOAD_DIR, { recursive: true });
                const outputPath = (0, path_1.join)(TEMP_DOWNLOAD_DIR, `${Date.now()}_${Math.random().toString(36).substring(7)}_${singleFinalFilename}`);
                tempFilesToCleanup.push(outputPath);
                // Vectorize locally (use normalized path - PNG for ICO/TGA, original for others)
                await (0, vectorize_service_1.vectorizeToSvg)(normalizedInputPath, outputPath);
                // Upload SVG to Cloudinary for download URL
                const svgStream = (0, fs_1.createReadStream)(outputPath);
                const result = await (0, conversionRouter_service_1.executeConversion)(svgStream, {
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
            // All other routes: use Cloudinary directly
            const result = await (0, conversionRouter_service_1.executeConversion)(fileStream, {
                inputFormat: null,
                targetFormat: jobData.targetFormat,
                originalFilename: singleFinalFilename,
                detectedMime: file.detectedMime,
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
        }
        else {
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
            const conversionResults = [];
            for (let i = 0; i < jobData.files.length; i += parallelLimit) {
                const batch = jobData.files.slice(i, i + parallelLimit);
                const batchResults = await Promise.all(batch.map(async (file, batchIndex) => {
                    const index = i + batchIndex;
                    return convertWithRetry(file, index, jobData.targetFormat, createdAt.toString(), ttlSeconds.toString(), tempFilesToCleanup);
                }));
                conversionResults.push(...batchResults);
            }
            // Separate successful and failed results
            const successResults = conversionResults.filter((result) => result.ok === true);
            const failedResults = conversionResults.filter((result) => !result.ok);
            // If no files succeeded, fail the job
            if (successResults.length === 0) {
                const failureMessages = failedResults.map((f) => `${f.filename} — ${f.reason}`).join('; ');
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
                const failedTextPath = (0, path_1.join)(TEMP_DOWNLOAD_DIR, `failed_${Date.now()}.txt`);
                tempFilesToCleanup.push(failedTextPath);
                const failedTextContent = failedResults
                    .map((f) => `${f.filename} — ${f.reason}`)
                    .join('\n');
                (0, fs_1.writeFileSync)(failedTextPath, failedTextContent);
                zipFiles.push({
                    filePath: failedTextPath,
                    filename: 'failed.txt',
                });
            }
            const zipFileName = `convert_zip_${jobId}.zip`;
            // Build ZIP locally (validates completion before response)
            const zipResult = await (0, zipLocal_util_1.buildLocalZip)({
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
            }
            else {
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
    }
    catch (error) {
        // Clean up temp files on error
        tempFilesToCleanup.forEach(cleanupTempFile);
        throw error;
    }
};
exports.processJob = processJob;
