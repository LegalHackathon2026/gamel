'use client';

import Link from 'next/link';

const GAMES = [
  {
    href: '/learn/flashcards',
    emoji: '⚡',
    title: 'Flashcards',
    description: 'Test your knowledge with quick question-and-answer cards covering key Nigerian legal concepts.',
    xp: '+10 XP per card',
    difficulty: 'All levels',
    cards: '35 cards available',
    color: 'var(--gold)',
    bg: '#FFFBF0',
  },
  {
    href: '/learn/rpg',
    emoji: '⚖️',
    title: 'Legal RPG',
    description: 'Step into real Nigerian legal situations. Make decisions, learn consequences, and apply the law.',
    xp: '+100 XP per scenario',
    difficulty: 'Beginner to Advanced',
    cards: '26 scenarios',
    color: 'var(--navy)',
    bg: '#F0F4FF',
  },
  {
    href: '/learn/facts',
    emoji: '💡',
    title: 'Did You Know?',
    description: 'Bite-sized legal facts about Nigerian law, courts, and your everyday rights.',
    xp: '+5 XP per fact',
    difficulty: 'Beginner friendly',
    cards: '35 facts',
    color: 'var(--green)',
    bg: '#F0FFF8',
  },
];

export default function LearnPage() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--navy)', letterSpacing: '-0.5px', marginBottom: 8 }}>
          Choose your game 🎮
        </h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 16 }}>
          Pick a learning mode and start earning XP. Every mode teaches real Nigerian law.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {GAMES.map(game => (
          <Link key={game.href} href={game.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: game.bg,
              border: `2px solid ${game.color}30`,
              borderRadius: 20, padding: '28px 32px',
              display: 'flex', alignItems: 'center', gap: 28,
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
              (e.currentTarget as HTMLElement).style.borderColor = game.color;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.borderColor = `${game.color}30`;
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18, flexShrink: 0,
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, boxShadow: 'var(--shadow-sm)',
              }}>{game.emoji}</div>

              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#0F1C3F', marginBottom: 6 }}>
                  {game.title}
                </h2>
                <p style={{ fontSize: 14, color: '#666666', lineHeight: 1.6, marginBottom: 14 }}>
                  {game.description}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#0F1C3F' }}>
                    {game.xp}
                  </span>
                  <span style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#666666' }}>
                    {game.difficulty}
                  </span>
                  <span style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#666666' }}>
                    {game.cards}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 24, color: '#0F1C3F', flexShrink: 0 }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming soon */}
      <div style={{ marginTop: 32, padding: 24, background: 'var(--gray-100)', borderRadius: 16, textAlign: 'center', border: '2px dashed var(--gray-200)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--gray-400)' }}>
          🚧 More games coming soon - Quizzes, Case Studies, and Mock Trials
        </p>
      </div>
    </div>
  );
}
