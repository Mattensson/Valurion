'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateProtocol, saveProtocol, getProtocols } from '@/app/actions/protocol';

function ProtocolContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [view, setView] = useState<'list' | 'edit' | 'loading'>('loading');
    const [protocols, setProtocols] = useState<any[]>([]);

    // Editor State
    const [editorData, setEditorData] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        checkInitState();
    }, []);

    const checkInitState = async () => {
        const createMode = searchParams.get('create');
        const draft = sessionStorage.getItem('valurion_protocol_draft');

        if (draft && createMode === 'true') {
            try {
                const data = JSON.parse(draft);
                // Setup new draft from transcript
                setEditorData({
                    ...data,
                    isNew: true,
                    // data.id comes from transcript ID but we handle it as source
                    transcriptionId: data.id !== 'new' ? data.id : null,
                    transcriptText: data.content
                });
                setTitle(data.title);
                setContent('');
                setView('edit');
            } catch (e) {
                console.error("Error parsing protocol draft", e);
                loadProtocols();
            }
        } else {
            loadProtocols();
        }
    };

    const loadProtocols = async () => {
        const res = await getProtocols();
        setProtocols(res);
        setView('list');
    };

    const handleOpenProtocol = (p: any) => {
        setEditorData({
            id: p.id,
            title: p.title,
            date: p.createdAt,
            transcriptionId: p.transcriptionId,
            transcriptText: p.transcription?.text,
            isNew: false
        });
        setTitle(p.title);
        setContent(p.content);
        setError('');
        setView('edit');
    };

    const handleCreateNew = () => {
        // Navigate to transcription to select source
        router.push('/dashboard/transcribe');
    };

    const handleGenerateAI = async () => {
        const sourceText = editorData?.transcriptText;

        if (!sourceText || isGenerating) return;

        setIsGenerating(true);
        setError('');
        try {
            const result = await generateProtocol(sourceText);
            if (result.success && result.protocol) {
                setContent(result.protocol);
            } else {
                setError(result.error || 'Generierung fehlgeschlagen.');
            }
        } catch (e: any) {
            console.error('Generation error', e);
            setError(e.message || 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            setError('Titel und Inhalt dürfen nicht leer sein.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await saveProtocol({
                id: editorData.isNew ? undefined : editorData.id,
                title,
                content,
                transcriptionId: editorData.transcriptionId
            });

            if (res.success) {
                sessionStorage.removeItem('valurion_protocol_draft');
                loadProtocols(); // This switches view to 'list'
            } else {
                setError(res.error || 'Speichern fehlgeschlagen');
            }
        } catch (e: any) {
            console.error('Save error', e);
            setError(e.message || 'Fehler beim Speichern');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        sessionStorage.removeItem('valurion_protocol_draft');
        if (editorData?.isNew && protocols.length === 0) {
            // If it was the first interaction and cancelled, maybe go back to transcribe?
            // But usually just list.
        }
        loadProtocols();
    };

    if (view === 'loading') {
        return <div style={{ padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>Lade...</div>;
    }

    // --- LIST VIEW ---
    if (view === 'list') {
        return (
            <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Protokolle
                        </h1>
                        <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                            Verwalten Sie Ihre Meeting-Protokolle.
                        </p>
                    </div>
                </div>

                {protocols.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.5 }}>📭</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Keine Protokolle vorhanden</h3>
                        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem', maxWidth: '400px' }}>
                            Sie haben noch keine Protokolle erstellt. Starten Sie eine Transkription, um ein Protokoll zu generieren.
                        </p>
                        <button
                            onClick={handleCreateNew}
                            className="btn btn-primary"
                            style={{ background: '#01b4d8', border: 'none', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            🎤 Zur Transkription
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {/* Add New Card */}
                        <div
                            onClick={handleCreateNew}
                            className="glass-panel hover-scale"
                            style={{
                                padding: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: '2px dashed rgba(255,255,255,0.1)',
                                background: 'transparent',
                                minHeight: '200px'
                            }}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: '1rem', color: '#01b4d8' }}>+</div>
                            <div style={{ fontWeight: 600 }}>Neues Protokoll</div>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>via Transkription</div>
                        </div>

                        {protocols.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => handleOpenProtocol(p)}
                                className="glass-panel hover-scale"
                                style={{
                                    padding: '1.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    minHeight: '200px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '0.5rem',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        color: '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.25rem'
                                    }}>
                                        📝
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                        {new Date(p.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                                        {p.title}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineClamp: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {p.content.substring(0, 150)}...
                                    </p>
                                </div>
                                {p.transcription && (
                                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>🎤</span> Basierend auf Transkript
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <style jsx>{`
                    .hover-scale {
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                    }
                    .hover-scale:hover {
                        transform: translateY(-4px);
                        box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                    }
                `}</style>
            </div>
        );
    }

    // --- EDITOR VIEW ---
    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={handleCancel}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0.5rem', borderRadius: '50%' }}
                >
                    ←
                </button>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {editorData?.isNew ? 'Neues Protokoll' : 'Protokoll bearbeiten'}
                    </h1>
                </div>
            </div>

            <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0 }}>
                {/* Header Section */}
                <div>
                    <div style={{ paddingBottom: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Protokoll Titel
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: '100%',
                                fontSize: '1.75rem',
                                fontWeight: 600,
                                background: 'transparent',
                                border: 'none',
                                color: 'hsl(var(--foreground))',
                                outline: 'none',
                                padding: '0.5rem 0'
                            }}
                            placeholder="Titel eingeben..."
                        />
                    </div>

                    {/* Compact Source Info (Only if existing transcript) */}
                    {(editorData?.transcriptText || editorData?.transcriptionId) && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.75rem 1rem',
                            background: 'rgba(1, 180, 216, 0.05)',
                            border: '1px solid rgba(1, 180, 216, 0.1)',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgba(1, 180, 216, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                color: '#01b4d8'
                            }}>
                                🎤
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>{editorData?.title}</span> {/* Show original transcript title if available in meta */}
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '0.15rem 0.5rem',
                                        background: 'rgba(1, 180, 216, 0.15)',
                                        color: '#01b4d8',
                                        borderRadius: '1rem',
                                        fontWeight: 600,
                                        textTransform: 'uppercase'
                                    }}>
                                        Quell-Datensatz
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span>{(editorData?.transcriptText?.length || 0).toLocaleString()} Zeichen</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Full Width Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                    }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>📝</span> PROTOKOLL
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {error && (
                                <span style={{ color: '#ef4444', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                                    ⚠️ {error}
                                </span>
                            )}
                            {editorData?.transcriptText && (
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating}
                                    className="btn btn-sm"
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.4rem 1rem',
                                        background: isGenerating ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.1)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        borderRadius: '1rem',
                                        cursor: isGenerating ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isGenerating ? (
                                        <>
                                            <span className="animate-spin">↻</span> Generiere...
                                        </>
                                    ) : (
                                        <>✨ AI Generieren</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '1.5rem',
                            resize: 'none',
                            lineHeight: '1.6',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            background: 'rgba(0,0,0,0.03)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderRadius: '0.75rem',
                            color: 'hsl(var(--foreground))',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        placeholder={isGenerating ? "Analysiere Transkript und Strategie..." : "Hier entsteht das Protokoll..."}
                        onFocus={(e) => e.target.style.borderColor = '#10b981'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
                    />
                </div>

                {/* Footer / Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <button onClick={handleCancel} className="btn btn-ghost" disabled={isSaving}>Abbrechen</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn btn-primary"
                        style={{ background: '#01b4d8', border: 'none', paddingLeft: '2rem', paddingRight: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {isSaving ? 'Speichere...' : 'Speichern'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                /* ... scrollbars ... */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1); 
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.2); 
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                    display: inline-block;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default function ProtocolPage() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>Lade Protokollierung...</div>}>
            <ProtocolContent />
        </Suspense>
    );
}
