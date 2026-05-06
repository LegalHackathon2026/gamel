'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabaseClient';
import { awardXP, XP_REWARDS } from '@/lib/gamification';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { metadata: Record<string, string>; similarity: number; preview: string }[];
  meta?: { provider: string; retrievedChunks: number; elapsedMs: number };
}

const SUGGESTIONS = [
  'What are my rights if I am arrested in Nigeria?',
  'Can my landlord evict me without notice?',
  'What does the Nigerian Constitution say about free speech?',
  'How do I enforce a contract if the other party defaults?',
  'What is the difference between the Criminal Code and Penal Code?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Session ID from LocalStorage or generate new one
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let sid = localStorage.getItem('gamell_session_id');
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('gamell_session_id', sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  // Fetch history when sessionId is ready
  useEffect(() => {
    if (!sessionId) return;

    const fetchHistory = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/ask?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          setMessages(data.history.map((m: any) => ({
            role: m.role,
            content: m.content,
            created_at: m.created_at
          })));
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };

    fetchHistory();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading || !sessionId) return;
    
    // Clear input immediately for better UX
    if (!question) setInput('');
    
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ question: q, sessionId }),
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

  const clearHistory = async () => {
    if (!sessionId) return;
    if (!confirm('Are you sure you want to clear this chat history?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/ask?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to clear history on server');
      
      // Generate new session ID
      const newSid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('gamell_session_id', newSid);
      setSessionId(newSid);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      alert('Could not clear history. Please try again.');
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
            <p style={{ fontSize: 12, color: 'var(--green)' }}>● Online · Backed by Legal Facts</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 60 }}>
          <button 
            onClick={clearHistory}
            style={{ 
              background: 'none', border: '1px solid var(--gray-200)', 
              borderRadius: 8, padding: '6px 12px', fontSize: 12, 
              color: 'var(--gray-600)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600
            }}>
            🗑️ Clear Chat
          </button>
          <div style={{
            background: '#FFFBF0', border: '1px solid var(--gold)',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#0F1C3F',
          }}>
            +15 XP per question
          </div>
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
              I search real Nigerian legal documents - case law, statutes, and the Constitution - to give you grounded answers.
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
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)'; }}>
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
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {m.role === 'user' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }: { children?: React.ReactNode }) => (
                          <p style={{ margin: '0 0 10px 0', lineHeight: 1.75 }}>
                            {children}
                          </p>
                        ),
                        strong: ({ children }: { children?: React.ReactNode }) => (
                          <strong style={{ fontWeight: 700, color: 'var(--navy)' }}>
                            {children}
                          </strong>
                        ),
                        em: ({ children }: { children?: React.ReactNode }) => (
                          <em style={{ fontStyle: 'italic' }}>{children}</em>
                        ),
                        ul: ({ children }: { children?: React.ReactNode }) => (
                          <ul style={{ margin: '8px 0', paddingLeft: 20, listStyleType: 'disc' }}>
                            {children}
                          </ul>
                        ),
                        ol: ({ children }: { children?: React.ReactNode }) => (
                          <ol style={{ margin: '8px 0', paddingLeft: 20, listStyleType: 'decimal' }}>
                            {children}
                          </ol>
                        ),
                        li: ({ children }: { children?: React.ReactNode }) => (
                          <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>
                        ),
                        h1: ({ children }: { children?: React.ReactNode }) => (
                          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--navy)', margin: '16px 0 8px 0' }}>
                            {children}
                          </h1>
                        ),
                        h2: ({ children }: { children?: React.ReactNode }) => (
                          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--navy)', margin: '14px 0 6px 0' }}>
                            {children}
                          </h2>
                        ),
                        h3: ({ children }: { children?: React.ReactNode }) => (
                          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)', margin: '12px 0 6px 0' }}>
                            {children}
                          </h3>
                        ),
                        h4: ({ children }: { children?: React.ReactNode }) => (
                          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--navy)', margin: '10px 0 4px 0' }}>
                            {children}
                          </h4>
                        ),
                        code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
                          const isBlock = className?.includes('language-');
                          return isBlock ? (
                            <code style={{
                              display: 'block',
                              background: 'var(--cream-dark)',
                              borderRadius: 8,
                              padding: '12px 16px',
                              fontSize: 13,
                              fontFamily: 'monospace',
                              overflowX: 'auto',
                              margin: '8px 0',
                            }}>
                              {children}
                            </code>
                          ) : (
                            <code style={{
                              background: 'var(--cream-dark)',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: 13,
                              fontFamily: 'monospace',
                            }}>
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => (
                          <pre style={{ margin: '8px 0', background: 'transparent' }}>
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote style={{
                            borderLeft: '3px solid var(--gold)',
                            paddingLeft: 14,
                            margin: '10px 0',
                            color: 'var(--gray-600)',
                            fontStyle: 'italic',
                          }}>
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--navy)', textDecoration: 'underline', fontWeight: 600 }}
                          >
                            {children}
                          </a>
                        ),
                        hr: () => (
                          <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '12px 0' }} />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>

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
                    {m.meta.retrievedChunks} document sources · {m.meta.elapsedMs}ms
                  </div>
                  // <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                  //   {m.meta.provider} · {m.meta.retrievedChunks} sources · {m.meta.elapsedMs}ms
                  // </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{
                display: 'flex', gap: 6, padding: '14px 18px',
                background: 'var(--white)', border: '1px solid var(--gray-200)',
                borderRadius: '4px 16px 16px 16px', width: 'fit-content',
                boxShadow: 'var(--shadow-sm)',
              }}>
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
        background: 'var(--white)', borderTop: '1px solid var(--gray-200)',
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
              border: '2px solid var(--gray-200)', borderRadius: 14,
              fontSize: 15, lineHeight: 1.5, fontFamily: 'var(--font-body)',
              color: 'var(--navy)', background: 'var(--cream)',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-navy"
            style={{ padding: '12px 20px', opacity: loading || !input.trim() ? 0.4 : 1, flexShrink: 0 }}
          >
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
