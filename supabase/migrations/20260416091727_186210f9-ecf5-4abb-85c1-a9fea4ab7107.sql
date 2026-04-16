
-- 1. Rate-limit table
CREATE TABLE public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rate_limits_user_time ON public.ai_rate_limits (user_id, created_at);

-- 2. Harden profiles RLS: public -> authenticated
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (is_owner(user_id));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (is_owner(user_id));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (is_owner(user_id));

-- 3. Harden projects RLS: public -> authenticated
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT TO authenticated USING (is_owner(user_id));
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (is_owner(user_id));
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE TO authenticated USING (is_owner(user_id));
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE TO authenticated USING (is_owner(user_id));
