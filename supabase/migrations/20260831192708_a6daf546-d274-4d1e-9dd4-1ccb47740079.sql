ALTER TABLE public.contratos DROP CONSTRAINT contratos_responsavel_id_fkey;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_responsavel_id_fkey
  FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;