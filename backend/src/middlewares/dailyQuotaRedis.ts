import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { env } from '../config/env';
import { extractClientIP } from '../utils/ip';
import { getSecondsUntilMidnightUTC, getCurrentEpochSeconds } from '../utils/time';
import { readFileSync } from 'fs';
import { join } from 'path';

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
    // Try multiple possible paths (dev and production)
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
        // Try next path
      }
    }

    if (!script) {
      console.error('Lua script not found in any expected location');
      return null;
    }

    luaScriptSha = (await redis.script('LOAD', script)) as string;
    return luaScriptSha;
  } catch (error) {
    console.error('Failed to load Lua script:', error);
    return null;
  }
};

interface QuotaResult {
  allowed: number;
  reason?: string;
  quota_used?: number;
  quota_limit?: number;
  tokens_remaining?: number;
  tokens_per_second?: number;
}

export const dailyQuotaRedis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const redis = getRedisClient();
  if (!redis) {
    // Fail-open: allow request if Redis is unavailable
    console.error('Redis not available, skipping daily quota check');
    return next();
  }

  const dailyBytesLimit = parseInt(env.DAILY_BYTES_LIMIT, 10);
  if (!dailyBytesLimit || isNaN(dailyBytesLimit)) {
    console.error('DAILY_BYTES_LIMIT not configured or invalid');
    return next();
  }

  const clientIP = extractClientIP(req);
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const bytesToAdd = contentLength || 0;

  // Validate file size
  const maxFileSize = parseInt(env.MAX_FILE_SIZE_BYTES, 10);
  if (maxFileSize && !isNaN(maxFileSize) && bytesToAdd > maxFileSize) {
    return res.status(413).json({
      error: 'File too large',
      message: `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
    });
  }

  try {
    const scriptSha = await loadLuaScript();
    if (!scriptSha) {
      console.error('Failed to load Lua script, allowing request');
      return next();
    }

    const nowSeconds = getCurrentEpochSeconds();
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    const tokensPerSecond = 5; // Rate limit: 5 files per second

    const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
    const tokenBucketKey = `tokens:${clientIP}`;

    const result = await redis.evalsha(
      scriptSha,
      2,
      dailyQuotaKey,
      tokenBucketKey,
      bytesToAdd.toString(),
      dailyBytesLimit.toString(),
      tokensPerSecond.toString(),
      nowSeconds.toString(),
      secondsUntilMidnight.toString()
    );

    const parsedResult: QuotaResult = JSON.parse(result as string);

    if (parsedResult.allowed === 0) {
      if (parsedResult.reason === 'DAILY_QUOTA_EXCEEDED') {
        return res.status(429).json({
          error: 'Daily quota exceeded',
          message: `Daily quota of ${dailyBytesLimit} bytes has been exceeded`,
          quota_used: parsedResult.quota_used,
          quota_limit: parsedResult.quota_limit,
        });
      }
      if (parsedResult.reason === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${tokensPerSecond} requests per second allowed`,
          tokens_per_second: parsedResult.tokens_per_second,
        });
      }
    }

    // Attach quota info to request for downstream use
    (req as any).quotaInfo = {
      quotaUsed: parsedResult.quota_used,
      quotaLimit: parsedResult.quota_limit,
      tokensRemaining: parsedResult.tokens_remaining,
    };

    next();
  } catch (error) {
    console.error('Redis quota check error:', error);
    // Fail-open: allow request on error
    return next();
  }
};
