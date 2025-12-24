"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.speedLimiterRedis = void 0;
const redis_1 = require("../config/redis");
const ip_1 = require("../utils/ip");
const time_1 = require("../utils/time");
const fs_1 = require("fs");
const path_1 = require("path");
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
            console.error('Lua script not found in any expected location');
            return null;
        }
        luaScriptSha = (await redis.script('LOAD', script));
        return luaScriptSha;
    }
    catch (error) {
        console.error('Failed to load Lua script:', error);
        return null;
    }
};
const speedLimiterRedis = async (req, res, next) => {
    const redis = (0, redis_1.getRedisClient)();
    if (!redis) {
        console.warn('Rate limiter unavailable, allowing request');
        return next();
    }
    const clientIP = (0, ip_1.extractClientIP)(req);
    const bytesToAdd = 0;
    const tokensPerSecond = 5;
    const dailyBytesLimit = 999999999999;
    try {
        const scriptSha = await loadLuaScript();
        if (!scriptSha) {
            console.warn('Rate limiter unavailable, allowing request');
            return next();
        }
        const nowSeconds = (0, time_1.getCurrentEpochSeconds)();
        const secondsUntilMidnight = (0, time_1.getSecondsUntilMidnightUTC)();
        const dailyQuotaKey = `quota:daily:${clientIP}:${new Date().toISOString().split('T')[0]}`;
        const tokenBucketKey = `tokens:burst:${clientIP}`;
        const result = await redis.evalsha(scriptSha, 2, dailyQuotaKey, tokenBucketKey, bytesToAdd.toString(), dailyBytesLimit.toString(), tokensPerSecond.toString(), nowSeconds.toString(), secondsUntilMidnight.toString());
        const parsedResult = JSON.parse(result);
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
    }
    catch (error) {
        console.warn('Rate limiter unavailable, allowing request');
        return next();
    }
};
exports.speedLimiterRedis = speedLimiterRedis;
