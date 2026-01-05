'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// --- Projects ---

export async function createProject(name: string, description: string, nonGoals: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const project = await prisma.project.create({
        data: {
            name,
            description,
            nonGoals,
            userId: session.userId,
            tenantId: session.tenantId
        }
    });

    revalidatePath('/dashboard/chat');
    return project;
}

export async function updateProject(projectId: string, name: string, description: string, nonGoals: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const project = await prisma.project.update({
        where: { id: projectId, userId: session.userId },
        data: {
            name,
            description,
            nonGoals
        }
    });

    revalidatePath('/dashboard/chat');
    return project;
}

export async function getProjects() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    return await prisma.project.findMany({
        where: {
            userId: session.userId
        },
        orderBy: {
            updatedAt: 'desc'
        },
        include: {
            _count: {
                select: { chats: true }
            }
        }
    });
}

export async function deleteProject(projectId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // Delete project (cascade delete handling should be considered, but for now manual or Prisma handles it if configured)
    // In schema, I didn't add Cascade to Chat relation in Project, so I should probably set Chat.projectId to null or delete chats.
    // Ideally user wants to keep chats? "Außerhalb des Projektes wissen die Chats nichts von diesem Projekt".
    // If project is deleted, maybe chats become "No Project".
    // Or we delete them. Let's assume we delete them for now or unlink.
    // Let's unlink for safety.

    await prisma.chat.updateMany({
        where: { projectId: projectId, userId: session.userId },
        data: { projectId: null }
    });

    await prisma.project.delete({
        where: {
            id: projectId,
            userId: session.userId
        }
    });

    revalidatePath('/dashboard/chat');
}

export async function getProjectDocuments(projectId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    return await prisma.document.findMany({
        where: { projectId: projectId, userId: session.userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true }
    });
}

export async function deleteDocument(documentId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // Ideally remove file from disk too, but for now just DB
    await prisma.document.delete({
        where: { id: documentId, userId: session.userId }
    });

    revalidatePath('/dashboard/chat');
}


// --- Chats ---

export async function createChat(title: string, projectId?: string, provider?: string, mode?: string, assistantId?: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const chat = await prisma.chat.create({
        data: {
            title,
            userId: session.userId,
            tenantId: session.tenantId,
            projectId: projectId || null,
            provider: provider || null,
            mode: mode || null,
            assistantId: assistantId || null
        }
    });

    revalidatePath('/dashboard/chat');
    return chat;
}

export async function getChats() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    return await prisma.chat.findMany({
        where: {
            userId: session.userId
        },
        orderBy: {
            updatedAt: 'desc'
        },
        include: {
            messages: {
                take: 1,
                orderBy: {
                    createdAt: 'asc'
                }
            },
            assistant: {
                select: {
                    id: true,
                    name: true,
                    icon: true,
                    gradient: true
                }
            }
        }
    });
}

export async function getChat(chatId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    return await prisma.chat.findFirst({
        where: {
            id: chatId,
            userId: session.userId
        },
        include: {
            messages: {
                orderBy: {
                    createdAt: 'asc'
                }
            },
            project: true
        }
    });
}

export async function saveMessage(chatId: string, role: 'user' | 'assistant', content: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            userId: session.userId
        }
    });

    if (!chat) throw new Error('Chat not found');

    const message = await prisma.message.create({
        data: {
            chatId,
            role,
            content
        }
    });

    // Update chat's updatedAt
    await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() }
    });

    revalidatePath('/dashboard/chat');
    return message;
}

export async function deleteChat(chatId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    await prisma.chat.deleteMany({
        where: {
            id: chatId,
            userId: session.userId
        }
    });

    revalidatePath('/dashboard/chat');
}
