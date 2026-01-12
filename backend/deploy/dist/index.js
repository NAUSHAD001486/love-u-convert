"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const job_worker_1 = require("./workers/job.worker");
const PORT = process.env.PORT || 8080;
app_1.app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    // Start background worker inside API process (shares in-memory job store)
    (0, job_worker_1.startJobWorker)();
    console.log('Background worker started inside API process');
});
