import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${session.userId}-${Date.now()}${path.extname(file.name)}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads/avatars');

    // Ensure filename is safe (basic check)
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    try {
        await writeFile(path.join(uploadDir, filename), buffer);
        const fileUrl = `/api/file/avatars/${filename}`;
        return NextResponse.json({ url: fileUrl });
    } catch (error) {
        console.error('Upload failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
