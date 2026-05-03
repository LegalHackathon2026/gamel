'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { awardXP, XP_REWARDS } from '@/lib/gamification';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { metadata: Record<string, string>; similarity: number; preview: string }[];
  meta?: { provider: string; retrievedChunks: number; elapsedMs: number };
}

const SUGGESTIONS = [
  'What are my rights if I am arrested in Nigeria?',
  'Under Nigerian law, can my landlord evict me without notice in Lagos?',
  'What does the Nigerian Constitution say about free speech?',
  'How do I enforce a contract under Nigerian law if the other party defaults?',
  'What is the difference between the Criminal Code and Penal Code?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, provider: 'gemini', sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        meta: data.meta,
      }]);

      if (userId) await awardXP(userId, 'chat_question', XP_REWARDS.chat_question);
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I could not process your question. ${err instanceof Error ? err.message : 'Please try again.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--gray-200)',
        padding: '16px 24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--navy), var(--navy-mid))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🤖</div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)' }}>
              Gamell AI Advisor
            </p>
            <p style={{ fontSize: 12, color: 'var(--green)' }}>● Online · Nigerian law only</p>
          </div>
        </div>
        <div style={{
          background: '#FFFBF0', border: '1px solid var(--gold)',
          borderRadius: 20, padding: '4px 12px',
          fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#0F1C3F', margin: '0px 50px 0px 0px',
        }}>
          +15 XP per question
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {isEmpty ? (
          <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚖️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)', marginBottom: 8 }}>
              Ask me anything about Nigerian law
            </h2>
            <p style={{ color: 'var(--gray-600)', fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
              I use Gemini with trusted Nigerian legal web sources to give you grounded answers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  background: 'var(--white)', border: '1px solid var(--gray-200)',
                  borderRadius: 12, padding: '12px 18px', textAlign: 'left',
                  fontSize: 14, color: 'var(--navy)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-primary)'; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {/* Bubble */}
                <div style={{
                  maxWidth: '82%',
                  background: m.role === 'user' ? 'var(--navy)' : 'var(--white)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--gray-200)',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  padding: '14px 18px',
                  fontSize: 15, lineHeight: 1.75,
                  color: m.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  boxShadow: 'var(--shadow-sm)',
                }}>{m.content}</div>

                {/* Sources */}
                {m.sources && m.sources.length > 0 && (
                  <div style={{ maxWidth: '82%', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.sources.slice(0, 3).map((s, si) => (
                      <div key={si} style={{
                        background: 'var(--cream-dark)', border: '1px solid var(--gray-200)',
                        borderRadius: 20, padding: '3px 12px',
                        fontSize: 11, color: 'var(--gray-600)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span>📜</span>
                        <span>{s.metadata?.case_name || s.metadata?.doc_type || 'Legal Document'}</span>
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                          {Math.round((s.similarity || 0) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Meta */}
                {m.meta && (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                    {m.meta.provider} · {m.meta.retrievedChunks} sources · {m.meta.elapsedMs}ms
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 6, padding: '14px 18px', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '4px 16px 16px 16px', width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)',
                    animation: `bounce 1s ease ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, padding: '16px 24px',
        background: 'var(--white)', borderTop: '1px solid var(--text--primary)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about Nigerian law... (Enter to send)"
            rows={2}
            style={{
              flex: 1, resize: 'none', padding: '12px 16px',
              border: '2px solid var(--text--primary)', borderRadius: 14,
              fontSize: 15, lineHeight: 1.5, fontFamily: 'var(--font-body)',
              color: 'var(--navy)', background: 'var(--cream)',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--text--primary)'; }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-navy"
            style={{ padding: '12px 20px', opacity: loading || !input.trim() ? 0.4 : 1, flexShrink: 0 }}>
            {loading ? '...' : '→'}
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginTop: 8 }}>
          Not legal advice. Always consult a qualified Nigerian lawyer for your situation.
        </p>
      </div>
    </div>
  );
}
