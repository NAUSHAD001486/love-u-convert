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

interface RateLimitResult {
  allowed: number;
  reason?: string;
  tokens_remaining?: number;
  tokens_per_second?: number;
}

export const speedLimiterRedis = async (
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
  const bytesToAdd = 0;
  const tokensPerSecond = 5;
  const dailyBytesLimit = 999999999999;

  try {
    const scriptSha = await loadLuaScript();
    if (!scriptSha) {
      console.warn('Rate limiter unavailable, allowing request');
      return next();
    }

    const nowSeconds = getCurrentEpochSeconds();
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();

    const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
    const tokenBucketKey = `tokens:burst:${clientIP}`;

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

    const parsedResult: RateLimitResult = JSON.parse(result as string);

    if (parsedResult.allowed === 0) {
      if (parsedResult.reason === 'RATE_LIMIT_EXCEEDED') {
        res.setHeader('Retry-After', '1');
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Maximum 5 image conversions per second allowed',
        });
      }
    }

    next();
  } catch (error) {
    console.warn('Rate limiter unavailable, allowing request');
    return next();
  }
};
