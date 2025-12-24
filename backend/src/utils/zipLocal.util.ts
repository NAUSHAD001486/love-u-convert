/**
 * Local ZIP generation - Creates ZIP files locally (not via Cloudinary)
 * Ensures ZIP is always valid and can be downloaded directly
 */

import archiver from 'archiver';
import { createWriteStream, createReadStream, unlink, mkdir, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);

interface LocalZipOptions {
  files: Array<{ filePath: string; filename: string }>;
  zipFileName: string;
  jobId: string;
}

interface LocalZipResult {
  zipPath: string;
  zipFileName: string;
  fileCount: number;
}

/**
 * Build ZIP locally on disk
 * Returns path to ZIP file for download
 */
export const buildLocalZip = async (
  options: LocalZipOptions
): Promise<LocalZipResult> => {
  const { files, zipFileName, jobId } = options;

  // Validate input
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('INVALID_ZIP_INPUT: Files array must be non-empty');
  }

  // Create storage directory for ZIPs
  const storageDir = join(process.cwd(), 'temp', 'zips', jobId);
  await mkdirAsync(storageDir, { recursive: true });

  const zipFilePath = join(storageDir, zipFileName);

  // Build ZIP atomically on disk
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      // Validate ZIP was created successfully
      try {
        const stats = require('fs').statSync(zipFilePath);
        if (stats.size === 0) {
          reject(new Error('ZIP file is empty'));
          return;
        }
        resolve();
      } catch (error) {
        reject(new Error('Failed to validate ZIP file'));
      }
    });

    archive.on('error', (error) => {
      reject(error);
    });

    archive.pipe(output);

    // Add all files to ZIP
    for (const file of files) {
      if (!file.filePath || !file.filename) {
        reject(new Error(`INVALID_ZIP_INPUT: Invalid file entry: ${file.filename}`));
        return;
      }

      // Verify file exists before adding
      try {
        require('fs').accessSync(file.filePath);
      } catch {
        reject(new Error(`File not found: ${file.filePath}`));
        return;
      }

      const zipEntryName = `converted/${file.filename}`;
      archive.append(createReadStream(file.filePath), { name: zipEntryName });
    }

    // Finalize ZIP
    archive.finalize();
  });

  return {
    zipPath: zipFilePath,
    zipFileName,
    fileCount: files.length,
  };
};

/**
 * Clean up ZIP file after download
 */
export const cleanupZip = async (zipPath: string): Promise<void> => {
  try {
    await unlinkAsync(zipPath);
  } catch (error) {
    console.error(`Failed to delete ZIP file ${zipPath}:`, error);
  }
};

