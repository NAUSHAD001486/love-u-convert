import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi';

const router = Router();

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Love U Convert API Documentation',
}));

export default router;

