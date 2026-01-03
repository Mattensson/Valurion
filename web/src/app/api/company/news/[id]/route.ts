import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

// DELETE - Delete a news entry
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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
        const { id: newsId } = await params;

        console.log('Deleting news:', newsId);

        // Verify news belongs to user's company
        const news = await prisma.companyNews.findUnique({
            where: { id: newsId },
            include: { company: true }
        });

        if (!news || news.company.tenantId !== tenantId) {
            return NextResponse.json({ error: 'News not found' }, { status: 404 });
        }

        // Delete the news
        await prisma.companyNews.delete({
            where: { id: newsId }
        });

        console.log('News deleted successfully:', newsId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting news:', error);
        return NextResponse.json(
            { error: 'Failed to delete news' },
            { status: 500 }
        );
    }
}
