const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@valurion.at';
    const password = 'admin'; // Simple password for dev
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Tenant
    const tenant = await prisma.tenant.create({
        data: {
            name: 'Valurion Inc.',
        },
    });

    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

    // Create Admin User
    const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            passwordHash,
            role: 'ADMIN',
            tenantId: tenant.id,
        },
    });

    console.log(`Created user: ${user.email} (${user.id})`);
    console.log(`Password: ${password}`);
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
