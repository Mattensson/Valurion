import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchWeb } from '@/lib/search';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, provider, mode, temperature } = await request.json();

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
            aiResponse = await callOpenAIWithTools(messages, config.modelId, temperature);
        } else if (provider === 'Gemini') {
            aiResponse = await callGeminiWithTools(messages, config.modelId, temperature);
        } else {
            return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
        }

        return NextResponse.json({ message: aiResponse });
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    let conversationMessages = [...messages];
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
                messages: conversationMessages,
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
    return conversationMessages[conversationMessages.length - 1].content;
}

// Gemini with Function Calling
async function callGeminiWithTools(messages: any[], model: string, temperature: number): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('No Gemini API key');

    // Convert messages to Gemini format
    const contents = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

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

    let conversationContents = [...contents];
    let iterations = 0;
    const maxIterations = 3;

    while (iterations < maxIterations) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: conversationContents,
                    generationConfig: { temperature },
                    tools
                })
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
                    }]
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
