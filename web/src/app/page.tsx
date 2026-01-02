import Link from 'next/link';

export default function Home() {
  return (
    <div className="container-custom" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0a0a0a 100%)'
    }}>
      <div className="glass-panel" style={{ padding: '4rem', borderRadius: '1rem', textAlign: 'center', maxWidth: '600px', width: '100%' }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em'
        }}>
          Valurion
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2.5rem', fontSize: '1.125rem', lineHeight: '1.6' }}>
          Der sichere Business-Chatbot für<br />strukturiertes Entscheiden.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Login</button>
          <button className="btn btn-ghost" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Demo anfragen</button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
        v1.0 • Secure • Mandantenfähig
      </div>
    </div>
  );
}
