import ffmpeg from 'fluent-ffmpeg';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Lazy configuration for ffmpeg/ffprobe paths to avoid Turbopack static resolution issues
let ffmpegConfigured = false;
async function configureFFmpegPaths(): Promise<void> {
    if (ffmpegConfigured) return;
    try {
        const ffmpegStaticMod: any = await import('ffmpeg-static');
        const ffprobeStaticMod: any = await import('ffprobe-static');

        let ffmpegPath: string | undefined = ffmpegStaticMod?.default ?? ffmpegStaticMod;
        let ffprobePath: string | undefined = ffprobeStaticMod?.path ?? ffprobeStaticMod?.default?.path;

        // Fix the \ROOT\ prefix bug (Windows path issue)
        if (typeof ffmpegPath === 'string' && ffmpegPath.startsWith('\\ROOT\\')) {
            const relativePath = ffmpegPath.substring(6);
            ffmpegPath = path.join(process.cwd(), relativePath);
        }
        if (typeof ffprobePath === 'string' && ffprobePath.startsWith('\\ROOT\\')) {
            const relativePath = ffprobePath.substring(6);
            ffprobePath = path.join(process.cwd(), relativePath);
        }

        if (ffmpegPath && existsSync(ffmpegPath)) {
            ffmpeg.setFfmpegPath(ffmpegPath);
            console.log('✓ FFmpeg path set:', ffmpegPath);
        } else if (ffmpegPath) {
            console.warn('FFmpeg binary not found at:', ffmpegPath);
        }

        if (ffprobePath && existsSync(ffprobePath)) {
            ffmpeg.setFfprobePath(ffprobePath);
            console.log('✓ FFprobe path set:', ffprobePath);
        } else if (ffprobePath) {
            console.warn('FFprobe binary not found at:', ffprobePath);
        }
    } catch (error) {
        console.warn('FFmpeg/FFprobe static binaries not found; relying on system binaries.', error);
    } finally {
        ffmpegConfigured = true;
    }
}

const CHUNK_SIZE_MB = 20; // Target 20MB per chunk (safe margin under 25MB limit)
const TEMP_DIR = path.join(process.cwd(), 'temp', 'audio-chunks');

interface AudioChunk {
    path: string;
    index: number;
    duration: number;
}

/**
 * Ensures the temp directory exists
 */
async function ensureTempDir(): Promise<void> {
    if (!existsSync(TEMP_DIR)) {
        await mkdir(TEMP_DIR, { recursive: true });
    }
}

/**
 * Gets audio file metadata using ffmpeg
 */
async function getAudioMetadata(filePath: string): Promise<{ duration: number; bitrate: number }> {
    await configureFFmpegPaths();
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const duration = metadata.format.duration || 0;
            const bitrate = metadata.format.bit_rate || 128000; // Default fallback

            resolve({ duration, bitrate });
        });
    });
}

/**
 * Calculates optimal chunk duration based on file size and bitrate
 */
function calculateChunkDuration(fileSize: number, bitrate: number, totalDuration: number): number {
    // Calculate bytes per second
    const bytesPerSecond = bitrate / 8;

    // Target chunk size in bytes
    const targetChunkBytes = CHUNK_SIZE_MB * 1024 * 1024;

    // Calculate chunk duration in seconds
    const chunkDuration = targetChunkBytes / bytesPerSecond;

    // Make sure we don't create chunks longer than the total duration
    return Math.min(chunkDuration, totalDuration);
}

/**
 * Splits an audio file into chunks
 */
async function splitAudioFile(
    inputPath: string,
    chunkDuration: number,
    totalDuration: number,
    sessionId: string
): Promise<AudioChunk[]> {
    await configureFFmpegPaths();
    const chunks: AudioChunk[] = [];
    let currentTime = 0;
    let index = 0;

    while (currentTime < totalDuration) {
        const actualDuration = Math.min(chunkDuration, totalDuration - currentTime);
        const outputPath = path.join(TEMP_DIR, `${sessionId}_chunk_${index}.mp3`);

        await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
                .setStartTime(currentTime)
                .setDuration(actualDuration)
                .output(outputPath)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        chunks.push({
            path: outputPath,
            index,
            duration: actualDuration
        });

        currentTime += actualDuration;
        index++;
    }

    return chunks;
}

/**
 * Cleans up temporary chunk files
 */
async function cleanupChunks(chunks: AudioChunk[], originalPath: string): Promise<void> {
    const deletePromises = chunks.map(chunk =>
        unlink(chunk.path).catch(err => console.error(`Failed to delete chunk ${chunk.path}:`, err))
    );

    // Also delete original temp file
    deletePromises.push(
        unlink(originalPath).catch(err => console.error(`Failed to delete original ${originalPath}:`, err))
    );

    await Promise.all(deletePromises);
}

/**
 * Main function: chunks an audio file if needed
 * Returns null if file is small enough, or an array of chunk paths if chunking was needed
 */
export async function chunkAudioIfNeeded(file: File): Promise<{
    needsChunking: boolean;
    chunks?: AudioChunk[];
    originalPath?: string;
    sessionId?: string;
}> {
    const fileSize = file.size;

    // If file is under 25MB, no chunking needed
    if (fileSize <= 25 * 1024 * 1024) {
        return { needsChunking: false };
    }

    // Create temp directory
    await ensureTempDir();

    // Save file temporarily
    const sessionId = randomUUID();
    const tempFilePath = path.join(TEMP_DIR, `${sessionId}_original${path.extname(file.name)}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    try {
        // Get audio metadata
        const { duration, bitrate } = await getAudioMetadata(tempFilePath);

        // Calculate optimal chunk duration
        const chunkDuration = calculateChunkDuration(fileSize, bitrate, duration);

        // Split the file
        const chunks = await splitAudioFile(tempFilePath, chunkDuration, duration, sessionId);

        return {
            needsChunking: true,
            chunks,
            originalPath: tempFilePath,
            sessionId
        };
    } catch (error) {
        // Cleanup on error
        await unlink(tempFilePath).catch(() => { });
        throw error;
    }
}

/**
 * Cleanup function to be called after processing
 */
export async function cleanupAudioChunks(chunks: AudioChunk[], originalPath: string): Promise<void> {
    await cleanupChunks(chunks, originalPath);
}

/**
 * Helper to chunk an already-stored audio file at a given path.
 * Use when the file was uploaded in chunks to disk and we want to process it
 * without loading the entire original into memory.
 */
export async function chunkAudioAtPath(filePath: string, fileSize: number): Promise<{
    needsChunking: true;
    chunks: AudioChunk[];
    originalPath: string;
    sessionId: string;
}> {
    await ensureTempDir();
    const sessionId = randomUUID();
    const { duration, bitrate } = await getAudioMetadata(filePath);
    const chunkDuration = calculateChunkDuration(fileSize, bitrate, duration);
    const chunks = await splitAudioFile(filePath, chunkDuration, duration, sessionId);
    return {
        needsChunking: true,
        chunks,
        originalPath: filePath,
        sessionId,
    };
}
