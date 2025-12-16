-- Atomic quota + token bucket implementation
-- KEYS[1] = daily_quota_key (per IP)
-- KEYS[2] = token_bucket_key (per IP)
-- ARGV[1] = bytes_to_add
-- ARGV[2] = daily_bytes_limit
-- ARGV[3] = tokens_per_second
-- ARGV[4] = now_epoch_seconds
-- ARGV[5] = seconds_until_midnight

local daily_quota_key = KEYS[1]
local token_bucket_key = KEYS[2]
local bytes_to_add = tonumber(ARGV[1])
local daily_bytes_limit = tonumber(ARGV[2])
local tokens_per_second = tonumber(ARGV[3])
local now_epoch_seconds = tonumber(ARGV[4])
local seconds_until_midnight = tonumber(ARGV[5])

-- 1) DAILY QUOTA CHECK
local current_quota = redis.call('INCRBY', daily_quota_key, bytes_to_add)

-- If key is new, set EXPIRE to seconds_until_midnight
if current_quota == bytes_to_add then
  redis.call('EXPIRE', daily_quota_key, seconds_until_midnight)
end

-- Check if daily quota exceeded
if current_quota > daily_bytes_limit then
  -- Rollback the increment
  redis.call('INCRBY', daily_quota_key, -bytes_to_add)
  return cjson.encode({allowed = 0, reason = "DAILY_QUOTA_EXCEEDED", quota_used = current_quota - bytes_to_add, quota_limit = daily_bytes_limit})
end

-- 2) TOKEN BUCKET CHECK (per second)
local bucket_data = redis.call('GET', token_bucket_key)
local current_second = math.floor(now_epoch_seconds)
local tokens_available = 0
local bucket_second = 0

if bucket_data then
  local bucket = cjson.decode(bucket_data)
  bucket_second = tonumber(bucket.second) or 0
  tokens_available = tonumber(bucket.tokens) or 0
end

-- Reset bucket if second changed
if bucket_second ~= current_second then
  tokens_available = tokens_per_second
  bucket_second = current_second
end

-- Check if tokens available
if tokens_available <= 0 then
  return cjson.encode({allowed = 0, reason = "RATE_LIMIT_EXCEEDED", tokens_available = 0, tokens_per_second = tokens_per_second})
end

-- Consume one token
tokens_available = tokens_available - 1

-- Update bucket
local bucket_update = cjson.encode({second = current_second, tokens = tokens_available})
redis.call('SET', token_bucket_key, bucket_update, 'EX', 2)

-- Both checks passed
return cjson.encode({allowed = 1, quota_used = current_quota, quota_limit = daily_bytes_limit, tokens_remaining = tokens_available, tokens_per_second = tokens_per_second})
