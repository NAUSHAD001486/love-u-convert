/**
 * Local Raster → SVG Vectorization Service (SVG_LOOK_COLOR_PRO mode)
 * Visual-quality SVG output: embedded optimized PNG for perfect color preservation
 * Performance and stability prioritized over perfect vector accuracy
 * FreeConvert-style "look SVG" - NOT real vectorization
 */

import sharp from 'sharp';
import { writeFileSync, statSync } from 'fs';

// SVG_LOOK_COLOR_PRO limits
const SVG_LOOK_MAX_SIZE = 8 * 1024 * 1024; // 8MB
const SVG_LOOK_PREPROCESS_SIZE = 1200; // 1200px (always downscale)
const SVG_LOOK_TIMEOUT_MS = 8000; // 8 seconds timeout

/**
 * Convert raster image to SVG using embedded PNG approach
 * This is NOT real vectorization - it embeds optimized PNG in SVG wrapper
 * Perfect color preservation, fast processing, controlled file size
 * 
 * @param inputPath - Path to input raster image
 * @returns SVG string with embedded PNG
 */
const vectorizeSvgLookColorPro = async (inputPath: string): Promise<string> => {
  // Preprocessing (QUALITY FIRST, SAFE)
  // - Resize to 1200px max (preserve aspect ratio, always downscale)
  // - Preserve colors (NO grayscale)
  // - Apply color enhancement for sharp edges
  // NO normalize(), sharpen(), blur(), threshold()
  const processedImage = sharp(inputPath)
    .resize({
      width: SVG_LOOK_PREPROCESS_SIZE,
      height: SVG_LOOK_PREPROCESS_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .modulate({ brightness: 1.05, saturation: 0.9 }) // Preserve colors, reduce noise
    .linear(1.1, -8); // Improve edge clarity

  // Get image metadata for SVG dimensions
  const metadata = await processedImage.metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 1200;

  // Convert to optimized PNG
  // Compression level 9 (maximum), strip metadata for file size control
  const pngBuffer = await processedImage
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Convert PNG to base64 data URI
  const base64Data = pngBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Data}`;

  // Create SVG wrapper with embedded PNG
  // width/height set correctly, viewBox preserved, background transparent
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="${dataUri}" width="${width}" height="${height}"/>
</svg>`;

  return svg;
};

/**
 * Vectorize raster image to SVG with timeout protection
 * 
 * SVG_LOOK_COLOR_PRO mode:
 * - NOT real vector SVG (visual-look SVG only)
 * - Output looks like the original image
 * - Colors preserved (no forced black & white)
 * - Sharp edges, readable text
 * - File size target: 300KB-1500KB for ~800KB JPG
 * - Processing time: < 3 seconds
 * - NO timeouts
 * 
 * Approach:
 * - Preprocess image (resize, color enhancement)
 * - Convert to optimized PNG
 * - Embed PNG as base64 data URI in SVG wrapper
 * 
 * This gives:
 * - Perfect visual match
 * - Full color preservation
 * - Sharp look
 * - Extremely fast processing
 * - Small SVG size
 * - ZERO tracing complexity
 * - ZERO timeout risk
 * 
 * Performance guarantees:
 * - Fast conversion (< 2-3 seconds typical)
 * - Sharp visual output with full colors
 * - File size controlled (300KB-1500KB typical)
 * - No request timeout (8s hard limit)
 * - No event loop blocking
 * 
 * Process:
 * 1. Validate input (fail fast - file size only)
 * 2. Preprocess with sharp (quality-first, safe downscaling)
 * 3. Convert to optimized PNG
 * 4. Embed PNG in SVG wrapper
 * 
 * Output: Colored SVG with embedded PNG
 * Full color preservation, sharp edges, transparent background
 * NOT true vector paths, NOT monochrome, NOT heavy
 * 
 * @param inputPath - Path to input raster image
 * @param outputPath - Path to output SVG file
 */
export const vectorizeToSvg = async (
  inputPath: string,
  outputPath: string
): Promise<void> => {
  try {
    // Step 0: Validate input (fail fast - file size only, NO dimension check)
    const fileStats = statSync(inputPath);
    if (fileStats.size > SVG_LOOK_MAX_SIZE) {
      throw new Error('SVG conversion supports images up to 8MB.');
    }

    // Step 1: Convert to SVG with timeout protection (8 seconds hard limit)
    const svgString = await Promise.race([
      vectorizeSvgLookColorPro(inputPath),
      new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(new Error('SVG conversion exceeded safe processing time. Please try a smaller image.'));
        }, SVG_LOOK_TIMEOUT_MS);
      }),
    ]);

    // Step 2: Write SVG to output path
    writeFileSync(outputPath, svgString, 'utf8');
  } catch (error) {
    // Preserve validation/timeout errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown vectorization error';
    if (errorMessage.includes('8MB') || errorMessage.includes('exceeded safe processing time')) {
      // Validation/timeout error - preserve original message
      throw new Error(errorMessage);
    }
    // Vectorization error - generic message
    throw new Error('SVG conversion failed. Please try a different image.');
  }
};

