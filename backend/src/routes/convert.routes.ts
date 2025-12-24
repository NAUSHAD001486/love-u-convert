import { Router } from 'express';
import { convertImage, convertImageFromUrl } from '../controllers/convert.controller';
import { getJob } from '../controllers/job.controller';
import { downloadZip } from '../controllers/download.controller';
import { mimeTypeGuard } from '../middlewares/mimeTypeGuard';
import { uploadStream } from '../middlewares/uploadStream';

const router = Router();

router.post(
  '/api/convert/image',
  uploadStream,
  mimeTypeGuard,
  convertImage
);

router.post(
  '/api/convert/image-from-url',
  convertImageFromUrl
);

router.get('/api/job/:jobId', getJob);

// ZIP download endpoint
router.get('/api/download/zip/:jobId', downloadZip);

export default router;
