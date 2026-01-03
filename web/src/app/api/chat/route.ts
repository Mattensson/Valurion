import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchWeb } from '@/lib/search';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, provider, mode, temperature, chatId } = await request.json();

        // Check for Project Context
        let projectContext = "";
        if (chatId) {
            const chat = await prisma.chat.findUnique({
                where: { id: chatId },
                include: { project: true }
            });

            if (chat?.project) {
                projectContext = `\n\nHIER SIND DIE PROJEKT-ANWEISUNGEN FÜR DIESEN CHAT:\nPROJEKT NAME: ${chat.project.name}\nZIEL (INSTRUCTIONS): ${chat.project.description || "Keine"}\nNICHT-ZIELE (NON-GOALS): ${chat.project.nonGoals || "Keine"}\n\nBitte berücksichtige diese Anweisungen strikt bei deiner Antwort. Verfolge die Ziele und vermeide die Nicht-Ziele.`;
                console.log('Project Context Injected:', chat.project.name);

                // Fetch Project Documents (RAG)
                const documents = await prisma.document.findMany({
                    where: { projectId: chat.project.id },
                    select: { filename: true, parsedContent: true }
                });

                if (documents.length > 0) {
                    let knowledgeBase = "\n\nWISSENSBASIS AUS PROJEKT-DATEIEN (Nutze dies als Faktengrundlage):\n";
                    for (const doc of documents) {
                        if (doc.parsedContent) {
                            // Simple Truncation to avoid context explosion (approx 10k chars per file max for now)
                            const content = doc.parsedContent.substring(0, 10000);
                            knowledgeBase += `\n--- DATEI: ${doc.filename} ---\n${content}\n---------------------------------\n`;
                        }
                    }
                    projectContext += knowledgeBase;
                    console.log(`Injected ${documents.length} documents into context.`);
                }
            }
        }

        const processedMessages = await processMessages(messages);

        console.log('Chat request:', { provider, mode, temperature, messageCount: messages.length });

        // Get configured model from database
        const config = await prisma.aIModelConfig.findUnique({
            where: {
                provider_mode: {
                    provider,
                    mode
                }
            }
        });

        console.log('Found config:', config);

        if (!config) {
            console.error('No model config found for:', provider, mode);
            return NextResponse.json({ error: 'No model configured for this provider/mode' }, { status: 400 });
        }

        let aiResponse: string;
        let totalTokens = 0;

        if (provider === 'OpenAI') {
            const result = await callOpenAIWithTools(processedMessages, config.modelId, temperature, projectContext);
            aiResponse = result.content;
            totalTokens = result.tokens;
        } else if (provider === 'Gemini') {
            const result = await callGeminiWithTools(processedMessages, config.modelId, temperature, projectContext);
            aiResponse = result.content;
            totalTokens = result.tokens;
        } else {
            return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
        }

        // Log Token Usage
        if (session.userId && totalTokens > 0) {
            await prisma.auditLog.create({
                data: {
                    action: 'CHAT_INTERACTION',
                    modelUsed: config.modelId,
                    tokenCount: totalTokens,
                    userId: session.userId,
                    tenantId: session.tenantId,
                }
            });
        }

        return NextResponse.json({ message: aiResponse });
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Helper to determine system instruction based on temperature
function getSystemInstruction(temperature: number): string {
    if (temperature <= 0.2) {
        return "Du bist ein extrem präziser Assistent. Deine Antworten müssen EXTREM KURZ und KNACKIG sein. Beschränke dich auf das absolut Wesentliche. Keine Einleitungen, keine Floskeln. Stichpunkte sind bevorzugt.";
    } else if (temperature <= 0.4) {
        return "Antworte kurz, bündig und direkt. Vermeide unnötige Ausschmückungen.";
    } else if (temperature <= 0.6) {
        return "Antworte in normaler Ausführlichkeit. Gib relevante Informationen, aber fasse dich gut verständlich.";
    } else if (temperature <= 0.8) {
        return "Antworte ausführlich. Erkläre Hintergründe und Zusammenhänge. Gehe auf Details ein.";
    } else {
        return "Sei sehr ausführlich, kreativ und umfassend. Beleuchte das Thema von allen Seiten, bringe Beispiele und erkläre jedes Detail genau. Deine Antworten sollen tiefgehend sein.";
    }
}

