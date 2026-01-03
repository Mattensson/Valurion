'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const STORAGE_DIR = join(process.cwd(), 'storage', 'documents');

// Ensure storage directory exists
async function ensureStorage() {
    try {
        await mkdir(STORAGE_DIR, { recursive: true });
    } catch (e) {
        // ignore if exists
    }
}

export type DocumentDTO = {
    id: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    uploaderName?: string;
    uploaderId: string;
    sharedWithCount?: number; // For UI to show "Shared with 3 people"
};

export type UserDTO = {
    id: string;
    email: string;
    name: string;
};

export async function getDocuments() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // My documents: userId is Me
    const myDocs = await prisma.document.findMany({
        where: {
            userId: session.userId,
            tenantId: session.tenantId,
        },
        include: {
            sharedWith: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' },
    });

    // Shared with me: I am in sharedWith list
    const sharedWithMeDocs = await prisma.document.findMany({
        where: {
            tenantId: session.tenantId,
            sharedWith: {
                some: { id: session.userId }
            }
        },
        include: {
            user: {
                select: { firstName: true, lastName: true, email: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    return {
        myDocuments: myDocs.map(d => ({
            ...d,
            uploaderId: d.userId,
            uploaderName: 'Me',
            sharedWithCount: d.sharedWith.length
        })),
        sharedDocuments: sharedWithMeDocs.map(d => ({
            ...d,
            uploaderId: d.userId,
            uploaderName: d.user.firstName ? `${d.user.firstName} ${d.user.lastName}` : d.user.email,
            sharedWithCount: 0 // Not relevant for "shared with me" view typically, or could fetch.
        }))
    };
}

export async function uploadDocument(formData: FormData) {
    const session = await getSession();
    if (!session) return { error: 'Unauthorized' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    await ensureStorage();
    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueId = randomUUID();
    const ext = file.name.split('.').pop();
    const storageFilename = `${uniqueId}.${ext}`;
    const storagePath = join(STORAGE_DIR, storageFilename);

    try {
        await writeFile(storagePath, buffer);

        await prisma.document.create({
            data: {
                filename: file.name,
                fileSize: file.size,
                mimeType: file.type,
                storagePath: storageFilename,
                userId: session.userId,
                tenantId: session.tenantId,
            }
        });

        revalidatePath('/dashboard/docs');
        return { success: true };
    } catch (error) {
        console.error('Upload error:', error);
        return { error: 'Upload failed' };
    }
}

export async function deleteDocument(documentId: string) {
    const session = await getSession();
    if (!session) return { error: 'Unauthorized' };

    const doc = await prisma.document.findUnique({
        where: { id: documentId }
    });

    if (!doc) return { error: 'Document not found' };

    const isOwner = doc.userId === session.userId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
        return { error: 'Access denied' };
    }

    try {
        const filePath = join(STORAGE_DIR, doc.storagePath);
        try {
            await unlink(filePath);
        } catch (e) {
            console.warn('File not found on disk, deleting DB record anyway');
        }

        await prisma.document.delete({
            where: { id: documentId }
        });

        revalidatePath('/dashboard/docs');
        return { success: true };
    } catch (error) {
        return { error: 'Delete failed' };
    }
}

// --- Sharing Actions ---

/**
 * Get users that a document is shared with
 */
export async function getDocumentShares(documentId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            sharedWith: {
                select: { id: true, email: true, firstName: true, lastName: true }
            }
        }
    });

    if (!doc) throw new Error('Document not found');
    if (doc.userId !== session.userId && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
        throw new Error('Access Denied');
    }

    return doc.sharedWith.map(u => ({
        id: u.id,
        email: u.email,
        name: u.firstName ? `${u.firstName} ${u.lastName}` : u.email
    }));
}

/**
 * Search users in the same tenant to share with
 */
export async function searchUsersForSharing(query: string) {
    const session = await getSession();
    if (!session) return [];

    const users = await prisma.user.findMany({
        where: {
            tenantId: session.tenantId,
            id: { not: session.userId }, // Exclude self
            OR: [
                { email: { contains: query, mode: 'insensitive' } },
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } }
            ]
        },
        select: { id: true, email: true, firstName: true, lastName: true },
        take: 5
    });

    return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.firstName ? `${u.firstName} ${u.lastName}` : u.email
    }));
}

/**
 * Share document with a specific user
 */
export async function shareDocument(documentId: string, targetUserId: string) {
    const session = await getSession();
    if (!session) return { error: 'Unauthorized' };

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== session.userId) return { error: 'Access denied' };

    try {
        await prisma.document.update({
            where: { id: documentId },
            data: {
                sharedWith: {
                    connect: { id: targetUserId }
                }
            }
        });
        revalidatePath('/dashboard/docs');
        return { success: true };
    } catch (e) {
        return { error: 'Share failed' };
    }
}

/**
 * Unshare document with a specific user
 */
export async function unshareDocument(documentId: string, targetUserId: string) {
    const session = await getSession();
    if (!session) return { error: 'Unauthorized' };

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== session.userId) return { error: 'Access denied' };

    try {
        await prisma.document.update({
            where: { id: documentId },
            data: {
                sharedWith: {
                    disconnect: { id: targetUserId }
                }
            }
        });
        revalidatePath('/dashboard/docs');
        return { success: true };
    } catch (e) {
        return { error: 'Unshare failed' };
    }
}
