
CREATE OR REPLACE FUNCTION public.rpc_admin_gerencial_reset()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'gerencial') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  RETURN gen_random_uuid();
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_admin_caixa_reset()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_importar(auth.uid(), 'caixa') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  RETURN gen_random_uuid();
END; $$;
