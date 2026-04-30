// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import NavWrapper from '@/components/NavWrapper';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Gamell - Gamified Law Learning',
  description: 'The gamified way to learn Nigerian law. Earn XP, complete scenarios, and become legally literate.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <NavWrapper>{children}</NavWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
