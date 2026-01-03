'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { loginAction } from './actions';

// Submit Button Component for Loading State
function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="btn btn-primary w-full"
            style={{ padding: '0.875rem', opacity: pending ? 0.7 : 1 }}
        >
            {pending ? 'Wird angemeldet...' : 'Anmelden'}
        </button>
    );
}

export default function LoginPage() {
    const [state, action] = useActionState(loginAction, {});

    return (
        <div className="container-custom" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient Background */}
            <div style={{
                position: 'absolute',
                top: '-20%',
                left: '-10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
                filter: 'blur(60px)',
                zIndex: -1
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-5%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)',
                filter: 'blur(60px)',
                zIndex: -1
            }} />

            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '2.5rem',
                borderRadius: '1rem',
            }}>
                <div className="text-center mb-8">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <Image
                            src="/img/logo-icon.png"
                            alt="Valurion Logo"
                            width={64}
                            height={64}
                            style={{ width: 'auto', height: '64px' }}
                            priority
                        />
                    </div>
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 'bold',
                        marginBottom: '0.5rem',
                        color: 'hsl(var(--foreground))'
                    }}>
                        Welcome Back
                    </h1>
                    <p className="text-muted text-sm">
                        Melden Sie sich an, um auf Ihren Workspace zuzugreifen.
                    </p>
                </div>

                <form action={action}>
                    {state.message && (
                        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                            {state.message}
                        </div>
                    )}
                    {state.errors?.general && (
                        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                            {state.errors.general[0]}
                        </div>
                    )}

                    <div className="input-group">
                        <label className="label" htmlFor="email">Email Adresse</label>
                        <input
                            name="email"
                            type="email"
                            id="email"
                            className="input-field"
                            placeholder="name@company.com"
                            autoComplete="email"
                            required
                        />
                        {state.errors?.email && (
                            <p className="text-sm text-red-400 mt-1">{state.errors.email[0]}</p>
                        )}
                    </div>

                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label className="label" htmlFor="password" style={{ marginBottom: 0 }}>Passwort</label>
                        </div>
                        <input
                            name="password"
                            type="password"
                            id="password"
                            className="input-field"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                        />
                        {state.errors?.password && (
                            <p className="text-sm text-red-400 mt-1">{state.errors.password[0]}</p>
                        )}
                    </div>

                    <SubmitButton />
                </form>

                <div className="text-center" style={{ marginTop: '2rem' }}>
                    <p className="text-sm text-muted">
                        Noch keinen Account?{' '}
                        <Link href="/register" style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                            Registrieren
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
