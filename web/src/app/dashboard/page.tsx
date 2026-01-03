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
                            <div style={{ fontSize: '2.5rem' }}>💬</div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>AI Chat starten</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Lösen Sie komplexe Aufgaben mit Valurion AI 4.0
                            </div>
                        </div>
                    </a>

                    <a href="/dashboard/docs" style={{ textDecoration: 'none' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <div style={{ fontSize: '2.5rem' }}>📁</div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Dokumente verwalten</div>
                            <div style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                                Laden Sie Verträge und Dateien zur Analyse hoch
                            </div>
                        </div>
                    </a>

                    <a href="/dashboard/companies" style={{ textDecoration: 'none', gridColumn: 'span 2' }}>
                        <div className="glass-panel btn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%' }}>
                            <div style={{ fontSize: '2.5rem' }}>🏢</div>
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
