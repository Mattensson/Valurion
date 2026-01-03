import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

// GET - Fetch company info for current tenant
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = session.tenantId;

        // Get or create company
        let company = await prisma.company.findUnique({
            where: { tenantId },
            include: {
                news: {
                    orderBy: { researchDate: 'desc' },
                    take: 10
                },
                strategies: {
                    where: { isActive: true },
                    orderBy: { priority: 'desc' }
                }
            }
        });

        // If no company exists, create one
        if (!company) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: { users: true }
            });

            company = await prisma.company.create({
                data: {
                    name: tenant?.name || 'Mein Unternehmen',
                    tenantId,
                    employeeCount: tenant?.users.length || 0
                },
                include: {
                    news: true,
                    strategies: true
                }
            });
        }

        // Update employee count
        const employeeCount = await prisma.user.count({
            where: { tenantId }
        });

        if (company.employeeCount !== employeeCount) {
            company = await prisma.company.update({
                where: { id: company.id },
                data: { employeeCount },
                include: {
                    news: {
                        orderBy: { researchDate: 'desc' },
                        take: 10
                    },
                    strategies: {
                        where: { isActive: true },
                        orderBy: { priority: 'desc' }
                    }
                }
            });
        }

        return NextResponse.json(company);
    } catch (error) {
        console.error('Error fetching company:', error);
        return NextResponse.json(
            { error: 'Failed to fetch company information' },
            { status: 500 }
        );
    }
}

// PUT - Update company info
export async function PUT(req: NextRequest) {
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

        const { name, logo, industry, foundedDate, description } = body;

        // Find existing company
        let company = await prisma.company.findUnique({
            where: { tenantId }
        });

        if (!company) {
            // Create if doesn't exist
            company = await prisma.company.create({
                data: {
                    tenantId,
                    name: name || 'Mein Unternehmen',
                    logo,
                    industry,
                    foundedDate: foundedDate ? new Date(foundedDate) : null,
                    description
                }
            });
        } else {
            // Update existing
            company = await prisma.company.update({
                where: { id: company.id },
                data: {
                    ...(name && { name }),
                    ...(logo !== undefined && { logo }),
                    ...(industry !== undefined && { industry }),
                    ...(foundedDate !== undefined && { foundedDate: foundedDate ? new Date(foundedDate) : null }),
                    ...(description !== undefined && { description })
                }
            });
        }

        return NextResponse.json(company);
    } catch (error) {
        console.error('Error updating company:', error);
        return NextResponse.json(
            { error: 'Failed to update company information' },
            { status: 500 }
        );
    }
}
