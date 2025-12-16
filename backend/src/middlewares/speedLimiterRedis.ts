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
    // Fail-open: allow request if Redis is unavailable
    console.error('Redis not available, skipping rate limit check');
    return next();
  }

  const clientIP = extractClientIP(req);
  const bytesToAdd = 0; // Rate limit doesn't consume bytes, only checks tokens

  try {
    const scriptSha = await loadLuaScript();
    if (!scriptSha) {
      console.error('Failed to load Lua script, allowing request');
      return next();
    }

    const nowSeconds = getCurrentEpochSeconds();
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    const tokensPerSecond = 5; // Max 5 files per second
    const dailyBytesLimit = 999999999; // Large value since we're only checking rate limit

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

    const parsedResult: RateLimitResult = JSON.parse(result as string);

    if (parsedResult.allowed === 0) {
      if (parsedResult.reason === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${tokensPerSecond} requests per second allowed`,
          tokens_per_second: parsedResult.tokens_per_second,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Redis rate limit check error:', error);
    // Fail-open: allow request on error
    return next();
  }
};
