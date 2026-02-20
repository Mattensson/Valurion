import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
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
        },
        include: {
            project: true,
        }
    });

    return membership;
}

/**
 * GET /api/projects/[id]
 * Get project details
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;

        // Check access
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership) {
            return NextResponse.json(
                { error: 'Project not found or access denied' },
                { status: 404 }
            );
        }

        // Get full project details
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    }
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                avatarUrl: true,
                                jobTitle: true,
                            }
                        }
                    },
                    orderBy: {
                        role: 'asc',
                    }
                },
                documents: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc',
                    }
                },
                projectAssistant: true,
            }
        });

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ project });

    } catch (error) {
        console.error('Error fetching project:', error);
        return NextResponse.json(
            { error: 'Failed to fetch project' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/projects/[id]
 * Update project details
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;
        const body = await request.json();

        // Check if user is owner
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership || membership.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Only project owner can update project' },
                { status: 403 }
            );
        }

        const { name, description, nonGoals } = body;

        const project = await prisma.project.update({
            where: { id: projectId },
            data: {
                name,
                description,
                nonGoals,
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                avatarUrl: true,
                            }
                        }
                    }
                },
                projectAssistant: true,
            }
        });

        return NextResponse.json({ project });

    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json(
            { error: 'Failed to update project' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;

        // Check if user is owner
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership || membership.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Only project owner can delete project' },
                { status: 403 }
            );
        }

        await prisma.project.delete({
            where: { id: projectId },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
