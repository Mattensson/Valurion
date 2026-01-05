import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updatedAssistants = [
    {
        name: 'Vertrags-Analyst',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        gradient: 'linear-gradient(135deg, rgba(30, 58, 138, 0.9) 0%, rgba(30, 64, 175, 0.8) 100%)',
    },
    {
        name: 'Business Consultant',
        icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        gradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.9) 0%, rgba(29, 78, 216, 0.8) 100%)',
    },
    {
        name: 'Daten-Analyst',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.9) 0%, rgba(14, 165, 233, 0.8) 100%)',
    },
    {
        name: 'Content Creator',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
        gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(124, 58, 237, 0.8) 100%)',
    },
    {
        name: 'Research Assistant',
        icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.8) 100%)',
    }
];

async function main() {
    console.log('🔄 Updating assistant icons and gradients...');

    for (const assistant of updatedAssistants) {
        await prisma.assistant.updateMany({
            where: { name: assistant.name },
            data: {
                icon: assistant.icon,
                gradient: assistant.gradient
            }
        });

        console.log(`✓ Updated assistant: ${assistant.name}`);
    }

    console.log('✅ Update complete!');
}

main()
    .catch((e) => {
        console.error('Error updating:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
