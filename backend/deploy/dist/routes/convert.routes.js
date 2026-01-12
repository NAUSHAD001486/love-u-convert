"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const convert_controller_1 = require("../controllers/convert.controller");
const job_controller_1 = require("../controllers/job.controller");
const download_controller_1 = require("../controllers/download.controller");
const uploadStream_1 = require("../middlewares/uploadStream");
const router = (0, express_1.Router)();
router.post('/api/test', (req, res) => {
    res.status(200).json({ ok: true });
});
router.post('/api/convert/image', uploadStream_1.uploadStream, convert_controller_1.convertImage);
router.post('/api/convert/image-from-url', convert_controller_1.convertImageFromUrl);
router.get('/api/job/:jobId', job_controller_1.getJob);
// Download endpoints
router.get('/api/download/file/:jobId', download_controller_1.downloadFile);
router.get('/api/download/zip/:jobId', download_controller_1.downloadZip);
exports.default = router;
