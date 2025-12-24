"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImages = void 0;
const cloudinary_service_1 = require("./cloudinary.service");
const zip_service_1 = require("./zip.service");
const env_1 = require("../config/env");
const time_1 = require("../utils/time");
const redis_1 = require("../config/redis");
const time_2 = require("../utils/time");
const fs_1 = require("fs");
const path_1 = require("path");
const errors_1 = require("../utils/errors");
let luaScriptSha = null;
const loadLuaScript = async () => {
    const redis = (0, redis_1.getRedisClient)();
    if (!redis) {
        return null;
    }
    if (luaScriptSha) {
        return luaScriptSha;
    }
    try {
        const possiblePaths = [
            (0, path_1.join)(__dirname, '../scripts/redis-lua/quota_and_tokens.lua'),
            (0, path_1.join)(process.cwd(), 'src/scripts/redis-lua/quota_and_tokens.lua'),
            (0, path_1.join)(process.cwd(), 'dist/scripts/redis-lua/quota_and_tokens.lua'),
        ];
        let script = '';
        for (const scriptPath of possiblePaths) {
            try {
                script = (0, fs_1.readFileSync)(scriptPath, 'utf-8');
                break;
            }
            catch {
                continue;
            }
        }
        if (!script) {
            return null;
        }
        luaScriptSha = (await redis.script('LOAD', script));
        return luaScriptSha;
    }
    catch (error) {
        return null;
    }
};
const deductQuota = async (clientIP, bytesUploaded) => {
    const redis = (0, redis_1.getRedisClient)();
    if (!redis) {
        return;
    }
    try {
        const scriptSha = await loadLuaScript();
        if (!scriptSha) {
            return;
        }
        const nowSeconds = (0, time_2.getCurrentEpochSeconds)();
        const secondsUntilMidnight = (0, time_2.getSecondsUntilMidnightUTC)();
        const dailyBytesLimit = 1610612736;
        const tokensPerSecond = 999;
        const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
        const tokenBucketKey = `tokens:deduct:${clientIP}`;
        await redis.evalsha(scriptSha, 2, dailyQuotaKey, tokenBucketKey, bytesUploaded.toString(), dailyBytesLimit.toString(), tokensPerSecond.toString(), nowSeconds.toString(), secondsUntilMidnight.toString());
    }
    catch (error) {
        console.error('Failed to deduct quota:', error);
    }
};
const convertSingleFile = async (fileStream, options) => {
    const ttlSeconds = env_1.env.CLEANUP_TTL_SECONDS || 86400;
    const createdAt = (0, time_1.getUTCTimestamp)();
    const publicId = `convert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let result;
    try {
        result = await (0, cloudinary_service_1.uploadImageStream)(fileStream.stream, {
            targetFormat: options.targetFormat,
            publicId,
            context: {
                createdAt: createdAt.toString(),
                ttlSeconds: ttlSeconds.toString(),
                originalFormat: fileStream.detectedMime || 'unknown',
            },
            quotaLimit: options.quotaLimit,
            quotaUsed: options.quotaUsed,
        });
        if (options.clientIP) {
            await deductQuota(options.clientIP, result.bytesUploaded);
        }
        return {
            downloadUrl: result.secure_url,
            publicId: result.public_id,
            createdAt,
            ttlSeconds,
        };
    }
    catch (error) {
        if (error instanceof errors_1.QuotaExceededError) {
            throw error;
        }
        throw error;
    }
};
const convertMultipleFiles = async (fileStreams, options) => {
    const ttlSeconds = env_1.env.CLEANUP_TTL_SECONDS || 86400;
    const createdAt = (0, time_1.getUTCTimestamp)();
    let totalBytesUploaded = 0;
    const uploadPromises = fileStreams.map(async (fileStream, index) => {
        const publicId = `convert_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
        let currentQuotaUsed = (options.quotaUsed || 0) + totalBytesUploaded;
        const result = await (0, cloudinary_service_1.uploadImageStream)(fileStream.stream, {
            targetFormat: options.targetFormat,
            publicId,
            context: {
                createdAt: createdAt.toString(),
                ttlSeconds: ttlSeconds.toString(),
                originalFormat: fileStream.detectedMime || 'unknown',
            },
            quotaLimit: options.quotaLimit,
            quotaUsed: currentQuotaUsed,
        });
        totalBytesUploaded += result.bytesUploaded;
        const extension = options.targetFormat.toLowerCase();
        const baseFilename = fileStream.filename.replace(/\.[^/.]+$/, '') || 'image';
        const filename = `${baseFilename}.${extension}`;
        return {
            filename,
            url: result.secure_url,
            publicId: result.public_id,
            bytesUploaded: result.bytesUploaded,
        };
    });
    const uploadedFiles = await Promise.all(uploadPromises);
    const zipStream = await (0, zip_service_1.createZipFromUrls)(uploadedFiles.map((file) => ({
        filename: file.filename,
        url: file.url,
    })));
    const zipPublicId = `convert_zip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const zipResult = await new Promise((resolve, reject) => {
        const cloudinary = require('../config/cloudinary').default;
        let zipBytesUploaded = 0;
        let uploadAborted = false;
        const quotaLimit = options.quotaLimit || 0;
        const quotaUsed = (options.quotaUsed || 0) + totalBytesUploaded;
        const byteTracker = new (require('stream').Transform)({
            transform(chunk, encoding, callback) {
                if (uploadAborted) {
                    return callback();
                }
                zipBytesUploaded += chunk.length;
                const newQuotaUsed = quotaUsed + zipBytesUploaded;
                if (quotaLimit > 0 && newQuotaUsed > quotaLimit) {
                    uploadAborted = true;
                    cloudinaryUploadStream.destroy();
                    zipStream.destroy();
                    reject(new errors_1.QuotaExceededError('Daily upload limit exceeded'));
                    return callback();
                }
                callback(null, chunk);
            },
        });
        const uploadOptions = {
            resource_type: 'raw',
            public_id: zipPublicId,
            context: {
                createdAt: createdAt.toString(),
                ttlSeconds: ttlSeconds.toString(),
                fileCount: uploadedFiles.length.toString(),
            },
        };
        const cloudinaryUploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (uploadAborted) {
                return;
            }
            if (error) {
                reject(error);
                return;
            }
            if (!result || !result.secure_url || !result.public_id) {
                reject(new Error('Cloudinary ZIP upload failed: invalid response'));
                return;
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                bytesUploaded: zipBytesUploaded,
            });
        });
        zipStream.pipe(byteTracker).pipe(cloudinaryUploadStream);
        zipStream.on('error', (error) => {
            if (!uploadAborted) {
                cloudinaryUploadStream.destroy();
                reject(error);
            }
        });
    });
    totalBytesUploaded += zipResult.bytesUploaded;
    if (options.clientIP) {
        await deductQuota(options.clientIP, totalBytesUploaded);
    }
    return {
        downloadUrl: zipResult.secure_url,
        publicId: zipResult.public_id,
        createdAt,
        ttlSeconds,
    };
};
const convertImages = async (fileStreams, options) => {
    if (fileStreams.length === 0) {
        throw new Error('No files provided for conversion');
    }
    if (fileStreams.length === 1) {
        return convertSingleFile(fileStreams[0], options);
    }
    else {
        return convertMultipleFiles(fileStreams, options);
    }
};
exports.convertImages = convertImages;
