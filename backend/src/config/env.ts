import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 8080),

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  REDIS_URL: process.env.REDIS_URL || '',
  DYNAMODB_TABLE_CONVERSIONS: process.env.DYNAMODB_TABLE_CONVERSIONS || '',

  DAILY_BYTES_LIMIT: Number(process.env.DAILY_BYTES_LIMIT || 0),
  MAX_FILE_SIZE_BYTES: Number(process.env.MAX_FILE_SIZE_BYTES || 0),
  CLEANUP_TTL_SECONDS: Number(process.env.CLEANUP_TTL_SECONDS || 0),

  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
};
