import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const STORAGE_DIR = join(process.cwd(), 'storage', 'documents');

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const docId = params.id;

    const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { sharedWith: { select: { id: true } } }
    });

    if (!doc) {
        return new NextResponse('Document not found', { status: 404 });
    }

    // Access Control
    const isOwner = doc.userId === session.userId;
    const isTenantMatch = doc.tenantId === session.tenantId;
    const isSharedWithMe = doc.sharedWith.some(u => u.id === session.userId);
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isOwner) {
        if (!isTenantMatch) return new NextResponse('Forbidden', { status: 403 });
        if (!isSharedWithMe && !isAdmin) return new NextResponse('Forbidden', { status: 403 });
    }

    const filePath = join(STORAGE_DIR, doc.storagePath);

    if (!existsSync(filePath)) {
        return new NextResponse('File not found on server', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': doc.mimeType,
            'Content-Disposition': `attachment; filename="${doc.filename}"`,
        },
    });
}
