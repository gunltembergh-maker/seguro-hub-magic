import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportarXlsx, type ColunaExport } from "@/lib/export-xlsx";

const NAVY = "#13405C";
const CYAN = "#338B85";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BRL2 = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLS_DEZENAS: ColunaExport[] = [
  { header: "Data Pagamento", key: "data_pagamento", formato: "data" },
  { header: "Empresa Faturada", key: "empresa_faturada", formato: "texto", width: 18 },
  { header: "Dezena", key: "dezena", formato: "texto", width: 10 },
  { header: "Valor Recebido / A Receber", key: "valor_recebido_a_receber", formato: "moeda", width: 22 },
  { header: "Tomador", key: "tomador", formato: "texto", width: 34 },
  { header: "Segurado", key: "segurado", formato: "texto", width: 34 },
  { header: "Documento", key: "documento", formato: "texto", width: 20 },
  { header: "Seguradora", key: "seguradora", formato: "texto", width: 22 },
  { header: "Ramo", key: "ramo", formato: "texto", width: 22 },
  { header: "Tipo de Ramo", key: "tipo_de_ramo", formato: "texto", width: 18 },
  { header: "Nº Apólice", key: "numero_apolice", formato: "texto", width: 26 },
  { header: "Data Emissão", key: "data_emissao", formato: "data" },
  { header: "Início Vigência", key: "inicio_vigencia", formato: "data" },
  { header: "Fim Vigência", key: "fim_vigencia", formato: "data" },
  { header: "Nº da Parcela", key: "numero_da_parcela", formato: "inteiro" },
  { header: "Qtd Parcelas", key: "qtd_parcelas", formato: "inteiro" },
  { header: "Status da Parcela de Comissão", key: "status_parcela_comissao", formato: "texto", width: 24 },
  { header: "Prêmio Total", key: "premio_total", formato: "moeda" },
  { header: "Prêmio Parcela", key: "premio_parcela", formato: "moeda" },
  { header: "% Comissão", key: "percentual_comissao", formato: "percentual" },
  { header: "Comissão Bruta", key: "comissao_bruta", formato: "moeda" },
  { header: "Imposto Ret", key: "imposto_ret", formato: "moeda" },
  { header: "Valor ISS", key: "valor_iss", formato: "moeda" },
  { header: "Possui Repasse", key: "possui_repasse", formato: "texto" },
  { header: "% Repasse", key: "percentual_repasse", formato: "percentual" },
  { header: "Valor Repasse Total", key: "valor_repasse_total", formato: "moeda", width: 18 },
  { header: "Status do Repasse", key: "status_repasse", formato: "texto" },
  { header: "Observação", key: "observacao", formato: "texto", width: 40 },
];

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

type Recorte = {
  chave: string;
  ini: string;
  fim: string;
  dezena: string | null;
  empresa: string | null;
  arquivo: string;
};

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

const fmtBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const primeiroDia = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`;

const ultimoDia = (ano: number, mes: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`;

