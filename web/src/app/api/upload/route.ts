import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file found" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure directory exists
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = file.name;
        // Simple extension extraction
        const ext = originalName.substring(originalName.lastIndexOf('.') + 1) || 'png';
        const filename = `upload-${uniqueSuffix}.${ext}`;

        const path = join(uploadDir, filename);

        await writeFile(path, buffer);
        console.log(`Uploaded file to ${path}`);

        return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`,
            filename: filename,
            type: file.type
        });
    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
    }
}
