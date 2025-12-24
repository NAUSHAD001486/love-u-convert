import { createWriteStream } from 'fs';

/**
 * Download a file from URL and save to disk
 * Returns the path to the saved file
 */
export const downloadFileToDisk = async (
  url: string,
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const urlModule = require('url');

    const parsedUrl = urlModule.parse(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const fileStream = createWriteStream(outputPath);

    client.get(url, (response: any) => {
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
    }).on('error', (error: Error) => {
      fileStream.destroy();
      reject(error);
    });

    fileStream.on('error', (error: Error) => {
      reject(error);
    });
  });
};

