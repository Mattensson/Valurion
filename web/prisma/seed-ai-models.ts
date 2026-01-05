import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding AI Model Configurations (User Confirmed)...');

    // OpenAI Models (unchanged)
    await prisma.aIModelConfig.upsert({
        where: { provider_mode: { provider: 'OpenAI', mode: 'fast' } },
        update: { modelId: 'gpt-4o-mini' },
        create: { provider: 'OpenAI', mode: 'fast', modelId: 'gpt-4o-mini' }
    });

    await prisma.aIModelConfig.upsert({
        where: { provider_mode: { provider: 'OpenAI', mode: 'thinking' } },
        update: { modelId: 'gpt-4o' },
        create: { provider: 'OpenAI', mode: 'thinking', modelId: 'gpt-4o' }
    });

    // Gemini Models - Confirmed Working Models 2026
    await prisma.aIModelConfig.upsert({
        where: { provider_mode: { provider: 'Gemini', mode: 'fast' } },
        update: { modelId: 'gemini-2.5-flash' },
        create: { provider: 'Gemini', mode: 'fast', modelId: 'gemini-2.5-flash' }
    });
    console.log('✓ Gemini Fast -> gemini-2.5-flash');

    await prisma.aIModelConfig.upsert({
        where: { provider_mode: { provider: 'Gemini', mode: 'thinking' } },
        update: { modelId: 'gemini-3-flash-preview' },
        create: { provider: 'Gemini', mode: 'thinking', modelId: 'gemini-3-flash-preview' }
    });
    console.log('✓ Gemini Thinking -> gemini-3-flash-preview');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
