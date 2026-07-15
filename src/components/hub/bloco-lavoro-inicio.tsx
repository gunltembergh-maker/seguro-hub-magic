import { AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import type { LavoroResumo } from "@/hooks/use-inicio-data";

const L = {
  navy: "#14405C",
  navyDark: "#0E2E43",
  blue: "#00BAF2",
  bgCard: "#FFFFFF",
  border: "rgba(20,64,92,0.15)",
  textMuted: "#4B6D88",
  amber: "#D97706",
  amberBg: "#FEF3C7",
};

const fmtBRL = (n: number | null | undefined): string => {
  if (n == null || !isFinite(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} Mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const fmtPct = (n: number | null | undefined) =>
  n == null || !isFinite(Number(n)) ? "—" : `${(Number(n) * 100).toFixed(0)}%`;

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

interface Props {
  resumo: LavoroResumo | null;
  isLoading: boolean;
  canSee: boolean;
}

export function BlocoLavoroInicio({ resumo, isLoading, canSee }: Props) {
  if (!canSee) return null;

  const atingimento = Number(resumo?.atingimento_caixa_mes ?? 0);
  const pctBarra = Math.max(0, Math.min(1, atingimento));
  const barraColor = atingimento >= 0.7 ? L.blue : atingimento >= 0.5 ? "#F59E0B" : "#DC2626";
  const vencido = Number(resumo?.total_vencido_mes ?? 0);

  return (
    <section className="rounded-lg overflow-hidden" style={{ background: L.bgCard, border: `1px solid ${L.border}` }}>
      <header className="flex items-center gap-2.5 px-5 py-3" style={{ background: L.navy, color: "#FFFFFF" }}>
        <span
          className="inline-flex items-center justify-center rounded"
          style={{ background: L.blue, color: L.navyDark, width: 24, height: 24, fontSize: 12, fontWeight: 700 }}
        >
          L
        </span>
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.2px" }}>
          Lavoro Seguros
        </h2>
        <span
          className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,186,242,0.18)", color: L.blue, fontWeight: 600 }}
        >
          Este mês
        </span>
      </header>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniCard label="Receita Competência" value={isLoading ? null : fmtBRL(resumo?.receita_competencia_mes)} accent={L.navy} />
          <MiniCard label="Caixa Previsto" value={isLoading ? null : fmtBRL(resumo?.receita_caixa_mes)} accent={L.blue} />
          <MiniCard label="Caixa Recebido" value={isLoading ? null : fmtBRL(resumo?.receita_caixa_recebida_mes)} accent="#059669" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 12, color: L.textMuted, fontWeight: 600 }}>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Atingimento de Caixa
            </span>
            <span className="font-numeric" style={{ color: L.navyDark, fontWeight: 700 }}>
              {isLoading ? "—" : fmtPct(resumo?.atingimento_caixa_mes)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(20,64,92,0.08)" }}>
            <div className="h-full transition-all" style={{ width: `${pctBarra * 100}%`, background: barraColor }} />
          </div>
        </div>

        {!isLoading && vencido > 0 && (
          <div className="flex items-start gap-2.5 rounded-md px-3 py-2.5" style={{ background: L.amberBg, border: `1px solid ${L.amber}33` }}>
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: L.amber }} />
            <div className="text-[13px]" style={{ color: "#7C2D12", lineHeight: 1.4 }}>
              <strong>Comissões vencidas no mês: {fmtBRL(vencido)}.</strong>{" "}
              <span style={{ opacity: 0.8 }}>Revise no Dashboard Receita Executivo.</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px]" style={{ color: L.textMuted }}>
            Atualizado em: {isLoading ? "—" : fmtDateTime(resumo?.ultima_atualizacao)}
          </p>
          <Link
            to="/dashboard/receita-executivo"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: L.navy }}
          >
            Ver Dashboard Executivo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MiniCard({ label, value, accent }: { label: string; value: string | null; accent: string }) {
  return (
    <div className="rounded-md p-3.5" style={{ background: "#F8FAFC", borderLeft: `3px solid ${accent}` }}>
      <p style={{ color: L.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
      {value == null ? (
        <Skeleton className="h-7 w-28 mt-1.5" />
      ) : (
        <p className="font-display font-numeric mt-1" style={{ fontSize: 22, fontWeight: 500, color: L.navyDark, letterSpacing: "-0.3px" }}>
          {value}
        </p>
      )}
    </div>
  );
}