// OpenAI with Function Calling
async function callOpenAIWithTools(messages: any[], model: string, temperature: number, projectContext: string = ""): Promise<{ content: string, tokens: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('No OpenAI API key');

    const tools = [{
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Sucht aktuelle Informationen im Internet. Nutze dies für aktuelle Ereignisse, Fakten, News oder wenn du nicht sicher bist.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Die Suchanfrage'
                    }
                },
                required: ['query']
            }
        }
    }];

    // Add system instruction based on temperature and project context
    const systemInstruction = getSystemInstruction(temperature) + projectContext;
    let conversationMessages = [
        { role: 'system', content: systemInstruction },
        ...messages
    ];
    let iterations = 0;
    const maxIterations = 3;
    let totalTokensUsed = 0;

    while (iterations < maxIterations) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: conversationMessages.map(msg => {
                    if (msg.hasImages && msg.images) {
                        return {
                            role: msg.role,
                            content: [
                                { type: 'text', text: msg.cleanText },
                                ...msg.images.map((img: any) => ({
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${img.mimeType};base64,${img.data}`
                                    }
                                }))
                            ]
                        };
                    }
                    // Handle tool outputs which have specific structure
                    if (msg.role === 'tool') return msg;
                    if (msg.tool_calls) return msg;
                    if (msg.role === 'system') return msg; // Allow system messages

                    return { role: msg.role, content: msg.content };
                }),
                temperature,
                tools,
                tool_choice: 'auto'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI Error:', error);
            throw new Error('OpenAI request failed');
        }

        const data = await response.json();

        // Track usage
        if (data.usage && data.usage.total_tokens) {
            totalTokensUsed += data.usage.total_tokens;
        }

        const message = data.choices[0].message;

        // Check if model wants to call a function
        if (message.tool_calls && message.tool_calls.length > 0) {
            conversationMessages.push(message);

            for (const toolCall of message.tool_calls) {
                if (toolCall.function.name === 'search_web') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log('🔍 OpenAI searching:', args.query);

                    const searchResults = await searchWeb(args.query);

                    conversationMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: searchResults
                    });
                }
            }
            iterations++;
        } else {
            // No more function calls, return final answer
            return { content: message.content, tokens: totalTokensUsed };
        }
    }

    // Fallback if max iterations reached
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return { content: lastMsg.content || 'Keine Antwort erhalten', tokens: totalTokensUsed };
}

// Gemini with Function Calling
async function callGeminiWithTools(messages: any[], model: string, temperature: number, projectContext: string = ""): Promise<{ content: string, tokens: number }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('No Gemini API key');

    // Convert messages to Gemini format
    const contents = messages.map((msg: any) => {
        const parts = [];
        if (msg.hasImages && msg.images) {
            if (msg.cleanText) parts.push({ text: msg.cleanText });
            msg.images.forEach((img: any) => {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data
                    }
                });
            });
        } else {
            parts.push({ text: msg.content });
        }

        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts
        };
    });

    const tools = [{
        functionDeclarations: [{
            name: 'search_web',
            description: 'Sucht aktuelle Informationen im Internet. Nutze dies für aktuelle Ereignisse, Fakten, News oder wenn du nicht sicher bist.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Die Suchanfrage'
                    }
                },
                required: ['query']
            }
        }]
    }];

    const systemInstructionText = getSystemInstruction(temperature) + projectContext;

    let conversationContents = [...contents];
    let iterations = 0;
    const maxIterations = 3;
    let totalTokensUsed = 0;

    while (iterations < maxIterations) {
        const bodyObj: any = {
            contents: conversationContents,
            generationConfig: { temperature },
            tools,
            systemInstruction: {
                parts: [{ text: systemInstructionText }]
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini Error:', error);
            throw new Error('Gemini request failed');
        }

        const data = await response.json();

        // Track Usage (Gemini format: usageMetadata)
        if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
            totalTokensUsed += data.usageMetadata.totalTokenCount;
        }

        const candidate = data.candidates[0];

        // Check for function calls
        if (candidate.content.parts[0].functionCall) {
            const functionCall = candidate.content.parts[0].functionCall;

            if (functionCall.name === 'search_web') {
                console.log('🔍 Gemini searching:', functionCall.args.query);

                const searchResults = await searchWeb(functionCall.args.query);

                // Add function call and response to conversation
                conversationContents.push(candidate.content);
                conversationContents.push({
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: 'search_web',
                            response: { result: searchResults }
                        }
                    } as any]
                });

                iterations++;
            }
        } else {
            // No function call, return final answer
            return { content: candidate.content.parts[0].text, tokens: totalTokensUsed };
        }
    }

    // Fallback
    const lastContent = conversationContents[conversationContents.length - 1];
    return { content: lastContent.parts[0].text || 'Keine Antwort erhalten', tokens: totalTokensUsed };
}

// Helper to process messages and extract local images
async function processMessages(messages: any[]) {
    return Promise.all(messages.map(async (msg) => {
        if (msg.role === 'user' && typeof msg.content === 'string') {
            const imageRegex = /!\[.*?\]\((.*?)\)/g;
            const images = [];
            let match;

            // We only look for local uploads to process
            while ((match = imageRegex.exec(msg.content)) !== null) {
                const url = match[1];
                if (url.startsWith('/uploads/')) {
                    try {
                        const filename = url.split('/').pop();
                        if (filename) {
                            const filePath = join(process.cwd(), 'public', 'uploads', filename);
                            const fileBuffer = await readFile(filePath);
                            const base64 = fileBuffer.toString('base64');
                            const ext = filename.split('.').pop()?.toLowerCase();
                            const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';

                            images.push({ mimeType, data: base64 });
                        }
                    } catch (e) {
                        console.error('Failed to load image for AI processing:', url);
                    }
                }
            }

            if (images.length > 0) {
                return {
                    ...msg,
                    hasImages: true,
                    images,
                    cleanText: msg.content.replace(imageRegex, '').trim() || "Bild analysieren:"
                };
            }
        }
        return msg;
    }));
}
