import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NAVY = "#14405C";
const CYAN = "#00BAF2";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const DEZENAS = ["1-10", "11-20", "21-31"] as const;
type Dezena = (typeof DEZENAS)[number];

type PrevisaoRow = {
  ano: number;
  mes: number;
  dezena: string;
  empresa_faturada: string;
  valor_a_receber: number;
};

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export function RecebimentoDezenas() {
  // Mês atual + próximos 3 (janela de 4 meses)
  const janela = useMemo(() => {
    const now = nowBRT();
    return Array.from({ length: 4 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }, []);

  const results = useQueries({
    queries: janela.map(({ ano, mes }) => ({
      queryKey: ["lavoro-previsao-dezena", ano, mes],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("rpc_lavoro_apolices_previsao_dezena" as never, {
          p_ano: ano,
          p_mes: mes,
        } as never);
        if (error) throw error;
        return (data || []) as PrevisaoRow[];
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error as Error | undefined;

  // Agrega por (ano, mes) e dezena → total
  const linhas = useMemo(() => {
    return janela.map(({ ano, mes }, i) => {
      const rows = results[i].data || [];
      const porDezena: Record<Dezena, number> = { "1-10": 0, "11-20": 0, "21-31": 0 };
      for (const r of rows) {
        if (r.ano !== ano || r.mes !== mes) continue;
        const d = (r.dezena as Dezena) || null;
        if (d && d in porDezena) porDezena[d] += Number(r.valor_a_receber || 0);
      }
      const total = porDezena["1-10"] + porDezena["11-20"] + porDezena["21-31"];
      return { ano, mes, ...porDezena, total };
    });
  }, [results, janela]);

  const totaisColuna = useMemo(() => {
    const t: Record<Dezena | "total", number> = { "1-10": 0, "11-20": 0, "21-31": 0, total: 0 };
    for (const l of linhas) {
      t["1-10"] += l["1-10"];
      t["11-20"] += l["11-20"];
      t["21-31"] += l["21-31"];
      t.total += l.total;
    }
    return t;
  }, [linhas]);

  const janelaLabel = useMemo(() => {
    const ini = janela[0];
    const fim = janela[janela.length - 1];
    return ini.ano === fim.ano
      ? `${MESES[ini.mes - 1]} a ${MESES[fim.mes - 1]}/${fim.ano}`
      : `${MESES[ini.mes - 1]}/${ini.ano} a ${MESES[fim.mes - 1]}/${fim.ano}`;
  }, [janela]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold" style={{ color: NAVY }}>
            Recebimento por Dezenas
          </h3>
          <p className="text-xs text-gray-500">
            Previsão de comissão a receber — {janelaLabel} (mês atual + próximos 3)
          </p>
        </div>
        <span
          className="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: CYAN }}
        >
          Janela 4 meses
        </span>
      </div>

      <div className="p-4 md:p-5">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Não foi possível carregar a previsão: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  {DEZENAS.map((d) => (
                    <TableHead key={d} className="text-right">
                      Dezena {d}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total do mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={`${l.ano}-${l.mes}`}>
                    <TableCell className="font-medium" style={{ color: NAVY }}>
                      {MESES[l.mes - 1]}/{l.ano}
                    </TableCell>
                    {DEZENAS.map((d) => (
                      <TableCell key={d} className="text-right font-mono tabular-nums">
                        {BRL(l[d])}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono font-semibold tabular-nums"
                      style={{ color: NAVY }}
                    >
                      {BRL(l.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50">
                  <TableCell className="font-semibold" style={{ color: NAVY }}>
                    Total da janela
                  </TableCell>
                  {DEZENAS.map((d) => (
                    <TableCell
                      key={d}
                      className="text-right font-mono font-semibold tabular-nums"
                      style={{ color: NAVY }}
                    >
                      {BRL(totaisColuna[d])}
                    </TableCell>
                  ))}
                  <TableCell
                    className="text-right font-mono font-bold tabular-nums"
                    style={{ color: CYAN }}
                  >
                    {BRL(totaisColuna.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
