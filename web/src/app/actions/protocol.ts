'use server';

import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * HIER IST DAS PROMPTING GEPARKT FÜR DEN USER ZUR ÜBERSICHT
 * ==========================================================
 * 
 * Generiert ein Protokoll mit folgenden Instruktionen:
 * - So kurz wie möglich, so lang wie nötig.
 * - Strategie-Check: Abgleich von Entscheidungen mit Unternehmensstrategien.
 * - Effizienz-Check: Bewertung der Meeting-Effizienz.
 */
export async function generateProtocol(transcript: string) {
    console.log('generateProtocol called with transcript length:', transcript?.length);

    try {
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is missing');
            return { success: false, error: 'Server Konfiguration fehlt (API Key)' };
        }

        const session = await getSession();
        if (!session?.tenantId) {
            console.error('No session or tenantId found');
            return { success: false, error: 'Nicht authentifiziert' };
        }

        // 1. Strategien laden
        const strategies = await prisma.companyStrategy.findMany({
            where: {
                company: { tenantId: session.tenantId },
                isActive: true
            },
            select: {
                title: true,
                description: true,
                type: true
            }
        });

        const strategyContext = strategies.length > 0
            ? strategies.map((s: any) => `- [${s.type}] ${s.title}: ${s.description || 'Keine Beschreibung'}`).join('\n')
            : 'Keine spezifischen Strategien hinterlegt.';

        // 2. OpenAI Call
        const systemPrompt = `Du bist ein erfahrener Protokollführer und Strategie-Analyst für die Firma Valurion.
Deine Aufgabe ist es, aus dem übergebenen Transkript ein professionelles Protokoll zu erstellen.

---
LEITLINIEN:
1. UMFANG: Das Protokoll soll so kurz wie möglich, aber so lang wie notwendig sein. Vermeide unnötiges Füllmaterial, aber unterschlage keine wichtigen Details.
2. STRATEGIE-CHECK (WICHTIG):
   Prüfe kritisch, ob das Besprochene und insbesondere die getroffenen ENTSCHEIDUNGEN im Einklang mit den unten aufgeführten Unternehmensstrategien stehen.
   - Wenn ja: Weise kurz darauf hin, welche Strategie gestützt wird.
   - Wenn nein/Widerspruch: Markiere dies deutlich als Warnung.
   - Wenn irrelevant: Erwähne es nicht zwingend.
3. EFFIZIENZ & EFFEKTIVITÄT:
   Gib am Ende eine kurze Einschätzung zur Effizienz des Meetings ab (z.B. klare Agenda, zielführende Diskussion vs. Abschweifungen).

---
UNTERNEHMENSSTRATEGIEN:
${strategyContext}

---
GEWÜNSCHTE STRUKTUR:
# [Titel des Meetings] - Protokoll
**Datum:** [Datum einfügen falls im Text erkennbar, sonst 'Unbekannt']

## 1. Zusammenfassung
[Kurze Management Summary]

## 2. Entscheidungen & Beschlüsse
- [Entscheidung 1]
- ...

## 3. Offene Punkte / To-Dos
- [Wer] macht [Was] bis [Wann]

## 4. Strategischer Abgleich
[Hier deine Analyse einfügen: Passen die Ergebnisse zur Strategie '${strategies.map((s: any) => s.title).join(', ')}'?]

## 5. Meeting-Effizienz
[Deine Einschätzung]
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript }
            ],
            temperature: 0.5,
        });

        const protocol = completion.choices[0]?.message?.content || 'Fehler bei der Generierung.';

        return { success: true, protocol };

    } catch (error: any) {
        console.error('Protocol generation failed:', error);
        return { success: false, error: error.message || 'Protokollierung fehlgeschlagen' };
    }
}

export async function saveProtocol(data: { id?: string, title: string, content: string, transcriptionId?: string }) {
    const session = await getSession();
    if (!session?.tenantId) return { success: false, error: 'Nicht authentifiziert' };

    try {
        if (data.id && data.id !== 'new') {
            const updated = await prisma.protocol.update({
                where: { id: data.id, userId: session.userId },
                data: {
                    title: data.title,
                    content: data.content,
                    transcriptionId: data.transcriptionId || undefined
                }
            });
            return { success: true, protocol: updated };
        } else {
            const created = await prisma.protocol.create({
                data: {
                    title: data.title,
                    content: data.content,
                    transcriptionId: data.transcriptionId || undefined,
                    userId: session.userId
                }
            });
            return { success: true, protocol: created };
        }
    } catch (e: any) {
        console.error('Save protocol error', e);
        return { success: false, error: e.message || 'Speichern fehlgeschlagen' };
    }
}

export async function getProtocols() {
    const session = await getSession();
    if (!session?.tenantId) return [];

    try {
        const protocols = await prisma.protocol.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            include: { transcription: true } // Optional: include source info
        });
        return protocols;
    } catch (e) {
        console.error('Get protocols error', e);
        return [];
    }
}
