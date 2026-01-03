import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: filePathParams } = await params;
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...filePathParams);

    if (!existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        if (ext === '.gif') contentType = 'image/gif';
        if (ext === '.svg') contentType = 'image/svg+xml';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, max-age=0', // Dev mode: no cache to see updates instantly? Or cache?
                // For avatars that might change, maybe verify? 
                // But the filename includes timestamp, so it is immutable effectively.
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Error reading file' }, { status: 500 });
    }
}
