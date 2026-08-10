CREATE OR REPLACE FUNCTION public.retry_lavoro_sync_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_running int;
  v_status text;
  v_criado timestamptz;
  v_msg text;
BEGIN
  -- Carga realmente em andamento (heartbeat nos últimos 10 min): não interfere.
  SELECT count(*) INTO v_running
  FROM public.lavoro_sync_log
  WHERE status = 'erro'
    AND criado_em > now() - interval '10 minutes'
    AND (mensagem_erro LIKE 'Em progresso%' OR mensagem_erro LIKE 'Sync iniciado%');

  IF v_running > 0 THEN
    RETURN;
  END IF;

  SELECT status, criado_em, coalesce(mensagem_erro, '')
    INTO v_status, v_criado, v_msg
  FROM public.lavoro_sync_log
  WHERE base = 'gerencial'
  ORDER BY criado_em DESC
  LIMIT 1;

  -- Última carga do gerencial deu certo e é recente: nada a fazer.
  IF v_status = 'sucesso' AND v_criado > now() - interval '6 hours' THEN
    RETURN;
  END IF;

  -- Marca cargas travadas como falha definitiva para liberar a trava de concorrência.
  UPDATE public.lavoro_sync_log
     SET status = 'erro',
         mensagem_erro = 'Interrompida (sem continuação) - reexecutada automaticamente'
   WHERE status = 'erro'
     AND criado_em < now() - interval '10 minutes'
     AND (mensagem_erro LIKE 'Em progresso%' OR mensagem_erro LIKE 'Sync iniciado%');

  PERFORM net.http_post(
    url := 'https://primmycdkkiziyhqkkkv.supabase.co/functions/v1/sync-lavoro-bases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaW1teWNka2tpeml5aHFra2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzQ0MDAsImV4cCI6MjA5OTExMDQwMH0._htjVkyhWr21gLcztb873HWu9O2BL0HELTLu1jGrPiQ'
    ),
    body := jsonb_build_object('trigger', 'auto_retry', 'base', 'all')
  );
END;
$function$;