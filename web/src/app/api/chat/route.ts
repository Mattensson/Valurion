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
        const { messages, provider, mode, temperature } = await request.json();

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

        if (provider === 'OpenAI') {
            aiResponse = await callOpenAIWithTools(processedMessages, config.modelId, temperature);
        } else if (provider === 'Gemini') {
            aiResponse = await callGeminiWithTools(processedMessages, config.modelId, temperature);
        } else {
            return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
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
async function callOpenAIWithTools(messages: any[], model: string, temperature: number): Promise<string> {
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

    // Add system instruction based on temperature
    const systemInstruction = getSystemInstruction(temperature);
    let conversationMessages = [
        { role: 'system', content: systemInstruction },
        ...messages
    ];
    let iterations = 0;
    const maxIterations = 3;

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
            return message.content;
        }
    }

    // Fallback if max iterations reached
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return lastMsg.content || 'Keine Antwort erhalten';
}

// Gemini with Function Calling
async function callGeminiWithTools(messages: any[], model: string, temperature: number): Promise<string> {
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

    const systemInstructionText = getSystemInstruction(temperature);

    let conversationContents = [...contents];
    let iterations = 0;
    const maxIterations = 3;

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
            return candidate.content.parts[0].text;
        }
    }

    // Fallback
    const lastContent = conversationContents[conversationContents.length - 1];
    return lastContent.parts[0].text || 'Keine Antwort erhalten';
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
