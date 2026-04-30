'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { AVATARS, getAvatar, xpForNextLevel, xpProgressToNextLevel } from '@/lib/gamification';
import type { User, UserBadge } from '@/lib/types';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('scale');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', session.user.id).single();
      if (!userData) { router.replace('/auth'); return; }

      setUser(userData);
      setDisplayName(userData.display_name || '');
      setSelectedAvatar(userData.avatar_id || 'scale');

      const { data: badgeData } = await supabase
        .from('user_badges').select('*, badges(*)').eq('user_id', session.user.id);
      setBadges(badgeData || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('users').update({
      display_name: displayName,
      avatar_id: selectedAvatar,
    }).eq('id', user.id);

    setUser(prev => prev ? { ...prev, display_name: displayName, avatar_id: selectedAvatar } : null);
    setEditing(false);
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading profile...</div>;
  if (!user) return null;

  const avatar = getAvatar(user.avatar_id);
  const progress = xpProgressToNextLevel(user.xp);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--navy)', marginBottom: 32 }}>
        👤 My Profile
      </h1>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--navy), var(--navy-mid))', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(201,168,76,0.2)', border: '3px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
          }}>
            {getAvatar(editing ? selectedAvatar : user.avatar_id).emoji}
          </div>
          <div>
            {editing ? (
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 18,
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                }} />
            ) : (
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
                {user.display_name || 'Legal Scholar'}
              </h2>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{user.email}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div className="level-badge">⭐ Level {user.level}</div>
              <div className="streak-badge">🔥 {user.streak} days</div>
            </div>
          </div>
        </div>

        {/* XP Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>XP Progress</span>
            <span style={{ fontSize: 13, color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{user.xp.toLocaleString()} XP</span>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {progress}% to Level {user.level + 1}
          </p>
        </div>

        {/* Edit / Save buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {editing ? (
            <>
              <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 20px' }}>
                {saving ? 'Saving...' : '✓ Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              ✏️ Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Avatar Selector */}
      {editing && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 16 }}>Choose your avatar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {AVATARS.map(a => (
              <button key={a.id} onClick={() => setSelectedAvatar(a.id)} style={{
                padding: '16px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${selectedAvatar === a.id ? 'var(--gold)' : 'var(--gray-200)'}`,
                background: selectedAvatar === a.id ? '#FFFBF0' : '#FFFBF0',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{a.emoji}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: '#0F1C3F' }}>{a.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '⭐', label: 'Total XP', value: user.xp.toLocaleString() },
          { emoji: '📚', label: 'Lessons Done', value: user.total_lessons },
          { emoji: '🔥', label: 'Day Streak', value: `${user.streak} days` },
          { emoji: '🏅', label: 'Badges Earned', value: badges.length },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--navy)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 16 }}>
          🏅 Badges Earned
        </h3>
        {badges.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>Complete lessons and earn XP to unlock badges!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {badges.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--cream)', borderRadius: 12 }}>
                <span style={{ fontSize: 28 }}>{b.badges?.icon}</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{b.badges?.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{b.badges?.description}</p>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)' }}>
                  {new Date(b.earned_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button onClick={handleSignOut} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        background: 'var(--white)', border: '2px solid var(--red)',
        color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--red)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--white)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; }}>
        Sign Out
      </button>
    </div>
  );
}
