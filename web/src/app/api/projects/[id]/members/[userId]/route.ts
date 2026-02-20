import { NextResponse } from 'next/server';
<parameter name="PrismaClient, ProjectRole } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * Check if user has access to a project
 */
async function checkProjectAccess(userId: string, projectId: string) {
    const membership = await prisma.projectMember.findFirst({
        where: {
            projectId,
            userId,
        }
    });
    return membership;
}

/**
 * DELETE /api/projects/[projectId]/members/[userId]
 * Remove a member from a project
 */
export async function DELETE(
    request: Request,
    { params }: { params: { id: string; userId: string } }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const targetUserId = params.userId;

        // Check if current user is owner
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership || membership.role !== ProjectRole.OWNER) {
            return NextResponse.json(
                { error: 'Only project owner can remove members' },
                { status: 403 }
            );
        }

        // Prevent removing the owner
        const targetMembership = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                }
            }
        });

        if (!targetMembership) {
            return NextResponse.json(
                { error: 'Member not found' },
                { status: 404 }
            );
        }

        if (targetMembership.role === ProjectRole.OWNER) {
            return NextResponse.json(
                { error: 'Cannot remove project owner' },
                { status: 400 }
            );
        }

        // Remove member
        await prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error removing project member:', error);
        return NextResponse.json(
            { error: 'Failed to remove member' },
            { status: 500 }
        );
    }
}
