import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
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
 * POST /api/projects/[id]/create-assistant
 * Create AI assistant for project using meta-AI
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId } = await params;

        // Check if user is owner
        const membership = await checkProjectAccess(user.id, projectId);
        if (!membership || membership.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Only project owner can create assistant' },
                { status: 403 }
            );
        }

        // Get project details
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Check if assistant already exists
        const existingAssistant = await prisma.projectAssistant.findUnique({
            where: { projectId },
        });

        if (existingAssistant) {
            return NextResponse.json(
                { error: 'Project assistant already exists' },
                { status: 400 }
            );
        }

        // Use Meta-AI to generate optimal assistant configuration
        const metaAIResponse = await generateAssistantConfig(project);

        // Create project assistant
        const assistant = await prisma.projectAssistant.create({
            data: {
                name: metaAIResponse.assistantName,
                systemPrompt: metaAIResponse.systemPrompt,
                provider: metaAIResponse.provider,
                modelId: metaAIResponse.modelId,
                temperature: metaAIResponse.temperature,
                promptGeneratedBy: metaAIResponse.metaModelUsed,
                promptGeneratedAt: new Date(),
                projectId,
            },
        });

        // Update project with assistant ID
        await prisma.project.update({
            where: { id: projectId },
            data: {
                assistantId: assistant.id,
            },
        });

        return NextResponse.json({
            assistant,
            reasoning: metaAIResponse.reasoning,
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating project assistant:', error);
        return NextResponse.json(
            { error: 'Failed to create project assistant' },
            { status: 500 }
        );
    }
}

/**
 * Generate optimal assistant configuration using Meta-AI
 */
async function generateAssistantConfig(project: any) {
    const metaPrompt = `Du bist ein KI-Experte, der optimale System-Prompts für Projekt-Assistenten erstellt.

PROJEKT-INFORMATIONEN:
Name: ${project.name}
Beschreibung: ${project.description || 'Keine Beschreibung vorhanden'}
Nicht-Ziele: ${project.nonGoals || 'Keine Nicht-Ziele angegeben'}

AUFGABE:
1. Analysiere das Projekt gründlich
2. Erstelle einen optimalen, detaillierten System-Prompt für einen KI-Assistenten, der das Projektteam unterstützt
3. Wähle das beste Modell (OpenAI oder Gemini) basierend auf:
   - Art des Projekts
   - Komplexität der Aufgaben
   - Benötigte Fähigkeiten (Code, Analyse, Kreativität, etc.)
4. Setze die optimale Temperature
5. Erstelle einen passenden Namen für den Assistenten

Der System-Prompt sollte:
- Spezifisch auf das Projekt zugeschnitten sein
- Die Projektziele klar definieren
- Den Kontext und Scope verstehen
- Hilfreiche Antworten im Projektkontext geben können
- Die Nicht-Ziele respektieren

AUSGABE (JSON):
{
  "assistantName": "Prägnanter Name für den Assistenten",
  "systemPrompt": "Detaillierter System-Prompt...",
  "provider": "OpenAI oder Gemini",
  "modelId": "gpt-4o, gpt-4, gemini-2.0-flash-exp, etc.",
  "temperature": 0.7,
  "reasoning": "Kurze Erklärung warum diese Konfiguration optimal ist"
}`;

    // Use Gemini 2.0 Flash Thinking for meta-analysis
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: metaPrompt,
                    }],
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
    }

    const config = JSON.parse(jsonMatch[0]);

    return {
        ...config,
        metaModelUsed: 'gemini-2.0-flash-thinking-exp',
    };
}
