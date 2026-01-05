'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

// --- Tenant Management ---

export async function getTenants() {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    // Return all tenants with user count
    return await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { users: true }
            }
        }
    });
}

export async function createTenant(name: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        const tenant = await prisma.tenant.create({
            data: { name }
        });
        revalidatePath('/dashboard/admin/ai-config');
        return { success: true, tenant };
    } catch (e) {
        console.error("Create Tenant Error", e);
        return { success: false, error: 'Fehler beim Erstellen' };
    }
}

export async function updateTenant(id: string, name: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        const tenant = await prisma.tenant.update({
            where: { id },
            data: { name }
        });
        revalidatePath('/dashboard/admin/ai-config');
        return { success: true, tenant };
    } catch (e) {
        console.error("Update Tenant Error", e);
        return { success: false, error: 'Fehler beim Aktualisieren' };
    }
}

export async function deleteTenant(id: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        // Prevent deleting current tenant of the user (safety check)
        if (id === session.tenantId) {
            return { success: false, error: 'Das eigene Unternehmen kann nicht gelöscht werden.' };
        }

        // Clean up data
        // Delete users of tenant
        const users = await prisma.user.findMany({ where: { tenantId: id }, select: { id: true } });
        for (const u of users) {
            // We can reuse deleteUser logic but simpler here:
            // Cascading delete manually for safety
            await prisma.auditLog.deleteMany({ where: { userId: u.id } });
            await prisma.transcription.deleteMany({ where: { userId: u.id } });
            await prisma.document.deleteMany({ where: { userId: u.id } });

            const chats = await prisma.chat.findMany({ where: { userId: u.id }, select: { id: true } });
            await prisma.message.deleteMany({ where: { chatId: { in: chats.map((c: { id: string }) => c.id) } } });
            await prisma.chat.deleteMany({ where: { userId: u.id } });
            await prisma.project.deleteMany({ where: { userId: u.id } });
        }
        await prisma.user.deleteMany({ where: { tenantId: id } });

        // Delete Tenant resources not tied to user if any (AuditLog, Document linked to Tenant directly?)
        // Schema: AuditLog -> Tenant, Document -> Tenant, Chat -> Tenant, Project -> Tenant
        await prisma.auditLog.deleteMany({ where: { tenantId: id } });
        await prisma.document.deleteMany({ where: { tenantId: id } });
        await prisma.message.deleteMany({ where: { chat: { tenantId: id } } });
        await prisma.chat.deleteMany({ where: { tenantId: id } });
        await prisma.project.deleteMany({ where: { tenantId: id } });

        await prisma.tenant.delete({ where: { id } });

        revalidatePath('/dashboard/admin/ai-config');
        return { success: true };
    } catch (e) {
        console.error("Delete Tenant Error", e);
        return { success: false, error: 'Fehler beim Löschen' };
    }
}

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

    // For now, allow both ADMIN and SUPER_ADMIN to see all users to support cross-tenant management
    const whereClause = {};

    return await prisma.user.findMany({
        where: whereClause,
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            company: true,
            role: true,
            createdAt: true,
            tenant: {
                select: {
                    name: true
                }
            }
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
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    tenantId?: string;
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

                tenantId: data.tenantId || session.tenantId,
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
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    tenantId?: string;
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

        if (data.tenantId) {
            updateData.tenantId = data.tenantId;
        }

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
        const chatIds = userChats.map((c: { id: string }) => c.id);
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

export async function getUsersByTenant(tenantId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    return await prisma.user.findMany({
        where: { tenantId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            role: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

export type TokenUsageReport = {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    totalTokens: number;
    usageCount: number;
    lastActive: Date | null;
};

export type TenantTokenUsageReport = {
    tenantId: string;
    name: string;
    totalTokens: number;
    usageCount: number;
    userCount: number;
};

export async function getUserTokenUsage(month?: number, year?: number): Promise<TokenUsageReport[]> {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    const whereClause: any = {};
    if (session.role === 'ADMIN') {
        whereClause.tenantId = session.tenantId;
    }

    let dateFilter: any = {};
    if (month && year) {
        // Month is 1-12
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1); // First day of next month
        dateFilter = {
            timestamp: {
                gte: startDate,
                lt: endDate
            }
        };
    }

    const users = await prisma.user.findMany({
        where: whereClause,
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            auditLogs: {
                where: {
                    action: 'CHAT_INTERACTION',
                    ...dateFilter
                },
                select: {
                    tokenCount: true,
                    timestamp: true
                }
            }
        }
    });

    const report: TokenUsageReport[] = users.map((user: any) => {
        const totalTokens = user.auditLogs.reduce((sum: number, log: any) => sum + (log.tokenCount || 0), 0);
        const usageCount = user.auditLogs.length;

        let lastActive: Date | null = null;
        if (user.auditLogs.length > 0) {
            lastActive = user.auditLogs.reduce((latest: Date | null, current: any) => {
                return (!latest || current.timestamp > latest) ? current.timestamp : latest;
            }, null as Date | null);
        }

        return {
            userId: user.id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            company: user.company || '',
            totalTokens,
            usageCount,
            lastActive
        };
    });

    return report.sort((a, b) => b.totalTokens - a.totalTokens);
}

export async function getTenantTokenUsage(month?: number, year?: number): Promise<TenantTokenUsageReport[]> {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    let dateFilter: any = {};
    if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);
        dateFilter = {
            timestamp: {
                gte: startDate,
                lt: endDate
            }
        };
    }

    // Admins only see their own tenant
    const tenantWhere = session.role === 'ADMIN' ? { id: session.tenantId } : {};

    const tenants = await prisma.tenant.findMany({
        where: tenantWhere,
        select: {
            id: true,
            name: true,
            auditLogs: {
                where: {
                    action: 'CHAT_INTERACTION',
                    ...dateFilter
                },
                select: {
                    tokenCount: true
                }
            },
            users: {
                select: { id: true }
            }
        }
    });

    const report: TenantTokenUsageReport[] = tenants.map((tenant: any) => {
        const totalTokens = tenant.auditLogs.reduce((sum: number, log: any) => sum + (log.tokenCount || 0), 0);
        const usageCount = tenant.auditLogs.length;
        const userCount = tenant.users.length;

        return {
            tenantId: tenant.id,
            name: tenant.name,
            totalTokens,
            usageCount,
            userCount
        };
    });

    return report.sort((a, b) => b.totalTokens - a.totalTokens);
}

// ===== Assistant Management =====

export type AssistantData = {
    id?: string;
    name: string;
    icon: string;
    gradient: string;
    description: string;
    category: string;
    systemPrompt: string;
    provider: string;
    modelId: string;
    temperature: number;
    isActive?: boolean;
    sortOrder?: number;
};

export async function getAssistants() {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    return await prisma.assistant.findMany({
        orderBy: [
            { isActive: 'desc' },
            { sortOrder: 'asc' }
        ]
    });
}

export async function getActiveAssistants() {
    // Public function - anyone can see active assistants
    return await prisma.assistant.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
    });
}

