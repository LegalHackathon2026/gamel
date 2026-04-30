// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: 'var(--cream)' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>⚖️</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-1px' }}>404</h1>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--gray-600)', marginBottom: 24 }}>This page doesn't exist in Nigerian law or anywhere else.</h2>
      <Link href="/dashboard" className="btn-primary">Back to Dashboard</Link>
    </div>
  );
}
