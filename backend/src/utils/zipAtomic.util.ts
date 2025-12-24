import archiver from 'archiver';
import { createWriteStream, createReadStream, unlink, mkdir } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import cloudinary from '../config/cloudinary';

const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);

interface AtomicZipOptions {
  files: Array<{ filePath: string; filename: string }>;
  zipFileName: string;
  fileCount: number;
  createdAt: string;
  ttlSeconds: string;
  jobId?: string;
}

interface AtomicZipResult {
  downloadUrl: string;
  publicId: string;
  fileCount: number;
  createdAt: number;
  ttlSeconds: number;
}

/**
 * Build ZIP atomically on disk, then upload to Cloudinary
 * This ensures ZIP is never corrupted and always valid
 */
export const buildAtomicZip = async (
  options: AtomicZipOptions
): Promise<AtomicZipResult> => {
  const { files, zipFileName, fileCount, createdAt, ttlSeconds, jobId } = options;

  // Validate input
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('INVALID_ZIP_INPUT: Files array must be non-empty');
  }

  // Create temp directory for ZIP
  const tempDir = join(process.cwd(), 'temp', 'zips');
  await mkdirAsync(tempDir, { recursive: true });

  const zipFilePath = join(tempDir, `${Date.now()}_${Math.random().toString(36).substring(7)}.zip`);

  try {
    // Step 1: Build ZIP atomically on disk
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      output.on('close', () => {
        resolve();
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

        const zipEntryName = `converted/${file.filename}`;
        archive.append(createReadStream(file.filePath), { name: zipEntryName });
      }

      // Finalize ZIP
      archive.finalize();
    });

    // Step 2: Upload ZIP to Cloudinary
    const zipPublicId = `zip/convert_zip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const uploadOptions: any = {
      resource_type: 'raw',
      format: 'zip',
      type: 'upload',
      access_mode: 'public',
      flags: 'attachment',
      public_id: zipPublicId,
      folder: 'zip',
      context: {
        createdAt: createdAt,
        ttlSeconds: ttlSeconds,
        fileCount: fileCount.toString(),
      },
    };

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: any, result: any) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result || !result.secure_url || !result.public_id) {
            reject(new Error('Cloudinary ZIP upload failed: invalid response'));
            return;
          }
          resolve(result);
        }
      );

      createReadStream(zipFilePath).pipe(uploadStream);
    });

    // Step 3: Clean up temp ZIP file
    await unlinkAsync(zipFilePath).catch((err) => {
      console.error(`Failed to delete temp ZIP file ${zipFilePath}:`, err);
    });

    return {
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      fileCount,
      createdAt: Number(createdAt),
      ttlSeconds: Number(ttlSeconds),
    };
  } catch (error) {
    // Clean up temp ZIP file on error
    await unlinkAsync(zipFilePath).catch(() => {
      // Ignore cleanup errors
    });
    throw error;
  }
};

