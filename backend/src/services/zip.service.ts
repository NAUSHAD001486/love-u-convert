import archiver from 'archiver';
import { Readable } from 'stream';
import { downloadFileAsStream } from './cloudinary.service';

interface FileStream {
  filename: string;
  stream?: NodeJS.ReadableStream;
  url?: string;
}

/**
 * Create ZIP stream from file streams or URLs
 * - Uses archiver for ZIP creation
 * - Streams files into ZIP (no buffering)
 * - Returns zip stream for further processing
 * @param fileStreams - Array of file streams or URLs
 * @returns ZIP archive stream
 */
export const createZipStream = async (
  fileStreams: FileStream[]
): Promise<archiver.Archiver> => {
  const zip = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  // Process each file
  for (const file of fileStreams) {
    let fileStream: NodeJS.ReadableStream;

    if (file.stream) {
      // Use provided stream directly
      fileStream = file.stream;
    } else if (file.url) {
      // Download from URL and create stream
      fileStream = await downloadFileAsStream(file.url);
    } else {
      throw new Error(`File ${file.filename} has no stream or URL`);
    }

    // Append file to ZIP archive
    zip.append(fileStream as any, { name: file.filename });
  }

  // Finalize the archive
  zip.finalize();

  return zip;
};

/**
 * Create ZIP stream from Cloudinary URLs
 * Downloads files from URLs and streams into ZIP
 * @param urls - Array of objects with filename and url
 * @returns ZIP archive stream
 */
export const createZipFromUrls = async (
  urls: Array<{ filename: string; url: string }>
): Promise<archiver.Archiver> => {
  const fileStreams: FileStream[] = urls.map((item) => ({
    filename: item.filename,
    url: item.url,
  }));

  return createZipStream(fileStreams);
};
