import { NextResponse } from 'next/server';
import { PrismaClient, ProjectRole } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * GET /api/projects
 * Get all projects for the current user (owned or member)
 */
export async function GET(request: Request) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get projects where user is owner or member
        const ownedProjects = await prisma.project.findMany({
            where: {
                userId: user.id,
                tenantId: user.tenantId,
            },
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
                            }
                        }
                    }
                },
                documents: {
                    select: {
                        id: true,
                    }
                },
                projectAssistant: true,
            },
            orderBy: {
                updatedAt: 'desc',
            }
        });

        // Get projects where user is a member
        const memberProjects = await prisma.projectMember.findMany({
            where: {
                userId: user.id,
            },
            include: {
                project: {
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
                                    }
                                }
                            }
                        },
                        documents: {
                            select: {
                                id: true,
                            }
                        },
                        projectAssistant: true,
                    }
                }
            }
        });

        // Combine and deduplicate projects
        const allProjects = [
            ...ownedProjects,
            ...memberProjects.map(mp => mp.project),
        ];

        // Transform data
        const projects = allProjects.map(project => ({
            id: project.id,
            name: project.name,
            description: project.description,
            nonGoals: project.nonGoals,
            owner: project.user,
            members: project.members,
            documentCount: project.documents.length,
            hasAssistant: !!project.projectAssistant,
            assistant: project.projectAssistant,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        }));

        return NextResponse.json({ projects });

    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: Request) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, nonGoals } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // Create project and add creator as owner member
        const project = await prisma.project.create({
            data: {
                name,
                description,
                nonGoals,
                userId: user.id,
                tenantId: user.tenantId,
                members: {
                    create: {
                        userId: user.id,
                        role: ProjectRole.OWNER,
                    }
                }
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

        return NextResponse.json({ project }, { status: 201 });

    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}
