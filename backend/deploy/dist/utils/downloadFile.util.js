"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFileToDisk = void 0;
const fs_1 = require("fs");
// Timeout constant for production safety
const DOWNLOAD_TIMEOUT_MS = 30000; // 30 seconds (safe for Elastic Beanstalk 60s limit)
/**
 * Download a file from URL and save to disk
 * Returns the path to the saved file
 * Includes timeout protection to prevent hanging requests
 */
const downloadFileToDisk = async (url, outputPath) => {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const http = require('http');
        const urlModule = require('url');
        const parsedUrl = urlModule.parse(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const fileStream = (0, fs_1.createWriteStream)(outputPath);
        let timeoutId = null;
        let request = null;
        let completed = false;
        // Set timeout to prevent hanging downloads
        timeoutId = setTimeout(() => {
            if (!completed) {
                completed = true;
                if (request) {
                    request.destroy();
                }
                fileStream.destroy();
                reject(new Error('File download timeout: operation exceeded 30 seconds'));
            }
        }, DOWNLOAD_TIMEOUT_MS);
        request = client.get(url, (response) => {
            if (completed) {
                return;
            }
            if (response.statusCode !== 200) {
                completed = true;
                if (timeoutId)
                    clearTimeout(timeoutId);
                fileStream.destroy();
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                if (completed) {
                    return;
                }
                completed = true;
                if (timeoutId)
                    clearTimeout(timeoutId);
                fileStream.close();
                resolve(outputPath);
            });
        });
        request.on('error', (error) => {
            if (completed) {
                return;
            }
            completed = true;
            if (timeoutId)
                clearTimeout(timeoutId);
            fileStream.destroy();
            reject(error);
        });
        fileStream.on('error', (error) => {
            if (completed) {
                return;
            }
            completed = true;
            if (timeoutId)
                clearTimeout(timeoutId);
            if (request) {
                request.destroy();
            }
            reject(error);
        });
    });
};
exports.downloadFileToDisk = downloadFileToDisk;
