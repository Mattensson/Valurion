import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { stat } from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Directory where chunked uploads are stored
const UPLOAD_DIR = path.join(process.cwd(), 'temp', 'upload-sessions');

// Helper to send SSE messages
function sse(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: any) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

// Transcribe a single file using Whisper, with safety re-encode if too large
async function transcribeSingleFile(filePath: string): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const WHISPER_LIMIT = 24 * 1024 * 1024;
  let actualPath = filePath;

  const st = await stat(filePath);
  if (st.size > WHISPER_LIMIT) {
    const ffmpegModule: any = await import('fluent-ffmpeg');
    const ffmpegCmd = (ffmpegModule as any).default ?? ffmpegModule;
    const reEncoded = filePath.replace(/(\.[^.]+)$/i, '_small$1');
    await new Promise<void>((resolve, reject) => {
      ffmpegCmd(filePath)
        .audioCodec('libmp3lame')
        .audioBitrate('48k')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(reEncoded)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
    actualPath = reEncoded;
  }

  const stream = fs.createReadStream(actualPath);
  const response = await openai.audio.transcriptions.create({
    file: stream as any,
    model: 'whisper-1',
    language: 'de',
  });

  if (actualPath !== filePath) {
    await import('fs/promises').then(fsp => fsp.unlink(actualPath).catch(() => {}));
  }

  return response.text;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get('path') || '';
  const source = searchParams.get('source') === 'RECORDING' ? 'RECORDING' : 'UPLOAD';

  // Validate path: must be inside UPLOAD_DIR
  const normalized = path.normalize(rawPath);
  const allowedPrefix = path.normalize(UPLOAD_DIR) + path.sep;
  if (!normalized.startsWith(allowedPrefix)) {
    return new Response('Invalid path', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Keepalive heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(':ping\n\n'));
      }, 15000);

      const cleanup = async () => {
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      try {
        // Lazy imports to reuse existing helpers
        const { chunkAudioAtPath, cleanupAudioChunks } = await import('@/lib/audio-chunker');
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Always chunk (2MB configured in audio-chunker) to enable early partials
        const st = await stat(normalized);
        const fileSize = st.size;
        let aggregateText = '';
        const { chunks, originalPath } = await chunkAudioAtPath(normalized, fileSize);
        try {
          const total = Math.max(1, chunks.length);
          let completed = 0;
          for (const ch of chunks) {
            const piece = await transcribeSingleFile(ch.path);
            aggregateText += (aggregateText ? ' ' : '') + piece;
            completed += 1;
            sse(controller, 'partial', { textDelta: piece, aggregateText });
            const percent = Math.min(100, Math.round((completed / total) * 100));
            sse(controller, 'progress', { completedChunks: completed, totalChunks: total, percent });
          }
        } finally {
          // Always cleanup of chunks and original temp file
          try { await cleanupAudioChunks(chunks, originalPath); } catch {}
        }

        // Title generation
        let title = 'Neues Transkript';
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'Erstelle einen sehr kurzen Titel (3-6 Wörter) für diesen Text. Antworte nur mit dem Titel ohne Anführungszeichen.' },
              { role: 'user', content: aggregateText.substring(0, 500) }
            ],
            max_tokens: 30
          });
          const maybe = completion.choices[0]?.message?.content;
          if (maybe) title = maybe.trim().replace(/^(\"|\'|\`)|([\"\'\`])$/g, '');
        } catch (e) {
          // ignore title errors
        }

        // Persist
        const transcription = await prisma.transcription.create({
          data: { text: aggregateText, title, source, userId: session.userId }
        });

        sse(controller, 'done', { transcriptionId: transcription.id, text: aggregateText, title });
        await cleanup();
      } catch (err: any) {
        sse(controller, 'error', { message: err?.message || 'Transkription fehlgeschlagen' });
        try { controller.close(); } catch {}
      }
    },
    cancel() {}
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
