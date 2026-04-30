// lib/types.ts

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_id: string;
  xp: number;
  level: number;
  streak: number;
  last_active: string;
  total_lessons: number;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_required: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badges: Badge;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface LegalFact {
  id: string;
  fact: string;
  topic: string;
  source: string;
}

export interface RpgScenario {
  id: string;
  title: string;
  description: string;
  situation: string;
  difficulty: string;
  topic: string;
  xp_reward: number;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  topic: string | null;
  likes: number;
  created_at: string;
  users?: { display_name: string | null; avatar_id: string };
}

export interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  avatar_id: string;
  xp: number;
  level: number;
  streak: number;
}
