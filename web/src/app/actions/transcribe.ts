'use server';

import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { chunkAudioIfNeeded, cleanupAudioChunks, chunkAudioAtPath } from '@/lib/audio-chunker';
import { readFile, stat } from 'fs/promises';
import fs from 'fs';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribes a single audio file or chunk.
 * If the file exceeds 24MB it will be re-encoded to a smaller bitrate first.
 */
async function transcribeSingleFile(filePath: string): Promise<string> {
    const WHISPER_LIMIT = 24 * 1024 * 1024;
    let actualPath = filePath;

    // Safety net: if chunk is still too large, re-encode at lower bitrate
    const fileStats = await stat(filePath);
    if (fileStats.size > WHISPER_LIMIT) {
        console.warn(`Chunk ${filePath} is ${fileStats.size} bytes (>${WHISPER_LIMIT}), re-encoding...`);
        const { default: ffmpegModule } = await import('fluent-ffmpeg') as any;
        const ffmpegCmd = ffmpegModule.default ?? ffmpegModule;
        const reEncodedPath = filePath.replace(/(\.[^.]+)$/, '_small$1');
        await new Promise<void>((resolve, reject) => {
            ffmpegCmd(filePath)
                .audioCodec('libmp3lame')
                .audioBitrate('48k')
                .audioChannels(1)
                .audioFrequency(16000)
                .output(reEncodedPath)
                .on('end', () => resolve())
                .on('error', (err: Error) => reject(err))
                .run();
        });
        actualPath = reEncodedPath;
    }

    const stream = fs.createReadStream(actualPath);
    const response = await openai.audio.transcriptions.create({
        file: stream as any,
        model: 'whisper-1',
        language: 'de',
    });

    // Clean up re-encoded file if created
    if (actualPath !== filePath) {
        await import('fs/promises').then(fsp => fsp.unlink(actualPath).catch(() => {}));
    }

    return response.text;
}

export async function transcribeAudio(formData: FormData) {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, error: 'Nicht authentifiziert' };
        }

        const file = formData.get('file') as File;
        const sourceRaw = formData.get('source') as string;
        const source = sourceRaw === 'RECORDING' ? 'RECORDING' : 'UPLOAD';

        if (!file) {
            return { success: false, error: 'Keine Datei hochgeladen' };
        }

        if (file.size > 1024 * 1024 * 1024) {
            return { success: false, error: 'Datei zu groß (Max 1GB)' };
        }

        let text = '';

        // Check if chunking is needed
        const chunkResult = await chunkAudioIfNeeded(file);

        if (!chunkResult.needsChunking) {
            // Small file - direct transcription
            const response = await openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                language: 'de',
            });
            text = response.text;
        } else {
            // Large file - chunk and transcribe
            const { chunks, originalPath } = chunkResult;

            if (!chunks || !originalPath) {
                return { success: false, error: 'Chunking fehlgeschlagen' };
            }

            try {
                console.log(`Transcribing ${chunks.length} chunks...`);

                // Transcribe all chunks in parallel
                const transcriptionPromises = chunks.map(chunk =>
                    transcribeSingleFile(chunk.path)
                );

                const transcriptions = await Promise.all(transcriptionPromises);

                // Combine all transcriptions
                text = transcriptions.join(' ');

                console.log(`Successfully transcribed ${chunks.length} chunks`);
            } finally {
                // Cleanup temporary files
                await cleanupAudioChunks(chunks, originalPath);
            }
        }
        let title = 'Neues Transkript';

        // Titel generieren
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'Erstelle einen sehr kurzen Titel (3-6 Wörter) für diesen Text. Antworte nur mit dem Titel ohne Anführungszeichen.' },
                    { role: 'user', content: text.substring(0, 500) }
                ],
                max_tokens: 30
            });
            if (completion.choices[0]?.message?.content) {
                title = completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
            }
        } catch (e) {
            console.error('Title generation error', e);
        }

        const transcription = await prisma.transcription.create({
            data: {
                text,
                title,
                source,
                userId: session.userId,
            }
        });

        return { success: true, text, transcription };
    } catch (error: any) {
        console.error('Transcription failed:', error);
        return { success: false, error: error.message || 'Transkription fehlgeschlagen' };
    }
}

/**
 * Transcribe a file that already exists on disk at `filePath`.
 * Use this after a chunked upload to avoid server action body limits.
 */
export async function transcribeFromPath(filePath: string, sourceRaw?: string) {
    try {
        const session = await getSession();
        if (!session) return { success: false, error: 'Nicht authentifiziert' };

        const source = sourceRaw === 'RECORDING' ? 'RECORDING' : 'UPLOAD';

        const st = await stat(filePath);
        const fileSize = st.size;

        let text = '';

        // OpenAI Whisper limit is 25MB. Use 24MB threshold for safety (HTTP overhead).
        const WHISPER_LIMIT = 24 * 1024 * 1024;

        if (fileSize <= WHISPER_LIMIT) {
            // Small file: send directly to Whisper
            const stream = fs.createReadStream(filePath);
            const response = await openai.audio.transcriptions.create({
                file: stream as any,
                model: 'whisper-1',
                language: 'de',
            });
            text = response.text;
        } else {
            // Large file: chunk by path, then transcribe each chunk
            const { chunks, originalPath } = await chunkAudioAtPath(filePath, fileSize);
            try {
                // Process chunks sequentially to avoid rate limits
                const parts: string[] = [];
                for (const chunk of chunks) {
                    const partText = await transcribeSingleFile(chunk.path);
                    parts.push(partText);
                }
                text = parts.join(' ');
            } finally {
                await cleanupAudioChunks(chunks, originalPath);
            }
        }

        let title = 'Neues Transkript';
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'Erstelle einen sehr kurzen Titel (3-6 Wörter) für diesen Text. Antworte nur mit dem Titel ohne Anführungszeichen.' },
                    { role: 'user', content: text.substring(0, 500) }
                ],
                max_tokens: 30
            });
            if (completion.choices[0]?.message?.content) {
                title = completion.choices[0].message.content.trim().replace(/^(["'])|(["'])$/g, '');
            }
        } catch (e) {
            console.error('Title generation error', e);
        }

        const transcription = await prisma.transcription.create({
            data: { text, title, source, userId: session.userId }
        });
        return { success: true, text, transcription };
    } catch (error: any) {
        console.error('Transcription from path failed:', error);
        return { success: false, error: error.message || 'Transkription fehlgeschlagen' };
    }
}

export async function getTranscripts() {
    const session = await getSession();
    if (!session) return [];

    try {
        const transcripts = await prisma.transcription.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return transcripts;
    } catch (error) {
        console.error('Failed to get transcripts', error);
        return [];
    }
}

export async function deleteTranscript(id: string) {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    try {
        await prisma.transcription.delete({
            where: { id, userId: session.userId }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete' };
    }
}
