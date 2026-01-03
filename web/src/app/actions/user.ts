'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateUserDetails(userId: string, data: { firstName?: string; lastName?: string; jobTitle?: string; avatarUrl?: string }) {
    const session = await getSession();
    if (!session || session.userId !== userId) {
        console.error('Unauthorized access attempt:', { session, userId });
        throw new Error('Unauthorized');
    }

    try {
        console.log(`Updating user ${userId} with data:`, data);
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                jobTitle: data.jobTitle,
                avatarUrl: data.avatarUrl,
            },
        });
        console.log('User updated successfully:', updatedUser);
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to update user:', error);
        return { success: false, error: 'Update failed' };
    }
}
