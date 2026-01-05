
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const assistants = [
        {
            name: 'Vertrags-Analyst',
            // FileText icon
            icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
            gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            description: 'Spezialisiert auf Vertragsanalyse, Risikobewertung und rechtliche Prüfung von Dokumenten',
            category: 'Legal',
            systemPrompt: 'Du bist ein spezialisierter Assistent für Vertragsanalysen. Prüfe Texte auf rechtliche Risiken, Unklarheiten und Nachteile.',
            provider: 'OpenAI',
            modelId: 'gpt-4o',
            temperature: 0.3,
            isActive: true,
            sortOrder: 1
        },
        {
            name: 'Business Consultant',
            // Briefcase icon
            icon: 'M20 7h-4V4c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v3H4c-1.103 0-2 .897-2 2v11c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V9c0-1.103-.897-2-2-2zM10 4h4v3h-4V4z',
            gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
            description: 'Strategische Unternehmensberatung, Geschäftsmodell-Entwicklung und Wachstumsstrategien',
            category: 'Business',
            systemPrompt: 'Du bist ein erfahrener Unternehmensberater. Hilf bei der Strategieentwicklung, Business-Analysen und Markteinschätzungen.',
            provider: 'OpenAI',
            modelId: 'gpt-4o',
            temperature: 0.7,
            isActive: true,
            sortOrder: 2
        },
        {
            name: 'Daten-Analyst',
            // BarChart icon
            icon: 'M12 20V10 M18 20V4 M6 20v-6',
            gradient: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)',
            description: 'Finanzanalysen, Datenauswertung und Business Intelligence',
            category: 'Analytics',
            systemPrompt: 'Du bist ein Daten-Analyst. Interpretiere Zahlen und Daten, finde Trends und erstelle Berichte.',
            provider: 'OpenAI',
            modelId: 'gpt-4o',
            temperature: 0.2, // Precise
            isActive: true,
            sortOrder: 3
        },
        {
            name: 'Content Creator',
            // Edit/Pen icon
            icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
            description: 'Marketing-Texte, Social Media Content und kreative Kommunikation',
            category: 'Marketing',
            systemPrompt: 'Du bist ein kreativer Content Creator. Erstelle ansprechende Texte für Marketing, Social Media und Blogs.',
            provider: 'OpenAI',
            modelId: 'gpt-4o',
            temperature: 0.9, // Creative
            isActive: true,
            sortOrder: 4
        },
        {
            name: 'Research Assistant',
            // Search icon (Magnifying glass)
            icon: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
            gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            description: 'Tiefgehende Recherchen, Marktanalysen und wissenschaftliche Aufbereitung',
            category: 'Research',
            systemPrompt: 'Du bist ein Research Assistant. Führe gründliche Recherchen durch, finde Fakten und bereite komplexe Themen verständlich auf.',
            provider: 'OpenAI',
            modelId: 'gpt-4o-mini',
            temperature: 0.5,
            isActive: true,
            sortOrder: 5
        }
    ];
    console.log(`Clearing existing assistants...`);
    await prisma.assistant.deleteMany({}); // Clear table to ensure exact match

    console.log(`Start seeding assistants...`);

    for (const a of assistants) {
        await prisma.assistant.create({ data: a });
        console.log(`Created assistant: ${a.name}`);
    }

    console.log(`Seeding assistants finished.`);

    console.log(`Resetting AI Model Configs (Global Logic)...`);
    await prisma.aIModelConfig.deleteMany({});

    const modelConfigs = [
        { provider: 'OpenAI', mode: 'fast', modelId: 'gpt-4o-mini' },
        { provider: 'OpenAI', mode: 'thinking', modelId: 'gpt-4o' }, // O1/gpt-5 not yet fully supported with tools/system
        { provider: 'Gemini', mode: 'fast', modelId: 'gemini-1.5-flash' },
        { provider: 'Gemini', mode: 'thinking', modelId: 'gemini-1.5-pro' },
    ];

    for (const c of modelConfigs) {
        await prisma.aIModelConfig.create({ data: c });
        console.log(`Configured ${c.provider} / ${c.mode} -> ${c.modelId}`);
    }
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
