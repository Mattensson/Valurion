import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchWeb } from '@/lib/search';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Polyfills for pdf-parse in Node environment to prevent crash
if (typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix { };
}
if (typeof (global as any).ImageData === 'undefined') {
    (global as any).ImageData = class ImageData { };
}
if (typeof (global as any).Path2D === 'undefined') {
    (global as any).Path2D = class Path2D { };
}

// Use pdfjs-dist for robust PDF text extraction in Node
// pdfjs-dist will be lazy loaded in processMessages

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, provider, mode, temperature, chatId, systemPrompt } = await request.json();

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
            const result = await callOpenAIWithTools(processedMessages, config.modelId, temperature, projectContext, systemPrompt);
            aiResponse = result.content;
            totalTokens = result.tokens;
        } else if (provider === 'Gemini') {
            const result = await callGeminiWithTools(processedMessages, config.modelId, temperature, projectContext, systemPrompt);
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

// Helper to determine system instruction based on temperature or custom prompt
function getSystemInstruction(temperature: number, customPrompt?: string): string {
    if (customPrompt) {
        return customPrompt;
    }

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
async function callOpenAIWithTools(messages: any[], model: string, temperature: number, projectContext: string = "", systemPrompt?: string): Promise<{ content: string, tokens: number }> {
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
    const systemInstruction = getSystemInstruction(temperature, systemPrompt) + projectContext;
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
async function callGeminiWithTools(messages: any[], model: string, temperature: number, projectContext: string = "", systemPrompt?: string): Promise<{ content: string, tokens: number }> {
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

    // Determine if tools are supported (Thinking models often don't support tools)
    const startTools = !model.toLowerCase().includes("thinking");

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

    const systemInstructionText = getSystemInstruction(temperature, systemPrompt) + projectContext;

    let conversationContents = [...contents];
    let iterations = 0;
    const maxIterations = 3;
    let totalTokensUsed = 0;

    while (iterations < maxIterations) {
        const bodyObj: any = {
            contents: conversationContents,
            generationConfig: { temperature },
            // Only add system instruction if not a very old model, but assume yes for now.
            // Some thinking models prefer system instructions in the prompt, but API supports it usually.
            systemInstruction: {
                parts: [{ text: systemInstructionText }]
            }
        };

        if (startTools) {
            bodyObj.tools = tools;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        console.log('Gemini Request URL:', url.replace(apiKey, 'HIDDEN_KEY'));

        const response = await fetch(
            url,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini Error:', error);
            throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Track Usage
        if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
            totalTokensUsed += data.usageMetadata.totalTokenCount;
        }

        // Safety Check
        if (!data.candidates || data.candidates.length === 0) {
            console.error('Gemini No Candidates:', JSON.stringify(data));
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                return { content: `[BLOCK] Die Anfrage wurde von der KI-Sicherheitsrichtlinie blockiert. Grund: ${data.promptFeedback.blockReason}`, tokens: totalTokensUsed };
            }
            return { content: "Entschuldigung, die KI konnte keine Antwort generieren (leere Antwort).", tokens: totalTokensUsed };
        }

        const candidate = data.candidates[0];

        // Ensure content parts exist
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            return { content: "Leere Antwort von der KI erhalten.", tokens: totalTokensUsed };
        }

        // Check for function calls (only if we sent tools)
        if (startTools && candidate.content.parts[0].functionCall) {
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
            } else {
                // Unknown function or just return text
                return { content: "Funktionsaufruf nicht erkannt.", tokens: totalTokensUsed };
            }
        } else {
            // No function call, return final answer
            // Handle cases where thinking models return multiple parts (thoughts + text)
            const textParts = candidate.content.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
            return { content: textParts || 'Keine Textantwort erhalten', tokens: totalTokensUsed };
        }
    }

    // Fallback
    // Ensure we have a valid last content
    if (conversationContents.length > 0 && conversationContents[conversationContents.length - 1].parts) {
        const lastParts = conversationContents[conversationContents.length - 1].parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
        return { content: lastParts || 'Keine Antwort erhalten', tokens: totalTokensUsed };
    }

    return { content: 'Keine Antwort erhalten', tokens: totalTokensUsed };
}

// Helper to process messages and extract local images and PDF text
async function processMessages(messages: any[]) {
    return Promise.all(messages.map(async (msg) => {
        if (msg.role === 'user' && typeof msg.content === 'string') {
            const linkRegex = /!?\[.*?\]\((.*?)\)/g;
            const images: any[] = [];
            let processedText = msg.content;

            const matches = [...msg.content.matchAll(linkRegex)];

            for (const m of matches) {
                const url = m[1];
                if (url && url.startsWith('/uploads/')) {
                    try {
                        const filename = url.split('/').pop();
                        if (filename) {
                            const filePath = join(process.cwd(), 'public', 'uploads', filename);
                            const fileBuffer = await readFile(filePath);
                            const ext = filename.split('.').pop()?.toLowerCase();

                            const SUPPORTED_IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

                            if (ext && SUPPORTED_IMAGES.includes(ext)) {
                                const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                                images.push({ mimeType, data: fileBuffer.toString('base64') });
                                processedText = processedText.replace(m[0], '');
                            }
                            else if (ext === 'pdf') {
                                try {
                                    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
                                    const data = new Uint8Array(fileBuffer);
                                    const loadingTask = pdfjsLib.getDocument({ data });
                                    const pdfDocument = await loadingTask.promise;
                                    let pdfText = '';

                                    for (let i = 1; i <= pdfDocument.numPages; i++) {
                                        const page = await pdfDocument.getPage(i);
                                        const textContent = await page.getTextContent();
                                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                                        pdfText += pageText + '\n';
                                    }

                                    pdfText = pdfText.replace(/\n\s*\n/g, '\n').trim();
                                    if (pdfText.length > 50000) pdfText = pdfText.substring(0, 50000) + "\n... (Text gekürzt)";
                                    processedText += `\n\n--- INHALT DATEI '${filename}' ---\n${pdfText}\n--- ENDE DATEI INHALT ---\n`;
                                } catch (pdfError) {
                                    console.error('PDF parsing error:', pdfError);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to process file:', url);
                    }
                }
            }

            processedText = processedText.trim();
            if (!processedText && images.length > 0) processedText = "Bild analysieren:";

            if (images.length > 0) {
                return {
                    ...msg,
                    hasImages: true,
                    images,
                    cleanText: processedText,
                    content: processedText
                };
            } else if (processedText !== msg.content) {
                return {
                    ...msg,
                    content: processedText
                };
            }
        }
        return msg;
    }));
}
