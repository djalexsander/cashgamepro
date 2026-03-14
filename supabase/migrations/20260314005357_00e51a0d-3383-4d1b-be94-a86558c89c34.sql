
ALTER TABLE public.profiles
  ADD COLUMN subscription_due_date date DEFAULT null,
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.profiles.subscription_due_date IS 'Data de vencimento da mensalidade';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Status: active, pending, blocked';
