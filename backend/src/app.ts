import express from 'express';
import { requestIdMiddleware } from './middlewares/requestId';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import healthRoutes from './routes/health.routes';
import convertRoutes from './routes/convert.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

app.use(express.json());
app.use(requestIdMiddleware);
app.use(corsMiddleware);

// Root route for Elastic Beanstalk health checks
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'love-u-convert-api' });
});

app.use(healthRoutes);
app.use(convertRoutes);
app.use(adminRoutes);
app.use(notFound);
app.use(errorHandler);

export { app };
