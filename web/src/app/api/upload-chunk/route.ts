import { NextRequest, NextResponse } from 'next/server';
import { mkdir, appendFile, rename, stat } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'temp', 'upload-sessions');

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
    const filename = req.headers.get('x-filename') || 'upload.bin';
    const ext = path.extname(filename);
    const chunkIndex = parseInt(req.headers.get('x-chunk-index') || '0', 10);
    const totalChunks = parseInt(req.headers.get('x-total-chunks') || '1', 10);

    await mkdir(UPLOAD_DIR, { recursive: true });

    const partPath = path.join(UPLOAD_DIR, `${sessionId}.part`);
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await appendFile(partPath, buffer);

    const isFinal = chunkIndex + 1 >= totalChunks;

    if (isFinal) {
      const finalPath = path.join(UPLOAD_DIR, `${sessionId}_original${ext || ''}`);
      await rename(partPath, finalPath);
      const st = await stat(finalPath);
      return NextResponse.json({ success: true, done: true, sessionId, finalPath, size: st.size, filename });
    }

    return NextResponse.json({ success: true, done: false, sessionId });
  } catch (err) {
    console.error('Chunk upload failed', err);
    return NextResponse.json({ success: false, error: 'Chunk upload failed' }, { status: 500 });
  }
}
