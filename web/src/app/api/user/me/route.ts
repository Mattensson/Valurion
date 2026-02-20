import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/user/me
 * Get current user information
 */
export async function GET(request: Request) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json({ user });

    } catch (error) {
        console.error('Error fetching current user:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user' },
            { status: 500 }
        );
    }
}
