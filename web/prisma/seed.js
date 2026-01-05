const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const assistants = [
        {
            name: 'Valurion Analyst',
            icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            description: 'Ihr intelligenter Partner für komplexe Analysen und kreative Problemlösungen.',
            category: 'General',
            systemPrompt: 'Du bist Valurion Analyst, ein fortschrittlicher KI-Assistent. Du hilfst bei der Analyse komplexer Sachverhalte, bietest strukturierte Lösungen und denkst kritisch mit.',
            provider: 'OpenAI',
            modelId: 'gpt-4o-mini',
            temperature: 0.7,
            isActive: true,
            sortOrder: 1
        },
        {
            name: 'Deep Thinking',
            icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
            gradient: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            description: 'Nutzt erweiterte Denkprozesse für tiefgreifende Logik und Problemlösung.',
            category: 'Reasoning',
            systemPrompt: 'Du bist ein Deep Thinking Assistent. Nutze Chain-of-Thought, um komplexe Probleme Schritt für Schritt zu lösen.',
            provider: 'OpenAI',
            modelId: 'gpt-5.1',
            temperature: 0.7,
            isActive: true,
            sortOrder: 2
        },
        {
            name: 'Vertrags-Check',
            icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
            gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            description: 'Analysiert Dokumente und Verträge auf Risiken und Anomalien.',
            category: 'Legal',
            systemPrompt: 'Du bist ein spezialisierter Assistent für Vertragsanalysen. Prüfe Texte auf rechtliche Risiken, Unklarheiten und Nachteile.',
            provider: 'OpenAI',
            modelId: 'gpt-4o',
            temperature: 0.3,
            isActive: true,
            sortOrder: 3
        }
    ];

    console.log(`Start seeding assistants...`);

    for (const a of assistants) {
        const exists = await prisma.assistant.findFirst({ where: { name: a.name } });
        if (!exists) {
            await prisma.assistant.create({ data: a });
            console.log(`Created assistant: ${a.name}`);
        } else {
            console.log(`Assistant already exists: ${a.name}`);
        }
    }

    console.log(`Seeding finished.`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
