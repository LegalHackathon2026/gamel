'use client';
// app/error.tsx
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)', marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: 'var(--gray-600)', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>{error.message || 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="btn-primary">Try Again</button>
    </div>
  );
}
