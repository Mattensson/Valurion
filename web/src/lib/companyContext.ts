import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get company strategy context for RAG (Retrieval Augmented Generation)
 * This context will be injected into AI prompts for chats and protocol generation
 */
export async function getCompanyStrategyContext(tenantId: string): Promise<string> {
    try {
        // Get company
        const company = await prisma.company.findUnique({
            where: { tenantId },
            include: {
                strategies: {
                    where: { isActive: true },
                    orderBy: { priority: 'desc' }
                }
            }
        });

        if (!company || company.strategies.length === 0) {
            return '';
        }

        // Build context string
        let context = `\n\n## UNTERNEHMENSKONTEXT: ${company.name}\n\n`;

        if (company.description) {
            context += `**Unternehmensbeschreibung:**\n${company.description}\n\n`;
        }

        // Group strategies by type
        const goals = company.strategies.filter(s => s.type === 'GOAL');
        const strategies = company.strategies.filter(s => s.type === 'STRATEGY');
        const initiatives = company.strategies.filter(s => s.type === 'INITIATIVE');
        const values = company.strategies.filter(s => s.type === 'VALUE');

        if (goals.length > 0) {
            context += `**Unternehmensziele:**\n`;
            goals.forEach(goal => {
                context += `- ${goal.title}: ${goal.description}\n`;
            });
            context += '\n';
        }

        if (strategies.length > 0) {
            context += `**Strategien:**\n`;
            strategies.forEach(strategy => {
                context += `- ${strategy.title}: ${strategy.description}\n`;
            });
            context += '\n';
        }

        if (initiatives.length > 0) {
            context += `**Aktuelle Initiativen:**\n`;
            initiatives.forEach(initiative => {
                context += `- ${initiative.title}: ${initiative.description}\n`;
            });
            context += '\n';
        }

        if (values.length > 0) {
            context += `**Unternehmenswerte:**\n`;
            values.forEach(value => {
                context += `- ${value.title}: ${value.description}\n`;
            });
            context += '\n';
        }

        context += `---\n\n`;
        context += `**WICHTIG:** Berücksichtige diese Unternehmensinformationen bei deinen Antworten und Analysen. `;
        context += `Stelle sicher, dass deine Vorschläge und Empfehlungen mit den Unternehmenszielen und -strategien übereinstimmen.\n\n`;

        return context;

    } catch (error) {
        console.error('Error fetching company strategy context:', error);
        return '';
    }
}

/**
 * Get formatted company strategy for protocol generation
 * More structured format specifically for meeting protocols
 */
export async function getCompanyStrategyForProtocol(tenantId: string): Promise<{
    hasContext: boolean;
    companyName: string;
    goals: Array<{ title: string; description: string }>;
    strategies: Array<{ title: string; description: string }>;
    initiatives: Array<{ title: string; description: string }>;
    values: Array<{ title: string; description: string }>;
}> {
    try {
        const company = await prisma.company.findUnique({
            where: { tenantId },
            include: {
                strategies: {
                    where: { isActive: true },
                    orderBy: { priority: 'desc' }
                }
            }
        });

        if (!company) {
            return {
                hasContext: false,
                companyName: '',
                goals: [],
                strategies: [],
                initiatives: [],
                values: []
            };
        }

        return {
            hasContext: company.strategies.length > 0,
            companyName: company.name,
            goals: company.strategies
                .filter(s => s.type === 'GOAL')
                .map(s => ({ title: s.title, description: s.description })),
            strategies: company.strategies
                .filter(s => s.type === 'STRATEGY')
                .map(s => ({ title: s.title, description: s.description })),
            initiatives: company.strategies
                .filter(s => s.type === 'INITIATIVE')
                .map(s => ({ title: s.title, description: s.description })),
            values: company.strategies
                .filter(s => s.type === 'VALUE')
                .map(s => ({ title: s.title, description: s.description }))
        };

    } catch (error) {
        console.error('Error fetching company strategy for protocol:', error);
        return {
            hasContext: false,
            companyName: '',
            goals: [],
            strategies: [],
            initiatives: [],
            values: []
        };
    }
}

/**
 * Get company info summary for display
 */
export async function getCompanySummary(tenantId: string) {
    try {
        const company = await prisma.company.findUnique({
            where: { tenantId },
            include: {
                strategies: {
                    where: { isActive: true }
                },
                news: {
                    orderBy: { researchDate: 'desc' },
                    take: 1
                }
            }
        });

        if (!company) {
            return null;
        }

        return {
            name: company.name,
            logo: company.logo,
            industry: company.industry,
            employeeCount: company.employeeCount,
            description: company.description,
            foundedDate: company.foundedDate,
            activeStrategiesCount: company.strategies.length,
            lastNewsDate: company.news[0]?.researchDate || null
        };

    } catch (error) {
        console.error('Error fetching company summary:', error);
        return null;
    }
}
