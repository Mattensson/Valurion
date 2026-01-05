import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const configs = await prisma.aIModelConfig.findMany();
    fs.writeFileSync('db-config-output.json', JSON.stringify(configs, null, 2));
    console.log("Done");
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
