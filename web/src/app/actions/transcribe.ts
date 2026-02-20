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
 * Transcribes a single audio file or chunk
 */
async function transcribeSingleFile(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const file = new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });

    const response = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'de',
    });

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

        if (fileSize <= 25 * 1024 * 1024) {
            // Small file: stream directly without loading whole file in memory
            const stream = fs.createReadStream(filePath);
            const response = await openai.audio.transcriptions.create({
                file: stream as any,
                model: 'whisper-1',
                language: 'de',
            });
            text = response.text;
        } else {
            // Large file: chunk by path
            const { chunks, originalPath } = await chunkAudioAtPath(filePath, fileSize);
            try {
                const transcriptionPromises = chunks.map(chunk => transcribeSingleFile(chunk.path));
                const transcriptions = await Promise.all(transcriptionPromises);
                text = transcriptions.join(' ');
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
