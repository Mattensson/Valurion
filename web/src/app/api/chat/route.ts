import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchWeb } from '@/lib/search';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { extractPdfData } from '@/lib/pdf-engine';
import { extractDocxData } from '@/lib/docx-engine';

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

        const processedMessages = await processMessages(messages, provider);

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
async function processMessages(messages: any[], provider: string = 'OpenAI') {
    return Promise.all(messages.map(async (msg) => {
        if (msg.role === 'user' && typeof msg.content === 'string') {
            const linkRegex = /!?\[.*?\]\((.*?)\)/g;
            const images: any[] = [];
            let processedText = msg.content;

            const matches = [...msg.content.matchAll(linkRegex)];

            for (const m of matches) {
                const url = m[1];

                // 1. Handle public/uploads (Direct Uploads in Chat)
                if (url && url.startsWith('/uploads/')) {
                    try {
                        const filename = url.split('/').pop();
                        if (filename) {
                            const filePath = join(process.cwd(), 'public', 'uploads', filename);
                            await processFileAttachment(filePath, filename, images, (text) => {
                                processedText += text;
                            }, provider);
                            // Remove the image link from text if it was an image, to avoid confusing the model? 
                            // Actually existing logic removed it for images but not PDFs. 
                            // We will follow the pattern inside processFileAttachment or handle removal here.

                            // Original logic removed the markdown link for images:
                            const ext = filename.split('.').pop()?.toLowerCase();
                            const SUPPORTED_IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                            if (ext && SUPPORTED_IMAGES.includes(ext)) {
                                processedText = processedText.replace(m[0], '');
                            }
                        }
                    } catch (e) {
                        console.error('Failed to process upload file:', url, e);
                    }
                }

                // 2. Handle /api/documents/ (Repository Files)
                else if (url && url.includes('/api/documents/')) {
                    try {
                        const docId = url.split('/').pop(); // Last part is ID
                        if (docId) {
                            const doc = await prisma.document.findUnique({
                                where: { id: docId }
                            });

                            if (!doc) {
                                console.error(`Document with ID ${docId} not found in database.`);
                            }

                            if (doc) {
                                const storageDir = join(process.cwd(), 'storage', 'documents');
                                const filePath = join(storageDir, doc.storagePath);

                                await processFileAttachment(filePath, doc.filename, images, (text) => {
                                    processedText += text;
                                }, provider);

                                // Check if image to remove link
                                const SUPPORTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
                                if (SUPPORTED_IMAGES.includes(doc.mimeType)) {
                                    processedText = processedText.replace(m[0], '');
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to process repo file:', url, e);
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

// Reusable helper for file processing


// Reusable helper for file processing
// - Gemini: Native PDF support (send PDF as base64)
// - OpenAI: Text extraction using pdfjs-dist
async function processFileAttachment(filePath: string, originalFilename: string, images: any[], appendText: (t: string) => void, provider: string = 'OpenAI') {
    try {
        console.log(`Processing attachment: ${filePath} (${originalFilename}) for provider: ${provider}`);
        const fileBuffer = await readFile(filePath);
        const ext = originalFilename.split('.').pop()?.toLowerCase();

        // MimeType detection
        let mimeType = '';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'gif') mimeType = 'image/gif';

        // Images: Always send as base64
        if (mimeType) {
            images.push({
                mimeType,
                data: fileBuffer.toString('base64'),
                filename: originalFilename
            });
        }
        // PDFs: Provider-specific handling
        else if (ext === 'pdf') {
            if (provider === 'Gemini') {
                // Gemini: Native PDF processing via inlineData
                images.push({
                    mimeType: 'application/pdf',
                    data: fileBuffer.toString('base64'),
                    filename: originalFilename
                });
                appendText(`\n\n[Analysiere die angehängte PDF-Datei: ${originalFilename}]\n`);
            } else {
                // OpenAI: Use Gemini 2.5 Flash for extraction, then pass text to OpenAI
                try {
                    const pdfData = await extractPdfData(fileBuffer, { maxCharacters: 50000, includePageNumbers: true });
                    appendText(`\n\n--- INHALT DATEI '${originalFilename}' ---\n${pdfData.text}\n--- ENDE DATEI INHALT ---\n`);
                } catch (pdfError: any) {
                    console.error('PDF extraction error:', pdfError);
                    appendText(`\n\n[SYSTEM FEHLER: Konnte PDF '${originalFilename}' nicht lesen. Fehler: ${pdfError.message}]\n`);
                }
            }
        }
        // Word Documents (.docx and .doc): Provider-specific handling
        else if (ext === 'docx' || ext === 'doc') {
            if (provider === 'Gemini') {
                // Gemini: Native Word document processing via inlineData
                const mimeType = ext === 'doc'
                    ? 'application/msword'
                    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

                images.push({
                    mimeType,
                    data: fileBuffer.toString('base64'),
                    filename: originalFilename
                });
                appendText(`\n\n[Analysiere das angehängte Word-Dokument: ${originalFilename}]\n`);
            } else {
                // OpenAI: Extract text using docx-engine (mammoth for .docx, Gemini for .doc)
                try {
                    const docxData = await extractDocxData(fileBuffer, originalFilename, { maxCharacters: 50000 });
                    appendText(`\n\n--- INHALT DATEI '${originalFilename}' ---\n${docxData.text}\n--- ENDE DATEI INHALT ---\n`);
                } catch (docxError: any) {
                    console.error('DOCX extraction error:', docxError);
                    appendText(`\n\n[SYSTEM FEHLER: Konnte Word-Dokument '${originalFilename}' nicht lesen. Fehler: ${docxError.message}]\n`);
                }
            }
        }
    } catch (e: any) {
        console.error(`Failed to read file ${filePath}:`, e);
        appendText(`\n\n[SYSTEM FEHLER: Datei '${originalFilename}' konnte nicht vom System gelesen werden. Fehler: ${e.message}]\n`);
    }
}
