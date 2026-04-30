// components/NavWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ThemeToggle from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', emoji: '🏠' },
  { href: '/learn', label: 'Learn', emoji: '📚' },
  { href: '/chat', label: 'AI Chat', emoji: '💬' },
  { href: '/community', label: 'Community', emoji: '👥' },
  { href: '/profile', label: 'Profile', emoji: '👤' },
];

export default function NavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === '/' || pathname === '/auth';

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={NAV_ITEMS} />
      <main className="main-content">
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }}>
          <ThemeToggle />
        </div>
        {children}
      </main>
      <BottomNav navItems={NAV_ITEMS} />
    </div>
  );
}
