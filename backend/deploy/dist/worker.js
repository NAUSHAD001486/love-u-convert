"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const job_worker_1 = require("./workers/job.worker");
// Start background job worker
(0, job_worker_1.startJobWorker)();
console.log('Worker started');
