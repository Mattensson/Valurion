import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
const pdf = require('pdf-parse');

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const projectId: string | null = data.get('projectId') as string;

        if (!file || !projectId) {
            return NextResponse.json({ success: false, error: "Missing file or projectId" }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId, userId: session.userId }
        });

        if (!project) {
            return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
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
        const ext = originalName.substring(originalName.lastIndexOf('.') + 1) || 'bin';
        const filename = `project-${projectId}-${uniqueSuffix}.${ext}`;
        const path = join(uploadDir, filename);

        await writeFile(path, buffer);

        // Text Extraction
        let parsedContent = "";
        try {
            if (file.type === 'application/pdf' || ext.toLowerCase() === 'pdf') {
                const data = await pdf(buffer);
                parsedContent = data.text;
            } else if (
                file.type.startsWith('text/') ||
                ['md', 'txt', 'json', 'csv', 'js', 'ts', 'tsx', 'jsx', 'html', 'css'].includes(ext.toLowerCase())
            ) {
                parsedContent = buffer.toString('utf-8');
            }
        } catch (e) {
            console.error("Text extraction failed", e);
            parsedContent = ""; // Fail gracefully
        }

        // Save to DB
        const doc = await prisma.document.create({
            data: {
                filename: originalName,
                fileSize: file.size,
                mimeType: file.type,
                storagePath: `/uploads/${filename}`,
                parsedContent: parsedContent || null,
                userId: session.userId,
                tenantId: session.tenantId,
                projectId: projectId
            }
        });

        return NextResponse.json({
            success: true,
            document: doc
        });
    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
    }
}
