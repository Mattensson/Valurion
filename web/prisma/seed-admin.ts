import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding admin user...');

    // Create or find the default tenant
    let tenant = await prisma.tenant.findFirst({
        where: { name: 'Valurion' }
    });

    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Valurion'
            }
        });
        console.log('✓ Created tenant: Valurion');
    } else {
        console.log('✓ Tenant already exists: Valurion');
    }

    // Check if admin user exists
    const existingAdmin = await prisma.user.findFirst({
        where: { email: 'admin@valurion.at' }
    });

    if (existingAdmin) {
        console.log('✓ Admin user already exists');
        return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
        data: {
            email: 'admin@valurion.at',
            firstName: 'Admin',
            lastName: 'User',
            jobTitle: 'System Administrator',
            passwordHash,
            role: 'SUPER_ADMIN',
            tenantId: tenant.id
        }
    });

    console.log('✅ Created admin user:');
    console.log('   Email: admin@valurion.at');
    console.log('   Password: admin123');
    console.log('   Role: SUPER_ADMIN');
}

main()
    .catch((e) => {
        console.error('Error seeding admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
