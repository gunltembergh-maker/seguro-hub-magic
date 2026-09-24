ALTER TABLE public.hub_clientes ADD COLUMN IF NOT EXISTS canal_id uuid REFERENCES public.canais(id);

ALTER TABLE public.hub_clientes DISABLE TRIGGER hub_clientes_protege_responsavel;
ALTER TABLE public.hub_clientes DISABLE TRIGGER hub_clientes_touch;

UPDATE public.hub_clientes c SET canal_id = e.canal_id
FROM (SELECT DISTINCT ON (cliente_id) cliente_id, canal_id FROM public.hub_entradas
      WHERE canal_id IS NOT NULL ORDER BY cliente_id, chegada_em DESC, registrado_em DESC) e
WHERE c.canal_id IS NULL AND e.cliente_id = c.id;

UPDATE public.hub_clientes c SET responsavel_id = d.responsavel_cliente_id
FROM (SELECT DISTINCT ON (cliente_id) cliente_id, responsavel_cliente_id FROM public.garantia_demandas
      WHERE responsavel_cliente_id IS NOT NULL ORDER BY cliente_id, cadastrado_em DESC) d
WHERE c.responsavel_id IS NULL AND d.cliente_id = c.id;

ALTER TABLE public.hub_clientes ENABLE TRIGGER hub_clientes_protege_responsavel;
ALTER TABLE public.hub_clientes ENABLE TRIGGER hub_clientes_touch;

CREATE OR REPLACE FUNCTION public.hub_clientes_trava_canal_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if public.has_role(auth.uid(), 'ADMIN') then return new; end if;
  if (old.canal_id is not null and new.canal_id is distinct from old.canal_id)
     or (old.responsavel_id is not null and new.responsavel_id is distinct from old.responsavel_id) then
    raise exception 'Canal e responsável do cliente só podem ser alterados por um administrador.';
  end if;
  return new;
end; $$;
REVOKE ALL ON FUNCTION public.hub_clientes_trava_canal_responsavel() FROM public, anon;

DROP TRIGGER IF EXISTS hub_clientes_trava_canal_responsavel ON public.hub_clientes;
CREATE TRIGGER hub_clientes_trava_canal_responsavel BEFORE UPDATE ON public.hub_clientes
FOR EACH ROW EXECUTE FUNCTION public.hub_clientes_trava_canal_responsavel();

CREATE OR REPLACE FUNCTION public.garantia_demandas_trava_canal_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if public.has_role(auth.uid(), 'ADMIN') then return new; end if;
  if (old.canal_id is not null and new.canal_id is distinct from old.canal_id)
     or (old.responsavel_cliente_id is not null and new.responsavel_cliente_id is distinct from old.responsavel_cliente_id) then
    raise exception 'Canal e responsável do cliente só podem ser alterados por um administrador.';
  end if;
  return new;
end; $$;
REVOKE ALL ON FUNCTION public.garantia_demandas_trava_canal_responsavel() FROM public, anon;

DROP TRIGGER IF EXISTS garantia_demandas_trava_canal_responsavel ON public.garantia_demandas;
CREATE TRIGGER garantia_demandas_trava_canal_responsavel BEFORE UPDATE ON public.garantia_demandas
FOR EACH ROW EXECUTE FUNCTION public.garantia_demandas_trava_canal_responsavel();