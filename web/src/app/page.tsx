import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="container-custom" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      // background: 'radial-gradient(circle at 50% 10%, #f0f9ff 0%, #ffffff 100%)' // Optional light gradient
    }}>
      <div className="glass-panel" style={{ padding: '4rem', borderRadius: '1rem', textAlign: 'center', maxWidth: '600px', width: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Image
            src="/img/logo-icon.png"
            alt="Valurion Logo"
            width={80}
            height={80}
            style={{ width: 'auto', height: '80px' }}
            priority
          />
        </div>

        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          marginBottom: '1rem',
          color: 'hsl(var(--foreground))',
          letterSpacing: '-0.02em',
        }}>
          Valurion
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2.5rem', fontSize: '1.125rem', lineHeight: '1.6' }}>
          Der sichere Business-Chatbot für<br />strukturiertes Entscheiden.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/login">
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Login</button>
          </Link>
          <button className="btn btn-ghost" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Demo anfragen</button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
        v1.0 • Secure • Mandantenfähig
      </div>
    </div>
  );
}
