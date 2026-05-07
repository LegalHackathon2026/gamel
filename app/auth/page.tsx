'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

// ── Rate limiting: max 5 auth attempts per 15 minutes ────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// ── Resend cooldown: 60s between sends, max 3 per session ────
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 3;

function getRateLimitState(): { attempts: number; firstAttemptTime: number } {
  if (typeof window === 'undefined') return { attempts: 0, firstAttemptTime: 0 };
  try {
    const stored = sessionStorage.getItem('auth_attempts');
    return stored ? JSON.parse(stored) : { attempts: 0, firstAttemptTime: 0 };
  } catch {
    return { attempts: 0, firstAttemptTime: 0 };
  }
}

function recordAttempt(): { blocked: boolean; remainingMs: number } {
  const state = getRateLimitState();
  const now = Date.now();
  if (now - state.firstAttemptTime > LOCKOUT_DURATION_MS) {
    sessionStorage.setItem('auth_attempts', JSON.stringify({ attempts: 1, firstAttemptTime: now }));
    return { blocked: false, remainingMs: 0 };
  }
  const newAttempts = state.attempts + 1;
  sessionStorage.setItem('auth_attempts', JSON.stringify({ ...state, attempts: newAttempts }));
  if (newAttempts > MAX_ATTEMPTS) {
    return { blocked: true, remainingMs: LOCKOUT_DURATION_MS - (now - state.firstAttemptTime) };
  }
  return { blocked: false, remainingMs: 0 };
}

function getResendState(): { lastSentAt: number; count: number } {
  if (typeof window === 'undefined') return { lastSentAt: 0, count: 0 };
  try {
    const stored = sessionStorage.getItem('resend_state');
    return stored ? JSON.parse(stored) : { lastSentAt: 0, count: 0 };
  } catch {
    return { lastSentAt: 0, count: 0 };
  }
}

function recordResend(): void {
  const state = getResendState();
  sessionStorage.setItem('resend_state', JSON.stringify({
    lastSentAt: Date.now(),
    count: state.count + 1,
  }));
}

function canResend(): { allowed: boolean; remainingMs: number; exhausted: boolean } {
  const state = getResendState();
  if (state.count >= MAX_RESENDS) return { allowed: false, remainingMs: 0, exhausted: true };
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - state.lastSentAt);
  if (remaining > 0) return { allowed: false, remainingMs: remaining, exhausted: false };
  return { allowed: true, remainingMs: 0, exhausted: false };
}

