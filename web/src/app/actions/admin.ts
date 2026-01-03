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
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            return { success: false, error: 'Ein Benutzer mit dieser E-Mail existiert bereits' };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: data.email,
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
            email: data.email,
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
