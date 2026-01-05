export default function DashboardPage() {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Willkommen bei Valurion</h1>
                <p style={{ fontSize: '1.1rem', color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
                    Ihre KI-gestützte Plattform für Dokumentenanalyse und Prozessoptimierung.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                    <a href="/dashboard/chat" style={{ textDecoration: 'none' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01b4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>AI Chat starten</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Lösen Sie komplexe Aufgaben mit Valurion AI 4.0
                            </div>
                        </div>
                    </a>

                    <a href="/dashboard/docs" style={{ textDecoration: 'none' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01b4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Dokumente verwalten</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Laden Sie Verträge und Dateien zur Analyse hoch
                            </div>
                        </div>
                    </a>

                    <a href="/dashboard/assistants" style={{ textDecoration: 'none' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01b4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>KI-Assistenten</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Spezialisierte Assistenten für verschiedene Aufgaben
                            </div>
                        </div>
                    </a>

                    <a href="/dashboard/companies" style={{ textDecoration: 'none' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01b4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 21h18M5 21V7l8-4 8 4v14M6 10h2M6 14h2M6 18h2M10 6v14M14 10h2M14 14h2M14 18h2" />
                            </svg>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Unternehmen</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Verwalten Sie Unternehmensprofile und Strukturen
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}