function sanitizeDisplayName(name: string): string {
  return name.replace(/<[^>]*>/g, '').trim().slice(0, 50);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const eyeBtnStyle: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%',
  transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 4, color: 'var(--text-tertiary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // pendingEmail drives the "check your email" screen
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) { router.replace('/dashboard'); return; }
      setCheckingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_IN' && session) router.replace('/dashboard');
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [router]);

  // Live countdown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [resendCooldown]);

  const startCooldown = (ms: number) => setResendCooldown(Math.ceil(ms / 1000));

  const handleToggleMode = useCallback(() => {
    setIsSignUp(prev => !prev);
    setError(''); setSuccess('');
    setPassword(''); setConfirmPassword('');
    setShowPassword(false); setShowConfirmPassword(false);
    setPendingEmail(null);
  }, []);

  // ── Resend verification email ─────────────────────────────
  const handleResend = async () => {
    if (!pendingEmail) return;
    setError(''); setSuccess('');

    const { allowed, remainingMs, exhausted } = canResend();

    if (exhausted) {
      setError('Maximum resend limit reached. Please check your spam folder or contact support.');
      return;
    }
    if (!allowed) {
      setError(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before requesting another email.`);
      return;
    }

    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      recordResend();
      startCooldown(RESEND_COOLDOWN_MS);
      setSuccess('Verification email resent! Check your inbox and spam folder.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many')) {
          setError('Too many requests. Please wait a few minutes.');
          startCooldown(RESEND_COOLDOWN_MS * 2); // extra penalty
        } else {
          setError('Failed to resend. Please try again.');
          console.error('Resend error (hidden from user):', err.message);
        }
      } else {
        setError('Failed to resend. Please try again.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  // ── Sign-in / Sign-up ─────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const { blocked, remainingMs } = recordAttempt();
    if (blocked) {
      const mins = Math.ceil(remainingMs / 60000);
      setError(`Too many attempts. Please wait ${mins} minute${mins !== 1 ? 's' : ''}.`);
      return;
    }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (!isValidPassword(password)) { setError('Password must be at least 8 characters.'); return; }
    if (isSignUp) {
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      const cleanName = sanitizeDisplayName(displayName);
      if (displayName && cleanName.length === 0) { setError('Display name contains invalid characters.'); return; }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const cleanName = sanitizeDisplayName(displayName);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: cleanName || email.split('@')[0].slice(0, 50),
            }
          }
        });
        if (error) throw error;

        if (data.user) {
          // Profile is created via database trigger on auth.users (see schema.sql)
          // to avoid "permission denied" errors when email confirmation is ON.

          // Show the verification screen
          const capturedEmail = email;
          setEmail(''); setPassword(''); setConfirmPassword('');
          setDisplayName(''); setShowPassword(false); setShowConfirmPassword(false);
          setIsSignUp(false);
          recordResend(); // Supabase just sent one
          startCooldown(RESEND_COOLDOWN_MS);
          setPendingEmail(capturedEmail);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          sessionStorage.removeItem('auth_attempts');
          sessionStorage.removeItem('resend_state');
          router.replace('/dashboard');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
          setError('Invalid email or password.');
        } else if (msg.includes('email not confirmed')) {
          // Tried to sign in but email not confirmed — show resend screen
          setPendingEmail(email);
          setError(''); setSuccess('');
        } else if (msg.includes('user already registered')) {
          setError('An account with this email already exists. Please sign in.');
        } else if (msg.includes('rate limit') || msg.includes('too many requests')) {
          setError('Our email provider is temporarily rate-limited. Please wait a few minutes and try again, or contact support.');
        } else if (msg.includes('network') || msg.includes('fetch')) {
          setError('Network error. Please check your connection.');
        } else {
          setError('Something went wrong. Please try again.');
          console.error('Auth error (hidden from user):', err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Loading screen ────────────────────────────────────────
  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ opacity: 0.4, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  // ── Verification pending screen ───────────────────────────
  if (pendingEmail) {
    const { exhausted } = canResend();
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'var(--bg-primary)' }}>
        <div style={{
          position: 'relative', width: '100%', maxWidth: 480,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 28, padding: '48px 32px', textAlign: 'center',
          boxShadow: '0 28px 80px rgba(15,28,63,0.12)',
        }}>
          <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>

          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>
            📧
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 12 }}>
            Check your email
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 6 }}>
            We sent a verification link to
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 32, wordBreak: 'break-all' }}>
            {pendingEmail}
          </p>

          {error && (
            <div role="alert" aria-live="polite" style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', color: 'var(--color-red)', fontSize: 14, marginBottom: 16, textAlign: 'left' }}>
              {error}
            </div>
          )}
          {success && (
            <div role="status" aria-live="polite" style={{ background: '#F0FFF8', border: '1px solid #B2DFDB', borderRadius: 10, padding: '12px 16px', color: 'var(--color-green-dark)', fontSize: 14, marginBottom: 16, textAlign: 'left' }}>
              {success}
            </div>
          )}

          {/* Resend button or exhausted notice */}
          {!exhausted ? (
            <button
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: resendCooldown > 0 ? 'var(--gray-100)' : 'var(--navy)',
                color: resendCooldown > 0 ? 'var(--text-tertiary)' : 'white',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                marginBottom: 12, transition: 'all 0.2s',
              }}
            >
              {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '📨 Resend verification email'}
            </button>
          ) : (
            <div style={{ background: '#FFF8E8', border: '1px solid var(--gold)', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#92400E', marginBottom: 12 }}>
              Maximum resends reached. Check your spam folder or contact support.
            </div>
          )}

          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
            Didn&apos;t get it? Check your spam folder. The link expires in 24 hours.
          </p>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => { setPendingEmail(null); setError(''); setSuccess(''); setIsSignUp(false); }}
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 10, padding: '11px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}
            >
              ✅ I&apos;ve verified — Sign in
            </button>
            <button
              onClick={() => { setPendingEmail(null); setError(''); setSuccess(''); setIsSignUp(true); sessionStorage.removeItem('resend_state'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 13, color: 'var(--text-tertiary)' }}
            >
              Wrong email? Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main auth form ────────────────────────────────────────
  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
      padding: '32px', background: 'var(--bg-primary)',
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: 'none', flexDirection: 'column', justifyContent: 'center', padding: '64px',
        background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 100%)',
        position: 'relative', overflow: 'hidden',
      }} className="auth-left">
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚖️</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gamell</span>
        </Link>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-1px', marginBottom: 20 }}>
          Your legal education<br />starts here.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.7, maxWidth: 380 }}>
          Join thousands of Nigerians who are learning their rights through play. No law degree required.
        </p>
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {['Learn real Nigerian law', 'Earn XP and badges', 'Practice with AI scenarios'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✓</div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 20, padding: '48px 32px', background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)', borderRadius: 28,
        boxShadow: '0 28px 80px rgba(15,28,63,0.12)',
      }} className="auth-right">
        <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>

        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }} className="auth-logo-mobile">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚖️</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>Gamell</span>
        </Link>

        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.5px' }}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 32 }}>
          {isSignUp ? 'Start your legal learning journey today.' : 'Sign in to continue your journey.'}
        </p>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          {isSignUp && (
            <div>
              <label htmlFor="displayName" style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>Display Name</label>
              <input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="input" placeholder="How should we call you?" maxLength={50} autoComplete="username" />
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="your@email.com" required maxLength={254}
              autoComplete="email" spellCheck={false} autoCapitalize="none" />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} className="input" placeholder="••••••••"
                required minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'}
                style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'} style={eyeBtnStyle}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {isSignUp && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Minimum 8 characters</p>}
          </div>

          {isSignUp && (
            <div>
              <label htmlFor="confirmPassword" style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} className="input" placeholder="••••••••"
                  required minLength={8} autoComplete="new-password"
                  style={{ paddingRight: 44, borderColor: confirmPassword && confirmPassword !== password ? '#FFCDD2' : undefined }} />
                <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} style={eyeBtnStyle}>
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p style={{ fontSize: 12, color: 'var(--color-red)', marginTop: 4 }}>Passwords do not match</p>
              )}
              {confirmPassword && confirmPassword === password && (
                <p style={{ fontSize: 12, color: 'var(--color-green-dark)', marginTop: 4 }}>✓ Passwords match</p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite"
              style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', color: 'var(--color-red)', fontSize: 14 }}>
              {error}
            </div>
          )}
          {success && (
            <div role="status" aria-live="polite"
              style={{ background: '#F0FFF8', border: '1px solid #B2DFDB', borderRadius: 10, padding: '12px 16px', color: 'var(--color-green-dark)', fontSize: 14 }}>
              {success}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', opacity: loading ? 0.7 : 1, marginTop: 8 }}>
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={handleToggleMode}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 32 }}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .auth-left { display: flex !important; }
          .auth-right { border-radius: 0; }
          .auth-logo-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
