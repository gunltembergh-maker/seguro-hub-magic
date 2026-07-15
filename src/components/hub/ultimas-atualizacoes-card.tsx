import { Database, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimestampRow } from "@/hooks/use-inicio-data";

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function UltimasAtualizacoesCard({ timestamps, isLoading }: { timestamps: TimestampRow[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg bg-white/95 p-5 shadow-sm" style={{ border: "1px solid rgba(20,64,92,0.15)" }}>
      <h3 className="flex items-center gap-2 font-display text-base font-semibold text-[#14405C]">
        <Database className="h-4 w-4" /> Últimas atualizações das bases
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {isLoading && (
          <>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </>
        )}
        {!isLoading && timestamps.map((t) => (
          <div key={t.fonte} className="rounded-md border border-[#14405C]/10 bg-[#F8FAFC] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#4B6D88]">{t.fonte}</div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-[#0E2E43]">
                <Clock className="h-3.5 w-3.5 text-[#00BAF2]" />
                {fmt(t.ultima_atualizacao)} BRT
              </span>
              <span className="text-xs font-numeric text-[#4B6D88]">
                {Number(t.total_linhas).toLocaleString("pt-BR")} linhas
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
