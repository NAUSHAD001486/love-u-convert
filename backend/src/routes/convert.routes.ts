import { Router } from 'express';
import { convertImage, convertImageFromUrl } from '../controllers/convert.controller';
import { speedLimiterRedis } from '../middlewares/speedLimiterRedis';
import { dailyQuotaRedis } from '../middlewares/dailyQuotaRedis';
import { mimeTypeGuard } from '../middlewares/mimeTypeGuard';
import { uploadStream } from '../middlewares/uploadStream';

const router = Router();

// POST /api/convert/image
// Middleware order: speedLimiterRedis → dailyQuotaRedis → mimeTypeGuard → uploadStream → controller
// Note: mimeTypeGuard validates after uploadStream processes files (uploadStream detects MIME first)
router.post(
  '/api/convert/image',
  speedLimiterRedis,
  dailyQuotaRedis,
  uploadStream, // Processes files and detects MIME
  mimeTypeGuard, // Validates detected MIME against targetFormat
  convertImage
);

// POST /api/convert/image-from-url
// Middleware order: speedLimiterRedis → dailyQuotaRedis → controller
// (No file upload, so no uploadStream or mimeTypeGuard)
router.post(
  '/api/convert/image-from-url',
  speedLimiterRedis,
  dailyQuotaRedis,
  convertImageFromUrl
);

export default router;
