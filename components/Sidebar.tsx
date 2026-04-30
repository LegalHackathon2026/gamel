'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

export default function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0,
      width: 'var(--spacing-sidebar)',
      background: 'var(--color-navy)',
      display: 'none',
      flexDirection: 'column',
      padding: '24px 16px',
      zIndex: 100,
      transition: 'background 0.3s',
    }}
    className="sidebar-desktop">
      {/* Logo */}
      <Link href="/dashboard" style={{ textDecoration: 'none', marginBottom: 40, display: 'block' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>⚖️</div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800, fontSize: 22,
            color: 'white',
            letterSpacing: '-0.5px',
          }}>Gamell</span>
        </div>
      </Link>

      {/* Nav Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
                borderLeft: active ? '3px solid var(--color-gold)' : '3px solid transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 15,
                  color: active ? 'var(--color-gold)' : 'rgba(255,255,255,0.7)',
                }}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom tagline */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.5 }}>
        Learn Nigerian Law<br/>One XP at a time
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: flex !important; }
        }
      `}</style>
    </aside>
  );
}
