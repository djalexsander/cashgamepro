-- Keep Cash Game Pro isolated per authenticated user.
-- These policies intentionally keep the product in an individual-user model.

ALTER TABLE public.players
  ADD CONSTRAINT players_id_user_id_unique UNIQUE (id, user_id);

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_id_user_id_unique UNIQUE (id, user_id);

ALTER TABLE public.cash_players
  ADD CONSTRAINT cash_players_id_user_id_unique UNIQUE (id, user_id),
  ADD CONSTRAINT cash_players_id_session_id_user_id_unique UNIQUE (id, session_id, user_id),
  ADD CONSTRAINT cash_players_session_belongs_to_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.cash_sessions (id, user_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT cash_players_player_belongs_to_user
    FOREIGN KEY (player_id, user_id)
    REFERENCES public.players (id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_session_belongs_to_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.cash_sessions (id, user_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT transactions_cash_player_belongs_to_session_user
    FOREIGN KEY (cash_player_id, session_id, user_id)
    REFERENCES public.cash_players (id, session_id, user_id)
    ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can select own players" ON public.players;
DROP POLICY IF EXISTS "Users can insert own players" ON public.players;
DROP POLICY IF EXISTS "Users can update own players" ON public.players;
DROP POLICY IF EXISTS "Users can delete own players" ON public.players;

CREATE POLICY "Users can select own players"
ON public.players FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own players"
ON public.players FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own players"
ON public.players FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own players"
ON public.players FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.cash_sessions;

CREATE POLICY "Users can select own sessions"
ON public.cash_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
ON public.cash_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.cash_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
ON public.cash_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own cash_players" ON public.cash_players;
DROP POLICY IF EXISTS "Users can insert own cash_players" ON public.cash_players;
DROP POLICY IF EXISTS "Users can update own cash_players" ON public.cash_players;
DROP POLICY IF EXISTS "Users can delete own cash_players" ON public.cash_players;

CREATE POLICY "Users can select own cash_players"
ON public.cash_players FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash_players"
ON public.cash_players FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cash_sessions s
    WHERE s.id = cash_players.session_id
      AND s.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = cash_players.player_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own cash_players"
ON public.cash_players FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cash_sessions s
    WHERE s.id = cash_players.session_id
      AND s.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = cash_players.player_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own cash_players"
ON public.cash_players FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can select own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cash_sessions s
    WHERE s.id = transactions.session_id
      AND s.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.cash_players cp
    WHERE cp.id = transactions.cash_player_id
      AND cp.session_id = transactions.session_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cash_sessions s
    WHERE s.id = transactions.session_id
      AND s.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.cash_players cp
    WHERE cp.id = transactions.cash_player_id
      AND cp.session_id = transactions.session_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
