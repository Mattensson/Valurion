'use server';

import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

        if (file.size > 25 * 1024 * 1024) {
            return { success: false, error: 'Datei zu groß (Max 25MB)' };
        }

        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'de',
        });

        const text = response.text;
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
