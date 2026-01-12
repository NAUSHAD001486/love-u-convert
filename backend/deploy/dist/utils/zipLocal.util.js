"use strict";
/**
 * Local ZIP generation - Creates ZIP files locally (not via Cloudinary)
 * Ensures ZIP is always valid and can be downloaded directly
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupZip = exports.buildLocalZip = void 0;
const archiver_1 = __importDefault(require("archiver"));
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
const unlinkAsync = (0, util_1.promisify)(fs_1.unlink);
const mkdirAsync = (0, util_1.promisify)(fs_1.mkdir);
/**
 * Build ZIP locally on disk
 * Returns path to ZIP file for download
 */
const buildLocalZip = async (options) => {
    const { files, zipFileName, jobId } = options;
    // Validate input
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('INVALID_ZIP_INPUT: Files array must be non-empty');
    }
    // Create storage directory for ZIPs
    const storageDir = (0, path_1.join)(process.cwd(), 'temp', 'zips', jobId);
    await mkdirAsync(storageDir, { recursive: true });
    const zipFilePath = (0, path_1.join)(storageDir, zipFileName);
    // Build ZIP atomically on disk
    await new Promise((resolve, reject) => {
        const output = (0, fs_1.createWriteStream)(zipFilePath);
        const archive = (0, archiver_1.default)('zip', {
            zlib: { level: 9 }, // Maximum compression
        });
        output.on('close', () => {
            // Validate ZIP was created successfully
            try {
                const stats = require('fs').statSync(zipFilePath);
                if (stats.size === 0) {
                    reject(new Error('ZIP file is empty'));
                    return;
                }
                resolve();
            }
            catch (error) {
                reject(new Error('Failed to validate ZIP file'));
            }
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
            // Verify file exists before adding
            try {
                require('fs').accessSync(file.filePath);
            }
            catch {
                reject(new Error(`File not found: ${file.filePath}`));
                return;
            }
            const zipEntryName = `converted/${file.filename}`;
            archive.append((0, fs_1.createReadStream)(file.filePath), { name: zipEntryName });
        }
        // Finalize ZIP
        archive.finalize();
    });
    return {
        zipPath: zipFilePath,
        zipFileName,
        fileCount: files.length,
    };
};
exports.buildLocalZip = buildLocalZip;
/**
 * Clean up ZIP file after download
 */
const cleanupZip = async (zipPath) => {
    try {
        await unlinkAsync(zipPath);
    }
    catch (error) {
        console.error(`Failed to delete ZIP file ${zipPath}:`, error);
    }
};
exports.cleanupZip = cleanupZip;
