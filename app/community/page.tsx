'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getAvatar, awardXP, XP_REWARDS } from '@/lib/gamification';
import type { Post, Like, LeaderboardEntry, Comment } from '@/lib/types';

type Tab = 'feed' | 'leaderboard';

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('General');
  const [posting, setPosting] = useState(false);
  const [userInteractions, setUserInteractions] = useState<Record<string, 'like' | 'dislike'>>({});
  const [interactingPostIds, setInteractingPostIds] = useState<Set<string>>(new Set());

  // Comments state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const TOPICS = ['General', 'Constitutional Law', 'Criminal Law', 'Contract Law', 'Land Law', 'Labour Law', 'Family Law'];

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user.id ?? null;
      if (currentUserId) setUserId(currentUserId);

      const [{ data: postsData }, { data: lbData }] = await Promise.all([
        supabase.from('posts').select('*, users(display_name, avatar_id)').order('created_at', { ascending: false }).limit(20),
        supabase.from('users').select('id, display_name, avatar_id, xp, level, streak').order('xp', { ascending: false }).limit(10),
      ]);

      setPosts(postsData || []);
      setLeaderboard(lbData || []);

      if (currentUserId) {
        const { data: interactionsData } = await supabase
          .from('post_interactions')
          .select('post_id, interaction_type')
          .eq('user_id', currentUserId);

        const interactions: Record<string, 'like' | 'dislike'> = {};
        (interactionsData || []).forEach((item: any) => {
          interactions[item.post_id] = item.interaction_type as 'like' | 'dislike';
        });
        setUserInteractions(interactions);
      }

      setLoading(false);
    };
    init();
  }, []);

  const submitPost = async () => {
    if (!title.trim() || !content.trim() || !userId) return;
    setPosting(true);
    const { data, error } = await supabase.from('posts').insert({
      user_id: userId, title, content, topic,
    }).select('*, users(display_name, avatar_id)').single();

    if (!error && data) {
      setPosts(prev => [data, ...prev]);
      await awardXP(userId, 'post_created', XP_REWARDS.post_created);
      setTitle(''); setContent(''); setTopic('General');
      setShowForm(false);
    }
    setPosting(false);
  };

  const handleInteraction = async (postId: string, type: 'like' | 'dislike') => {
    if (!userId) return;

    const post = posts.find(p => p.id === postId);
    if (!post || post.user_id === userId || userInteractions[postId] === type || interactingPostIds.has(postId)) {
      return;
    }

    setInteractingPostIds(prev => new Set(prev).add(postId));

    const { data: nextCounts, error } = await supabase.rpc('interact_with_post', {
      p_post_id: postId,
      p_type: type,
    });

    if (error) {
      setInteractingPostIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      return;
    }

    setUserInteractions(prev => ({ ...prev, [postId]: type }));
    setPosts(prev => prev.map(p => p.id === postId ? { 
      ...p, 
      likes: nextCounts.likes, 
      dislikes: nextCounts.dislikes 
    } : p));
    
    setInteractingPostIds(prev => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });

    if (type === 'like' && !userInteractions[postId]) {
      await awardXP(userId, 'post_liked', XP_REWARDS.post_liked || 5);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const fetchComments = async (postId: string) => {
    if (comments[postId] || loadingComments.has(postId)) return;

    setLoadingComments(prev => new Set(prev).add(postId));
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(display_name, avatar_id)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(prev => ({ ...prev, [postId]: data }));
    }
    setLoadingComments(prev => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const toggleComments = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      fetchComments(postId);
    }
  };

  const submitComment = async (postId: string) => {
    if (!newComment.trim() || !userId) return;
    setSubmittingComment(true);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: newComment.trim(),
      })
      .select('*, users(display_name, avatar_id)')
      .single();

    if (!error && data) {
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data],
      }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      setNewComment('');
      await awardXP(userId, 'comment_created', XP_REWARDS.comment_created || 10);
    }
    setSubmittingComment(false);
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--navy)', letterSpacing: '-0.5px' }}>
            👥 Community
          </h1>
          <p style={{ color: 'var(--gray-600)', fontSize: 14, marginTop: 4 }}>Discuss Nigerian law with fellow learners</p>
        </div>
        {userId && (
          <button onClick={() => setShowForm(f => !f)} className="btn-primary" style={{ fontSize: 14 }}>
            {showForm ? '✕ Cancel' : '+ New Post'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--gray-100)', borderRadius: 12, padding: 4 }}>
        {(['feed', 'leaderboard'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--white)' : 'transparent',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            color: tab === t ? 'var(--navy)' : 'var(--gray-400)',
            boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.2s', textTransform: 'capitalize',
          }}>{t === 'feed' ? '📢 Discussion Feed' : '🏆 Leaderboard'}</button>
        ))}
      </div>

      {/* New Post Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24, border: '2px solid var(--gold)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 16 }}>Share with the community</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select value={topic} onChange={e => setTopic(e.target.value)} className="input" style={{ width: 'auto' }}>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="input" placeholder="Post title..." />
            <textarea value={content} onChange={e => setContent(e.target.value)}
              className="input" placeholder="Share your question, insight, or legal experience..." rows={4}
              style={{ resize: 'vertical' }} />
            <button onClick={submitPost} disabled={posting || !title.trim() || !content.trim()}
              className="btn-primary" style={{ alignSelf: 'flex-end', opacity: posting ? 0.6 : 1 }}>
              {posting ? 'Posting...' : 'Post (+25 XP)'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Loading...</div>
      ) : tab === 'feed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--white)', borderRadius: 16, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--gray-400)' }}>No posts yet. Be the first to start a discussion!</p>
            </div>
          ) : posts.map(post => {
            const avatar = getAvatar(post.users?.avatar_id || 'scale');
            const isOwnPost = post.user_id === userId;
            const currentInteraction = userInteractions[post.id];
            const isInteracting = interactingPostIds.has(post.id);
            const interactionDisabled = !userId || isOwnPost || isInteracting;

            return (
              <div key={post.id} className="card" style={{ transition: 'box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {avatar.emoji}
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
                      {post.users?.display_name || 'Anonymous'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{timeAgo(post.created_at)}</p>
                  </div>
                  {post.topic && (
                    <div style={{ marginLeft: 'auto', background: 'var(--cream-dark)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--navy-light)' }}>
                      {post.topic}
                    </div>
                  )}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 8 }}>{post.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.7, marginBottom: 16 }}>{post.content}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleInteraction(post.id, 'like')}
                    disabled={interactionDisabled || currentInteraction === 'like'}
                    title={
                      !userId
                        ? 'Sign in to interact'
                        : isOwnPost
                          ? 'You cannot like your own post'
                          : currentInteraction === 'like'
                            ? 'You liked this'
                            : 'Like'
                    }
                    style={{
                      background: currentInteraction === 'like' ? '#5D4037' : 'var(--cream)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 20, padding: '4px 14px',
                      fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, 
                      color: currentInteraction === 'like' ? '#FFFFFF' : 'var(--navy)',
                      opacity: interactionDisabled && currentInteraction !== 'like' ? 0.6 : 1,
                      cursor: interactionDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}>
                    {isOwnPost ? '🚫' : '👍'} {post.likes}
                  </button>

                  <button
                    onClick={() => handleInteraction(post.id, 'dislike')}
                    disabled={interactionDisabled || currentInteraction === 'dislike'}
                    title={
                      !userId
                        ? 'Sign in to interact'
                        : isOwnPost
                          ? 'You cannot dislike your own post'
                          : currentInteraction === 'dislike'
                            ? 'You disliked this'
                            : 'Dislike'
                    }
                    style={{
                      background: currentInteraction === 'dislike' ? '#5D4037' : 'var(--cream)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 20, padding: '4px 14px',
                      fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, 
                      color: currentInteraction === 'dislike' ? '#FFFFFF' : 'var(--navy)',
                      opacity: interactionDisabled && currentInteraction !== 'dislike' ? 0.6 : 1,
                      cursor: interactionDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}>
                    {isOwnPost ? '🚫' : '👎'} {post.dislikes || 0}
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    style={{
                      background: 'var(--cream)', border: '1px solid var(--gray-200)',
                      borderRadius: 20, padding: '4px 14px',
                      fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--navy)',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}>
                    💬 {post.comments_count || 0}
                  </button>
                </div>

                {/* Expanded Comments Section */}
                {expandedPostId === post.id && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                      {loadingComments.has(post.id) ? (
                        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Loading comments...</p>
                      ) : (comments[post.id] || []).length === 0 ? (
                        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>No comments yet. Start the conversation!</p>
                      ) : (
                        comments[post.id].map(comment => {
                          const cAvatar = getAvatar(comment.users?.avatar_id || 'scale');
                          return (
                            <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                {cAvatar.emoji}
                              </div>
                              <div style={{ flex: 1, background: 'var(--gray-50)', borderRadius: 12, padding: '10px 14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>{comment.users?.display_name || 'Anonymous'}</span>
                                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{timeAgo(comment.created_at)}</span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5 }}>{comment.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {userId ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <textarea
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Write a reply..."
                          className="input"
                          rows={1}
                          style={{ minHeight: 44, fontSize: 13, padding: '10px 14px' }}
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={submittingComment || !newComment.trim()}
                          className="btn-primary"
                          style={{ padding: '0 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {submittingComment ? '...' : 'Reply'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Sign in to join the discussion.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Leaderboard
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-mid))', padding: '20px 24px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>🏆 Top Legal Scholars</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Ranked by total XP earned</p>
          </div>
          {leaderboard.map((user, idx) => {
            const avatar = getAvatar(user.avatar_id);
            const medals = ['🥇', '🥈', '🥉'];
            const isMe = user.id === userId;
            return (
              <div key={user.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 24px',
                background: isMe ? '#FFFBF0' : 'var(--white)',
                borderBottom: '1px solid var(--gray-200)',
                borderLeft: isMe ? '3px solid var(--gold)' : '3px solid transparent',
              }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: idx < 3 ? 'inherit' : 'var(--gray-400)' }}>
                  {idx < 3 ? medals[idx] : idx + 1}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {avatar.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: isMe ? '#0F1C3F' : 'var(--text-primary)' }}>
                    {user.display_name || 'Anonymous'} {isMe ? '(You)' : ''}
                  </p>
                  <p style={{ fontSize: 12, color: isMe ? '#0F1C3F' : 'var(--text-primary)' }}>Level {user.level} · 🔥 {user.streak} day streak</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: isMe ? '#0F1C3F' : 'var(--text-primary)' }}>{user.xp.toLocaleString()}</p>
                  <p style={{ fontSize: 11, color: isMe ? '#0F1C3F' : 'var(--text-primary)' }}>XP</p>
                </div>
              </div>
            );
          })}
          {leaderboard.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-primary' }}>No data yet. Start earning XP to appear here!</div>
          )}
        </div>
      )}
    </div>
  );
}
