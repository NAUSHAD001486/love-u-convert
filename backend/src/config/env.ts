// Load and validate required env vars (non-blocking for now)

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '8080',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  REDIS_URL: process.env.REDIS_URL || '',
  DYNAMODB_TABLE_CONVERSIONS: process.env.DYNAMODB_TABLE_CONVERSIONS || '',
  DAILY_BYTES_LIMIT: process.env.DAILY_BYTES_LIMIT || '',
  MAX_FILE_SIZE_BYTES: process.env.MAX_FILE_SIZE_BYTES || '',
  CLEANUP_TTL_SECONDS: process.env.CLEANUP_TTL_SECONDS || '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
};

