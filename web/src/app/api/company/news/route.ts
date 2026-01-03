import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

// POST - Trigger news research for company
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = session.tenantId;

        // Get company
        let company = await prisma.company.findUnique({
            where: { tenantId }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

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
            return NextResponse.json({
                message: 'News already generated for today',
                news: existingNews
            });
        }

        // Perform web search and AI analysis
        const newsData = await performNewsResearch(company.name, company.industry);

        // Save to database
        const news = await prisma.companyNews.create({
            data: {
                title: newsData.title,
                summary: newsData.summary,
                sourceUrls: newsData.sourceUrls,
                rawData: newsData.rawData,
                companyId: company.id,
                researchDate: new Date()
            }
        });

        return NextResponse.json(news);
    } catch (error) {
        console.error('Error generating company news:', error);
        return NextResponse.json(
            { error: 'Failed to generate company news' },
            { status: 500 }
        );
    }
}

// GET - Fetch latest news
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
            return NextResponse.json({ news: [] });
        }

        const news = await prisma.companyNews.findMany({
            where: { companyId: company.id },
            orderBy: { researchDate: 'desc' },
            take: 30 // Last 30 days
        });

        return NextResponse.json({ news });
    } catch (error) {
        console.error('Error fetching company news:', error);
        return NextResponse.json(
            { error: 'Failed to fetch company news' },
            { status: 500 }
        );
    }
}

// Helper function to perform news research using Tavily
async function performNewsResearch(companyName: string, industry?: string | null) {
    try {
        // Initialize Tavily
        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (!tavilyApiKey) {
            throw new Error('TAVILY_API_KEY not configured');
        }

        // Create search query
        const searchQuery = industry
            ? `${companyName} ${industry} aktuelle Nachrichten Trends Entwicklungen`
            : `${companyName} aktuelle Nachrichten Trends Entwicklungen`;

        console.log('🔍 Searching with Tavily:', searchQuery);

        // Perform search using fetch API
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: tavilyApiKey,
                query: searchQuery,
                search_depth: 'advanced',
                max_results: 5,
                include_answer: true,
                include_raw_content: false
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
        }

        const searchResults = await response.json();

        console.log('✅ Tavily search completed');

        // Extract sources
        const sourceUrls = searchResults.results.map((result: any) => result.url);

        // Build raw content for AI summarization
        let rawContent = '';

        if (searchResults.answer) {
            rawContent += `Tavily Zusammenfassung: ${searchResults.answer}\n\n`;
        }

        rawContent += 'Gefundene Artikel:\n\n';
        searchResults.results.forEach((result: any, index: number) => {
            rawContent += `${index + 1}. ${result.title}\n`;
            rawContent += `   ${result.content}\n`;
            rawContent += `   URL: ${result.url}\n\n`;
        });

        // Use Gemini to create a concise, structured summary
        const geminiApiKey = process.env.GEMINI_API_KEY;
        let summary = '';
        let title = '';

        if (geminiApiKey) {
            try {
                console.log('🤖 Summarizing with Gemini...');

                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Erstelle eine prägnante, professionelle Zusammenfassung der folgenden Recherche-Ergebnisse über das Unternehmen "${companyName}"${industry ? ` (Branche: ${industry})` : ''}.

RECHERCHE-ERGEBNISSE:
${rawContent}

AUFGABE:
1. Erstelle einen aussagekräftigen Titel (max. 80 Zeichen)
2. Fasse die wichtigsten 3-5 Erkenntnisse zusammen
3. Strukturiere die Zusammenfassung in klare Bulletpoints
4. Fokussiere auf: Aktuelle Entwicklungen, Trends, wichtige News
5. Halte es kompakt und leicht lesbar (max. 500 Wörter)

FORMAT (JSON):
{
  "title": "Kurzer, aussagekräftiger Titel",
  "summary": "• Erkenntnis 1\\n• Erkenntnis 2\\n• Erkenntnis 3\\n..."
}`
                                }]
                            }],
                            generationConfig: {
                                temperature: 0.3,
                                maxOutputTokens: 1024,
                            }
                        })
                    }
                );

                if (geminiResponse.ok) {
                    const geminiData = await geminiResponse.json();
                    const geminiText = geminiData.candidates[0]?.content?.parts[0]?.text || '';

                    // Try to parse JSON from response
                    try {
                        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            title = parsed.title || '';
                            summary = parsed.summary || '';
                        }
                    } catch (e) {
                        // If JSON parsing fails, use the text as-is
                        summary = geminiText;
                    }

                    console.log('✅ Gemini summarization completed');
                }
            } catch (geminiError) {
                console.error('Gemini summarization failed:', geminiError);
                // Fall back to basic summary if Gemini fails
            }
        }

        // Fallback if Gemini didn't work or no API key
        if (!summary) {
            summary = '**Wichtigste Erkenntnisse:**\n\n';
            searchResults.results.slice(0, 3).forEach((result: any, index: number) => {
                summary += `• **${result.title}**\n  ${result.content.substring(0, 150)}...\n\n`;
            });
        }

        if (!title) {
            title = industry
                ? `Aktuelle Entwicklungen: ${companyName} (${industry})`
                : `Aktuelle Informationen zu ${companyName}`;
        }

        return {
            title,
            summary: summary.trim(),
            sourceUrls,
            rawData: JSON.stringify(searchResults, null, 2)
        };

    } catch (error) {
        console.error('Error in Tavily news research:', error);

        // Fallback response
        return {
            title: `Informationen zu ${companyName}`,
            summary: `Automatische Recherche konnte nicht durchgeführt werden. Fehler: ${error instanceof Error ? error.message : 'Unknown error'}\n\nBitte stellen Sie sicher, dass TAVILY_API_KEY in der .env Datei konfiguriert ist.`,
            sourceUrls: [],
            rawData: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
        };
    }
}
