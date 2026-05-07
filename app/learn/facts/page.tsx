'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { awardXP, XP_REWARDS } from '@/lib/gamification';
import type { LegalFact } from '@/lib/types';
import Link from 'next/link';

const FALLBACK_FACTS: LegalFact[] = [
  { id: '1', fact: 'Nigeria operates a federal system with 36 states and the FCT. Each state has its own House of Assembly, while the National Assembly at the federal level has the Senate and House of Representatives.', topic: 'Constitutional Law', source: 'Constitution of Nigeria 1999' },
  { id: '2', fact: 'Under the Land Use Act 1978, no individual truly "owns" land in Nigeria. All land belongs to the Governor of each state. Citizens only hold a "Right of Occupancy," which is why you get a Certificate of Occupancy (C of O) rather than a title deed.', topic: 'Land Law', source: 'Land Use Act 1978' },
  { id: '3', fact: 'In Nigeria, you cannot be imprisoned for owing a debt. The Debtors Act prohibits this. However, if money was obtained by fraud, it becomes a criminal offence and imprisonment is possible.', topic: 'Criminal Law', source: 'Debtors Act, Nigeria' },
];

const TOPIC_COLORS: Record<string, { bg: string; color: string }> = {
  'Constitutional Law': { bg: '#F0F4FF', color: '#0F1C3F' },
  'Contract Law':       { bg: '#F8F0FF', color: '#6B21A8' },
  'Criminal Law':       { bg: '#FFF0F0', color: '#DC2626' },
  'Land Law':           { bg: '#FFF8E8', color: '#EA580C' },
  'Labour Law':         { bg: '#F0FFF8', color: '#16A34A' },
  'Court System':       { bg: '#F5F0FF', color: '#6B21A8' },
  'Family Law':         { bg: '#FFF0F8', color: '#BE185D' },
};

function getTodayKey() {
  return new Date().toDateString(); // e.g. "Thu Apr 30 2026"
}

function getSeenFactsKey(userId: string) {
  return `seen_facts_${userId}`;
}

function getDailyFactKey(userId: string) {
  return `daily_fact_${userId}`;
}

// Pick a deterministic daily fact based on the date + total facts count
function getDailyFactIndex(totalFacts: number): number {
  const today = new Date();
  // Use days since epoch as a stable daily seed
  const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  return daysSinceEpoch % totalFacts;
}

