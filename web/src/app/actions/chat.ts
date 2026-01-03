'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createChat(title: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const chat = await prisma.chat.create({
        data: {
            title,
            userId: session.userId,
            tenantId: session.tenantId
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
            }
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
