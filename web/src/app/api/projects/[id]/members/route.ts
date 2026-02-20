import { NextResponse } from 'next/server';
import { PrismaClient, ProjectRole } from '@prisma/client';
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
 * GET /api/projects/[id]/members
 * Get all members of a project
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;

        // Check access
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership) {
            return NextResponse.json(
                { error: 'Project not found or access denied' },
                { status: 404 }
            );
        }

        const members = await prisma.projectMember.findMany({
            where: { projectId },
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
            orderBy: [
                { role: 'asc' },
                { addedAt: 'asc' }
            ]
        });

        return NextResponse.json({ members });

    } catch (error) {
        console.error('Error fetching project members:', error);
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/projects/[id]/members
 * Add a member to a project
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const body = await request.json();
        const { userEmail } = body;

        // Check if current user is owner
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership || membership.role !== ProjectRole.OWNER) {
            return NextResponse.json(
                { error: 'Only project owner can add members' },
                { status: 403 }
            );
        }

        // Find user by email in the same tenant
        const newMember = await prisma.user.findFirst({
            where: {
                email: userEmail,
                tenantId: user.tenantId,
            }
        });

        if (!newMember) {
            return NextResponse.json(
                { error: 'User not found in your company' },
                { status: 404 }
            );
        }

        // Check if already a member
        const existingMembership = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: newMember.id,
                }
            }
        });

        if (existingMembership) {
            return NextResponse.json(
                { error: 'User is already a member of this project' },
                { status: 400 }
            );
        }

        // Add member
        const projectMember = await prisma.projectMember.create({
            data: {
                projectId,
                userId: newMember.id,
                role: ProjectRole.MEMBER,
            },
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
            }
        });

        return NextResponse.json({ member: projectMember }, { status: 201 });

    } catch (error) {
        console.error('Error adding project member:', error);
        return NextResponse.json(
            { error: 'Failed to add member' },
            { status: 500 }
        );
    }
}
