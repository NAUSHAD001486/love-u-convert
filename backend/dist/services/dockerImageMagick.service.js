"use strict";
/**
 * Docker ImageMagick Service
 * Used ONLY for TGA conversion when local ImageMagick is unavailable
 * Docker-based fallback for robust TGA decoding (RLE, indexed, Photoshop TGA)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerTgaToPng = dockerTgaToPng;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Convert TGA to PNG using Docker ImageMagick
 * Uses dpokidov/imagemagick Docker image for robust TGA decoding
 *
 * @param inputPath - Path to input TGA file
 * @param outputPath - Path to output PNG file
 * @throws Error if conversion fails
 */
async function dockerTgaToPng(inputPath, outputPath) {
    try {
        // Get directory and filenames for Docker volume mount
        // Example: inputPath = /Users/.../temp/uploads/abc.tga
        //          workDir = /Users/.../temp/uploads
        //          inputFilename = abc.tga
        //          outputFilename = abc.png
        const workDir = (0, path_1.dirname)(inputPath);
        const inputFilename = (0, path_1.basename)(inputPath);
        const outputFilename = (0, path_1.basename)(outputPath);
        // Ensure outputPath is in the same directory as inputPath
        // This is required for Docker volume mount to work correctly
        const expectedOutputDir = (0, path_1.dirname)(outputPath);
        if (workDir !== expectedOutputDir) {
            throw new Error('TGA input file could not be decoded on this server.');
        }
        // Docker command: docker run --rm -v "<workDir>:/work" dpokidov/imagemagick magick "/work/<inputFilename>" "/work/<outputFilename>"
        // execFile handles arguments properly - each argument is separate, so spaces in filenames are safe
        await execFileAsync('docker', [
            'run',
            '--rm',
            '-v',
            `${workDir}:/work`,
            'dpokidov/imagemagick',
            'magick',
            `/work/${inputFilename}`,
            `/work/${outputFilename}`,
        ], {
            timeout: 30000, // 30 second timeout for Docker conversion
        });
        // Verify PNG file was created at the expected output path
        // Docker writes to /work/<outputFilename> which maps to <workDir>/<outputFilename> = outputPath
        if (!(0, fs_1.existsSync)(outputPath)) {
            throw new Error('TGA input file could not be decoded on this server.');
        }
    }
    catch (error) {
        // Clean error message (no Docker stacktrace)
        throw new Error('TGA input file could not be decoded on this server.');
    }
}
