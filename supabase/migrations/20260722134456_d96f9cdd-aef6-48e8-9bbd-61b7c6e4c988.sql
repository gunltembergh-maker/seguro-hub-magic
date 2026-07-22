
ALTER TABLE public.email_disparos_automaticos
  ADD COLUMN IF NOT EXISTS hora_slot text;

DROP INDEX IF EXISTS public.ux_email_disparos_auto_dia;

CREATE UNIQUE INDEX ux_email_disparos_auto_dia_slot
  ON public.email_disparos_automaticos (modulo, data_envio, hora_slot)
  WHERE forcado_por IS NULL;
