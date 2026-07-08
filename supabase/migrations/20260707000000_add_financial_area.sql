-- Área financeira for Cash Game Pro.
--
-- This migration is intentionally aligned with the table names hardcoded in
-- src/db/database.ts. The frontend uses:
--   sessions:           public.cash_sessions
--   players:            public.players
--   session players:    public.cash_players
--   legacy transactions public.transactions
--   finance entries:    public.financial_transactions
--   receivables:        public.receivables
--   expenses:           public.session_expenses
--
-- If public.cash_sessions does not exist, the production database is missing
-- the base Cash Game Pro schema expected by the app. In that case this
-- migration stops with a clear message instead of creating an incompatible
-- parallel schema.

DO $$
BEGIN
  IF to_regclass('public.cash_sessions') IS NULL THEN
    RAISE EXCEPTION
      'Cash Game Pro schema mismatch: public.cash_sessions does not exist, but the frontend uses db.cashSessions -> public.cash_sessions. Apply the base schema migration before the financial migration or update the frontend table mapping.';
  END IF;

  IF to_regclass('public.players') IS NULL THEN
    RAISE EXCEPTION
      'Cash Game Pro schema mismatch: public.players does not exist, but the frontend uses db.players -> public.players.';
  END IF;
END $$;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS dealer_percentage numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_sessions'::regclass
      AND conname = 'cash_sessions_dealer_percentage_range'
  ) THEN
    ALTER TABLE public.cash_sessions
      ADD CONSTRAINT cash_sessions_dealer_percentage_range
      CHECK (dealer_percentage >= 0 AND dealer_percentage <= 100);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  receivable_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  type text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receivable_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  source_transaction_id uuid,
  original_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS original_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.session_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_expenses
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_amount_positive'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_payment_method_check'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_payment_method_check
      CHECK (payment_method IN ('cash', 'pix', 'credit', 'debit', 'fiado')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_type_check'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_type_check
      CHECK (type IN ('buyin', 'rebuy', 'addon', 'settlement', 'fiado_payment', 'manual_adjustment')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_original_amount_positive'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_original_amount_positive CHECK (original_amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_paid_amount_range'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_paid_amount_range CHECK (paid_amount >= 0 AND paid_amount <= original_amount) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_status_check'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_status_check CHECK (status IN ('open', 'paid')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_expenses'::regclass
      AND conname = 'session_expenses_amount_positive'
  ) THEN
    ALTER TABLE public.session_expenses
      ADD CONSTRAINT session_expenses_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_expenses'::regclass
      AND conname = 'session_expenses_category_check'
  ) THEN
    ALTER TABLE public.session_expenses
      ADD CONSTRAINT session_expenses_category_check
      CHECK (category IN ('dealer', 'food', 'drinks', 'staff', 'cleaning', 'rent', 'other')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_session_id_fkey'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.cash_sessions(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_player_id_fkey'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_user_id_fkey'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_session_id_fkey'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.cash_sessions(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_player_id_fkey'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_expenses'::regclass
      AND conname = 'session_expenses_user_id_fkey'
  ) THEN
    ALTER TABLE public.session_expenses
      ADD CONSTRAINT session_expenses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_expenses'::regclass
      AND conname = 'session_expenses_session_id_fkey'
  ) THEN
    ALTER TABLE public.session_expenses
      ADD CONSTRAINT session_expenses_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.cash_sessions(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_transactions'::regclass
      AND conname = 'financial_transactions_receivable_id_fkey'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_receivable_id_fkey
      FOREIGN KEY (receivable_id) REFERENCES public.receivables(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.receivables'::regclass
      AND conname = 'receivables_source_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_source_transaction_id_fkey
      FOREIGN KEY (source_transaction_id) REFERENCES public.financial_transactions(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_expenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_expenses TO authenticated;

DROP POLICY IF EXISTS "Users can select own financial transactions" ON public.financial_transactions;
CREATE POLICY "Users can select own financial transactions"
ON public.financial_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own financial transactions" ON public.financial_transactions;
CREATE POLICY "Users can insert own financial transactions"
ON public.financial_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own financial transactions" ON public.financial_transactions;
CREATE POLICY "Users can update own financial transactions"
ON public.financial_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own financial transactions" ON public.financial_transactions;
CREATE POLICY "Users can delete own financial transactions"
ON public.financial_transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own receivables" ON public.receivables;
CREATE POLICY "Users can select own receivables"
ON public.receivables FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own receivables" ON public.receivables;
CREATE POLICY "Users can insert own receivables"
ON public.receivables FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own receivables" ON public.receivables;
CREATE POLICY "Users can update own receivables"
ON public.receivables FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own receivables" ON public.receivables;
CREATE POLICY "Users can delete own receivables"
ON public.receivables FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own session expenses" ON public.session_expenses;
CREATE POLICY "Users can select own session expenses"
ON public.session_expenses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own session expenses" ON public.session_expenses;
CREATE POLICY "Users can insert own session expenses"
ON public.session_expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own session expenses" ON public.session_expenses;
CREATE POLICY "Users can update own session expenses"
ON public.session_expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own session expenses" ON public.session_expenses;
CREATE POLICY "Users can delete own session expenses"
ON public.session_expenses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS financial_transactions_session_idx
ON public.financial_transactions (session_id, occurred_at);

CREATE INDEX IF NOT EXISTS financial_transactions_player_idx
ON public.financial_transactions (player_id);

CREATE INDEX IF NOT EXISTS financial_transactions_receivable_idx
ON public.financial_transactions (receivable_id);

CREATE INDEX IF NOT EXISTS receivables_session_idx
ON public.receivables (session_id);

CREATE INDEX IF NOT EXISTS receivables_open_player_idx
ON public.receivables (player_id, status);

CREATE INDEX IF NOT EXISTS session_expenses_session_idx
ON public.session_expenses (session_id, occurred_at);
