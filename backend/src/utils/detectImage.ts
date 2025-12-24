import { readFileSync } from 'fs';
import { extname } from 'path';

/**
 * Image detection result
 */
export interface ImageDetectionResult {
  isImage: boolean;
  format?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

/**
 * Detect if a file is an image by reading its content (magic bytes)
 * Supports:
 * - Bitmap formats (PNG, JPEG, GIF, WEBP, etc.) via file-type
 * - Vector formats (SVG, EPS) via content inspection
 * - TIFF files via extension
 * - ICO files
 * - PSD files
 * - Screenshots
 * - Renamed files (content-based detection, not extension-based)
 * 
 * @param filePath - Path to the file on disk
 * @returns Detection result with image information
 */
export const detectImage = async (filePath: string): Promise<ImageDetectionResult> => {
  try {
    // Get file extension for vector format detection
    const ext = extname(filePath).toLowerCase().slice(1); // Remove leading dot
    
    // Vector format detection (SVG, EPS)
    if (ext === 'svg' || ext === 'eps') {
      const fileContent = readFileSync(filePath, 'utf8');
      
      if (ext === 'svg') {
        // SVG valid if starts with "<svg" OR contains "<svg"
        const isSvg = fileContent.trim().startsWith('<svg') || fileContent.includes('<svg');
        if (isSvg) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Detected vector image (svg)');
          }
          return {
            isImage: true,
            format: 'svg',
            mimeType: 'image/svg+xml',
          };
        }
      } else if (ext === 'eps') {
        // EPS valid if starts with "%!PS-Adobe"
        const isEps = fileContent.trim().startsWith('%!PS-Adobe');
        if (isEps) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Detected vector image (eps)');
          }
          return {
            isImage: true,
            format: 'eps',
            mimeType: 'application/postscript',
          };
        }
      }
    }
    
    // TIFF detection via extension (tif, tiff)
    if (ext === 'tif' || ext === 'tiff') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Detected tiff image');
      }
      return {
        isImage: true,
        format: 'tiff',
        mimeType: 'image/tiff',
      };
    }
    
    // Bitmap format detection using file-type (magic bytes)
    // Read first bytes for magic byte detection (file-type needs at least 4100 bytes for some formats)
    const fullBuffer = readFileSync(filePath);
    const buffer = fullBuffer.slice(0, Math.min(4100, fullBuffer.length));
    
    // Use file-type to detect image from content
    const { fileTypeFromBuffer } = await import('file-type');
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      return {
        isImage: false,
      };
    }
    
    // Check if detected MIME type is an image
    const isImage = fileType.mime.startsWith('image/');
    
    if (!isImage) {
      return {
        isImage: false,
        mimeType: fileType.mime,
      };
    }
    
    // Extract format from MIME type or extension
    let format: string | undefined;
    if (fileType.ext) {
      format = fileType.ext;
    } else if (fileType.mime) {
      // Extract format from MIME type (e.g., "image/png" -> "png")
      const mimeParts = fileType.mime.split('/');
      if (mimeParts.length === 2) {
        format = mimeParts[1].split('+')[0]; // Handle "image/svg+xml" -> "svg"
      }
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Detected bitmap image');
    }
    
    // Try to get dimensions using image-size if available
    // For now, we'll just return the format and let Cloudinary handle dimensions
    let width: number | undefined;
    let height: number | undefined;
    
    try {
      // Try to read more bytes for dimension detection if needed
      // For most formats, file-type is sufficient
      // Dimensions can be extracted later by Cloudinary if needed
    } catch {
      // Dimension detection is optional
    }
    
    return {
      isImage: true,
      format,
      mimeType: fileType.mime,
      width,
      height,
    };
  } catch (error) {
    console.error('Image detection error:', error);
    return {
      isImage: false,
    };
  }
};

/**
 * Detect image from buffer (for streaming scenarios)
 * @param buffer - File buffer (first bytes)
 * @returns Detection result
 */
export const detectImageFromBuffer = async (buffer: Buffer): Promise<ImageDetectionResult> => {
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      return {
        isImage: false,
      };
    }
    
    const isImage = fileType.mime.startsWith('image/');
    
    if (!isImage) {
      return {
        isImage: false,
        mimeType: fileType.mime,
      };
    }
    
    let format: string | undefined;
    if (fileType.ext) {
      format = fileType.ext;
    } else if (fileType.mime) {
      const mimeParts = fileType.mime.split('/');
      if (mimeParts.length === 2) {
        format = mimeParts[1].split('+')[0];
      }
    }
    
    return {
      isImage: true,
      format,
      mimeType: fileType.mime,
    };
  } catch (error) {
    console.error('Image detection from buffer error:', error);
    return {
      isImage: false,
    };
  }
};

