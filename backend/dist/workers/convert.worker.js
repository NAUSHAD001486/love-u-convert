"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const env_1 = require("../config/env");
const cloudinary_service_1 = require("../services/cloudinary.service");
const zip_service_1 = require("../services/zip.service");
const time_1 = require("../utils/time");
const time_2 = require("../utils/time");
const fs_1 = require("fs");
const path_1 = require("path");
const stream_1 = require("stream");
const redis_1 = require("../config/redis");
if (!env_1.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is required');
}
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (error.message.includes('REDIS_URL')) {
        process.exit(1);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (reason && reason.message && reason.message.includes('REDIS_URL')) {
        process.exit(1);
    }
});
let luaScriptSha = null;
const loadLuaScript = async () => {
    const redis = (0, redis_1.getWorkerRedis)();
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
    const redis = (0, redis_1.getWorkerRedis)();
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
const bufferToStream = (buffer) => {
    return stream_1.Readable.from(buffer);
};
const processJob = async (jobData) => {
    const ttlSeconds = env_1.env.CLEANUP_TTL_SECONDS || 86400;
    const createdAt = (0, time_1.getUTCTimestamp)();
    let totalBytesUploaded = 0;
    if (jobData.files.length === 1) {
        const file = jobData.files[0];
        const publicId = `convert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const stream = bufferToStream(file.data);
        const result = await (0, cloudinary_service_1.uploadImageStream)(stream, {
            targetFormat: jobData.targetFormat,
            publicId,
            context: {
                createdAt: createdAt.toString(),
                ttlSeconds: ttlSeconds.toString(),
                originalFormat: file.detectedMime || 'unknown',
            },
            quotaLimit: jobData.quotaLimit,
            quotaUsed: jobData.quotaUsed,
        });
        totalBytesUploaded = result.bytesUploaded;
        await deductQuota(jobData.clientIP, totalBytesUploaded);
        return {
            downloadUrl: result.secure_url,
            publicId: result.public_id,
            createdAt,
            ttlSeconds,
            fileCount: 1,
        };
    }
    else {
        const uploadPromises = jobData.files.map(async (file, index) => {
            const publicId = `convert_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
            const stream = bufferToStream(file.data);
            let currentQuotaUsed = jobData.quotaUsed + totalBytesUploaded;
            const result = await (0, cloudinary_service_1.uploadImageStream)(stream, {
                targetFormat: jobData.targetFormat,
                publicId,
                context: {
                    createdAt: createdAt.toString(),
                    ttlSeconds: ttlSeconds.toString(),
                    originalFormat: file.detectedMime || 'unknown',
                },
                quotaLimit: jobData.quotaLimit,
                quotaUsed: currentQuotaUsed,
            });
            totalBytesUploaded += result.bytesUploaded;
            const extension = jobData.targetFormat.toLowerCase();
            const baseFilename = file.filename.replace(/\.[^/.]+$/, '') || 'image';
            const filename = `${baseFilename}.${extension}`;
            return {
                filename,
                url: result.secure_url,
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
            const quotaLimit = jobData.quotaLimit || 0;
            const quotaUsed = jobData.quotaUsed + totalBytesUploaded;
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
                        reject(new Error('Daily upload limit exceeded'));
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
        await deductQuota(jobData.clientIP, totalBytesUploaded);
        return {
            downloadUrl: zipResult.secure_url,
            publicId: zipResult.public_id,
            createdAt,
            ttlSeconds,
            fileCount: jobData.files.length,
        };
    }
};
const startWorker = async () => {
    if (!env_1.env.REDIS_URL) {
        throw new Error('REDIS_URL environment variable is required');
    }
    const redisClient = (0, redis_1.getWorkerRedis)();
    const worker = new bullmq_1.Worker('convert', async (job) => {
        console.log(`Processing job ${job.id}`);
        return await processJob(job.data);
    }, {
        connection: redisClient,
        concurrency: 5,
        lockDuration: 600000,
        autorun: true,
    });
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err);
    });
    worker.on('error', (err) => {
        console.error('Worker error:', err);
    });
    console.log('Convert worker started');
};
if (require.main === module) {
    startWorker().catch((error) => {
        console.error('Failed to start worker:', error);
        if (error.message && error.message.includes('REDIS_URL')) {
            process.exit(1);
        }
    });
}
