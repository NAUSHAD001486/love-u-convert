import express from 'express';
import { requestIdMiddleware } from './middlewares/requestId';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import healthRoutes from './routes/health.routes';
import convertRoutes from './routes/convert.routes';
import adminRoutes from './routes/admin.routes';
import docsRoutes from './routes/docs.routes';

const app = express();

app.use(corsMiddleware);
app.use(requestIdMiddleware);

// health check (no body parsing)
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// multipart routes MUST come BEFORE express.json
app.use(convertRoutes);

// now safe to parse JSON bodies
app.use(express.json());

// API documentation (Swagger UI)
app.use('/docs', docsRoutes);

// remaining routes
app.use(healthRoutes);
app.use(adminRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
