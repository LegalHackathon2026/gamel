'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { xpForNextLevel, xpProgressToNextLevel, getAvatar, awardXP, updateStreak } from '@/lib/gamification';
import type { User, UserBadge } from '@/lib/types';

const GAME_MODES = [
  { href: '/learn/flashcards', emoji: '⚡', title: 'Flashcards', desc: 'Quick fire Q&A', color: '#FFF8E8', accent: '#C9A84C', xp: '+10 XP/card' },
  { href: '/learn/rpg', emoji: '⚖️', title: 'RPG Scenarios', desc: 'Real legal situations', color: '#F0F8FF', accent: '#1A2F5E', xp: '+100 XP/win' },
  { href: '/learn/facts', emoji: '💡', title: 'Did You Know?', desc: 'Legal facts daily', color: '#F0FFF8', accent: '#1A8A57', xp: '+5 XP/fact' },
  { href: '/chat', emoji: '🤖', title: 'AI Advisor', desc: 'Ask anything', color: '#F8F0FF', accent: '#6B21A8', xp: '+15 XP/chat' },
];

const RECENT_TOPICS = ['Constitutional Law', 'Criminal Law', 'Contract Law', 'Land Law'];

// How long to wait for a token refresh before assuming the user is truly logged out
const SESSION_RETRY_DELAY_MS = 800;

function getDailyXPKey(userId: string): string {
  // Scoped per user so multiple accounts on same device work correctly
  return `last_xp_login_${userId}`;
}

function hasAwardedXPToday(userId: string): boolean {
  try {
    const stored = localStorage.getItem(getDailyXPKey(userId));
    return stored === new Date().toDateString();
  } catch {
    // localStorage unavailable (e.g. private browsing with strict settings)
    return false;
  }
}

function markXPAwardedToday(userId: string): void {
  try {
    localStorage.setItem(getDailyXPKey(userId), new Date().toDateString());
  } catch {
    // Silently fail — not critical
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Prevents the effect from running twice in React Strict Mode
  const initRan = useRef(false);

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    let isMounted = true;

    const init = async () => {
      // --- Step 1: Get session, with one retry to handle token refresh races ---
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Wait briefly — the Supabase client may be mid-refresh
        await new Promise(res => setTimeout(res, SESSION_RETRY_DELAY_MS));
        const retried = await supabase.auth.getSession();
        session = retried.data.session;
      }

      if (!isMounted) return;

      if (!session) {
        // Genuinely not authenticated after retry
        router.replace('/auth');
        return;
      }

      const userId = session.user.id;

      // --- Step 2: Fetch user profile ---
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!isMounted) return;

      if (userError) {
        if (userError.code === 'PGRST116' || userError.message?.includes('No rows found')) {
          // Profile missing — create it (e.g. OAuth sign-up bypassed auth page insert)
          const fallbackName = session.user.email?.split('@')[0]?.slice(0, 50) ?? 'Scholar';
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: session.user.email!,
              display_name: fallbackName,
              avatar_id: 'scale',
              xp: 0,
              level: 1,
              streak: 0,
            })
            .select()
            .single();

          if (!isMounted) return;

          if (createError) {
            console.error('Failed to create user record:', createError.message);
            setError('Failed to set up your profile. Please sign out and sign back in.');
            setLoading(false);
            return;
          }

          setUser(newUser);
        } else {
          console.error('Failed to fetch user data:', userError.message);
          setError('Failed to load your profile. Please check your connection and try again.');
          setLoading(false);
          return;
        }
      } else if (!userData) {
        setError('Failed to load your profile. Please try again.');
        setLoading(false);
        return;
      } else {
        if (!isMounted) return;
        setUser(userData);
      }

      // --- Step 3: Fetch badges (non-critical, never blocks the page) ---
      supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', userId)
        .limit(6)
        .then(({ data: badgeData }) => {
          if (isMounted) setBadges(badgeData || []);
        });

      // --- Step 4: Award daily XP — guarded so it only fires once per day ---
      // This prevents the Supabase token refresh that was causing the redirect loop
      if (!hasAwardedXPToday(userId)) {
        try {
          const newStreak = await updateStreak(userId);
          await awardXP(userId, 'daily_login', 20);
          markXPAwardedToday(userId);

          // Re-fetch user so dashboard shows updated streak + XP straight away
          const { data: refreshedUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (isMounted && refreshedUser) setUser(refreshedUser);
          console.log('Daily login complete. New streak:', newStreak);
        } catch (err) {
          console.error('Failed to update streak/XP:', err);
        }
      }

      if (!isMounted) return;
      setLoading(false);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  };

  if (loading) return <LoadingDashboard />;

  if (error) return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--color-red)', marginBottom: 16 }}>Something went wrong</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            // Re-trigger init by resetting the ref
            initRan.current = false;
            window.location.reload();
          }}
          style={{
            padding: '12px 24px',
            background: 'var(--navy)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
        <button
          onClick={handleSignOut}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );

  if (!user) return null;

  const progress = xpProgressToNextLevel(user.xp);
  const nextLevel = xpForNextLevel(user.level);
  const avatar = getAvatar(user.avatar_id);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 4 }}>Good day,</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {avatar.emoji} {user.display_name || 'Legal Scholar'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="streak-badge">🔥 {user.streak} day streak</div>
          <div className="level-badge">⭐ Level {user.level}</div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* XP Progress Card */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>TOTAL XP</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: 'var(--gold)', letterSpacing: '-1px' }}>{user.xp.toLocaleString()}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>NEXT LEVEL</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: 'var(--white)', letterSpacing: '-1px' }}>Lvl {user.level + 1}</p>
          </div>
        </div>
        <div className="xp-bar">
          <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
          {progress}% to Level {user.level + 1} — {nextLevel - user.xp} XP to go
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Lessons', value: user.total_lessons ?? 0, emoji: '📚' },
          { label: 'Badges', value: badges.length, emoji: '🏅' },
          { label: 'Streak', value: `${user.streak}d`, emoji: '🔥' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Game Modes */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>
        🎮 Choose your game
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {GAME_MODES.map(m => (
          <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: m.color,
                border: `2px solid ${m.accent}20`,
                borderRadius: 16,
                padding: 20,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{m.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: '#0F1C3F', marginBottom: 4 }}>{m.title}</div>
              <div style={{ fontSize: 13, color: '#666666', marginBottom: 12 }}>{m.desc}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: m.accent }}>{m.xp}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>
            🏅 Your badges
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            {badges.map(b => (
              <div
                key={b.id}
                title={b.badges?.description}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>{b.badges?.icon}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{b.badges?.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Topics to explore */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 16 }}>
        📚 Explore topics
      </h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {RECENT_TOPICS.map(t => (
          <Link
            key={t}
            href={`/learn/flashcards?topic=${encodeURIComponent(t)}`}
            style={{
              textDecoration: 'none',
              background: 'var(--white)',
              border: '1px solid var(--gray-200)',
              borderRadius: 30,
              padding: '8px 18px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--navy)',
              transition: 'all 0.2s',
            }}
          >
            {t}
          </Link>
        ))}
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            height: 80,
            background: 'var(--gray-200)',
            borderRadius: 16,
            marginBottom: 16,
            opacity: 0.5,
            animation: 'pulse 1.5s ease infinite',
          }}
        />
      ))}
    </div>
  );
}