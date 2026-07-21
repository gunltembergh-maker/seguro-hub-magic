import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const EMPRESAS = ["L Farias", "Taicons", "ZIN"] as const;
type Empresa = (typeof EMPRESAS)[number];

type RpcRow = {
  ano: number;
  mes: number;
  dezena: Dezena;
  empresa: Empresa;
  valor: number;
};

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export function RecebimentoDezenas() {
  const queryClient = useQueryClient();

  // Mês âncora = mês atual (Brasília)
  const ancora = useMemo(() => {
    const d = nowBRT();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }, []);

  const janela = useMemo(() => {
    const base = new Date(ancora.ano, ancora.mes - 1, 1);
    return Array.from({ length: 4 }).map((_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }, [ancora]);

  const queryKey = ["lavoro-recebimento-dezenas-empresas", ancora.ano, ancora.mes];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_recebimento_dezenas_empresas" as never,
        { p_ano: ancora.ano, p_mes: ancora.mes } as never,
      );
      if (error) throw error;
      return (data || []) as RpcRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime: sempre que uma nova sincronização terminar com sucesso, revalida
  useEffect(() => {
    const channel = supabase
      .channel("lavoro-sync-log-recebimento-dezenas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lavoro_sync_log" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { status?: string } | null;
          if (!row || row.status === "sucesso") {
            queryClient.invalidateQueries({ queryKey });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey]);

  // Índice para lookup rápido
  const idx = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data || []) {
      map.set(`${r.ano}-${r.mes}-${r.dezena}-${r.empresa}`, Number(r.valor || 0));
    }
    return map;
  }, [data]);

  const getVal = (ano: number, mes: number, dezena: Dezena, empresa: Empresa) =>
    idx.get(`${ano}-${mes}-${dezena}-${empresa}`) ?? 0;

  const totalMes = (ano: number, mes: number) =>
    DEZENAS.reduce(
      (acc, d) => acc + EMPRESAS.reduce((a, e) => a + getVal(ano, mes, d, e), 0),
      0,
    );

  const totalJanelaEmpresaDezena = (empresa: Empresa, dezena: Dezena) =>
    janela.reduce((acc, { ano, mes }) => acc + getVal(ano, mes, dezena, empresa), 0);

  const totalJanela = janela.reduce((acc, { ano, mes }) => acc + totalMes(ano, mes), 0);

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
            Previsão de comissão (a receber + pago) — {janelaLabel} • Empresas: L Farias, Taicons e ZIN
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
            Não foi possível carregar a previsão: {(error as Error).message}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="align-bottom">Mês</TableHead>
                  {DEZENAS.map((d) => (
                    <TableHead
                      key={d}
                      colSpan={EMPRESAS.length}
                      className="border-l border-gray-200 text-center"
                      style={{ color: NAVY }}
                    >
                      Dezena {d}
                    </TableHead>
                  ))}
                  <TableHead rowSpan={2} className="border-l border-gray-200 text-right align-bottom">
                    Total do mês
                  </TableHead>
                </TableRow>
                <TableRow>
                  {DEZENAS.flatMap((d) =>
                    EMPRESAS.map((e, i) => (
                      <TableHead
                        key={`${d}-${e}`}
                        className={`text-right text-[11px] font-medium text-gray-500 ${i === 0 ? "border-l border-gray-200" : ""}`}
                      >
                        {e}
                      </TableHead>
                    )),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {janela.map(({ ano, mes }) => (
                  <TableRow key={`${ano}-${mes}`}>
                    <TableCell className="font-medium" style={{ color: NAVY }}>
                      {MESES[mes - 1]}/{ano}
                    </TableCell>
                    {DEZENAS.flatMap((d) =>
                      EMPRESAS.map((e, i) => (
                        <TableCell
                          key={`${d}-${e}`}
                          className={`text-right font-mono tabular-nums ${i === 0 ? "border-l border-gray-200" : ""}`}
                        >
                          {BRL(getVal(ano, mes, d, e))}
                        </TableCell>
                      )),
                    )}
                    <TableCell
                      className="border-l border-gray-200 text-right font-mono font-semibold tabular-nums"
                      style={{ color: NAVY }}
                    >
                      {BRL(totalMes(ano, mes))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50">
                  <TableCell className="font-semibold" style={{ color: NAVY }}>
                    Total da janela
                  </TableCell>
                  {DEZENAS.flatMap((d) =>
                    EMPRESAS.map((e, i) => (
                      <TableCell
                        key={`${d}-${e}`}
                        className={`text-right font-mono font-semibold tabular-nums ${i === 0 ? "border-l border-gray-200" : ""}`}
                        style={{ color: NAVY }}
                      >
                        {BRL(totalJanelaEmpresaDezena(e, d))}
                      </TableCell>
                    )),
                  )}
                  <TableCell
                    className="border-l border-gray-200 text-right font-mono font-bold tabular-nums"
                    style={{ color: CYAN }}
                  >
                    {BRL(totalJanela)}
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
