-- Cash Game Pro base schema.
-- Aligned with src/db/database.ts, src/types/index.ts, AuthContext,
-- ManageUsers, CashGames, ActiveCashGame, HistoryPage and NewCashGame.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  subscription_due_date date DEFAULT null,
  subscription_status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_due_date date DEFAULT null,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  nickname text NOT NULL DEFAULT '',
  phone text,
  pix text,
  notes text,
  tags text[] DEFAULT '{}',
  total_winnings numeric NOT NULL DEFAULT 0,
  total_losses numeric NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS nickname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS pix text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_winnings numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_losses numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  game_type text NOT NULL,
  blinds text NOT NULL,
  chip_value numeric NOT NULL DEFAULT 1,
  notes text,
  dealers_choice_games text,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_invested numeric,
  total_returned numeric,
  rake_final numeric
);

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS game_type text,
  ADD COLUMN IF NOT EXISTS blinds text,
  ADD COLUMN IF NOT EXISTS chip_value numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS dealers_choice_games text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_invested numeric,
  ADD COLUMN IF NOT EXISTS total_returned numeric,
  ADD COLUMN IF NOT EXISTS rake_final numeric;

CREATE TABLE IF NOT EXISTS public.cash_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  initial_buyin numeric NOT NULL DEFAULT 0,
  total_invested numeric NOT NULL DEFAULT 0,
  current_chips numeric NOT NULL DEFAULT 0,
  final_chips numeric,
  result numeric,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_status text NOT NULL DEFAULT 'paid',
  joined_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.cash_players
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS initial_buyin numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invested numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_chips numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_chips numeric,
  ADD COLUMN IF NOT EXISTS result numeric,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  cash_player_id uuid NOT NULL REFERENCES public.cash_players(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cash_player_id uuid REFERENCES public.cash_players(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timestamp timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, active, subscription_status)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', true, 'active')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

INSERT INTO public.profiles (id, full_name, active, subscription_status)
SELECT id, raw_user_meta_data->>'full_name', true, 'active'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;

DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can select own players" ON public.players;
CREATE POLICY "Users can select own players"
ON public.players FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own players" ON public.players;
CREATE POLICY "Users can insert own players"
ON public.players FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own players" ON public.players;
CREATE POLICY "Users can update own players"
ON public.players FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own players" ON public.players;
CREATE POLICY "Users can delete own players"
ON public.players FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own sessions" ON public.cash_sessions;
CREATE POLICY "Users can select own sessions"
ON public.cash_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.cash_sessions;
CREATE POLICY "Users can insert own sessions"
ON public.cash_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.cash_sessions;
CREATE POLICY "Users can update own sessions"
ON public.cash_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.cash_sessions;
CREATE POLICY "Users can delete own sessions"
ON public.cash_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own cash_players" ON public.cash_players;
CREATE POLICY "Users can select own cash_players"
ON public.cash_players FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cash_players" ON public.cash_players;
CREATE POLICY "Users can insert own cash_players"
ON public.cash_players FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cash_players" ON public.cash_players;
CREATE POLICY "Users can update own cash_players"
ON public.cash_players FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cash_players" ON public.cash_players;
CREATE POLICY "Users can delete own cash_players"
ON public.cash_players FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own transactions" ON public.transactions;
CREATE POLICY "Users can select own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS players_user_name_idx ON public.players (user_id, name);
CREATE INDEX IF NOT EXISTS cash_sessions_user_started_idx ON public.cash_sessions (user_id, started_at);
CREATE INDEX IF NOT EXISTS cash_players_session_idx ON public.cash_players (session_id);
CREATE INDEX IF NOT EXISTS cash_players_player_idx ON public.cash_players (player_id);
CREATE INDEX IF NOT EXISTS transactions_session_idx ON public.transactions (session_id, timestamp);
CREATE INDEX IF NOT EXISTS transactions_cash_player_idx ON public.transactions (cash_player_id);
