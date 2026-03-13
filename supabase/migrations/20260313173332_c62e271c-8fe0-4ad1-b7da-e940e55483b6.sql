
-- Players table
CREATE TABLE public.players (
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

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own players" ON public.players FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own players" ON public.players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own players" ON public.players FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own players" ON public.players FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cash Sessions table
CREATE TABLE public.cash_sessions (
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

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.cash_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cash Players table
CREATE TABLE public.cash_players (
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

ALTER TABLE public.cash_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own cash_players" ON public.cash_players FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash_players" ON public.cash_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash_players" ON public.cash_players FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash_players" ON public.cash_players FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  cash_player_id uuid NOT NULL REFERENCES public.cash_players(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
