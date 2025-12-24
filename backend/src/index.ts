import 'dotenv/config';
import { app } from './app';
import { startJobWorker, stopJobWorker } from './workers/job.worker';
import { SUPPORTED_OUTPUT_FORMATS } from './config/formats';

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// Log supported formats on startup
const supportedFormatsList = Array.from(SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
console.log(`Supported output formats: ${supportedFormatsList}`);

// Start background job worker (non-blocking)
startJobWorker();

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`${signal} received. Starting graceful shutdown...`);
  
  // Stop job worker
  stopJobWorker();
  
  server.close(() => {
    console.log('Server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
