"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { UserProfileModal } from './UserProfileModal';

interface SidebarProps {
    user?: {
        id: string;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        jobTitle?: string | null;
        avatarUrl?: string | null;
        tenantName: string;
        role: string;
    };
}

export function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const getLinkStyle = (path: string) => {
        const isActive = pathname === path;
        return {
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            width: '100%',
            color: 'hsl(var(--foreground))',
            background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            fontWeight: isActive ? 600 : 500,
            borderLeft: isActive ? '3px solid #01b4d8' : '3px solid transparent',
            paddingLeft: isCollapsed ? '0' : '0.75rem'
        };
    };

    const navItems = [
        { path: '/dashboard/chat', label: 'AI Chat', icon: '💬', svgPath: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
        { path: '/dashboard/docs', label: 'Dokumente', icon: '📁', svgPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
        { path: '/dashboard/companies', label: 'Unternehmen', icon: '🏢', svgPath: 'M3 21h18M5 21V7l8-4 8 4v14M6 10h2M6 14h2M6 18h2M10 6v14M14 10h2M14 14h2M14 18h2' },
        { path: '/dashboard/transcribe', label: 'Transkription', icon: '🎤', svgPath: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.66 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z' },
        { path: '/dashboard/protocol', label: 'Protokollierung', icon: '📑', svgPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
    ];

    return (
        <>
            <aside style={{
                width: isCollapsed ? '80px' : '260px',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(10px)',
                transition: 'width 0.3s ease',
                position: 'relative',
                boxShadow: '4px 0 12px rgba(0,0,0,0.08)',
                zIndex: 100
            }}>
                {/* Logo Header */}
                <Link
                    href="/dashboard"
                    style={{
                        padding: isCollapsed ? '1rem 0.5rem' : '1.5rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '96px',
                        transition: 'padding 0.3s ease',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}
                >
                    {isCollapsed ? (
                        <img
                            src="/valurion-ai-avatar.png"
                            alt="Valurion"
                            style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                        />
                    ) : (
                        <img
                            src="/img/valurion-app-logo.png"
                            alt="Valurion Logo"
                            style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
                        />
                    )}
                </Link>

                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        position: 'absolute',
                        right: '-12px',
                        top: '40px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#01b4d8',
                        border: '2px solid var(--background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 1000,
                        fontSize: '0.75rem',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s'
                    }}
                    className="hover:scale-110"
                >
                    {isCollapsed ? '›' : '‹'}
                </button>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: isCollapsed ? '1rem 0.5rem' : '1rem' }}>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <Link
                                    href={item.path}
                                    className="btn btn-ghost"
                                    style={getLinkStyle(item.path)}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ marginRight: isCollapsed ? '0' : '0.75rem', flexShrink: 0 }}
                                    >
                                        <path d={item.svgPath} />
                                    </svg>
                                    {!isCollapsed && item.label}
                                </Link>
                            </li>
                        ))}

                        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                            <li style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                <Link
                                    href="/dashboard/admin/ai-config"
                                    className="btn btn-ghost"
                                    style={getLinkStyle('/dashboard/admin/ai-config')}
                                    title={isCollapsed ? 'Admin' : undefined}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ marginRight: isCollapsed ? '0' : '0.75rem', flexShrink: 0 }}
                                    >
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v6m0 6v6m6-12l-6 6m0 0L6 7m0 10l6-6m0 0l6 6" />
                                    </svg>
                                    {!isCollapsed && 'Admin'}
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>

                {/* User Profile */}
                <div
                    style={{
                        padding: isCollapsed ? '1rem 0.5rem' : '1rem',
                        borderTop: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    className="hover:bg-black/5"
                    onClick={() => setIsProfileOpen(true)}
                    title={isCollapsed ? user?.name || 'User' : undefined}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0' : '0.75rem', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #01b4d8 0%, #0192b3 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            color: '#fff',
                            overflow: 'hidden',
                            flexShrink: 0
                        }}>
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                user?.name ? user.name[0].toUpperCase() : (user?.email?.[0].toUpperCase() || 'U')
                            )}
                        </div>
                        {!isCollapsed && (
                            <div style={{ fontSize: '0.875rem', overflow: 'hidden' }}>
                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user?.name || 'User'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user?.tenantName || 'Valurion Inc.'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {user && (
                <UserProfileModal
                    user={user}
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                />
            )}
        </>
    );
}
