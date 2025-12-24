"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const job_worker_1 = require("./workers/job.worker");
const formats_1 = require("./config/formats");
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
// Log supported formats on startup
const supportedFormatsList = Array.from(formats_1.SUPPORTED_OUTPUT_FORMATS).sort().join(', ');
console.log(`Supported output formats: ${supportedFormatsList}`);
// Start background job worker (non-blocking)
(0, job_worker_1.startJobWorker)();
const server = app_1.app.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
});
const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Starting graceful shutdown...`);
    // Stop job worker
    (0, job_worker_1.stopJobWorker)();
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
