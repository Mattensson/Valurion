"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getActiveAssistants } from '@/app/actions/admin';

export default function AssistantsPage() {
    const router = useRouter();
    const [assistants, setAssistants] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadAssistants();
    }, []);

    const loadAssistants = async () => {
        try {
            const data = await getActiveAssistants();
            setAssistants(data);
        } catch (error) {
            console.error('Failed to load assistants:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAssistant = (assistant: any) => {
        // Navigate to chat with assistant parameter
        const encodedPrompt = encodeURIComponent(assistant.systemPrompt);
        router.push(`/dashboard/chat?assistant=${assistant.id}&prompt=${encodedPrompt}&name=${encodeURIComponent(assistant.name)}&provider=${assistant.provider}&model=${assistant.modelId}&temp=${assistant.temperature}&icon=${encodeURIComponent(assistant.icon)}&gradient=${encodeURIComponent(assistant.gradient)}`);
    };

    if (isLoading) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Lade Assistenten...</div>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(to right, #fff, #94a3b8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    KI-Assistenten
                </h1>
                <p style={{
                    fontSize: '1.1rem',
                    color: 'hsl(var(--muted-foreground))',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    Wählen Sie einen spezialisierten Assistenten für Ihre Aufgabe
                </p>
            </div>

            {/* Assistants Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '1.5rem',
                maxWidth: '1400px',
                margin: '0 auto',
                width: '100%'
            }}>
                {assistants.map((assistant) => (
                    <div
                        key={assistant.id}
                        onClick={() => handleSelectAssistant(assistant)}
                        className="glass-panel btn"
                        style={{
                            padding: '0',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        {/* Gradient Header */}
                        <div style={{
                            background: assistant.gradient,
                            padding: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Animated background effect */}
                            <div style={{
                                position: 'absolute',
                                top: '-50%',
                                right: '-50%',
                                width: '200%',
                                height: '200%',
                                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                                animation: 'pulse 4s ease-in-out infinite'
                            }} />

                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                    position: 'relative',
                                    zIndex: 1
                                }}
                            >
                                <path d={assistant.icon} />
                            </svg>
                            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    fontWeight: 700,
                                    fontSize: '1.25rem',
                                    color: 'white',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    marginBottom: '0.25rem'
                                }}>
                                    {assistant.name}
                                </div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.9)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    fontWeight: 600
                                }}>
                                    {assistant.category}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{
                            padding: '1.5rem',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'hsl(var(--muted-foreground))',
                                lineHeight: '1.6',
                                margin: 0
                            }}>
                                {assistant.description}
                            </p>

                            {/* CTA Button */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: '0.5rem',
                                borderTop: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <span style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: 'hsl(var(--primary))'
                                }}>
                                    Chat starten
                                </span>
                                <span style={{
                                    fontSize: '1.25rem',
                                    color: 'hsl(var(--primary))',
                                    transition: 'transform 0.2s'
                                }}>
                                    →
                                </span>
                            </div>
                        </div>

                        {/* Hover effect overlay */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            pointerEvents: 'none'
                        }}
                            className="hover-overlay"
                        />
                    </div>
                ))}
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.5;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }

                .glass-panel:hover .hover-overlay {
                    opacity: 1 !important;
                }

                .glass-panel:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );
}
