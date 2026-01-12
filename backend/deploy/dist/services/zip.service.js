"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createZipFromUrls = exports.createZipStream = void 0;
const archiver_1 = __importDefault(require("archiver"));
const cloudinary_service_1 = require("./cloudinary.service");
/**
 * Create ZIP stream from file streams or URLs
 * - Uses archiver for ZIP creation
 * - Streams files into ZIP (no buffering)
 * - Returns zip stream for further processing
 * @param fileStreams - Array of file streams or URLs
 * @returns ZIP archive stream
 */
const createZipStream = async (fileStreams) => {
    const zip = (0, archiver_1.default)('zip', {
        zlib: { level: 9 }, // Maximum compression
    });
    // Process each file
    for (const file of fileStreams) {
        let fileStream;
        if (file.stream) {
            // Use provided stream directly
            fileStream = file.stream;
        }
        else if (file.url) {
            // Download from URL and create stream
            fileStream = await (0, cloudinary_service_1.downloadFileAsStream)(file.url);
        }
        else {
            throw new Error(`File ${file.filename} has no stream or URL`);
        }
        // Append file to ZIP archive
        zip.append(fileStream, { name: file.filename });
    }
    // Finalize the archive
    zip.finalize();
    return zip;
};
exports.createZipStream = createZipStream;
/**
 * Create ZIP stream from Cloudinary URLs
 * Downloads files from URLs and streams into ZIP
 * @param urls - Array of objects with filename and url
 * @returns ZIP archive stream
 */
const createZipFromUrls = async (urls) => {
    const fileStreams = urls.map((item) => ({
        filename: item.filename,
        url: item.url,
    }));
    return (0, exports.createZipStream)(fileStreams);
};
exports.createZipFromUrls = createZipFromUrls;
