import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
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
}

export const dailyQuotaRedis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('Rate limiter unavailable, allowing request');
    return next();
  }

  const clientIP = extractClientIP(req);
  const dailyBytesLimit = 1610612736;
  
  let bytesToAdd = 0;
  if ((req as any).files && Array.isArray((req as any).files)) {
    bytesToAdd = (req as any).files.reduce((sum: number, file: any) => sum + (file.size || 0), 0);
  } else {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    bytesToAdd = contentLength || 0;
  }

  try {
    const scriptSha = await loadLuaScript();
    if (!scriptSha) {
      console.warn('Rate limiter unavailable, allowing request');
      return next();
    }

    const nowSeconds = getCurrentEpochSeconds();
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    const tokensPerSecond = 999;

    const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
    const tokenBucketKey = `tokens:quota:${clientIP}`;

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
        const retryAfter = Math.ceil(secondsUntilMidnight / 60);
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          error: 'Daily quota exceeded',
          message: 'Daily quota of 1.5 GB has been exceeded',
          quota_used: parsedResult.quota_used,
          quota_limit: parsedResult.quota_limit,
        });
      }
    }

    (req as any).quotaInfo = {
      quotaUsed: parsedResult.quota_used,
      quotaLimit: parsedResult.quota_limit,
    };

    next();
  } catch (error) {
    console.warn('Rate limiter unavailable, allowing request');
    return next();
  }
};
