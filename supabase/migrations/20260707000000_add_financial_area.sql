ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS dealer_percentage numeric NOT NULL DEFAULT 0;

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_dealer_percentage_range
  CHECK (dealer_percentage >= 0 AND dealer_percentage <= 100);

CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  receivable_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  type text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_transactions_id_user_id_unique UNIQUE (id, user_id),
  CONSTRAINT financial_transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT financial_transactions_payment_method_check CHECK (payment_method IN ('cash', 'pix', 'credit', 'debit', 'fiado')),
  CONSTRAINT financial_transactions_type_check CHECK (type IN ('buyin', 'rebuy', 'addon', 'settlement', 'fiado_payment', 'manual_adjustment')),
  CONSTRAINT financial_transactions_session_belongs_to_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.cash_sessions (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT financial_transactions_player_belongs_to_user
    FOREIGN KEY (player_id)
    REFERENCES public.players (id)
    ON DELETE SET NULL
);

CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  source_transaction_id uuid,
  original_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receivables_id_user_id_unique UNIQUE (id, user_id),
  CONSTRAINT receivables_original_amount_positive CHECK (original_amount > 0),
  CONSTRAINT receivables_paid_amount_range CHECK (paid_amount >= 0 AND paid_amount <= original_amount),
  CONSTRAINT receivables_status_check CHECK (status IN ('open', 'paid')),
  CONSTRAINT receivables_session_belongs_to_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.cash_sessions (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT receivables_player_belongs_to_user
    FOREIGN KEY (player_id, user_id)
    REFERENCES public.players (id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_receivable_belongs_to_user
  FOREIGN KEY (receivable_id)
  REFERENCES public.receivables (id)
  ON DELETE SET NULL;

ALTER TABLE public.receivables
  ADD CONSTRAINT receivables_source_transaction_belongs_to_user
  FOREIGN KEY (source_transaction_id)
  REFERENCES public.financial_transactions (id)
  ON DELETE SET NULL;

CREATE TABLE public.session_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_expenses_amount_positive CHECK (amount > 0),
  CONSTRAINT session_expenses_category_check CHECK (category IN ('dealer', 'food', 'drinks', 'staff', 'cleaning', 'rent', 'other')),
  CONSTRAINT session_expenses_session_belongs_to_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.cash_sessions (id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own financial transactions"
ON public.financial_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial transactions"
ON public.financial_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financial transactions"
ON public.financial_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own financial transactions"
ON public.financial_transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own receivables"
ON public.receivables FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receivables"
ON public.receivables FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own receivables"
ON public.receivables FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own receivables"
ON public.receivables FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own session expenses"
ON public.session_expenses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session expenses"
ON public.session_expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session expenses"
ON public.session_expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own session expenses"
ON public.session_expenses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX financial_transactions_session_idx ON public.financial_transactions (session_id, occurred_at);
CREATE INDEX financial_transactions_player_idx ON public.financial_transactions (player_id);
CREATE INDEX receivables_open_player_idx ON public.receivables (player_id, status);
CREATE INDEX session_expenses_session_idx ON public.session_expenses (session_id, occurred_at);
