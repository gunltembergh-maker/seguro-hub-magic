import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const L = {
  navy: "#14405C",
  navyDark: "#0E2E43",
  blue: "#00BAF2",
  amber: "#D97706",
  green: "#059669",
  red: "#DC2626",
  bgCard: "#FFFFFF",
  border: "rgba(20,64,92,0.15)",
  textMuted: "#4B6D88",
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (v: number | null | undefined) => {
  if (v == null || !isFinite(Number(v))) return "—";
  return `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
};

interface KpiRow {
  receita_competencia: number;
  receita_caixa: number;
  meta_periodo: number;
  atingimento: number;
  defasagem: number;
  previsto_caixa: number;
  atingimento_caixa: number;
}

function useKpis(ano: number, mes: number, periodo: "MTD" | "YTD") {
  return useQuery({
    queryKey: ["hub-lavoro-kpis", ano, mes, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_lavoro_receita_kpis" as never, {
        p_ano: ano, p_mes: mes, p_periodo: periodo,
      } as never);
      if (error) throw error;
      return ((data as KpiRow[] | null)?.[0] ?? null) as KpiRow | null;
    },
    staleTime: 60_000,
  });
}

export function BlocoLavoroKpis({ canSee }: { canSee: boolean }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const mesLabel = `${MESES[mes - 1]}/${ano}`;

  const ytdQ = useKpis(ano, mes, "YTD");
  const mtdQ = useKpis(ano, mes, "MTD");

  if (!canSee) return null;

  const ytd = ytdQ.data;
  const mtd = mtdQ.data;
  const loadingY = ytdQ.isLoading;
  const loadingM = mtdQ.isLoading;

  const atingimento = Number(mtd?.atingimento ?? 0);
  const abaixo = atingimento < 1;
  const defasagem = Number(mtd?.defasagem ?? 0);

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
          Receita Lavoro Seguros
        </h2>
        <Link
          to="/dashboard/receita"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
          style={{ color: L.blue }}
        >
          Ver Dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="p-5 space-y-5">
        {/* YTD */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: L.textMuted }}>
            Acumulado YTD {ano}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Kpi
              label={`A RECEBER EM YTD ${ano}`}
              hint="Previsto Caixa (parcelas emitidas por data de pagamento)"
              value={loadingY ? null : BRL(ytd?.previsto_caixa)}
              accent={L.amber}
              hintColor={L.amber}
            />
            <Kpi
              label={`RECEITA CAIXA EM YTD ${ano}`}
              hint="Receita Caixa (efetivamente recebido)"
              value={loadingY ? null : BRL(ytd?.receita_caixa)}
              accent={L.green}
              hintColor={L.green}
            />
          </div>
        </div>

        {/* Mês corrente */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: L.textMuted }}>
            No mês de {mesLabel}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Kpi
              label={`A RECEBER EM ${mesLabel.toUpperCase()}`}
              hint="Previsto Caixa (parcelas emitidas por data de pagamento)"
              value={loadingM ? null : BRL(mtd?.previsto_caixa)}
              accent={L.amber}
              hintColor={L.amber}
            />
            <Kpi
              label={`RECEITA CAIXA EM ${mesLabel.toUpperCase()}`}
              hint="Receita Caixa (efetivamente recebido)"
              value={loadingM ? null : BRL(mtd?.receita_caixa)}
              accent={L.green}
              hintColor={L.green}
            />
          </div>
        </div>

        {/* Competência */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: L.textMuted }}>
            Competência ({mesLabel})
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Compact label={`RECEITA COMPETÊNCIA (${mesLabel.toUpperCase()})`} value={loadingM ? null : BRL(mtd?.receita_competencia)} />
            <Compact label={`META (${mesLabel.toUpperCase()})`} value={loadingM ? null : BRL(mtd?.meta_periodo)} />
            <Compact
              label="ATINGIMENTO (COMPETÊNCIA)"
              value={loadingM ? null : fmtPct(mtd?.atingimento)}
              badge={
                loadingM ? null : (
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{
                      background: abaixo ? "#FEE2E2" : "#DCFCE7",
                      color: abaixo ? L.red : L.green,
                    }}
                  >
                    {abaixo ? "Abaixo" : "Acima"}
                  </span>
                )
              }
            />
            <Compact
              label="DEFASAGEM (COMP - CAIXA)"
              value={loadingM ? null : BRL(defasagem)}
              valueColor={defasagem < 0 ? L.red : L.green}
              icon={loadingM ? null : defasagem < 0 ? <TrendingDown className="h-3.5 w-3.5" style={{ color: L.red }} /> : <TrendingUp className="h-3.5 w-3.5" style={{ color: L.green }} />}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  label, hint, value, accent, hintColor,
}: {
  label: string; hint: string; value: string | null; accent: string; hintColor: string;
}) {
  return (
    <div className="rounded-md p-4" style={{ background: "#F8FAFC", borderLeft: `4px solid ${accent}` }}>
      <p style={{ color: L.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: hintColor }}>{hint}</p>
      {value == null ? (
        <Skeleton className="h-8 w-40 mt-2" />
      ) : (
        <p className="font-display font-numeric mt-1" style={{ fontSize: 26, fontWeight: 600, color: L.navyDark, letterSpacing: "-0.3px" }}>
          {value}
        </p>
      )}
    </div>
  );
}

function Compact({
  label, value, badge, valueColor, icon,
}: {
  label: string; value: string | null; badge?: React.ReactNode; valueColor?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md p-3" style={{ background: "#F8FAFC", border: `1px solid ${L.border}` }}>
      <div className="flex items-start justify-between gap-1">
        <p style={{ color: L.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, lineHeight: 1.3 }}>
          {label}
        </p>
        {badge}
      </div>
      {value == null ? (
        <Skeleton className="h-6 w-24 mt-2" />
      ) : (
        <div className="flex items-center gap-1.5 mt-1">
          {icon}
          <p className="font-display font-numeric" style={{ fontSize: 18, fontWeight: 600, color: valueColor || L.navyDark, letterSpacing: "-0.2px" }}>
            {value}
          </p>
        </div>
      )}
    </div>
  );
}
