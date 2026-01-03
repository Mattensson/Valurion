import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

// PUT - Update strategy
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();

        if (!session?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const tenantId = session.tenantId;
        const strategyId = params.id;
        const body = await req.json();

        // Verify strategy belongs to user's company
        const strategy = await prisma.companyStrategy.findUnique({
            where: { id: strategyId },
            include: { company: true }
        });

        if (!strategy || strategy.company.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        const { title, description, type, priority, isActive } = body;

        const updatedStrategy = await prisma.companyStrategy.update({
            where: { id: strategyId },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(type !== undefined && { type }),
                ...(priority !== undefined && { priority }),
                ...(isActive !== undefined && { isActive })
            }
        });

        return NextResponse.json(updatedStrategy);
    } catch (error) {
        console.error('Error updating strategy:', error);
        return NextResponse.json(
            { error: 'Failed to update strategy' },
            { status: 500 }
        );
    }
}

// DELETE - Delete strategy
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();

        if (!session?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const tenantId = session.tenantId;
        const strategyId = params.id;

        // Verify strategy belongs to user's company
        const strategy = await prisma.companyStrategy.findUnique({
            where: { id: strategyId },
            include: { company: true }
        });

        if (!strategy || strategy.company.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        await prisma.companyStrategy.delete({
            where: { id: strategyId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting strategy:', error);
        return NextResponse.json(
            { error: 'Failed to delete strategy' },
            { status: 500 }
        );
    }
}
