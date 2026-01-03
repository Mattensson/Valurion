const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@valurion.at';
    const password = 'admin'; // Temporary password

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create Tenant
    let tenant = await prisma.tenant.findFirst({ where: { name: 'Valurion' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Valurion',
            },
        });
        console.log('Created Tenant:', tenant.id);
    } else {
        console.log('Tenant already exists:', tenant.id);
    }

    // 2. Create User
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN',
                tenantId: tenant.id,
            },
        });
        console.log('Created User:', user.email);
        console.log('Password set to:', password);
    } else {
        console.log('User already exists');
        // Optional: Reset password if user exists but can't login?
        // For now, let's assume if it exists it's fine.
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
