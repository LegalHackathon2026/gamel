'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

const FEATURES = [
  { emoji: '⚖️', title: 'Real Nigerian Law', desc: 'Learn from actual statutes, court judgments, and constitutional provisions - not made-up examples.' },
  { emoji: '🎮', title: 'Learn by Playing', desc: 'RPG scenarios, flashcards, and quizzes turn dry legal concepts into engaging challenges.' },
  { emoji: '🤖', title: 'AI Legal Advisor', desc: 'Ask anything. Our AI retrieves real Nigerian legal documents to answer your questions.' },
  { emoji: '🔥', title: 'Daily Streaks', desc: 'Build a habit. Earn XP, maintain your streak, and level up your legal knowledge every day.' },
  { emoji: '👥', title: 'Community', desc: 'Discuss cases, share insights, and learn from thousands of Nigerians on the same journey.' },
  { emoji: '🏆', title: 'Earn Badges', desc: 'Get recognized for your progress. Badges, levels, and leaderboards keep you motivated.' },
];

const STATS = [
  { value: '30+', label: 'Legal Topics' },
  { value: '30+', label: 'Flashcards' },
  { value: '20+', label: 'RPG Scenarios' },
  { value: '30+', label: 'Legal Facts' },
];

const TOPICS = ['Constitutional Law', 'Criminal Law', 'Contract Law', 'Land Law', 'Labour Law', 'Evidence Act', 'Family Law', 'Torts'];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTopicIdx, setActiveTopicIdx] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveTopicIdx(i => (i + 1) % TOPICS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ fontFamily: 'var(--font-body)', background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>

      {/* ── Navbar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        padding: '0 32px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'var(--bg-secondary)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border-color)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--gold), var(--gold-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>⚖️</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gamell</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <Link href="/auth" style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
            color: 'var(--text-primary)', textDecoration: 'none', padding: '8px 18px',
          }}>Log in</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px',
        background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 50%, #1A3A6E 100%)',
        position: 'relative', overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-5%', left: '-5%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,184,122,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: 30, padding: '6px 18px', marginBottom: 32,
          animation: 'fadeIn 0.6s ease forwards',
        }}>
          <span style={{ fontSize: 14 }}>🇳🇬</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--gold-light)' }}>
            Built for Nigerians, By Nigerians.
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(36px, 6vw, 72px)',
          color: 'var(--white)', lineHeight: 1.1, marginBottom: 16,
          letterSpacing: '-2px',
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}>
          Know Your Rights.<br />
          <span style={{ color: 'var(--gold)' }}>Play Your Way.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text-secondary)',
          maxWidth: 560, lineHeight: 1.7, marginBottom: 16,
          animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          The first gamified platform for learning Nigerian law. Earn XP, complete legal challenges, and understand your rights - one lesson at a time.
        </p>

        {/* Rotating topic */}
        <div style={{
          marginBottom: 40,
          animation: 'fadeUp 0.6s ease 0.25s both',
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 15 }}>Currently available: </span>
          <span key={activeTopicIdx} style={{
            color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            animation: 'fadeIn 0.4s ease',
          }}>{TOPICS[activeTopicIdx]}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.6s ease 0.3s both' }}>
          <Link href="/auth" className="btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
            Start Learning Free →
          </Link>
          <Link href="#features" className="btn-secondary" style={{ fontSize: 16, padding: '14px 32px', borderColor: 'var(--text-secondary)', color: 'var(--text-primary)' }}>
            See how it works
          </Link>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 32, marginTop: 72, flexWrap: 'wrap', justifyContent: 'center',
          animation: 'fadeUp 0.6s ease 0.4s both',
        }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: '96px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-gold-dark)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-1px' }}>
            Learning law has never been this fun
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 64px' }}>
            Gamell turns complex Nigerian legal concepts into bite-sized, interactive experiences.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {[
              { step: '01', emoji: '🔐', title: 'Create your account', desc: 'Sign up free and set your learning goals.' },
              { step: '02', emoji: '📚', title: 'Choose your path', desc: 'Flashcards, RPG scenarios, or AI chat - you decide.' },
              { step: '03', emoji: '⭐', title: 'Earn XP & badges', desc: 'Every lesson rewards you with XP and unlocks new levels.' },
              { step: '04', emoji: '🏆', title: 'Rise the ranks', desc: 'Compete on leaderboards and become the top legal mind.' },
            ].map(s => (
              <div key={s.step} style={{
                background: 'var(--bg-primary)', borderRadius: 20, padding: 28,
                border: '1px solid var(--border-color)', textAlign: 'left',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, color: 'var(--color-gold)', letterSpacing: '2px', marginBottom: 16 }}>{s.step}</div>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{s.emoji}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '96px 24px', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-gold-dark)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Features</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--text-primary)', letterSpacing: '-1px' }}>
              Everything you need to become<br />legally literate
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: 'var(--bg-secondary)', borderRadius: 20, padding: 28,
                border: '1px solid var(--border-color)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.emoji}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Topics ── */}
      <section style={{ padding: '96px 24px', background: 'var(--navy)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--white)', letterSpacing: '-1px', marginBottom: 16 }}>
            Learn what matters to you
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, marginBottom: 48 }}>
            From your constitutional rights to everyday contracts - we&apos;ve got it covered.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {TOPICS.map((t, i) => (
              <div key={i} style={{
                background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 30, padding: '8px 20px',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
                color: 'var(--gold-light)',
              }}>{t}</div>
            ))}
            <div style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 30, padding: '8px 20px',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
              color: 'rgba(255,255,255,0.5)',
            }}>+ More coming</div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '96px 24px', background: 'var(--cream)', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>⚖️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--navy)', letterSpacing: '-1px', marginBottom: 16 }}>
            Your rights are your power.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: 40 }}>
            Join thousands of Nigerians learning their legal rights in a fun, accessible way. No law degree required.
          </p>
          <Link href="/auth" className="btn-primary" style={{ fontSize: 17, padding: '16px 40px' }}>
            Start for free - it takes 30 seconds
          </Link>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 16 }}>No credit card. No jargon. Just law, made fun.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--navy)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>⚖️</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--white)' }}>Gamell</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          For educational purposes only. Not a substitute for professional legal advice.<br />
          © {new Date().getFullYear()} Gamell. Built for Nigerians, By Nigerians.
        </p>
      </footer>
    </div>
  );
}
