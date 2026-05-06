-- ============================================================
-- Gamell - Full Supabase Schema
-- Run in Supabase SQL Editor before launching
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users / Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE NOT NULL,
  display_name  text,
  avatar_id     text DEFAULT 'scale',
  xp            int DEFAULT 0,
  level         int DEFAULT 1,
  streak        int DEFAULT 0,
  last_active   date DEFAULT current_date,
  total_lessons int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Trigger to create profile on signup
-- This avoids "permission denied" errors when email confirmation is ON
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create the trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ── Badges ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  icon        text,
  xp_required int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  badge_id   uuid REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- ── Documents (RAG) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content    text NOT NULL,
  embedding  vector(768),
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_metadata
  ON documents USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── Flashcards ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text NOT NULL,
  answer     text NOT NULL,
  topic      text NOT NULL,
  difficulty text DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz DEFAULT now()
);

-- ── Legal Facts (Did You Know) ───────────────────────────────
CREATE TABLE IF NOT EXISTS legal_facts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact       text NOT NULL,
  topic      text NOT NULL,
  source     text,
  created_at timestamptz DEFAULT now()
);

-- ── RPG Scenarios ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rpg_scenarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  situation   text NOT NULL,
  difficulty  text DEFAULT 'beginner',
  topic       text,
  xp_reward   int DEFAULT 50,
  created_at  timestamptz DEFAULT now()
);

-- ── User Progress ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  activity     text NOT NULL,
  xp_earned    int DEFAULT 0,
  completed_at timestamptz DEFAULT now()
);

-- ── Community Posts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  content        text NOT NULL,
  topic          text,
  likes          int DEFAULT 0,
  dislikes       int DEFAULT 0,
  comments_count int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_interactions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id          uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('like', 'dislike')),
  created_at       timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- ── Conversations (Chat/RAG) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON conversations(session_id, user_id, created_at);

-- Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" 
  ON conversations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" 
  ON conversations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" 
  ON conversations FOR DELETE 
  USING (auth.uid() = user_id);


-- ── Ingestion Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  source_type  text NOT NULL,
  chunk_count  int DEFAULT 0,
  status       text DEFAULT 'pending',
  error_msg    text,
  created_at   timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ── Vector Search Functions ───────────────────────────────────
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding      vector(768),
  match_count          int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5,
  filter_metadata      jsonb DEFAULT '{}'
)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE 1 - (d.embedding <=> query_embedding) > similarity_threshold
    AND (filter_metadata = '{}'::jsonb OR d.metadata @> filter_metadata)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text      text,
  query_embedding vector(768),
  match_count     int DEFAULT 5,
  keyword_weight  float DEFAULT 0.3,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH keyword_results AS (
    SELECT d.id, d.content, d.metadata,
           ts_rank(to_tsvector('english', d.content),
                   plainto_tsquery('english', query_text)) AS kw_score
    FROM documents d
    WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
  ),
  semantic_results AS (
    SELECT d.id, d.content, d.metadata,
           1 - (d.embedding <=> query_embedding) AS sem_score
    FROM documents d
  ),
  combined AS (
    SELECT COALESCE(s.id, k.id) AS id,
           COALESCE(s.content, k.content) AS content,
           COALESCE(s.metadata, k.metadata) AS metadata,
           COALESCE(s.sem_score, 0) * semantic_weight
             + COALESCE(k.kw_score, 0) * keyword_weight AS similarity
    FROM semantic_results s
    FULL OUTER JOIN keyword_results k ON s.id = k.id
  )
  SELECT id, content, metadata, similarity
  FROM combined
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ── Comment Counting Trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_comment_changes()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET comments_count = comments_count - 1
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create the trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_comment_created_or_deleted') THEN
    CREATE TRIGGER on_comment_created_or_deleted
      AFTER INSERT OR DELETE ON public.comments
      FOR EACH ROW EXECUTE FUNCTION public.handle_comment_changes();
  END IF;
END $$;

