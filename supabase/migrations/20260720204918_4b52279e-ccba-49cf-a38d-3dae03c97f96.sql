
-- Auto-retry: se a última sincronização falhou/está pendente/incompleta, refazer automaticamente
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função que decide se precisa refazer sync e dispara a edge function
CREATE OR REPLACE FUNCTION public.retry_lavoro_sync_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ultima_status text;
  v_ultima_inicio timestamptz;
  v_running_count int;
BEGIN
  -- Se há sync rodando há menos de 20 min, não dispara nova
  SELECT COUNT(*) INTO v_running_count
  FROM public.lavoro_sync_log
  WHERE status = 'em_andamento'
    AND iniciado_em > now() - interval '20 minutes';

  IF v_running_count > 0 THEN
    RAISE NOTICE 'Sync já em andamento, pulando retry';
    RETURN;
  END IF;

  -- Pega o status da última tentativa (qualquer tabela)
  SELECT status, iniciado_em
  INTO v_ultima_status, v_ultima_inicio
  FROM public.lavoro_sync_log
  ORDER BY iniciado_em DESC NULLS LAST, id DESC
  LIMIT 1;

  -- Se última foi sucesso e é recente (<6h), nada a fazer
  IF v_ultima_status = 'sucesso' AND v_ultima_inicio > now() - interval '6 hours' THEN
    RETURN;
  END IF;

  -- Caso contrário (falha, em_andamento travado, ou nada nas últimas 6h), refaz
  PERFORM net.http_post(
    url := 'https://primmycdkkiziyhqkkkv.supabase.co/functions/v1/sync-lavoro-bases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaW1teWNka2tpeml5aHFra2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzQ0MDAsImV4cCI6MjA5OTExMDQwMH0._htjVkyhWr21gLcztb873HWu9O2BL0HELTLu1jGrPiQ'
    ),
    body := jsonb_build_object('trigger', 'auto_retry', 'at', now())
  );
END;
$$;

-- Agenda: roda a cada 15 minutos
SELECT cron.unschedule('lavoro-sync-auto-retry') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'lavoro-sync-auto-retry'
);

SELECT cron.schedule(
  'lavoro-sync-auto-retry',
  '*/15 * * * *',
  $$ SELECT public.retry_lavoro_sync_if_needed(); $$
);
