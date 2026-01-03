import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

// GET - Fetch all strategies for company
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = session.tenantId;

        // Get company
        const company = await prisma.company.findUnique({
            where: { tenantId }
        });

        if (!company) {
            return NextResponse.json({ strategies: [] });
        }

        const strategies = await prisma.companyStrategy.findMany({
            where: { companyId: company.id },
            orderBy: [
                { isActive: 'desc' },
                { priority: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json({ strategies });
    } catch (error) {
        console.error('Error fetching strategies:', error);
        return NextResponse.json(
            { error: 'Failed to fetch strategies' },
            { status: 500 }
        );
    }
}

// POST - Create new strategy
export async function POST(req: NextRequest) {
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
        const body = await req.json();

        const { title, description, type, priority } = body;

        if (!title || !description || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: title, description, type' },
                { status: 400 }
            );
        }

        // Get or create company
        let company = await prisma.company.findUnique({
            where: { tenantId }
        });

        if (!company) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });

            company = await prisma.company.create({
                data: {
                    name: tenant?.name || 'Mein Unternehmen',
                    tenantId
                }
            });
        }

        const strategy = await prisma.companyStrategy.create({
            data: {
                title,
                description,
                type,
                priority: priority || 0,
                companyId: company.id
            }
        });

        return NextResponse.json(strategy);
    } catch (error) {
        console.error('Error creating strategy:', error);
        return NextResponse.json(
            { error: 'Failed to create strategy' },
            { status: 500 }
        );
    }
}
