'use client';

import { useState, useRef, useEffect } from 'react';
import { transcribeAudio, getTranscripts, deleteTranscript } from '@/app/actions/transcribe';

const renderContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export default function TranscribePage() {
    const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);

    // Archive State
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalPosition, setDeleteModalPosition] = useState({ x: 0, y: 0 });
    const [transcriptToDelete, setTranscriptToDelete] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadTranscripts();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const loadTranscripts = async () => {
        try {
            const data = await getTranscripts();
            setTranscripts(data);
        } catch (error) {
            console.error('Error loading transcripts:', error);
        }
    };

    const formatDate = (date: string | Date) => {
        return new Date(date).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (file: File) => {
        if (file.size > 25 * 1024 * 1024) {
            setError('Datei ist zu groß (Max 25MB)');
            return;
        }
        setFile(file);
        setError('');
        // We don't clear transcription immediately to allow comparing, but maybe we should?
        // Let's keep previous output until new one is generated.
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            setError('');

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Zugriff auf Mikrofon verweigert oder nicht verfügbar.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);

            setTimeout(() => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
                setFile(file);
            }, 100);
        }
    };

    const handleTranscribe = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', activeTab === 'record' ? 'RECORDING' : 'UPLOAD');

        try {
            const result = await transcribeAudio(formData);
            if (result.success && result.text) {
                setTranscription(result.text);
                if (result.transcription) {
                    setSelectedTranscriptId(result.transcription.id);
                }
                await loadTranscripts();
            } else {
                setError(result.error || 'Unbekannter Fehler');
            }
        } catch (err) {
            setError('Verbindungsfehler zum Server');
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(transcription);
    };

    const handleDeleteTranscript = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setTranscriptToDelete(id);
        setDeleteModalPosition({ x: e.clientX, y: e.clientY });
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!transcriptToDelete) return;

        await deleteTranscript(transcriptToDelete);

        if (selectedTranscriptId === transcriptToDelete) {
            setTranscription('');
            setSelectedTranscriptId(null);
        }
        await loadTranscripts();

        setDeleteModalOpen(false);
        setTranscriptToDelete(null);
    };

    const selectTranscript = (t: any) => {
        setTranscription(t.text);
        setSelectedTranscriptId(t.id);
    };

    return (
        <div style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', overflowY: 'auto', maxHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    Audio Transkription
                </h1>
                <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Verwandeln Sie Sprache in Text mit OpenAI Whisper. Archiviert automatisch.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
                {/* Left Column: Input and Archive */}
                <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Input Card */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                            <button
                                onClick={() => { setActiveTab('upload'); setFile(null); setError(''); }}
                                style={{
                                    padding: '0.5rem 0',
                                    paddingBottom: '0.75rem',
                                    flex: 1,
                                    color: activeTab === 'upload' ? '#fff' : 'hsl(var(--muted-foreground))',
                                    fontWeight: 500,
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'upload' ? '2px solid #01b4d8' : '2px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'center'
                                }}
                            >
                                Upload
                            </button>
                            <button
                                onClick={() => { setActiveTab('record'); setFile(null); setError(''); }}
                                style={{
                                    padding: '0.5rem 0',
                                    paddingBottom: '0.75rem',
                                    flex: 1,
                                    color: activeTab === 'record' ? '#fff' : 'hsl(var(--muted-foreground))',
                                    fontWeight: 500,
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'record' ? '2px solid #01b4d8' : '2px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'center'
                                }}
                            >
                                Aufnahme
                            </button>
                        </div>

                        {activeTab === 'upload' && !file && (
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                style={{
                                    border: `2px dashed ${dragActive ? '#01b4d8' : 'rgba(255,255,255,0.2)'}`,
                                    borderRadius: '0.75rem',
                                    padding: '2rem 1rem',
                                    textAlign: 'center',
                                    background: dragActive ? 'rgba(1, 180, 216, 0.05)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleChange} accept="audio/*" />
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.7 }}>📁</div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Datei hierher ziehen</div>
                            </div>
                        )}

                        {activeTab === 'record' && !file && (
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                {!isRecording ? (
                                    <button
                                        onClick={startRecording}
                                        style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '50%',
                                            background: '#ef4444',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginBottom: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTime(recordingTime)}
                                        </div>
                                        <button onClick={stopRecording} className="btn" style={{ padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2rem', color: 'white' }}>
                                            Stoppen
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {file && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div>🎵</div>
                                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>{file.name}</div>
                                    <button onClick={() => { setFile(null); setTranscription(''); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>✕</button>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleTranscribe}
                                    disabled={isProcessing}
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    {isProcessing ? 'Verarbeite...' : 'Transkribieren'}
                                </button>
                            </div>
                        )}

                        {error && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Archive List */}
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Verlauf
                        </h3>
                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                            {transcripts.map((t) => (
                                <div
                                    key={t.id}
                                    onClick={() => selectTranscript(t)}
                                    className="glass-panel"
                                    style={{
                                        padding: '1rem',
                                        marginBottom: '0.75rem',
                                        cursor: 'pointer',
                                        border: selectedTranscriptId === t.id ? '1px solid #01b4d8' : '1px solid transparent',
                                        background: selectedTranscriptId === t.id ? 'rgba(1, 180, 216, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <div style={{
                                            fontSize: '1.2rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '6px'
                                        }}>
                                            {t.source === 'RECORDING' ? '🎤' : '📁'}
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {t.title || 'Ohne Titel'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                                {formatDate(t.createdAt)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteTranscript(e, t.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                opacity: 0.5,
                                                padding: '0.25rem',
                                                color: 'inherit',
                                                transition: 'opacity 0.2s'
                                            }}
                                            title="Löschen"
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {transcripts.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', padding: '2rem' }}>
                                    Noch keine Transkripte.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Result */}
                <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
                    {transcription ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Inhalt</h2>
                                <button
                                    onClick={copyToClipboard}
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    📋 Kopieren
                                </button>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem', overflowY: 'auto', flex: 1 }}>
                                {renderContent(transcription)}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📝</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 500 }}>Wählen Sie ein Transkript aus oder starten Sie eine neue Aufnahme</div>
                        </div>
                    )}
                </div>
            </div>

            {deleteModalOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={() => { setDeleteModalOpen(false); setTranscriptToDelete(null); }}
                    />
                    <div
                        className="glass-panel"
                        style={{
                            position: 'fixed',
                            left: `${deleteModalPosition.x}px`,
                            top: `${deleteModalPosition.y}px`,
                            transform: 'translate(-90%, 10px)',
                            padding: '1rem',
                            zIndex: 9999,
                            minWidth: '200px',
                            background: '#1a1a1a',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
                            Wirklich löschen?
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setDeleteModalOpen(false); setTranscriptToDelete(null); }}
                                className="btn btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                            >
                                Nein
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="btn"
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '0.25rem 0.75rem',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Ja
                            </button>
                        </div>
                    </div>
                </>
            )}

            <style jsx>{`
                /* Scrollbar Styling for Sidebar */
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1); 
                    border-radius: 3px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2); 
                }
            `}</style>
        </div>
    );
}
