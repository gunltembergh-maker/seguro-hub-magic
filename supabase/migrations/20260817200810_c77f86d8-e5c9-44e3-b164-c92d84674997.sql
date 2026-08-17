DO $do$
DECLARE
  r record;
  src text;
BEGIN
  FOR r IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosrc ILIKE '%banned_until%'
       AND p.prosrc ILIKE '%infinity%'
  LOOP
    src := pg_get_functiondef(r.oid);
    src := replace(src, '''infinity''::timestamptz', '''2999-12-31 00:00:00+00''::timestamptz');
    src := replace(src, '''infinity''::timestamp with time zone', '''2999-12-31 00:00:00+00''::timestamptz');
    EXECUTE src;
  END LOOP;
END
$do$;

DELETE FROM public.notificacoes_admin WHERE tipo = 'diagnostico';