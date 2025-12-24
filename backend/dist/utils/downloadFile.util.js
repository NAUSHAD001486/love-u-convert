"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFileToDisk = void 0;
const fs_1 = require("fs");
/**
 * Download a file from URL and save to disk
 * Returns the path to the saved file
 */
const downloadFileToDisk = async (url, outputPath) => {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const http = require('http');
        const urlModule = require('url');
        const parsedUrl = urlModule.parse(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const fileStream = (0, fs_1.createWriteStream)(outputPath);
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                fileStream.destroy();
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(outputPath);
            });
        }).on('error', (error) => {
            fileStream.destroy();
            reject(error);
        });
        fileStream.on('error', (error) => {
            reject(error);
        });
    });
};
exports.downloadFileToDisk = downloadFileToDisk;
