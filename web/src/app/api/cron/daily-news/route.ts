import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This endpoint should be called by a cron job daily
// Secure it with a secret token
export async function POST(req: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'your-secret-key-change-in-production';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all companies
        const companies = await prisma.company.findMany({
            include: {
                tenant: true
            }
        });

        const results = [];

        for (const company of companies) {
            try {
                // Check if we already have news for today
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const existingNews = await prisma.companyNews.findFirst({
                    where: {
                        companyId: company.id,
                        researchDate: {
                            gte: today
                        }
                    }
                });

                if (existingNews) {
                    results.push({
                        companyId: company.id,
                        companyName: company.name,
                        status: 'skipped',
                        reason: 'Already generated today'
                    });
                    continue;
                }

                // Call the news research API internally
                const newsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/company/news`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // We need to simulate a session - this is a workaround for cron jobs
                        // In production, you might want to refactor the news generation logic into a shared function
                    },
                    body: JSON.stringify({
                        companyId: company.id,
                        companyName: company.name,
                        industry: company.industry
                    })
                });

                if (newsResponse.ok) {
                    results.push({
                        companyId: company.id,
                        companyName: company.name,
                        status: 'success'
                    });
                } else {
                    results.push({
                        companyId: company.id,
                        companyName: company.name,
                        status: 'failed',
                        error: await newsResponse.text()
                    });
                }

            } catch (error) {
                results.push({
                    companyId: company.id,
                    companyName: company.name,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            message: 'Daily news research completed',
            results,
            processedCount: companies.length,
            successCount: results.filter(r => r.status === 'success').length
        });

    } catch (error) {
        console.error('Error in cron job:', error);
        return NextResponse.json(
            { error: 'Cron job failed' },
            { status: 500 }
        );
    }
}

// GET endpoint to check cron job status (for testing)
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companies = await prisma.company.findMany({
        include: {
            news: {
                orderBy: { researchDate: 'desc' },
                take: 1
            }
        }
    });

    return NextResponse.json({
        totalCompanies: companies.length,
        companies: companies.map(c => ({
            id: c.id,
            name: c.name,
            lastNewsDate: c.news[0]?.researchDate || null
        }))
    });
}
