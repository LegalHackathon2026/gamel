// components/ThemeToggle.tsx
'use client';

import { useTheme } from './ThemeProvider';
import { useState } from 'react';

export default function ThemeToggle() {
  const { isDark, setTheme, theme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setShowMenu(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          fontSize: 18,
          transition: 'all 0.2s',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
        }}
        title="Toggle theme"
      >
        {isDark ? '🌙' : '☀️'}
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
            minWidth: 150,
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {[
            { value: 'light' as const, label: '☀️ Light' },
            { value: 'dark' as const, label: '🌙 Dark' },
            { value: 'system' as const, label: '💻 System' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleThemeChange(option.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: theme === option.value ? 'var(--bg-tertiary)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: theme === option.value ? 700 : 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                if (theme !== option.value) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
