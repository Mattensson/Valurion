/**
 * BEISPIEL: Integration der Unternehmensstrategie in Chat-APIs
 * 
 * Diese Datei zeigt, wie du die Company Strategy als RAG-Kontext
 * in deine bestehenden Chat- und Protokoll-Features integrierst.
 */

import { getCompanyStrategyContext, getCompanyStrategyForProtocol } from '@/lib/companyContext';

// ============================================================================
// BEISPIEL 1: Chat-Integration
// ============================================================================

/**
 * Beispiel: Integration in eine Chat-API
 * Datei: /api/chat/[chatId]/message/route.ts
 */
export async function chatExample(tenantId: string, userMessage: string) {
    // 1. Hole den Unternehmenskontext
    const strategyContext = await getCompanyStrategyContext(tenantId);

    // 2. Baue den System-Prompt mit Kontext
    const systemPrompt = `Du bist ein hilfreicher KI-Assistent für die Valurion App.
  
Deine Aufgabe ist es, dem Nutzer bei seinen Fragen zu helfen und dabei 
die Unternehmensziele und -strategien zu berücksichtigen.
${strategyContext}

Antworte präzise, professionell und immer im Kontext der Unternehmensstrategie.`;

    // 3. Sende an AI (Beispiel mit Gemini)
    const response = await sendToAI({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ]
    });

    return response;
}

// ============================================================================
// BEISPIEL 2: Protokoll-Generierung aus Transkript
// ============================================================================

/**
 * Beispiel: Integration in Protokoll-Generierung
 * Datei: /api/transcription/[id]/protocol/route.ts
 */
export async function protocolExample(tenantId: string, transcriptText: string) {
    // 1. Hole strukturierte Strategie-Daten
    const strategy = await getCompanyStrategyForProtocol(tenantId);

    // 2. Baue den Prompt für Protokoll-Generierung
    let prompt = `Erstelle ein professionelles Meeting-Protokoll basierend auf folgendem Transkript:

---
${transcriptText}
---

Das Protokoll soll enthalten:
1. Zusammenfassung
2. Besprochene Themen
3. Beschlüsse und Entscheidungen
4. Aufgaben und Verantwortlichkeiten
5. Nächste Schritte

`;

    // 3. Füge Unternehmenskontext hinzu, falls vorhanden
    if (strategy.hasContext) {
        prompt += `\n## WICHTIGER KONTEXT: ${strategy.companyName}\n\n`;

        if (strategy.goals.length > 0) {
            prompt += `**Berücksichtige folgende Unternehmensziele:**\n`;
            strategy.goals.forEach(goal => {
                prompt += `- ${goal.title}: ${goal.description}\n`;
            });
            prompt += '\n';
        }

        if (strategy.strategies.length > 0) {
            prompt += `**Berücksichtige folgende Strategien:**\n`;
            strategy.strategies.forEach(strat => {
                prompt += `- ${strat.title}: ${strat.description}\n`;
            });
            prompt += '\n';
        }

        if (strategy.initiatives.length > 0) {
            prompt += `**Aktuelle Initiativen:**\n`;
            strategy.initiatives.forEach(init => {
                prompt += `- ${init.title}: ${init.description}\n`;
            });
            prompt += '\n';
        }

        prompt += `\n**WICHTIG:** 
- Identifiziere Verbindungen zwischen den Gesprächsinhalten und den Unternehmenszielen
- Hebe hervor, welche Entscheidungen mit der Unternehmensstrategie übereinstimmen
- Weise auf mögliche Konflikte oder Abweichungen hin
- Schlage vor, wie Aufgaben mit den Unternehmenszielen verknüpft werden können\n\n`;
    }

    // 4. Generiere Protokoll mit AI
    const protocol = await generateProtocol(prompt);

    return protocol;
}

// ============================================================================
// BEISPIEL 3: Dokument-Analyse mit Unternehmenskontext
// ============================================================================

/**
 * Beispiel: Dokument-Analyse mit Strategie-Kontext
 * Datei: /api/document/[id]/analyze/route.ts
 */