const slugEmp = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function RecebimentoDezenas() {
  const queryClient = useQueryClient();
  const [exportando, setExportando] = useState<string | null>(null);

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

  const queryKey = useMemo(
    () => ["lavoro-recebimento-dezenas-empresas", ancora.ano, ancora.mes],
    [ancora.ano, ancora.mes],
  );

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

  const iniJanela = janela[0];
  const fimJanela = janela[janela.length - 1];
  const iniJanelaStr = primeiroDia(iniJanela.ano, iniJanela.mes);
  const fimJanelaStr = ultimoDia(fimJanela.ano, fimJanela.mes);
  const iniJanelaFile = `${iniJanela.ano}-${String(iniJanela.mes).padStart(2, "0")}`;
  const fimJanelaFile = `${fimJanela.ano}-${String(fimJanela.mes).padStart(2, "0")}`;

  const exportar = async (r: Recorte) => {
    if (exportando) return;
    setExportando(r.chave);
    const toastId = toast.loading("Gerando planilha…");
    try {
      const PAGINA = 500;
      let offset = 0;
      const todas: any[] = [];
      let truncado = false;
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase.rpc("rpc_lavoro_dezenas_detalhe" as never, {
          p_data_ini: r.ini,
          p_data_fim: r.fim,
          p_dezena: r.dezena,
          p_empresa: r.empresa,
          p_limit: PAGINA,
          p_offset: offset,
        } as never);
        if (error) throw error;
        const lote = (data || []) as any[];
        todas.push(...lote);
        if (lote.length < PAGINA) break;
        if (i === 39) truncado = true;
        offset += PAGINA;
      }

      if (todas.length === 0) {
        toast.error("Nada a exportar nesta célula", { id: toastId });
        return;
      }
      if (truncado) {
        toast.warning("Resultado truncado em 20.000 linhas.", { duration: 8000 });
      }

      const total = Math.round(
        todas.reduce((acc, x) => acc + (Number(x.valor_recebido_a_receber) || 0), 0) * 100,
      ) / 100;
      await exportarXlsx({
        arquivo: r.arquivo,
        cabecalho: {
          titulo: "Recebimento por Dezenas",
          subtitulo: "DETALHAMENTO DA CÉLULA · CONFERÊNCIA INTERNA",
          info: [
            { rotulo: "Período", valor: `${fmtBR(r.ini)} a ${fmtBR(r.fim)}` },
            { rotulo: "Dezena", valor: r.dezena ? `${r.dezena.replace("-", " a ")}` : "Todas" },
            { rotulo: "Empresa faturada", valor: r.empresa ?? "Todas" },
            { rotulo: "Valor total", valor: BRL2(total) },
            { rotulo: "Parcelas", valor: String(todas.length) },
          ],
        },
        abas: [
          {
            nome: "Detalhe",
            colunas: COLS_DEZENAS,
            linhas: todas,
            totalizar: ["valor_recebido_a_receber"],
            semLinhasDeGrade: true,
          },
        ],
      });
      toast.success(r.arquivo, { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar a planilha", { id: toastId });
    } finally {
      setExportando(null);
    }
  };

  const CellButton = ({
    value,
    recorte,
    className,
  }: {
    value: number;
    recorte: Recorte;
    className?: string;
  }) => {
    const isLoading = exportando === recorte.chave;
    const isDisabled = exportando !== null && !isLoading;
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => exportar(recorte)}
        className={[
          "block h-full w-full px-4 py-2 text-right font-mono tabular-nums transition-colors",
          "hover:bg-[#EAF7FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BAF2] focus-visible:ring-offset-1",
          value === 0 ? "text-gray-300" : "",
          isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          className || "",
        ].join(" ")}
      >
        {isLoading ? (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
        ) : (
          BRL(value)
        )}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold" style={{ color: NAVY }}>
            Recebimento por Dezenas
          </h3>
          <p className="text-xs text-gray-500">
            Previsão de comissão (a receber + pago) — {janelaLabel} • Empresas: L Farias, Taicons e ZIN
            {" • "}
            Clique em qualquer número para exportar o que o compõe
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
                  <TableHead rowSpan={2} className="align-bottom">
                    Mês
                  </TableHead>
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
                {janela.map(({ ano, mes }) => {
                  const mesStr = String(mes).padStart(2, "0");
                  return (
                    <TableRow key={`${ano}-${mes}`}>
                      <TableCell className="font-medium" style={{ color: NAVY }}>
                        {MESES[mes - 1]}/{ano}
                      </TableCell>
                      {DEZENAS.flatMap((d) =>
                        EMPRESAS.map((e, i) => {
                          const val = getVal(ano, mes, d, e);
                          return (
                            <TableCell
                              key={`${d}-${e}`}
                              className={`p-0 text-right font-mono tabular-nums ${i === 0 ? "border-l border-gray-200" : ""}`}
                            >
                              <CellButton
                                value={val}
                                exportando={exportando}
                                onExport={exportar}
                                recorte={{
                                  chave: `c-${ano}-${mes}-${d}-${e}`,
                                  ini: primeiroDia(ano, mes),
                                  fim: ultimoDia(ano, mes),
                                  dezena: d,
                                  empresa: e,
                                  arquivo: `Recebimento_${ano}-${mesStr}_${d}_${slugEmp(e)}.xlsx`,
                                }}
                              />
                            </TableCell>
                          );
                        }),
                      )}
                      <TableCell
                        className="border-l border-gray-200 p-0 text-right font-mono font-semibold tabular-nums"
                        style={{ color: NAVY }}
                      >
                        <CellButton
                          value={totalMes(ano, mes)}
                          exportando={exportando}
                          onExport={exportar}
                          recorte={{
                            chave: `m-${ano}-${mes}`,
                            ini: primeiroDia(ano, mes),
                            fim: ultimoDia(ano, mes),
                            dezena: null,
                            empresa: null,
                            arquivo: `Recebimento_${ano}-${mesStr}_mes_completo.xlsx`,
                          }}
                          className="font-semibold"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-gray-50">
                  <TableCell className="font-semibold" style={{ color: NAVY }}>
                    Total da janela
                  </TableCell>
                  {DEZENAS.flatMap((d) =>
                    EMPRESAS.map((e, i) => {
                      const val = totalJanelaEmpresaDezena(e, d);
                      return (
                        <TableCell
                          key={`${d}-${e}`}
                          className={`p-0 text-right font-mono font-semibold tabular-nums ${i === 0 ? "border-l border-gray-200" : ""}`}
                          style={{ color: NAVY }}
                        >
                          <CellButton
                            value={val}
                            exportando={exportando}
                            onExport={exportar}
                            recorte={{
                              chave: `j-${d}-${e}`,
                              ini: iniJanelaStr,
                              fim: fimJanelaStr,
                              dezena: d,
                              empresa: e,
                              arquivo: `Recebimento_${iniJanelaFile}_a_${fimJanelaFile}_${d}_${slugEmp(e)}.xlsx`,
                            }}
                            className="font-semibold"
                          />
                        </TableCell>
                      );
                    }),
                  )}
                  <TableCell
                    className="border-l border-gray-200 p-0 text-right font-mono font-bold tabular-nums"
                    style={{ color: CYAN }}
                  >
                    <CellButton
                      value={totalJanela}
                      exportando={exportando}
                      onExport={exportar}
                      recorte={{
                        chave: "jt",
                        ini: iniJanelaStr,
                        fim: fimJanelaStr,
                        dezena: null,
                        empresa: null,
                        arquivo: `Recebimento_${iniJanelaFile}_a_${fimJanelaFile}_completo.xlsx`,
                      }}
                      className="font-bold"
                    />
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
