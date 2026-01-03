import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/Sidebar';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { tenant: true }
    });

    if (!user) {
        redirect('/login');
    }

    const userData = {
        id: user.id,
        email: user.email,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.email),
        firstName: user.firstName,
        lastName: user.lastName,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        tenantName: user.tenant.name,
        role: user.role
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
            <Sidebar user={userData} />

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {children}
            </main>
        </div>
    );
}
