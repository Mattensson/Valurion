'use server';

import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email('Ungültige Email-Adresse'),
    password: z.string().min(5, 'Passwort muss mindestens 5 Zeichen lang sein'),
});

export type LoginState = {
    errors?: {
        email?: string[];
        password?: string[];
        general?: string[];
    };
    message?: string;
};

export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Validate form data
    const validatedFields = loginSchema.safeParse({ email, password });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return {
                // Obscure whether user exists or not for security
                errors: { general: ['Ungültige Anmeldedaten.'] },
            };
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
            return {
                errors: { general: ['Ungültige Anmeldedaten.'] },
            };
        }

        // Create session
        await createSession(user.id, user.tenantId, user.role);

    } catch (error) {
        console.error('Login Error:', error);
        return {
            message: 'Ein unerwarteter Fehler ist aufgetreten.',
        };
    }

    // Redirect after successful login (must be outside try-catch)
    redirect('/dashboard');
}
