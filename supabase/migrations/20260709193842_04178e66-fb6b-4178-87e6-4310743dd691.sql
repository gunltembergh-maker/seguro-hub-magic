CREATE TABLE IF NOT EXISTS public.lavoro_sync_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_id UUID,
  origem TEXT NOT NULL CHECK (origem IN ('manual', 'automatico')),
  base TEXT NOT NULL CHECK (base IN ('gerencial', 'caixa')),
  status TEXT NOT NULL CHECK (status IN ('iniciado', 'sucesso', 'erro')),
  linhas_importadas INTEGER,
  mensagem_erro TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lavoro_sync_log TO authenticated;
GRANT ALL ON public.lavoro_sync_log TO service_role;

ALTER TABLE public.lavoro_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sync_log" ON public.lavoro_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sync_log" ON public.lavoro_sync_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sync_log" ON public.lavoro_sync_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);