export async function documentAnalysisExample(tenantId: string, documentContent: string) {
    const strategyContext = await getCompanyStrategyContext(tenantId);

    const analysisPrompt = `Analysiere folgendes Dokument im Kontext der Unternehmensstrategie:

${documentContent}
${strategyContext}

Erstelle eine Analyse mit:
1. Zusammenfassung des Dokuments
2. Relevanz für Unternehmensziele
3. Handlungsempfehlungen basierend auf der Strategie
4. Potenzielle Risiken oder Chancen`;

    const analysis = await analyzeWithAI(analysisPrompt);
    return analysis;
}

// ============================================================================
// BEISPIEL 4: Projekt-Bewertung
// ============================================================================

/**
 * Beispiel: Projekt-Vorschlag bewerten anhand der Unternehmensstrategie
 */
export async function projectEvaluationExample(
    tenantId: string,
    projectName: string,
    projectDescription: string
) {
    const strategy = await getCompanyStrategyForProtocol(tenantId);

    if (!strategy.hasContext) {
        return {
            score: null,
            message: 'Keine Unternehmensstrategie definiert. Bewertung nicht möglich.'
        };
    }

    const evaluationPrompt = `Bewerte folgendes Projekt anhand der Unternehmensstrategie:

**Projekt:** ${projectName}
**Beschreibung:** ${projectDescription}

**Unternehmensziele:**
${strategy.goals.map(g => `- ${g.title}: ${g.description}`).join('\n')}

**Strategien:**
${strategy.strategies.map(s => `- ${s.title}: ${s.description}`).join('\n')}

Bewerte das Projekt auf einer Skala von 1-10 bezüglich:
1. Übereinstimmung mit Unternehmenszielen
2. Unterstützung der Strategien
3. Potenzielle Auswirkungen

Gib eine strukturierte Bewertung mit:
- Score (1-10)
- Begründung
- Empfehlungen zur Optimierung`;

    const evaluation = await evaluateWithAI(evaluationPrompt);
    return evaluation;
}

// ============================================================================
// HELPER FUNCTIONS (Beispiel-Implementierungen)
// ============================================================================

async function sendToAI(params: { messages: Array<{ role: string; content: string }> }) {
    // Implementierung mit deiner AI-API (Gemini, OpenAI, etc.)
    // Dies ist nur ein Platzhalter
    return { text: 'AI Response' };
}

async function generateProtocol(prompt: string) {
    // Implementierung der Protokoll-Generierung
    return { protocol: 'Generated Protocol' };
}

async function analyzeWithAI(prompt: string) {
    // Implementierung der Dokument-Analyse
    return { analysis: 'Document Analysis' };
}

async function evaluateWithAI(prompt: string) {
    // Implementierung der Projekt-Bewertung
    return { score: 8, reasoning: 'Evaluation Result' };
}

// ============================================================================
// VERWENDUNG IN BESTEHENDEN APIS
// ============================================================================

/**
 * So integrierst du es in deine bestehende Chat-API:
 * 
 * 1. Importiere die Helper-Funktion:
 *    import { getCompanyStrategyContext } from '@/lib/companyContext';
 * 
 * 2. Hole den Kontext in deiner API-Route:
 *    const strategyContext = await getCompanyStrategyContext(session.user.tenantId);
 * 
 * 3. Füge ihn zum System-Prompt hinzu:
 *    const systemPrompt = `${basePrompt}${strategyContext}`;
 * 
 * 4. Nutze den erweiterten Prompt für deine AI-Anfrage
 */

/**
 * Für Protokoll-Generierung:
 * 
 * 1. Importiere:
 *    import { getCompanyStrategyForProtocol } from '@/lib/companyContext';
 * 
 * 2. Hole strukturierte Daten:
 *    const strategy = await getCompanyStrategyForProtocol(session.user.tenantId);
 * 
 * 3. Prüfe ob Kontext vorhanden:
 *    if (strategy.hasContext) { ... }
 * 
 * 4. Baue Prompt mit Strategie-Informationen
 */
