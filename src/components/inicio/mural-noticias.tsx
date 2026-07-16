import { useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { useMarketNews, type NewsCategoria, type NewsItem } from "@/hooks/use-market-news";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIAS: { key: NewsCategoria; label: string }[] = [
  { key: "mercado_seguros", label: "Mercado de Seguros" },
  { key: "atuarial", label: "Atuarial" },
  { key: "beneficios", label: "Benefícios" },
  { key: "saude", label: "Saúde" },
];

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

function ultimaAtualizacao(items: NewsItem[]): string {
  if (!items.length) return "—";
  const latest = items.reduce((acc, it) => {
    const t = it.criado_em ? new Date(it.criado_em).getTime() : 0;
    return t > acc ? t : acc;
  }, 0);
  if (!latest) return "—";
  return new Date(latest).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function MuralNoticias() {
  const { data, isLoading, isFetching, refetch } = useMarketNews();
  const [ativa, setAtiva] = useState<NewsCategoria>("mercado_seguros");

  const porCategoria = useMemo(() => {
    const map: Record<NewsCategoria, NewsItem[]> = {
      mercado_seguros: [],
      atuarial: [],
      beneficios: [],
      saude: [],
    };
    (data ?? []).forEach((n) => map[n.categoria]?.push(n));
    return map;
  }, [data]);

  const lista = (porCategoria[ativa] ?? []).slice(0, 10);
  const stamp = ultimaAtualizacao(data ?? []);

  return (
    <div className="rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur md:p-6" style={{ border: "1px solid rgba(20,64,92,0.15)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#14405C]">
          <Newspaper className="h-5 w-5 text-[#00BAF2]" />
          Mural de Notícias
        </h2>
        <div className="flex items-center gap-3 text-xs text-[#4B6D88]">
          <span>Atualizado às {stamp}</span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-[#14405C]/15 px-2 py-1 text-[#14405C] transition-colors hover:bg-[#14405C]/5"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIAS.map((c) => {
          const active = ativa === c.key;
          const count = (porCategoria[c.key] ?? []).length;
          return (
            <button
              key={c.key}
              onClick={() => setAtiva(c.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-transparent bg-[#14405C] text-white shadow-sm"
                  : "border-[#14405C]/15 bg-white text-[#14405C] hover:bg-[#14405C]/5",
              )}
            >
              {c.label}
              <span className={cn("ml-2 rounded-full px-1.5 text-[10px] font-numeric", active ? "bg-white/20 text-white" : "bg-[#14405C]/10 text-[#14405C]")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2">
        {isLoading && (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        )}

        {!isLoading && lista.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#14405C]/20 bg-[#F8FAFC] p-8 text-center text-sm text-[#4B6D88]">
            Nenhuma notícia disponível no momento para esta categoria.
          </div>
        )}

        {!isLoading &&
          lista.map((n) => (
            <a
              key={n.id}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-4 rounded-lg border border-[#14405C]/10 bg-white p-3.5 transition-all hover:border-[#00BAF2]/40 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#8AAFC9]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#14405C]">
                    {n.fonte}
                  </span>
                  <span className="text-[11px] font-numeric text-[#4B6D88]">{tempoRelativo(n.publicado_em)}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm font-medium text-[#0E2E43] group-hover:text-[#14405C]">
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
