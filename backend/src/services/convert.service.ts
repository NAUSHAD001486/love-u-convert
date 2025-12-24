import { uploadImageStream } from './cloudinary.service';
import { createZipFromUrls, createZipStream } from './zip.service';
import { env } from '../config/env';
import { getCurrentUTC, getUTCTimestamp } from '../utils/time';
import { getRedisClient } from '../config/redis';
import { extractClientIP } from '../utils/ip';
import { getSecondsUntilMidnightUTC, getCurrentEpochSeconds } from '../utils/time';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QuotaExceededError } from '../utils/errors';

interface FileStream {
  filename: string;
  mimeType: string | null;
  detectedMime: string | null;
  size: number;
  stream: NodeJS.ReadableStream;
  targetFormat?: string;
}

interface ConvertResult {
  downloadUrl: string;
  publicId: string;
  createdAt: number;
  ttlSeconds: number;
}

interface ConvertOptions {
  targetFormat: string;
  quotaLimit?: number;
  quotaUsed?: number;
  clientIP?: string;
}

let luaScriptSha: string | null = null;

const loadLuaScript = async (): Promise<string | null> => {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  if (luaScriptSha) {
    return luaScriptSha;
  }

  try {
    const possiblePaths = [
      join(__dirname, '../scripts/redis-lua/quota_and_tokens.lua'),
      join(process.cwd(), 'src/scripts/redis-lua/quota_and_tokens.lua'),
      join(process.cwd(), 'dist/scripts/redis-lua/quota_and_tokens.lua'),
    ];

    let script = '';
    for (const scriptPath of possiblePaths) {
      try {
        script = readFileSync(scriptPath, 'utf-8');
        break;
      } catch {
        continue;
      }
    }

    if (!script) {
      return null;
    }

    luaScriptSha = (await redis.script('LOAD', script)) as string;
    return luaScriptSha;
  } catch (error) {
    return null;
  }
};

const deductQuota = async (
  clientIP: string,
  bytesUploaded: number
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const scriptSha = await loadLuaScript();
    if (!scriptSha) {
      return;
    }

    const nowSeconds = getCurrentEpochSeconds();
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    const dailyBytesLimit = 1610612736;
    const tokensPerSecond = 999;

    const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
    const tokenBucketKey = `tokens:deduct:${clientIP}`;

    await redis.evalsha(
      scriptSha,
      2,
      dailyQuotaKey,
      tokenBucketKey,
      bytesUploaded.toString(),
      dailyBytesLimit.toString(),
      tokensPerSecond.toString(),
      nowSeconds.toString(),
      secondsUntilMidnight.toString()
    );
  } catch (error) {
    console.error('Failed to deduct quota:', error);
  }
};

const convertSingleFile = async (
  fileStream: FileStream,
  options: ConvertOptions
): Promise<ConvertResult> => {
  const ttlSeconds = env.CLEANUP_TTL_SECONDS || 86400;
  const createdAt = getUTCTimestamp();
  const publicId = `convert_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  let result;
  try {
    result = await uploadImageStream(fileStream.stream, {
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
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      throw error;
    }
    throw error;
  }
};

const convertMultipleFiles = async (
  fileStreams: FileStream[],
  options: ConvertOptions
): Promise<ConvertResult> => {
  const ttlSeconds = env.CLEANUP_TTL_SECONDS || 86400;
  const createdAt = getUTCTimestamp();
  let totalBytesUploaded = 0;

  const uploadPromises = fileStreams.map(async (fileStream, index) => {
    const publicId = `convert_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
    
    let currentQuotaUsed = (options.quotaUsed || 0) + totalBytesUploaded;
    
    const result = await uploadImageStream(fileStream.stream, {
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

  const zipStream = await createZipFromUrls(
    uploadedFiles.map((file) => ({
      filename: file.filename,
      url: file.url,
    }))
  );

  const zipPublicId = `convert_zip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const zipResult = await new Promise<{ secure_url: string; public_id: string; bytesUploaded: number }>((resolve, reject) => {
    const cloudinary = require('../config/cloudinary').default;
    let zipBytesUploaded = 0;
    let uploadAborted = false;
    
    const quotaLimit = options.quotaLimit || 0;
    const quotaUsed = (options.quotaUsed || 0) + totalBytesUploaded;

    const byteTracker = new (require('stream').Transform)({
      transform(chunk: Buffer, encoding: string, callback: Function) {
        if (uploadAborted) {
          return callback();
        }

        zipBytesUploaded += chunk.length;
        const newQuotaUsed = quotaUsed + zipBytesUploaded;

        if (quotaLimit > 0 && newQuotaUsed > quotaLimit) {
          uploadAborted = true;
          cloudinaryUploadStream.destroy();
          zipStream.destroy();
          reject(new QuotaExceededError('Daily upload limit exceeded'));
          return callback();
        }

        callback(null, chunk);
      },
    });
    
    const uploadOptions: any = {
      resource_type: 'raw',
      public_id: zipPublicId,
      context: {
        createdAt: createdAt.toString(),
        ttlSeconds: ttlSeconds.toString(),
        fileCount: uploadedFiles.length.toString(),
      },
    };

    const cloudinaryUploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result: any) => {
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
      }
    );

    zipStream.pipe(byteTracker).pipe(cloudinaryUploadStream);

    zipStream.on('error', (error: Error) => {
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

export const convertImages = async (
  fileStreams: FileStream[],
  options: ConvertOptions
): Promise<ConvertResult> => {
  if (fileStreams.length === 0) {
    throw new Error('No files provided for conversion');
  }

  if (fileStreams.length === 1) {
    return convertSingleFile(fileStreams[0], options);
  } else {
    return convertMultipleFiles(fileStreams, options);
  }
};
