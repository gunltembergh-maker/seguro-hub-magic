CREATE TABLE public.sso_handoff (
  code text PRIMARY KEY,
  payload text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sso_handoff TO service_role;
ALTER TABLE public.sso_handoff ENABLE ROW LEVEL SECURITY;