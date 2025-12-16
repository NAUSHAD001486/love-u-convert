import { Router } from 'express';
import { getUsage } from '../controllers/admin.controller';

const router = Router();

router.get('/admin/usage', getUsage);

export default router;

