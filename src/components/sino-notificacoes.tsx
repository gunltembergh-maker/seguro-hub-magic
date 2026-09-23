// Sino de pendências no topo do Hub. A lista vem pronta e filtrada por
// permissão do banco (rpc_minhas_notificacoes); a tela só exibe.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const CHAVE_NOTIFICACOES = ["minhas-notificacoes"] as const;

type Notificacao = {
  chave: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  urgencia: "alta" | "media" | string;
  desde: string | null;
  vista: boolean;
};

// Ações que resolvem pendências invalidam estas listas; o sino acompanha.
const CHAVES_QUE_RESOLVEM = new Set([
  "canal-repasse-demandas",
  "canal-parceiro-situacao",
  "canal-parceiro-documentos",
  "canal-parceiro-liberacoes",
  "canal-parceiro-contratos",
  "canal-parceiro-verificacao",
  "canal-parceiro-alteracoes",
  "juridico-contratos",
]);

function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function SinoNotificacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  const { data } = useQuery({
    queryKey: CHAVE_NOTIFICACOES,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_minhas_notificacoes" as never);
      if (error) throw error;
      return (data || []) as Notificacao[];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    return qc.getQueryCache().subscribe((ev) => {
      if (ev.type !== "updated" || ev.action.type !== "invalidate") return;
      const k = ev.query.queryKey[0];
      if (typeof k === "string" && CHAVES_QUE_RESOLVEM.has(k)) {
        void qc.invalidateQueries({ queryKey: CHAVE_NOTIFICACOES });
      }
    });
  }, [qc]);

  const itens = data ?? [];
  const naoVistos = itens.filter((i) => !i.vista);
  const temAlta = naoVistos.some((i) => i.urgencia === "alta");

  const grupos = useMemo(() => {
    const m = new Map<string, Notificacao[]>();
    for (const i of itens) {
      if (!m.has(i.categoria)) m.set(i.categoria, []);
      m.get(i.categoria)!.push(i);
    }
    return [...m.entries()];
  }, [itens]);

  async function abrir(o: boolean) {
    setAberto(o);
    if (!o || naoVistos.length === 0) return;
    const { error } = await supabase.rpc("rpc_notificacoes_marcar_vistas" as never, {
      p_chaves: naoVistos.map((i) => i.chave),
    } as never);
    if (!error) void qc.invalidateQueries({ queryKey: CHAVE_NOTIFICACOES });
  }

  return (
    <Popover open={aberto} onOpenChange={(o) => void abrir(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pendências"
          className="relative rounded-full p-2 text-primary-foreground transition-colors hover:bg-white/10"
        >
          <Bell className="h-5 w-5" />
          {naoVistos.length > 0 ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                temAlta
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-white text-primary",
              )}
            >
              {naoVistos.length > 9 ? "9+" : naoVistos.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] p-0 sm:w-[380px]">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Pendências</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              Nada pendente por aqui.
            </div>
          ) : (
            grupos.map(([cat, lista]) => (
              <div key={cat} className="py-1">
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </p>
                {lista.map((i) => (
                  <button
                    key={i.chave}
                    type="button"
                    className="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-muted/60"
                    onClick={() => {
                      setAberto(false);
                      if (i.link) void navigate({ to: i.link as never });
                    }}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        i.urgencia === "alta" ? "bg-destructive" : "bg-transparent",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm text-foreground",
                          !i.vista && "font-semibold",
                        )}
                      >
                        {i.titulo}
                      </span>
                      {i.descricao ? (
                        <span className="block text-xs text-muted-foreground">{i.descricao}</span>
                      ) : null}
                      <span className="block text-[11px] text-muted-foreground">
                        {tempoRelativo(i.desde)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2 text-center text-[11px] text-muted-foreground">
          Atualiza a cada minuto
        </div>
      </PopoverContent>
    </Popover>
  );
}