export async function createAssistant(data: AssistantData) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        const assistant = await prisma.assistant.create({
            data: {
                name: data.name,
                icon: data.icon,
                gradient: data.gradient,
                description: data.description,
                category: data.category,
                systemPrompt: data.systemPrompt,
                provider: data.provider,
                modelId: data.modelId,
                temperature: data.temperature,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder ?? 0
            }
        });

        revalidatePath('/dashboard/admin/ai-config');
        revalidatePath('/dashboard/assistants');
        return { success: true, assistant };
    } catch (error) {
        console.error('Failed to create assistant:', error);
        return { success: false, error: 'Fehler beim Erstellen des Assistenten' };
    }
}

export async function updateAssistant(data: AssistantData) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    if (!data.id) {
        return { success: false, error: 'ID erforderlich' };
    }

    try {
        const assistant = await prisma.assistant.update({
            where: { id: data.id },
            data: {
                name: data.name,
                icon: data.icon,
                gradient: data.gradient,
                description: data.description,
                category: data.category,
                systemPrompt: data.systemPrompt,
                provider: data.provider,
                modelId: data.modelId,
                temperature: data.temperature,
                isActive: data.isActive,
                sortOrder: data.sortOrder
            }
        });

        revalidatePath('/dashboard/admin/ai-config');
        revalidatePath('/dashboard/assistants');
        return { success: true, assistant };
    } catch (error) {
        console.error('Failed to update assistant:', error);
        return { success: false, error: 'Fehler beim Aktualisieren des Assistenten' };
    }
}

export async function deleteAssistant(id: string) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
        throw new Error('Unauthorized');
    }

    try {
        await prisma.assistant.delete({
            where: { id }
        });

        revalidatePath('/dashboard/admin/ai-config');
        revalidatePath('/dashboard/assistants');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete assistant:', error);
        return { success: false, error: 'Fehler beim Löschen des Assistenten' };
    }
}
