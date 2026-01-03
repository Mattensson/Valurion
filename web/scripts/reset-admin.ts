import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function resetAdminUser() {
    try {
        console.log('🔍 Checking for admin user...');

        // Check if admin user exists
        let adminUser = await prisma.user.findUnique({
            where: { email: 'admin@valurion.at' }
        });

        if (adminUser) {
            console.log('✅ Admin user found:', adminUser.email);
            console.log('   Role:', adminUser.role);
            console.log('   Tenant ID:', adminUser.tenantId);

            // Reset password
            const newPasswordHash = await hashPassword('admin');
            await prisma.user.update({
                where: { id: adminUser.id },
                data: { passwordHash: newPasswordHash }
            });

            console.log('✅ Password reset to: admin');
        } else {
            console.log('❌ Admin user not found. Creating new admin user...');

            // Get or create tenant
            let tenant = await prisma.tenant.findFirst();

            if (!tenant) {
                tenant = await prisma.tenant.create({
                    data: {
                        name: 'Valurion'
                    }
                });
                console.log('✅ Created new tenant:', tenant.name);
            }

            // Create admin user
            const passwordHash = await hashPassword('admin');
            adminUser = await prisma.user.create({
                data: {
                    email: 'admin@valurion.at',
                    firstName: 'Admin',
                    lastName: 'User',
                    passwordHash,
                    role: 'SUPER_ADMIN',
                    tenantId: tenant.id
                }
            });

            console.log('✅ Created new admin user');
            console.log('   Email: admin@valurion.at');
            console.log('   Password: admin');
            console.log('   Role: SUPER_ADMIN');
        }

        console.log('\n✅ Done! You can now login with:');
        console.log('   Email: admin@valurion.at');
        console.log('   Password: admin');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminUser();
