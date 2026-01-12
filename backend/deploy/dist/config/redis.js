"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
let redisClient = null;
const getRedisClient = () => {
    if (redisClient) {
        return redisClient;
    }
    if (!env_1.env.REDIS_URL) {
        console.error('REDIS_URL not configured');
        return null;
    }
    try {
        const isTLS = env_1.env.REDIS_URL.startsWith('rediss://') || env_1.env.REDIS_URL.includes('tls=true');
        const options = {
            lazyConnect: true,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            keepAlive: 10000,
            retryStrategy: (times) => {
                const delay = Math.min(times * 200, 2000);
                return delay;
            },
        };
        if (isTLS) {
            options.tls = {
                rejectUnauthorized: false,
            };
        }
        redisClient = new ioredis_1.default(env_1.env.REDIS_URL, options);
        redisClient.on('connect', () => {
            console.log('Redis client connected');
        });
        redisClient.on('ready', () => {
            console.log('Redis client ready');
        });
        redisClient.on('close', () => {
            console.log('Redis connection closed');
        });
        redisClient.on('reconnecting', () => {
            console.log('Redis reconnecting...');
        });
        redisClient.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
        // Connect Redis on startup (non-blocking, will retry automatically)
        redisClient.connect().catch((err) => {
            console.error('Redis initial connection failed:', err);
            // Connection will retry automatically via retryStrategy
        });
        return redisClient;
    }
    catch (error) {
        console.error('Failed to create Redis client:', error);
        return null;
    }
};
exports.getRedisClient = getRedisClient;
