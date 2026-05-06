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

  // Get current user stats
  const { data: user } = await supabase
    .from('users')
    .select('xp, total_lessons')
    .eq('id', userId)
    .single();

  if (!user) return;

  const newXp = user.xp + xpAmount;
  const newLevel = xpToLevel(newXp);
  
  // Increment lessons if it's a significant learning activity
  const isLesson = activity.includes('scenario') || activity.includes('flashcard_complete');
  const newTotalLessons = isLesson ? (user.total_lessons + 1) : user.total_lessons;

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ 
      xp: newXp, 
      level: newLevel,
      total_lessons: newTotalLessons 
    })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating user stats:', updateError);
    return;
  }

  // Check and award badges
  await checkAndAwardBadges(userId, newXp, newTotalLessons);

  return { newXp, newLevel, totalLessons: newTotalLessons };
}

/**
 * Check for milestones and award badges if not already earned
 */
export async function checkAndAwardBadges(userId: string, xp: number, lessons: number) {
  try {
    // 1. Get all available badges
    const { data: allBadges } = await supabase.from('badges').select('*');
    if (!allBadges) return;

    // 2. Get badges user already has
    const { data: existingBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    
    const ownedBadgeIds = new Set(existingBadges?.map(b => b.badge_id) || []);

    // 3. Define criteria for each badge (mapping name to logic)
    for (const badge of allBadges) {
      if (ownedBadgeIds.has(badge.id)) continue;

      let earned = false;
      if (badge.name === 'First Steps' && lessons >= 1) earned = true;
      if (badge.name === 'Legal Eagle' && xp >= 500) earned = true;
      if (badge.name === 'Scholar' && xp >= 2000) earned = true;
      
      if (badge.name === 'Flash Champion') {
        const count = await activityCount(userId, 'flashcard_complete');
        if (count >= 50) earned = true;
      }
      
      if (badge.name === 'Courtroom Ace') {
        const count = await activityCount(userId, 'rpg_scenario');
        if (count >= 5) earned = true;
      }

      if (earned) {
        await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id
        });
        console.log(`🎉 Badge earned: ${badge.name}`);
      }
    }
  } catch (err) {
    console.error('Error in checkAndAwardBadges:', err);
  }
}

/**
 * Helper to count specific activities in user_progress
 * (Note: In a real app, this might be a more complex query or a counter in the users table)
 */
async function activityCount(userId: string, activityType: string) {
  const { count } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .ilike('activity', `%${activityType}%`);
  
  return count || 0;
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