-- ── Atomic XP Update Function ─────────────────────────────────
-- Runs as the calling user (SECURITY INVOKER) so RLS is respected.
-- Eliminates the read-then-write race condition in awardXP.
CREATE OR REPLACE FUNCTION increment_user_xp(
  p_user_id   uuid,
  p_xp_amount int,
  p_activity  text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_xp    int;
  v_new_level int;
BEGIN
  -- Log the activity
  INSERT INTO user_progress (user_id, activity, xp_earned)
  VALUES (p_user_id, p_activity, p_xp_amount);

  -- Atomically increment XP and recompute level in one UPDATE
  UPDATE users
  SET
    xp    = xp + p_xp_amount,
    level = FLOOR(SQRT((xp + p_xp_amount) / 100.0))::int + 1
  WHERE id = p_user_id
  RETURNING xp, level INTO v_new_xp, v_new_level;

  RETURN json_build_object('newXp', v_new_xp, 'newLevel', v_new_level);
END;
$$;

CREATE OR REPLACE FUNCTION interact_with_post(p_post_id uuid, p_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_post_owner_id uuid;
  v_like_count int;
  v_dislike_count int;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_type NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'Invalid interaction type';
  END IF;

  SELECT user_id
  INTO v_post_owner_id
  FROM posts
  WHERE id = p_post_id;

  IF v_post_owner_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post_owner_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot interact with your own post';
  END IF;

  -- Insert or update the interaction
  INSERT INTO post_interactions (post_id, user_id, interaction_type)
  VALUES (p_post_id, v_user_id, p_type)
  ON CONFLICT (post_id, user_id) DO UPDATE 
  SET interaction_type = EXCLUDED.interaction_type;

  -- Recalculate totals
  SELECT COUNT(*) INTO v_like_count FROM post_interactions WHERE post_id = p_post_id AND interaction_type = 'like';
  SELECT COUNT(*) INTO v_dislike_count FROM post_interactions WHERE post_id = p_post_id AND interaction_type = 'dislike';

  -- Update posts table
  UPDATE posts
  SET likes = v_like_count, dislikes = v_dislike_count
  WHERE id = p_post_id;

  RETURN json_build_object('likes', v_like_count, 'dislikes', v_dislike_count);
END;
$$;

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating to avoid conflicts on re-run
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can view own badges" ON user_badges;
DROP POLICY IF EXISTS "Users can insert own badges" ON user_badges;
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view interactions" ON post_interactions;
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Anyone can read flashcards" ON flashcards;
DROP POLICY IF EXISTS "Anyone can read facts" ON legal_facts;
DROP POLICY IF EXISTS "Anyone can read scenarios" ON rpg_scenarios;
DROP POLICY IF EXISTS "Anyone can read badges" ON badges;
DROP POLICY IF EXISTS "Anyone can read documents" ON documents;

-- Users
CREATE POLICY "Users can view own profile"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- User badges
CREATE POLICY "Users can view own badges"   ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User progress
CREATE POLICY "Users can view own progress"   ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Posts
CREATE POLICY "Anyone can view posts"      ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts"     ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);

-- Interactions
CREATE POLICY "Anyone can view interactions" ON post_interactions FOR SELECT USING (true);

-- Public read-only content tables
CREATE POLICY "Anyone can read flashcards" ON flashcards  FOR SELECT USING (true);
CREATE POLICY "Anyone can read facts"      ON legal_facts FOR SELECT USING (true);
CREATE POLICY "Anyone can read scenarios"  ON rpg_scenarios FOR SELECT USING (true);
CREATE POLICY "Anyone can read badges"     ON badges FOR SELECT USING (true);
CREATE POLICY "Anyone can read documents"  ON documents FOR SELECT USING (true);

-- ── Table Grants ──────────────────────────────────────────────
-- RLS policies alone are not enough — Postgres also requires explicit
-- table-level privileges. Tables created via SQL Editor do not get
-- these automatically unlike tables created via the Supabase dashboard.
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT         ON public.user_badges TO authenticated;
GRANT SELECT, INSERT         ON public.user_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.post_interactions TO authenticated;
GRANT SELECT ON public.badges TO authenticated;
GRANT SELECT ON public.flashcards TO authenticated;
GRANT SELECT ON public.legal_facts TO authenticated;
GRANT SELECT ON public.rpg_scenarios TO authenticated;
GRANT SELECT ON public.documents TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_xp(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION interact_with_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents(vector, int, float, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search(text, vector, int, float, float) TO authenticated;

-- ── Seed: Badges ──────────────────────────────────────────────
INSERT INTO badges (name, description, icon, xp_required) VALUES
  ('First Steps',       'Complete your first lesson',                  '🎓', 0),
  ('Legal Eagle',       'Earn 500 XP',                                 '🦅', 500),
  ('Streak Master',     'Maintain a 7-day streak',                     '🔥', 0),
  ('Constitution Pro',  'Complete all constitutional law lessons',     '📜', 0),
  ('Courtroom Ace',     'Win 5 RPG scenarios',                         '⚖', 0),
  ('Flash Champion',    'Complete 50 flashcards',                      '⚡', 0),
  ('Scholar',           'Earn 2000 XP',                                '🎖', 2000)
ON CONFLICT DO NOTHING;

-- ── Seed: Flashcards ─────────────────────────────────────────
INSERT INTO flashcards (question, answer, topic, difficulty) VALUES
  ('What is the supreme law of Nigeria?', 'The Constitution of the Federal Republic of Nigeria 1999 (as amended) is the supreme law. Any law inconsistent with it is void to the extent of its inconsistency.', 'Constitutional Law', 'beginner'),
  ('What are the fundamental rights guaranteed under Chapter IV of the Nigerian Constitution?', 'Chapter IV guarantees: Right to life, Right to dignity, Right to personal liberty, Right to fair hearing, Right to private and family life, Right to freedom of thought and religion, Right to freedom of expression, Right to peaceful assembly, Right to freedom of movement, Right to freedom from discrimination, and Right to acquire and own property.', 'Constitutional Law', 'beginner'),
  ('What is the doctrine of separation of powers in Nigeria?', 'Nigeria operates a separation of powers among three arms of government: the Legislature (National Assembly - makes laws), the Executive (President and Ministers - implements laws), and the Judiciary (Courts - interprets laws). Each arm checks and balances the others.', 'Constitutional Law', 'beginner'),
  ('What is the standard of proof in criminal cases in Nigeria?', 'In criminal cases, the prosecution must prove the charge beyond reasonable doubt. The burden of proof lies on the prosecution and never shifts to the accused, except in statutory exceptions.', 'Criminal Law', 'beginner'),
  ('Define an offer in Nigerian contract law.', 'An offer is a definite and unambiguous proposal made by one party (the offeror) to another (the offeree) with the intention that it shall become binding as soon as it is accepted. It must be communicated to the offeree to be valid.', 'Contract Law', 'beginner'),
  ('What makes a contract legally binding in Nigeria?', 'A valid contract in Nigeria requires: (1) Offer, (2) Acceptance, (3) Consideration, (4) Intention to create legal relations, (5) Capacity of parties, and (6) Legality of object. All six elements must be present.', 'Contract Law', 'beginner'),
  ('What is the Land Use Act 1978 and what does it provide?', 'The Land Use Act 1978 vests all land in each state in the Governor, who holds it in trust for the people. Individuals can only hold a Right of Occupancy (statutory or customary), not outright ownership. The Governor can revoke occupancy for overriding public interest with compensation.', 'Land Law', 'intermediate'),
  ('What is the difference between a crime and a tort in Nigerian law?', 'A crime is a wrong against the state/public, prosecuted by the government, and punished by imprisonment or fine. A tort is a civil wrong against an individual, pursued by the victim in civil court, and remedied by damages or injunction. The same act can be both (e.g. assault).', 'General Law', 'beginner'),
  ('What is habeas corpus and when can it be applied in Nigeria?', 'Habeas corpus is a court order requiring a person under arrest to be brought before a judge. In Nigeria, it enforces the right to personal liberty under Section 35 of the Constitution. It can be applied when someone is unlawfully detained without charge or trial within 24-48 hours.', 'Criminal Law', 'intermediate'),
  ('What rights does a Nigerian citizen have upon arrest?', 'Upon arrest, a person has the right to: (1) be informed of the reason for arrest, (2) remain silent, (3) consult a lawyer of their choice, (4) be brought before a court within 24 hours (or 48 hours if no court is nearby), and (5) be released on bail for bailable offences.', 'Criminal Law', 'beginner'),
  ('What is the difference between the Criminal Code and the Penal Code in Nigeria?', 'The Criminal Code Act applies in Southern Nigeria (Lagos, Rivers, Anambra, etc.) and is based on English criminal law. The Penal Code applies in Northern Nigeria (Kano, Kaduna, etc.) and incorporates Islamic legal principles. Both define offences and punishments but differ in specific provisions.', 'Criminal Law', 'intermediate'),
  ('What is judicial precedent (stare decisis) in Nigerian law?', 'Stare decisis means courts are bound by decisions of higher courts in the same hierarchy. In Nigeria: Supreme Court decisions bind all lower courts. Court of Appeal decisions bind High Courts. A court is not bound by its own previous decisions but will follow them for consistency unless clearly wrong.', 'General Law', 'intermediate'),
  ('What is the Administration of Criminal Justice Act (ACJA) 2015?', 'The ACJA 2015 governs criminal procedure in federal courts and FCT. Key provisions: prohibits arrest in lieu of suspects, mandates arraignment within 24 hours, introduces plea bargaining, prohibits holding suspects beyond 24-48 hours without charge, and establishes the Administration of Criminal Justice Monitoring Committee.', 'Criminal Law', 'intermediate'),
  ('What is negligence in Nigerian tort law?', 'Negligence has three elements (from Donoghue v Stevenson): (1) Duty of care - the defendant owed the claimant a duty, (2) Breach - the defendant breached that duty by failing the reasonable person standard, and (3) Damage - the breach caused actual damage. All three must be proven.', 'Law of Torts', 'intermediate'),
  ('What is the right to fair hearing under Section 36 of the Nigerian Constitution?', 'Section 36 guarantees that anyone whose civil rights or criminal charges are determined must have a fair hearing within a reasonable time by a court or tribunal. It includes: right to be informed of charges, right to legal representation, right to examine witnesses, and presumption of innocence.', 'Constitutional Law', 'intermediate'),
  ('What does INEC stand for?', 'Independent National Electoral Commission.', 'Elections', 'beginner'),
  ('What is the role of NDLEA?', 'To combat drug trafficking.', 'Law Enforcement', 'beginner'),
  ('What is a constitution?', 'A set of fundamental principles governing a state.', 'Law', 'beginner'),
  ('What is democracy?', 'Government by the people.', 'Government', 'beginner'),
  ('What is a citizen?', 'A legally recognized member of a state.', 'Civics', 'beginner'),
  ('What is judicial independence?', 'Courts operate free from external influence.', 'Judiciary', 'intermediate'),
  ('What is a subpoena?', 'A legal order to appear in court.', 'Law', 'intermediate'),
  ('What is bail?', 'Temporary release of an accused person.', 'Criminal Law', 'intermediate'),
  ('What is a lease?', 'A contract for renting property.', 'Property Law', 'intermediate'),
  ('What is negligence?', 'Failure to take proper care.', 'Law', 'intermediate'),
  ('What is double jeopardy?', 'Being tried twice for the same offense.', 'Criminal Law', 'advanced'),
  ('What is an injunction?', 'A court order to stop an action.', 'Law', 'advanced'),
  ('What is arbitration?', 'Resolving disputes outside court.', 'Law', 'advanced'),
  ('What is extradition?', 'Transfer of a suspect between countries.', 'International Law', 'advanced'),
  ('What is sovereignty?', 'Supreme authority of a state.', 'Government', 'advanced'),
  ('What is public law?', 'Law governing state and citizens.', 'Law', 'intermediate'),
  ('What is private law?', 'Law between individuals.', 'Law', 'intermediate'),
  ('What is evidence?', 'Proof presented in court.', 'Law', 'beginner'),
  ('What is a verdict?', 'Decision of a court.', 'Judiciary', 'beginner'),
  ('What is litigation?', 'Process of taking legal action.', 'Law', 'intermediate')
ON CONFLICT DO NOTHING;

-- ── Seed: Legal Facts ─────────────────────────────────────────
INSERT INTO legal_facts (fact, topic, source) VALUES
  ('Nigeria operates a federal system of government with 36 states and the Federal Capital Territory (FCT), Abuja. Each state has its own House of Assembly and Governor, while the National Assembly at the federal level consists of the Senate and House of Representatives.', 'Constitutional Law', 'Constitution of Nigeria 1999, Section 2'),
  ('The Nigerian Supreme Court is the highest court in the land and its decisions are final and binding on all other courts. It was established by Section 230 of the 1999 Constitution and currently has a Chief Justice and up to 21 Justices.', 'Court System', 'Constitution of Nigeria 1999, Section 230'),
  ('Under the Land Use Act 1978, no individual owns land outright in Nigeria. All land belongs to the government, and individuals only hold a "Right of Occupancy." This is why you get a Certificate of Occupancy (C of O), not a title deed.', 'Land Law', 'Land Use Act 1978'),
  ('In Nigeria, you cannot be imprisoned for a debt you owe. The Debtors Act prohibits imprisonment for civil debt. However, if you obtain money by fraud or false pretenses, that becomes a criminal offence and can lead to imprisonment.', 'Criminal Law', 'Debtors Act, Nigeria'),
  ('The Nigerian Constitution recognizes three categories of legislative powers: Exclusive List (only federal government can legislate, e.g. defence, immigration), Concurrent List (both federal and state can legislate, e.g. education, health), and Residual Powers (states legislate on everything else).', 'Constitutional Law', 'Constitution of Nigeria 1999, Second Schedule'),
  ('A marriage conducted under the Marriage Act (Registry or Church marriage) is monogamous - you cannot legally marry another person while that marriage subsists. However, customary law marriages in Nigeria can be polygamous, allowing a man to marry multiple wives.', 'Family Law', 'Marriage Act, Nigeria'),
  ('The Evidence Act 2011 is the primary law governing what can and cannot be used as evidence in Nigerian courts. It covers oral evidence, documentary evidence, and electronic evidence - including emails and text messages, which are admissible if properly authenticated.', 'Law of Evidence', 'Evidence Act 2011'),
  ('Under Nigerian labour law, an employer must give notice before terminating employment. The required notice period depends on the contract - typically 1 month for monthly-paid employees. Summary dismissal (without notice) is only lawful for gross misconduct.', 'Labour Law', 'Labour Act, Nigeria'),
  ('The Federal High Court in Nigeria has exclusive jurisdiction over federal revenue matters, admiralty law, banking, companies, copyright, and matters involving the federal government. It was established by Section 249 of the 1999 Constitution.', 'Court System', 'Constitution of Nigeria 1999, Section 249'),
  ('In Nigeria, the age of criminal responsibility is 7 years. Children between 7 and 12 can only be convicted if it is proven they understood the nature and consequences of their actions. Children under 17 are tried in a Juvenile Court, not an adult court.', 'Criminal Law', 'Criminal Code Act, Nigeria'),
  ('Legal Aid is available in Nigeria through the Legal Aid Council established by the Legal Aid Act. It provides free legal services to Nigerians who cannot afford a lawyer for certain criminal offences. The accused must apply and prove financial incapacity.', 'Access to Justice', 'Legal Aid Act, Nigeria'),
  ('The Nigerian Bar Association (NBA) regulates the legal profession in Nigeria. Every lawyer must be enrolled at the Supreme Court and must have a practicing certificate (renewed annually) to practice law in Nigeria. Practicing without one is a criminal offence.', 'Legal Profession', 'Legal Practitioners Act, Nigeria'),
  ('Corruption and bribery of public officials is prosecuted by the Economic and Financial Crimes Commission (EFCC) and the Independent Corrupt Practices Commission (ICPC). Both were established by separate Acts and have power to investigate, arrest, and prosecute.', 'Anti-Corruption Law', 'EFCC Act 2004; ICPC Act 2000'),
  ('Under the Nigerian Constitution, the President can only serve a maximum of two terms of four years each (8 years total). The same applies to State Governors. This was designed to prevent concentration of executive power.', 'Constitutional Law', 'Constitution of Nigeria 1999, Sections 135 & 182'),
  ('Nigeria has a dual court system: the Common Law courts (Magistrate, High Court, Court of Appeal, Supreme Court) applying English-based law, and the Customary/Sharia courts applying customary or Islamic law. Both systems can operate simultaneously in most states.', 'Court System', 'Constitution of Nigeria 1999'),
  ('The Constitution is the highest authority in Nigeria.', 'Constitutional Law', '1999 Constitution'),
  ('Arrest without warrant is allowed in certain cases.', 'Criminal Law', 'Nigerian Law'),
  ('Self-defense is legally recognized.', 'Criminal Law', 'Penal Code'),
  ('Forgery includes falsifying signatures.', 'Criminal Law', 'Penal Code'),
  ('The police must identify themselves during arrest.', 'Human Rights', 'Nigerian Law'),
  ('Employees are entitled to safe working conditions.', 'Labor Law', 'Labor Act'),
  ('Dismissal without cause can be challenged.', 'Labor Law', 'Labor Act'),
  ('Tenancy agreements can be oral or written.', 'Property Law', 'Tenancy Law'),
  ('Trespassing is a punishable offense.', 'Property Law', 'Nigerian Law'),
  ('Defamation includes libel and slander.', 'Civil Law', 'Nigerian Law'),
  ('Cyberstalking is illegal.', 'Cyber Law', 'Cybercrime Act'),
  ('Identity theft is punishable.', 'Cyber Law', 'Cybercrime Act'),
  ('Banks must protect customer data.', 'Finance Law', 'CBN Regulations'),
  ('Fraudulent misrepresentation is actionable.', 'Contract Law', 'Nigerian Law'),
  ('Contracts require offer, acceptance, and consideration.', 'Contract Law', 'Nigerian Law'),
  ('Illegal strikes may attract penalties.', 'Labor Law', 'Labor Act'),
  ('Noise pollution can be regulated.', 'Environmental Law', 'NESREA Act'),
  ('Importation of banned goods is illegal.', 'Customs Law', 'Nigerian Law'),
  ('Smuggling is a criminal offense.', 'Customs Law', 'Nigerian Law'),
  ('False advertising is prohibited.', 'Consumer Law', 'Nigerian Law')
ON CONFLICT DO NOTHING;

-- ── Seed: RPG Scenarios ───────────────────────────────────────
INSERT INTO rpg_scenarios (title, description, situation, difficulty, topic, xp_reward) VALUES
  ('The Unlawful Eviction', 'Your landlord wants you out - but is it legal?', 'You have rented an apartment in Lagos for 3 years with a written tenancy agreement. Your landlord sends you a WhatsApp message giving you 7 days to vacate, claiming he needs the property back. He has started removing your belongings. What are your legal rights and what should you do?', 'beginner', 'Property Law', 100),
  ('The Wrongful Arrest', 'Police arrested you without explanation. Know your rights.', 'You are stopped by police officers who claim you match a suspect''s description. They put you in a van and take you to the station without telling you why you are being arrested or showing a warrant. At the station, they refuse to let you call a lawyer. It has been 30 hours. What are your constitutional rights and what steps should you take?', 'beginner', 'Criminal Law', 100),
  ('The Unfair Dismissal', 'Fired via WhatsApp with no reason. What can you do?', 'You have worked at a Lagos tech company for 4 years with a signed employment contract stating 1-month notice is required for termination. You receive a WhatsApp message from HR on a Friday evening saying your employment is terminated with immediate effect, no reason given, and no severance pay. What are your rights under Nigerian labour law?', 'beginner', 'Labour Law', 100),
  ('The Contract Dispute', 'You paid for services never delivered. Can you recover your money?', 'You paid a contractor N500,000 to renovate your shop. He completed 20% of the work, collected the full payment, and has since become unreachable. You have a written contract, bank transfer receipts, and WhatsApp messages where he promised to complete the work. What legal options do you have to recover your money?', 'intermediate', 'Contract Law', 150),
  ('The Land Grabbers', 'Someone is building on your land. What is your next move?', 'You inherited land from your father in Abuja with a Certificate of Occupancy (C of O) in his name. You return from abroad to find a developer has fenced off half the land and begun construction, claiming they purchased it from someone else. You have the original title documents. What steps should you take immediately under Nigerian law?', 'intermediate', 'Land Law', 150),
  ('The Police Extortion', 'Officers are demanding a bribe. What are your rights?', 'A police officer stops your car at a checkpoint and demands N10,000, threatening to arrest you on fabricated charges if you refuse. You have all your valid vehicle documents. You know this is wrong. What are your rights, and what is the safest and most legally sound way to handle this situation?', 'intermediate', 'Criminal Law', 150),
  ('ATM Fraud Attempt', 'Banking scam', 'Someone tries to distract you at an ATM.', 'beginner', 'Finance Law', 50),
  ('Phone Theft Case', 'Property crime', 'Your phone is stolen in public.', 'beginner', 'Criminal Law', 50),
  ('Fake NGO Donation', 'Fraud awareness', 'A group requests fake charity funds.', 'beginner', 'Fraud', 50),
  ('Driving Without License', 'Traffic law', 'You are stopped without a license.', 'beginner', 'Traffic Law', 50),
  ('Noise Complaint', 'Community dispute', 'Neighbor files complaint against you.', 'beginner', 'Environmental Law', 50),
  ('Startup Co-founder Conflict', 'Business issue', 'Your partner withdraws funds secretly.', 'intermediate', 'Business Law', 70),
  ('School Certificate Fraud', 'Education fraud', 'Fake certificates discovered.', 'intermediate', 'Criminal Law', 70),
  ('Immigration Overstay', 'Travel issue', 'You exceed visa duration.', 'intermediate', 'Immigration Law', 70),
  ('Trademark Dispute', 'Brand protection', 'Another company copies your logo.', 'intermediate', 'IP Law', 70),
  ('Insurance Claim Rejection', 'Finance issue', 'Your claim is denied unfairly.', 'intermediate', 'Insurance Law', 70),
  ('Corporate Tax Fraud', 'Finance crime', 'Your firm hides revenue.', 'advanced', 'Tax Law', 100),
  ('Election Violence', 'Crisis scenario', 'Violence breaks out at polling unit.', 'advanced', 'Electoral Law', 100),
  ('Kidnap Ransom Negotiation', 'High-risk scenario', 'You must respond strategically.', 'advanced', 'Criminal Law', 100),
  ('Data Privacy Breach', 'Tech law', 'User data is leaked.', 'advanced', 'Cyber Law', 100),
  ('Illegal Mining Operation', 'Environmental crime', 'Company violates regulations.', 'advanced', 'Environmental Law', 100),
  ('Fake Loan App', 'Fintech scam', 'App demands excessive permissions.', 'beginner', 'Cyber Law', 50),
  ('Public Protest Arrest', 'Civil rights', 'You are detained during protest.', 'intermediate', 'Human Rights', 70),
  ('Border Smuggling Offer', 'Crime temptation', 'You are offered money to smuggle goods.', 'advanced', 'Customs Law', 100),
  ('Contract Breach Lawsuit', 'Legal dispute', 'Client refuses to pay after service.', 'intermediate', 'Contract Law', 70),
  ('Online Identity Theft', 'Cybercrime', 'Someone impersonates you online.', 'intermediate', 'Cyber Law', 70)
ON CONFLICT DO NOTHING;