function getSeenFacts(userId: string): Set<string> {
  try {
    const stored = localStorage.getItem(getSeenFactsKey(userId));
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenFacts(userId: string, seen: Set<string>) {
  try {
    localStorage.setItem(getSeenFactsKey(userId), JSON.stringify([...seen]));
  } catch {}
}

function hasSeeenDailyFact(userId: string): boolean {
  try {
    const stored = localStorage.getItem(getDailyFactKey(userId));
    return stored === getTodayKey();
  } catch {
    return false;
  }
}

function markDailyFactSeen(userId: string) {
  try {
    localStorage.setItem(getDailyFactKey(userId), getTodayKey());
  } catch {}
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export default function FactsPage() {
  const [facts, setFacts]           = useState<LegalFact[]>([]);
  const [dailyFact, setDailyFact]   = useState<LegalFact | null>(null);
  const [seen, setSeen]             = useState<Set<string>>(new Set());
  const [userId, setUserId]         = useState<string | null>(null);
  const [xpEarned, setXpEarned]     = useState(0);
  const [loading, setLoading]       = useState(true);
  const [alreadySeen, setAlreadySeen] = useState(false);
  const [countdown, setCountdown]   = useState('');
  const [showPrev, setShowPrev]     = useState(false); // lets user browse past facts

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;
      setUserId(uid);

      const { data } = await supabase.from('legal_facts').select('*');
      const allFacts = data && data.length > 0 ? data : FALLBACK_FACTS;
      setFacts(allFacts);

      // Pick today's fact
      const todayIndex = getDailyFactIndex(allFacts.length);
      setDailyFact(allFacts[todayIndex]);

      // Restore seen facts from localStorage
      if (uid) {
        const seenSet = getSeenFacts(uid);
        setSeen(seenSet);
        setAlreadySeen(hasSeeenDailyFact(uid));
      }

      setLoading(false);
    };
    init();
  }, []);

  // Live countdown to next fact
  useEffect(() => {
    if (!alreadySeen) return;
    const tick = () => setCountdown(getTimeUntilMidnight());
    tick();
    const interval = setInterval(tick, 60000); // update every minute
    return () => clearInterval(interval);
  }, [alreadySeen]);

  const handleClaimFact = async () => {
    if (!dailyFact || alreadySeen) return;

    // Mark as seen
    const newSeen = new Set([...seen, dailyFact.id]);
    setSeen(newSeen);
    setAlreadySeen(true);
    setXpEarned(prev => prev + XP_REWARDS.fact_viewed);

    if (userId) {
      markDailyFactSeen(userId);
      saveSeenFacts(userId, newSeen);
      await awardXP(userId, 'fact_viewed', XP_REWARDS.fact_viewed);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
      Loading today&apos;s fact...
    </div>
  );

  if (!dailyFact) return null;

  const tc = TOPIC_COLORS[dailyFact.topic] || { bg: 'var(--cream-dark)', color: '#666666' };

  // Facts the user has already seen (for the archive view)
  const seenFacts = facts.filter(f => seen.has(f.id) && f.id !== dailyFact.id);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/learn" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)' }}>
          💡 Did You Know?
        </h1>
      </div>
      <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
        A new legal fact every day. Come back daily to build your streak.
      </p>

      {/* XP badge */}
      {xpEarned > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFFBF0', border: '1px solid var(--gold)', borderRadius: 20, padding: '4px 14px', marginBottom: 20, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#0F1C3F' }}>
          🎉 +{xpEarned} XP earned today!
        </div>
      )}

      {/* Progress — how many facts seen total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--gray-200)', borderRadius: 99 }}>
          <div style={{
            height: '100%',
            width: `${Math.round((seen.size / facts.length) * 100)}%`,
            background: 'var(--gold)',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
          {seen.size} / {facts.length} facts
        </span>
      </div>

      {/* Today's Fact Card */}
      <div style={{
        background: alreadySeen ? tc.bg : tc.bg,
        borderRadius: 24,
        padding: '40px 36px',
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        marginBottom: 24,
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.4s ease',
      }}>
        {/* "Today" label */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: alreadySeen ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.8)',
          borderRadius: 20, padding: '4px 12px',
          fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
          color: alreadySeen ? '#0F1C3F' : '#0F1C3F',
        }}>
          {alreadySeen ? '✓ Claimed' : '📅 Today'}
        </div>

        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'white', borderRadius: 20, padding: '4px 14px',
            marginBottom: 24, fontSize: 12,
            fontFamily: 'var(--font-display)', fontWeight: 700,
            color: alreadySeen ? '#0F1C3F' : '#0F1C3F',
          }}>
            💡 {dailyFact.topic}
          </div>

          {/* Blur the fact text until claimed */}
          <p style={{
            fontSize: 18, lineHeight: 1.8,
            color: alreadySeen ? '#0F1C3F' : '#0F1C3F',
            fontFamily: 'var(--font-display)', fontWeight: 500,
            filter: alreadySeen ? 'none' : 'blur(0px)',
            transition: 'filter 0.3s ease',
          }}>
            {dailyFact.fact}
          </p>
        </div>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: alreadySeen ? '#0F1C3F' : '#0F1C3F' }}>
            📜 Source: {dailyFact.source}
          </p>
        </div>
      </div>

      {/* CTA — Claim or Countdown */}
      {alreadySeen ? (
        <div style={{
          background: '#F0FFF8', border: '1px solid var(--green)',
          borderRadius: 16, padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 32,
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#0F1C3F', marginBottom: 2 }}>
              ✅ You&apos;ve read today&apos;s fact!
            </p>
            <p style={{ fontSize: 13, color: '#0F1C3F' }}>
              Next fact in <strong>{countdown}</strong>
            </p>
          </div>
          <div style={{ fontSize: 32 }}>🗓️</div>
        </div>
      ) : (
        <button
          onClick={handleClaimFact}
          className="btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: 16, marginBottom: 32 }}
        >
          💡 Read &amp; Claim +{XP_REWARDS.fact_viewed} XP
        </button>
      )}

      {/* Past Facts Archive */}
      {seenFacts.length > 0 && (
        <>
          <button
            onClick={() => setShowPrev(p => !p)}
            style={{
              background: 'none', border: 'none',
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 15, color: 'var(--navy)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16,
            }}
          >
            📚 Past facts ({seenFacts.length})
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
              {showPrev ? '▲ hide' : '▼ show'}
            </span>
          </button>

          {showPrev && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {seenFacts.map(f => {
                const ftc = TOPIC_COLORS[f.topic] || { bg: 'var(--cream-dark)', color: '#666666' };
                return (
                  <div key={f.id} style={{
                    background: ftc.bg, borderRadius: 16,
                    padding: '20px 24px', opacity: 0.85,
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'white', borderRadius: 20, padding: '3px 10px',
                      marginBottom: 10, fontSize: 11,
                      fontFamily: 'var(--font-display)', fontWeight: 700, color: ftc.color,
                    }}>
                      💡 {f.topic}
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: '#0F1C3F', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                      {f.fact}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 10 }}>
                      📜 {f.source}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}