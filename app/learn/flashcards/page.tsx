'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { awardXP, XP_REWARDS } from '@/lib/gamification';
import type { Flashcard } from '@/lib/types';
import Link from 'next/link';

const FALLBACK_CARDS: Flashcard[] = [
  { id: '1', question: 'What is the supreme law of Nigeria?', answer: 'The Constitution of the Federal Republic of Nigeria 1999 (as amended). Any law inconsistent with it is void to the extent of its inconsistency.', topic: 'Constitutional Law', difficulty: 'beginner' },
  { id: '2', question: 'What rights does a Nigerian have upon arrest?', answer: 'Right to be informed of the reason for arrest, right to remain silent, right to a lawyer, right to be brought to court within 24-48 hours, and right to bail for bailable offences.', topic: 'Criminal Law', difficulty: 'beginner' },
  { id: '3', question: 'What makes a contract legally binding in Nigeria?', answer: 'Six elements: (1) Offer, (2) Acceptance, (3) Consideration, (4) Intention to create legal relations, (5) Capacity of parties, (6) Legality of object. All must be present.', topic: 'Contract Law', difficulty: 'beginner' },
];

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState('All');

  const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

  // sort by topic first and then difficulty within each topic (e.g. all Constitutional Law beginner → intermediate → advanced, then all Contract Law beginner → intermediate → advanced)
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);

      const { data } = await supabase.from('flashcards').select('*');
      const sorted = (data && data.length > 0 ? data : FALLBACK_CARDS).sort((a, b) => {
        if (a.topic < b.topic) return -1;
        if (a.topic > b.topic) return 1;
        return (DIFFICULTY_ORDER[a.difficulty as keyof typeof DIFFICULTY_ORDER] ?? 0) -
              (DIFFICULTY_ORDER[b.difficulty as keyof typeof DIFFICULTY_ORDER] ?? 0);
      });

      setCards(sorted);
      setLoading(false);
    };
    init();
  }, []);

  const topics = ['All', ...Array.from(new Set(cards.map(c => c.topic)))];
  const filtered = topicFilter === 'All' ? cards : cards.filter(c => c.topic === topicFilter);
  const current = filtered[index];
  const total = filtered.length;

  const handleFlip = async () => {
    if (!flipped && current && !completed.has(current.id)) {
      setCompleted(prev => new Set([...prev, current.id]));
      setXpEarned(prev => prev + XP_REWARDS.flashcard_complete);
      if (userId) await awardXP(userId, 'flashcard_complete', XP_REWARDS.flashcard_complete);
    }
    setFlipped(f => !f);
  };

  const goNext = () => {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.min(i + 1, total - 1)), 150);
  };

  const goPrev = () => {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.max(i - 1, 0)), 150);
  };

  const resetDeck = () => {
    setIndex(0);
    setFlipped(false);
    setCompleted(new Set());
    setXpEarned(0);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading flashcards...</div>;

  const isFinished = index === total - 1 && flipped;

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/learn" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)' }}>⚡ Flashcards</h1>
      </div>

      {/* XP earned */}
      {xpEarned > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFFBF0', border: '1px solid var(--gold)', borderRadius: 20, padding: '4px 14px', marginBottom: 20, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#0F1C3F' }}>
          +{xpEarned} XP earned this session
        </div>
      )}

      {/* Topic filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {topics.map(t => (
          <button key={t} onClick={() => { setTopicFilter(t); setIndex(0); setFlipped(false); }}
            style={{
              background: topicFilter === t ? 'var(--navy)' : 'var(--white)',
              color: topicFilter === t ? 'white' : 'var(--gray-600)',
              border: '1px solid var(--gray-200)', borderRadius: 20,
              padding: '5px 14px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600,
              transition: 'all 0.2s',
            }}>{t}</button>
        ))}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--gray-400)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Card {index + 1} of {total}
        </span>
        <span style={{ fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          {completed.size} completed ✓
        </span>
      </div>
      <div className="xp-bar" style={{ marginBottom: 32 }}>
        <div className="xp-bar-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      {/* Card */}
      {current && (
        <div onClick={handleFlip} style={{
          minHeight: 280, borderRadius: 24, cursor: 'pointer',
          background: flipped ? 'var(--navy)' : 'var(--white)',
          border: `2px solid ${flipped ? 'var(--navy)' : 'var(--gray-200)'}`,
          padding: 36, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
          transition: 'background 0.3s, border-color 0.3s',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: flipped ? 'rgba(255,255,255,0.4)' : 'var(--gold)', marginBottom: 20 }}>
            {flipped ? 'ANSWER' : 'QUESTION'} · {current.topic}
          </div>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: flipped ? 'var(--white)' : 'var(--navy)', fontFamily: 'var(--font-display)', fontWeight: flipped ? 400 : 600 }}>
            {flipped ? current.answer : current.question}
          </p>
          {!flipped && (
            <p style={{ marginTop: 24, fontSize: 12, color: 'var(--gray-400)' }}>Tap to reveal answer</p>
          )}
          <div style={{ marginTop: 20 }}>
            <span className={`chip-${current.difficulty}`}>{current.difficulty}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={goPrev} disabled={index === 0} className="btn-secondary"
          style={{ opacity: index === 0 ? 0.3 : 1, padding: '10px 24px' }}>← Prev</button>

        {index < total - 1 ? (
          <button onClick={goNext} className="btn-navy" style={{ padding: '10px 32px' }}>Next →</button>
        ) : (
          <button onClick={resetDeck} className="btn-primary" style={{ padding: '10px 24px' }}>🔁 Restart</button>
        )}
      </div>

      {isFinished && (
        <div style={{ marginTop: 32, background: '#F0FFF8', border: '1px solid var(--green)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--navy)', marginBottom: 8 }}>Deck complete!</h3>
          <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>You earned <strong>{xpEarned} XP</strong> this session.</p>
        </div>
      )}
    </div>
  );
}
