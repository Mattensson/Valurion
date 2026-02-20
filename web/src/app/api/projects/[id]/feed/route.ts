import { NextResponse } from 'next/server';
import { PrismaClient, FeedMessageType } from '@prisma/client';
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
 * GET /api/projects/[id]/feed
 * Get project feed messages
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

        // Get feed messages (last 100)
        const messages = await prisma.projectFeedMessage.findMany({
            where: { projectId },
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
                assistant: {
                    select: {
                        id: true,
                        name: true,
                        icon: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'asc',
            },
            take: 100,
        });

        return NextResponse.json({ messages });

    } catch (error) {
        console.error('Error fetching feed messages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch feed messages' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/projects/[id]/feed
 * Send a message to project feed
 * Automatically detects @mentions and triggers assistant responses
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
        const { content } = body;

        if (!content || !content.trim()) {
            return NextResponse.json(
                { error: 'Message content is required' },
                { status: 400 }
            );
        }

        // Check access
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership) {
            return NextResponse.json(
                { error: 'Project not found or access denied' },
                { status: 404 }
            );
        }

        // Create user message
        const userMessage = await prisma.projectFeedMessage.create({
            data: {
                content,
                type: FeedMessageType.USER,
                projectId,
                userId: user.id,
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
                }
            }
        });

        // Check for @mentions
        const mentions = extractMentions(content);
        const responses: any[] = [userMessage];

        // Process mentions
        for (const mention of mentions) {
            if (mention === 'ProjectAssistant' || mention === 'projectassistant') {
                // Handle Project Assistant mention
                const assistantResponse = await handleProjectAssistantMention(
                    projectId,
                    content,
                    user.id
                );
                if (assistantResponse) {
                    responses.push(assistantResponse);
                }
            } else {
                // Handle general assistant mention
                const assistantResponse = await handleAssistantMention(
                    projectId,
                    mention,
                    content,
                    user.id
                );
                if (assistantResponse) {
                    responses.push(assistantResponse);
                }
            }
        }

        return NextResponse.json({
            messages: responses,
        }, { status: 201 });

    } catch (error) {
        console.error('Error sending feed message:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}

/**
 * Extract @mentions from message content
 */
function extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+[-\w]*)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[1]);
    }

    return mentions;
}

/**
 * Handle Project Assistant mention
 */
async function handleProjectAssistantMention(
    projectId: string,
    messageContent: string,
    userId: string
) {
    try {
        // Get project with assistant
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                projectAssistant: true,
                feedMessages: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!project || !project.projectAssistant) {
            return null;
        }

        // Build context from recent feed messages
        const feedContext = project.feedMessages
            .reverse()
            .map(msg => {
                const name = msg.user.firstName && msg.user.lastName
                    ? `${msg.user.firstName} ${msg.user.lastName}`
                    : 'User';
                return `${name}: ${msg.content}`;
            })
            .join('\n');

        // Call AI with project assistant configuration
        const aiResponse = await callAssistantAI(
            project.projectAssistant,
            messageContent,
            feedContext,
            project
        );

        // Save assistant response
        const assistantMessage = await prisma.projectFeedMessage.create({
            data: {
                content: aiResponse,
                type: FeedMessageType.ASSISTANT_MENTION,
                projectId,
                userId, // For audit purposes
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
                }
            }
        });

        return assistantMessage;

    } catch (error) {
        console.error('Error handling project assistant mention:', error);
        return null;
    }
}

/**
 * Handle general assistant mention (e.g., @Vertrags-Analyst)
 */
async function handleAssistantMention(
    projectId: string,
    assistantName: string,
    messageContent: string,
    userId: string
) {
    try {
        // Find assistant by name
        const assistant = await prisma.assistant.findFirst({
            where: {
                name: {
                    contains: assistantName.replace(/-/g, ' '),
                    mode: 'insensitive',
                },
                isActive: true,
            }
        });

        if (!assistant) {
            return null;
        }

        // Get project context
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                documents: {
                    select: {
                        filename: true,
                        parsedContent: true,
                    },
                    take: 5,
                },
                feedMessages: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!project) {
            return null;
        }

        // Build context
        const feedContext = project.feedMessages
            .reverse()
            .map(msg => {
                const name = msg.user.firstName && msg.user.lastName
                    ? `${msg.user.firstName} ${msg.user.lastName}`
                    : 'User';
                return `${name}: ${msg.content}`;
            })
            .join('\n');

        const documentsContext = project.documents
            .map(doc => `Dokument: ${doc.filename}\n${doc.parsedContent?.substring(0, 500) || ''}`)
            .join('\n\n');

        // Call AI with assistant configuration
        const aiResponse = await callGeneralAssistantAI(
            assistant,
            messageContent,
            feedContext,
            documentsContext,
            project
        );

        // Save assistant response
        const assistantMessage = await prisma.projectFeedMessage.create({
            data: {
                content: aiResponse,
                type: FeedMessageType.ASSISTANT_MENTION,
                projectId,
                userId,
                mentionedAssistantId: assistant.id,
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
                assistant: {
                    select: {
                        id: true,
                        name: true,
                        icon: true,
                    }
                }
            }
        });

        return assistantMessage;

    } catch (error) {
        console.error('Error handling assistant mention:', error);
        return null;
    }
}

/**
 * Call AI for project assistant
 */
async function callAssistantAI(
    assistant: any,
    message: string,
    feedContext: string,
    project: any
) {
    const prompt = `${assistant.systemPrompt}

PROJEKT-KONTEXT:
Projekt: ${project.name}
Beschreibung: ${project.description || 'Keine Beschreibung'}
Nicht-Ziele: ${project.nonGoals || 'Keine Nicht-Ziele'}

BISHERIGE FEED-UNTERHALTUNG:
${feedContext}

AKTUELLE ANFRAGE:
${message}

Bitte gib ein kurzes, prägnantes Statement ab (max. 3-4 Sätze), das dem Projektteam weiterhilft.`;

    if (assistant.provider === 'OpenAI') {
        return await callOpenAI(assistant.modelId, prompt, assistant.temperature);
    } else {
        return await callGemini(assistant.modelId, prompt, assistant.temperature);
    }
}

/**
 * Call AI for general assistant
 */
async function callGeneralAssistantAI(
    assistant: any,
    message: string,
    feedContext: string,
    documentsContext: string,
    project: any
) {
    const prompt = `${assistant.systemPrompt}

PROJEKT-KONTEXT:
Projekt: ${project.name}
Beschreibung: ${project.description || 'Keine Beschreibung'}

PROJEKT-DOKUMENTE:
${documentsContext || 'Keine Dokumente verfügbar'}

BISHERIGE FEED-UNTERHALTUNG:
${feedContext}

AKTUELLE ANFRAGE:
${message}

Bitte gib ein kurzes, prägnantes Statement ab (max. 3-4 Sätze), das dem Projektteam weiterhilft.`;

    if (assistant.provider === 'OpenAI') {
        return await callOpenAI(assistant.modelId, prompt, assistant.temperature);
    } else {
        return await callGemini(assistant.modelId, prompt, assistant.temperature);
    }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(modelId: string, prompt: string, temperature: number) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelId,
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: 500,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Call Gemini API
 */
async function callGemini(modelId: string, prompt: string, temperature: number) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt,
                    }],
                }],
                generationConfig: {
                    temperature,
                    maxOutputTokens: 500,
                },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
