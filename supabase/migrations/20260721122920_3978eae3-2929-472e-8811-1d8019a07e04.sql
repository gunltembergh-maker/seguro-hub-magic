-- Backfill profiles.email a partir de auth.users quando estiver vazio,
-- e faz o mesmo para o RPC de listagem de destinatários usar coalesce.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '');
