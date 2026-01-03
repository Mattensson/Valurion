'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export async function getAIConfigurations() {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    return await prisma.aIModelConfig.findMany();
}

export type AIConfigUpdate = {
    provider: string;
    mode: string;
    modelId: string;
};

export async function updateAIConfiguration(updates: AIConfigUpdate[]) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        for (const update of updates) {
            await prisma.aIModelConfig.upsert({
                where: {
                    provider_mode: {
                        provider: update.provider,
                        mode: update.mode,
                    },
                },
                update: {
                    modelId: update.modelId,
                },
                create: {
                    provider: update.provider,
                    mode: update.mode,
                    modelId: update.modelId,
                },
            });
        }
        revalidatePath('/dashboard/admin/ai-config');
        return { success: true };
    } catch (error) {
        console.error('Failed to update AI config:', error);
        return { success: false, error: 'Update failed' };
    }
}

// User Management Functions
export async function getAllUsers() {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    return await prisma.user.findMany({
        where: {
            tenantId: session.tenantId,
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            company: true,
            role: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

export type CreateUserData = {
    email: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    company?: string;
    password: string;
    role: 'USER' | 'ADMIN';
};

export async function createUser(data: CreateUserData) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        const normalizedEmail = data.email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            return { success: false, error: 'Ein Benutzer mit dieser E-Mail existiert bereits' };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                firstName: data.firstName,
                lastName: data.lastName,
                jobTitle: data.jobTitle,
                company: data.company,
                passwordHash,
                role: data.role,
                tenantId: session.tenantId,
            },
        });

        revalidatePath('/dashboard/admin/ai-config');
        return { success: true, userId: user.id };
    } catch (error) {
        console.error('Failed to create user:', error);
        return { success: false, error: 'Fehler beim Erstellen des Benutzers' };
    }
}

export type UpdateUserData = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    company?: string;
    password?: string;
    role: 'USER' | 'ADMIN';
};

export async function updateUserAsAdmin(data: UpdateUserData) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        const updateData: any = {
            email: data.email.toLowerCase().trim(),
            firstName: data.firstName,
            lastName: data.lastName,
            jobTitle: data.jobTitle,
            company: data.company,
            role: data.role,
        };

        if (data.password && data.password.trim() !== '') {
            updateData.passwordHash = await bcrypt.hash(data.password, 10);
        }

        await prisma.user.update({
            where: { id: data.id },
            data: updateData,
        });

        revalidatePath('/dashboard/admin/ai-config');
        return { success: true };
    } catch (error) {
        console.error('Failed to update user:', error);
        return { success: false, error: 'Fehler beim Aktualisieren des Benutzers' };
    }
}

export async function deleteUser(userId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        // Prevent deleting self
        if (userId === session.userId) {
            return { success: false, error: 'Sie können sich nicht selbst löschen' };
        }

        // Check if user exists and belongs to tenant
        const user = await prisma.user.findFirst({
            where: {
                id: userId,
                tenantId: session.tenantId
            }
        });

        if (!user) {
            return { success: false, error: 'Benutzer nicht gefunden' };
        }

        // Delete related data first (Cascade is usually set in Prisma Schema but explicit is safer or if schema differs)
        // Assuming schema has Cascade delete or we need to handle it.
        // For now, simple delete which might fail if constraints exist without cascade.
        // Checking schema: Message->Chat->User. Chat->User is OK. 
        // AuditLog->User. Document->User. Transcription->User.
        // Prisma usually handles cascade if defined in schema relations with onDelete: Cascade
        // In the schema provided earlier:
        // Message has onDelete: Cascade for Chat. 
        // Chat belongs to User but no onDelete specified on User relation? 
        // Wait, schema check:
        // model Chat { user      User     @relation(fields: [userId], references: [id]) ... }
        // No onDelete: Cascade on user relations. This will throw error!
        // I should probably manually delete or update the schema.
        // Updating schema is risky without migration tool access (I have no terminal access to run prisma migrate).
        // I will implement "Cascading Delete" manually here for safety.

        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.transcription.deleteMany({ where: { userId } });
        await prisma.document.deleteMany({ where: { userId } });

        // Delete chats and their messages
        const userChats = await prisma.chat.findMany({ where: { userId }, select: { id: true } });
        const chatIds = userChats.map(c => c.id);
        await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
        await prisma.chat.deleteMany({ where: { userId } });

        // Finally delete user
        await prisma.user.delete({
            where: { id: userId }
        });

        revalidatePath('/dashboard/admin/ai-config');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete user:', error);
        return { success: false, error: 'Fehler beim Löschen des Benutzers' };
    }
}
