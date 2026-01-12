"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAtomicZip = void 0;
const archiver_1 = __importDefault(require("archiver"));
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const unlinkAsync = (0, util_1.promisify)(fs_1.unlink);
const mkdirAsync = (0, util_1.promisify)(fs_1.mkdir);
/**
 * Build ZIP atomically on disk, then upload to Cloudinary
 * This ensures ZIP is never corrupted and always valid
 */
const buildAtomicZip = async (options) => {
    const { files, zipFileName, fileCount, createdAt, ttlSeconds, jobId } = options;
    // Validate input
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('INVALID_ZIP_INPUT: Files array must be non-empty');
    }
    // Create temp directory for ZIP
    const tempDir = (0, path_1.join)(process.cwd(), 'temp', 'zips');
    await mkdirAsync(tempDir, { recursive: true });
    const zipFilePath = (0, path_1.join)(tempDir, `${Date.now()}_${Math.random().toString(36).substring(7)}.zip`);
    try {
        // Step 1: Build ZIP atomically on disk
        await new Promise((resolve, reject) => {
            const output = (0, fs_1.createWriteStream)(zipFilePath);
            const archive = (0, archiver_1.default)('zip', {
                zlib: { level: 9 }, // Maximum compression
            });
            output.on('close', () => {
                resolve();
            });
            archive.on('error', (error) => {
                reject(error);
            });
            archive.pipe(output);
            // Add all files to ZIP
            for (const file of files) {
                if (!file.filePath || !file.filename) {
                    reject(new Error(`INVALID_ZIP_INPUT: Invalid file entry: ${file.filename}`));
                    return;
                }
                const zipEntryName = `converted/${file.filename}`;
                archive.append((0, fs_1.createReadStream)(file.filePath), { name: zipEntryName });
            }
            // Finalize ZIP
            archive.finalize();
        });
        // Step 2: Upload ZIP to Cloudinary
        const zipPublicId = `zip/convert_zip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const uploadOptions = {
            resource_type: 'raw',
            format: 'zip',
            type: 'upload',
            access_mode: 'public',
            flags: 'attachment',
            public_id: zipPublicId,
            folder: 'zip',
            context: {
                createdAt: createdAt,
                ttlSeconds: ttlSeconds,
                fileCount: fileCount.toString(),
            },
        };
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (!result || !result.secure_url || !result.public_id) {
                    reject(new Error('Cloudinary ZIP upload failed: invalid response'));
                    return;
                }
                resolve(result);
            });
            (0, fs_1.createReadStream)(zipFilePath).pipe(uploadStream);
        });
        // Step 3: Clean up temp ZIP file
        await unlinkAsync(zipFilePath).catch((err) => {
            console.error(`Failed to delete temp ZIP file ${zipFilePath}:`, err);
        });
        return {
            downloadUrl: result.secure_url,
            publicId: result.public_id,
            fileCount,
            createdAt: Number(createdAt),
            ttlSeconds: Number(ttlSeconds),
        };
    }
    catch (error) {
        // Clean up temp ZIP file on error
        await unlinkAsync(zipFilePath).catch(() => {
            // Ignore cleanup errors
        });
        throw error;
    }
};
exports.buildAtomicZip = buildAtomicZip;
