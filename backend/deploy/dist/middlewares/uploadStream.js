"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadStream = uploadStream;
const multer_1 = __importDefault(require("multer"));
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const uploadDir = (0, path_1.join)(process.cwd(), 'temp', 'uploads');
// Ensure upload directory exists
(0, fs_1.mkdirSync)(uploadDir, { recursive: true });
// Configure multer disk storage
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('hex')}_${file.originalname}`;
        cb(null, uniqueName);
    },
});
// File filter - only accept specific field names
const fileFilter = (_req, file, cb) => {
    // Accept files from field names: file, files, files[]
    const fieldName = file.fieldname;
    if (fieldName === 'file' || fieldName === 'files' || fieldName === 'files[]') {
        cb(null, true);
    }
    else {
        cb(null, false); // Reject other fields
    }
};
// Configure multer with limits and file filter
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: env_1.env.MAX_FILE_SIZE_BYTES || 100 * 1024 * 1024, // Default 100MB if not configured
    },
});
// Middleware to handle multiple file fields
const uploadMiddleware = upload.fields([
    { name: 'file', maxCount: 10 },
    { name: 'files', maxCount: 10 },
    { name: 'files[]', maxCount: 10 },
]);
/**
 * Multer-based upload stream middleware
 * - Uses multer with diskStorage
 * - Saves files to temp/uploads directory
 * - Accepts field names: file, files, files[]
 * - Attaches normalized files to req.uploadedFiles
 * - Multer's req.files remains intact with original multer types
 * - Attaches text fields to req.body
 * - Enforces MAX_FILE_SIZE_BYTES
 * - Fully TypeScript-safe with strict mode compatibility
 */
function uploadStream(req, res, next) {
    const contentType = req.headers['content-type'];
    if (!contentType?.includes('multipart/form-data')) {
        next(new Error('Expected multipart/form-data'));
        return;
    }
    // Use multer middleware
    uploadMiddleware(req, res, (err) => {
        if (err) {
            next(err instanceof Error ? err : new Error('Upload error'));
            return;
        }
        // Normalize multer files to req.uploadedFiles format
        const normalizedFiles = [];
        // Multer attaches files to req.files as an object with field names
        // Keep multer types intact - use req.files as multer defines it
        const multerFiles = req.files;
        if (multerFiles) {
            // Flatten all files from different field names into a single array
            for (const fieldName in multerFiles) {
                const fieldFiles = multerFiles[fieldName];
                if (Array.isArray(fieldFiles)) {
                    for (const file of fieldFiles) {
                        normalizedFiles.push({
                            filename: file.originalname,
                            mimeType: file.mimetype || 'application/octet-stream',
                            size: file.size,
                            tempPath: file.path,
                        });
                    }
                }
            }
        }
        // Attach normalized files to req.uploadedFiles (does not conflict with multer's req.files)
        req.uploadedFiles = normalizedFiles;
        // req.body already contains text fields (including targetFormat) from multer
        // No need to manually attach - multer handles it
        // Call next() exactly once
        next();
    });
}
