import { useMemo } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { useMarketNews, type NewsCategoria, type NewsItem } from "@/hooks/use-market-news";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIA_LABEL: Record<NewsCategoria, string> = {
  mercado_seguros: "Mercado",
  atuarial: "SUSEP",
  beneficios: "Benefícios",
  saude: "Saúde",
};

function tempoRelativo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Mixes the news list: round-robin across categorias to guarantee variety,
 * ordered by publicado_em within each categoria. Returns up to `max` items.
 */
function misturar(items: NewsItem[], max: number): NewsItem[] {
  const buckets: Record<NewsCategoria, NewsItem[]> = {
    mercado_seguros: [],
    atuarial: [],
    beneficios: [],
    saude: [],
  };
  items.forEach((n) => buckets[n.categoria]?.push(n));
  (Object.keys(buckets) as NewsCategoria[]).forEach((k) =>
    buckets[k].sort((a, b) => {
      const ta = a.publicado_em ? new Date(a.publicado_em).getTime() : 0;
      const tb = b.publicado_em ? new Date(b.publicado_em).getTime() : 0;
      return tb - ta;
    }),
  );

  const ordem: NewsCategoria[] = ["mercado_seguros", "saude", "beneficios", "atuarial"];
  const out: NewsItem[] = [];
  let i = 0;
  while (out.length < max) {
    let addedThisRound = false;
    for (const cat of ordem) {
      const it = buckets[cat][i];
      if (it) {
        out.push(it);
        addedThisRound = true;
        if (out.length >= max) break;
      }
    }
    if (!addedThisRound) break;
    i++;
  }
  return out;
}

export function MuralNoticias() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useMarketNews();

  const lista = useMemo(() => misturar(data ?? [], 8), [data]);

  const stamp = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "—";

  return (
    <div
      className="rounded-lg bg-white p-5 shadow-sm"
      style={{ border: "1px solid rgba(20,64,92,0.15)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-[#14405C]">
          <Newspaper className="h-4 w-4 text-[#00BAF2]" />
          Mural de Notícias
        </h3>
        <div className="flex items-center gap-3 text-xs text-[#4B6D88]">
          <span>Atualizado às {stamp}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-[#14405C]/15 px-2 py-1 text-[#14405C] transition-colors hover:bg-[#14405C]/5 disabled:opacity-50"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-[#4B6D88]">
        Mercado de Seguros, Garantia, Saúde e SUSEP · atualiza a cada 1 hora
      </p>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </>
        )}

        {!isLoading && lista.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#14405C]/20 bg-[#F8FAFC] p-6 text-center text-sm text-[#4B6D88]">
            Nenhuma notícia disponível no momento.
          </div>
        )}

        {!isLoading &&
          lista.map((n) => (
            <a
              key={n.id}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-4 rounded-md border border-[#14405C]/10 bg-[#F8FAFC] p-3 transition-all hover:border-[#00BAF2]/40 hover:bg-white hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#14405C]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#14405C]">
                    {CATEGORIA_LABEL[n.categoria]}
                  </span>
                  <span className="text-[11px] font-medium text-[#4B6D88]">{n.fonte}</span>
                  <span className="text-[11px] font-numeric text-[#8AAFC9]">
                    · {tempoRelativo(n.publicado_em)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-[#0E2E43] group-hover:text-[#14405C]">
                  {n.titulo}
                </p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[#8AAFC9] transition-colors group-hover:text-[#00BAF2]" />
            </a>
          ))}
      </div>
    </div>
  );
}
