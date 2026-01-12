"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createZipFromStreams = void 0;
const archiver_1 = __importDefault(require("archiver"));
const fs_1 = require("fs");
/**
 * Create ZIP file from streams and save to disk
 * @param files - Array of file streams with filenames
 * @param zipPath - Path where ZIP file should be saved
 * @returns Promise that resolves when ZIP is finalized
 */
const createZipFromStreams = async (files, zipPath) => {
    return new Promise((resolve, reject) => {
        const output = (0, fs_1.createWriteStream)(zipPath);
        const zip = (0, archiver_1.default)('zip', {
            zlib: { level: 9 }, // Maximum compression
        });
        let hasError = false;
        // Handle archive errors
        zip.on('error', (error) => {
            if (!hasError) {
                hasError = true;
                reject(error);
            }
        });
        // Handle output stream errors
        output.on('error', (error) => {
            if (!hasError) {
                hasError = true;
                reject(error);
            }
        });
        // Wait for file write to finish (this fires after zip is finalized and written)
        output.on('close', () => {
            if (!hasError) {
                resolve();
            }
        });
        // Pipe archive data to file
        zip.pipe(output);
        // Append each file stream to ZIP
        for (const file of files) {
            // Files go into "converted/" folder inside ZIP
            const zipEntryName = `converted/${file.filename}`;
            zip.append(file.stream, { name: zipEntryName });
        }
        // Finalize the archive
        zip.finalize();
    });
};
exports.createZipFromStreams = createZipFromStreams;
