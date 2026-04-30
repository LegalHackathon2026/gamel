'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { awardXP } from '@/lib/gamification';
import type { RpgScenario } from '@/lib/types';
import Link from 'next/link';

const FALLBACK_SCENARIOS: RpgScenario[] = [
  { id: '1', title: 'The Unlawful Eviction', description: 'Your landlord wants you out - but is it legal?', situation: 'You have rented an apartment in Lagos for 3 years with a written tenancy agreement. Your landlord sends a WhatsApp message giving you 7 days to vacate. He has started removing your belongings. What are your legal rights?', difficulty: 'beginner', topic: 'Property Law', xp_reward: 100 },
  { id: '2', title: 'The Wrongful Arrest', description: 'Police arrested you without explanation.', situation: 'Police stop you, claim you match a suspect description, and take you to the station without informing you of the charge or letting you call a lawyer. 30 hours have passed. What are your constitutional rights and what steps should you take?', difficulty: 'beginner', topic: 'Criminal Law', xp_reward: 100 },
  { id: '3', title: 'The Unfair Dismissal', description: 'Fired via WhatsApp with no reason.', situation: 'You have worked at a Lagos company for 4 years with a signed contract requiring 1-month notice. You receive a WhatsApp message terminating your employment immediately, no reason given, no severance pay. What are your rights under Nigerian labour law?', difficulty: 'beginner', topic: 'Labour Law', xp_reward: 100 },
];

type Stage = 'selection' | 'scenario' | 'result';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function RPGPage() {
  const [scenarios, setScenarios] = useState<RpgScenario[]>([]);
  const [selected, setSelected] = useState<RpgScenario | null>(null);
  const [stage, setStage] = useState<Stage>('selection');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);

  const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
  
  // sort the rpg questions in order of difficulty
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);

      const { data } = await supabase
        .from('rpg_scenarios')
        .select('*')
        .order('difficulty', { ascending: true }); // ← Postgres sorts alphabetically:
                                                    // advanced < beginner < intermediate
                                                    // so we sort client-side instead

      const sorted = (data && data.length > 0 ? data : FALLBACK_SCENARIOS).sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty as keyof typeof DIFFICULTY_ORDER] ?? 0) -
          (DIFFICULTY_ORDER[b.difficulty as keyof typeof DIFFICULTY_ORDER] ?? 0)
      );

      setScenarios(sorted);
    };
    init();
  }, []);

  const startScenario = (scenario: RpgScenario) => {
    setSelected(scenario);
    setMessages([{ role: 'assistant', content: `\n${scenario.situation} 🤔\n` }]);
    setStage('scenario');
    setXpAwarded(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !selected) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Legal RPG scenario: ${selected.situation}\n\nUser Answers: ${userMessage}\n\nReply as a helpful Nigerian legal advisor. Reference specific Nigerian laws and constitutional rights. Keep it conversational but accurate and correct the user whenever the user is wrong`,
          provider: 'gemini',
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || 'I could not process your question. Please try again.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check your internet and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const completeScenario = async () => {
    if (!xpAwarded && userId && selected) {
      await awardXP(userId, 'rpg_scenario_complete', selected.xp_reward);
      setXpAwarded(true);
    }
    setStage('result');
  };

  if (stage === 'result' && selected) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--navy)', marginBottom: 8 }}>Scenario Complete!</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>You successfully navigated <strong>{selected.title}</strong></p>
        <div style={{ background: '#FFFBF0', border: '1px solid var(--gold)', borderRadius: 16, padding: 20, marginBottom: 32 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#0F1C3F' }}>+{selected.xp_reward} XP earned</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => { setStage('selection'); setSelected(null); setMessages([]); }} className="btn-primary">Play Another</button>
          <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (stage === 'scenario' && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'var(--navy)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setStage('selection')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer' }}>←</button>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{selected.title}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.topic} · +{selected.xp_reward} XP</p>
          </div>
          <button onClick={completeScenario} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px', margin: '0px 50px 0px 0px' }}>
            ✓ Complete
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '14px 18px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: m.role === 'user' ? 'var(--navy)' : 'var(--white)',
                color: m.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)',
                fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                boxShadow: 'var(--shadow-sm)',
              }}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 6, padding: '14px 18px', background: 'var(--white)', borderRadius: '4px 16px 16px 16px', width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray-400)', animation: `bounce 1s ease ${i * 0.2}s infinite` }} />)}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, padding: '16px 24px', background: 'var(--white)', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 10 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask what to do, what your rights are..."
            className="input" style={{ flex: 1 }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-navy"
            style={{ padding: '10px 20px', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    );
  }

  // Scenario selection
  return (
    <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/learn" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)' }}>⚖️ Legal RPG</h1>
      </div>
      <p style={{ color: 'var(--gray-600)', marginBottom: 32 }}>Step into a real Nigerian legal situation and learn how the law protects you.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {scenarios.map(s => (
          <button key={s.id} onClick={() => startScenario(s)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 20, padding: '24px',
              background: 'var(--white)', border: '2px solid var(--gray-200)',
              borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>⚖️</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--navy)' }}>{s.title}</h3>
                <span className={`chip-${s.difficulty}`}>{s.difficulty}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 8 }}>{s.description}</p>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold-dark)' }}>+{s.xp_reward} XP · {s.topic}</span>
            </div>
            <span style={{ fontSize: 20, color: 'var(--gray-400)', flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
