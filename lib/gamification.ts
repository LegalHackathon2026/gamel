// lib/gamification.ts
import { supabase } from './supabaseClient';

export const XP_REWARDS = {
  flashcard_complete: 10,
  fact_viewed: 5,
  rpg_scenario_complete: 100,
  rpg_scenario_intermediate: 150,
  chat_question: 15,
  daily_login: 20,
  post_created: 25,
};

export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

export function xpProgressToNextLevel(xp: number): number {
  const level = xpToLevel(xp);
  const currentLevelXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = xpForNextLevel(level);
  return Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);
}

export async function awardXP(userId: string, activity: string, xpAmount: number) {
  // Log the activity
  await supabase.from('user_progress').insert({
    user_id: userId,
    activity,
    xp_earned: xpAmount,
  });

  // Get current xp
  const { data: user } = await supabase
    .from('users')
    .select('xp')
    .eq('id', userId)
    .single();

  if (!user) return;

  const newXp = user.xp + xpAmount;
  const newLevel = xpToLevel(newXp);

  await supabase
    .from('users')
    .update({ xp: newXp, level: newLevel })
    .eq('id', userId);

  return { newXp, newLevel };
}

export async function updateStreak(userId: string) {
  const { data, error } = await supabase.rpc('update_user_streak', {
    p_user_id: userId,
  });

  if (error) {
    console.error('updateStreak error:', error.message);
    return;
  }

  console.log('Streak result:', data);
  return data.streak as number;
}

export const AVATARS = [
  { id: 'scale', emoji: '⚖️', name: 'The Judge' },
  { id: 'scroll', emoji: '📜', name: 'The Scholar' },
  { id: 'eagle', emoji: '🦅', name: 'Legal Eagle' },
  { id: 'shield', emoji: '🛡️', name: 'Defender' },
  { id: 'crown', emoji: '👑', name: 'Justice' },
  { id: 'book', emoji: '📚', name: 'Bookworm' },
];

export function getAvatar(avatarId: string) {
  return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
}
