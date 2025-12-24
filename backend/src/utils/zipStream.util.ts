import archiver from 'archiver';
import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

interface StreamZipOptions {
  files: Array<{ stream: Readable; filename: string }>;
  zipFileName: string;
  fileCount: number;
  createdAt: string;
  ttlSeconds: string;
  jobId?: string;
}

interface StreamZipResult {
  downloadUrl: string;
  publicId: string;
  fileCount: number;
  createdAt: number;
  ttlSeconds: number;
}

/**
 * Stream ZIP archive directly to Cloudinary (no temp file)
 * - Creates ZIP archive as stream
 * - Appends file streams under "converted/" folder
 * - Pipes ZIP stream directly to Cloudinary upload_stream
 * - Handles backpressure safely
 * - Returns upload result
 */
export const streamZipToCloudinary = async (
  options: StreamZipOptions
): Promise<StreamZipResult> => {
  const { files, zipFileName, fileCount, createdAt, ttlSeconds, jobId } = options;

  // Validate input array before starting ZIP creation
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('INVALID_ZIP_INPUT: Files array must be non-empty');
  }

  // Validate every item in the array
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) {
      throw new Error(`INVALID_ZIP_INPUT: File at index ${i} is undefined or null`);
    }
    if (typeof file.filename !== 'string' || !file.filename) {
      throw new Error(`INVALID_ZIP_INPUT: File at index ${i} has invalid or missing filename`);
    }
    if (!file.stream || typeof file.stream.read !== 'function') {
      throw new Error(`INVALID_ZIP_INPUT: File at index ${i} (${file.filename}) has invalid or missing stream`);
    }
  }

  return new Promise((resolve, reject) => {
    // Create ZIP archive as stream
    const zip = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    let uploadAborted = false;
    let cloudinaryUploadStream: any = null;

    // Handle archive errors
    zip.on('error', (error) => {
      if (!uploadAborted) {
        uploadAborted = true;
        if (cloudinaryUploadStream && typeof cloudinaryUploadStream.destroy === 'function') {
          cloudinaryUploadStream.destroy();
        }
        reject(error);
      }
    });

    // Prepare Cloudinary upload options
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

    // Create Cloudinary upload stream
    cloudinaryUploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result: any) => {
        if (uploadAborted) {
          return;
        }

        if (error) {
          uploadAborted = true;
          reject(error);
          return;
        }

        if (!result || !result.secure_url || !result.public_id) {
          uploadAborted = true;
          reject(new Error('Cloudinary ZIP upload failed: invalid response'));
          return;
        }

        resolve({
          downloadUrl: result.secure_url,
          publicId: result.public_id,
          fileCount,
          createdAt: Number(createdAt),
          ttlSeconds: Number(ttlSeconds),
        });
      }
    );

    // Handle Cloudinary upload stream errors
    cloudinaryUploadStream.on('error', (error: Error) => {
      if (!uploadAborted) {
        uploadAborted = true;
        zip.destroy();
        reject(error);
      }
    });

    // STRICT ORDER: Pipe first, then append files, then finalize
    // Pipe ZIP archive directly to Cloudinary upload stream
    zip.pipe(cloudinaryUploadStream);

    // Append each file stream to ZIP under "converted/" folder
    // Validation already done above, but double-check for safety
    for (const file of files) {
      if (!file || !file.filename || !file.stream) {
        uploadAborted = true;
        zip.destroy();
        if (cloudinaryUploadStream && typeof cloudinaryUploadStream.destroy === 'function') {
          cloudinaryUploadStream.destroy();
        }
        reject(new Error(`INVALID_ZIP_INPUT: Invalid file entry during ZIP creation`));
        return;
      }

      const zipEntryName = `converted/${file.filename}`;
      zip.append(file.stream, { name: zipEntryName });
    }

    // Finalize MUST be the last call (triggers upload)
    zip.finalize();
  });
};

