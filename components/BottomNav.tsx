'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

export default function BottomNav({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--nav-height-bottom)',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="bottom-nav-mobile">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{item.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? 'var(--color-gold)' : 'var(--text-tertiary)',
              }}>{item.label}</span>
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', marginTop: 1 }} />
              )}
            </Link>
          );
        })}
      </nav>

      <style>{`
        .bottom-nav-mobile { display: flex; }
        @media (min-width: 768px) {
          .bottom-nav-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
