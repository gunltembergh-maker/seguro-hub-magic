import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Ban,
  Users,
  Download,
  Loader2,
  Info,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { exportarXlsx, type ColunaExport } from "@/lib/export-xlsx";
import { dataBR, hhmm, isoDeData, mensagemErro } from "@/lib/rp/rp-tipos";
import { processarAusencias } from "@/lib/rp/rp-ausencias.functions";
import { CancelarComMotivoDialog } from "@/components/reserva-posicoes/CancelarComMotivoDialog";
import { cancelarReservaComMotivo } from "@/lib/rp/rp-cancelar";


export const Route = createFileRoute("/_authenticated/rh/controle-posicoes")({
  head: () => ({
    meta: [
      { title: "Controle de Posições | RH | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Acompanhamento de reservas, comparecimentos e ausências das posições do escritório de SP.",
      },
      { property: "og:title", content: "Controle de Posições | RH | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Reservas, comparecimentos e ranking de uso das posições do escritório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlePosicoesPage,
});

interface ReservaControle {
  reserva_id: string;
  data: string;
  data_iso: string;
  posicao_numero: number;
  colaborador: string | null;
  user_id: string | null;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  compareceu: boolean;
  checkin_em: string | null;
  reservado_em: string | null;
  motivo_cancelamento?: string | null;
}


interface RankingControle {
  colaborador: string | null;
  user_id: string | null;
  reservas: number;
  comparecimentos: number;
  ausencias: number;
  cancelamentos: number;
  taxa_comparecimento: number;
}

const STATUS_LABEL: Record<string, string> = {
  reservada: "Reservada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  expirada: "Ausência",
};

const STATUS_OPCOES = ["reservada", "confirmada", "cancelada", "expirada"];

function primeiroDiaMes() {
  const d = new Date();
  return isoDeData(new Date(d.getFullYear(), d.getMonth(), 1));
}
function ultimoDiaMes() {
  const d = new Date();
  return isoDeData(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function dataHoraBR(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Cartao({
  titulo,
  valor,
  icone: Icone,
  cor,
}: {
  titulo: string;
  valor: number | string;
  icone: typeof Users;
  cor: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-white/60">{titulo}</span>
        <Icone className="h-4 w-4" style={{ color: cor }} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-white">{valor}</p>
    </div>
  );
}

function ControlePosicoesPage() {
  const [de, setDe] = useState(primeiroDiaMes);
  const [ate, setAte] = useState(ultimoDiaMes);
  const [userId, setUserId] = useState<string>("todos");
  const [posicao, setPosicao] = useState<string>("todas");
  const [status, setStatus] = useState<string>("todos");
  const [exportando, setExportando] = useState(false);
  const qc = useQueryClient();
  const [alvo, setAlvo] = useState<ReservaControle | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const cancelarReserva = async (motivo: string) => {
    if (!alvo) return;
    setCancelandoId(alvo.reserva_id);
    try {
      await cancelarReservaComMotivo(alvo.reserva_id, motivo);
      await qc.invalidateQueries({ queryKey: ["rh-controle-reservas"] });
      await qc.invalidateQueries({ queryKey: ["rh-controle-ranking"] });
      setAlvo(null);
      toast.success("Reserva cancelada.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCancelandoId(null);
    }
  };


  // Processa e notifica ausências pendentes ao abrir a tela (idempotente no servidor).
  useEffect(() => {
    processarAusencias().catch(() => undefined);
  }, []);

  const { data: usuarios } = useQuery({
    queryKey: ["rh-usuarios-hub"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_buscar_usuarios_hub", { p_busca: "" });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const filtros = {
    p_de: de,
    p_ate: ate,
    p_user_id: userId === "todos" ? undefined : userId,
    p_posicao_numero: posicao === "todas" ? undefined : Number(posicao),
    p_status: status === "todos" ? undefined : status,
  };

  const {
    data: reservas,
    isLoading: carregandoReservas,
    error: erroReservas,
  } = useQuery({
    queryKey: ["rh-controle-reservas", de, ate, userId, posicao, status],
    queryFn: async (): Promise<ReservaControle[]> => {
      const { data, error } = await supabase.rpc("rpc_rp_controle_reservas", filtros as never);
      if (error) throw error;
      return (data ?? []) as unknown as ReservaControle[];
    },
  });

  const { data: ranking, isLoading: carregandoRanking } = useQuery({
    queryKey: ["rh-controle-ranking", de, ate],
    queryFn: async (): Promise<RankingControle[]> => {
      const { data, error } = await supabase.rpc("rpc_rp_controle_ranking", { p_de: de, p_ate: ate });
      if (error) throw error;
      return (data ?? []) as unknown as RankingControle[];
    },
  });

  const linhas = useMemo(() => reservas ?? [], [reservas]);
  const rank = useMemo(
    () => [...(ranking ?? [])].sort((a, b) => b.comparecimentos - a.comparecimentos),
    [ranking],
  );

  const hojeIso = isoDeData(new Date());
  const resumo = useMemo(() => {
    const total = linhas.length;
    const comparecimentos = linhas.filter((r) => r.compareceu).length;
    const ausencias = linhas.filter((r) => r.status === "expirada").length;
    const cancelamentos = linhas.filter((r) => r.status === "cancelada").length;
    const hoje = new Set(
      linhas
        .filter((r) => r.data_iso === hojeIso && r.status !== "cancelada")
        .map((r) => r.posicao_numero),
    ).size;
    return { total, comparecimentos, ausencias, cancelamentos, hoje };
  }, [linhas, hojeIso]);

  const semPermissao = reservas === null || (!!erroReservas && String(erroReservas));

  const exportar = async () => {
    if (linhas.length === 0 && rank.length === 0) {
      toast.warning("Nada a exportar para o período e filtros selecionados.");
      return;
    }
    setExportando(true);
    const toastId = toast.loading("Gerando a planilha…");
    try {
      const colsReservas: ColunaExport[] = [
        { header: "Data", key: "data_iso", formato: "data" },
        { header: "Posição", key: "posicao_numero", formato: "inteiro" },
        { header: "Colaborador", key: "colaborador", formato: "texto", width: 32 },
        { header: "Hora Início", key: "hora_inicio", formato: "texto" },
        { header: "Hora Fim", key: "hora_fim", formato: "texto" },
        { header: "Status", key: "status_label", formato: "texto" },
        { header: "Compareceu", key: "compareceu_label", formato: "texto" },
        { header: "Reservado em", key: "reservado_em_br", formato: "texto", width: 20 },
        { header: "Check-in em", key: "checkin_em_br", formato: "texto", width: 20 },
      ];
      const colsRanking: ColunaExport[] = [
        { header: "Colaborador", key: "colaborador", formato: "texto", width: 32 },
        { header: "Reservas", key: "reservas", formato: "inteiro" },
        { header: "Comparecimentos", key: "comparecimentos", formato: "inteiro" },
        { header: "Ausências", key: "ausencias", formato: "inteiro" },
        { header: "Cancelamentos", key: "cancelamentos", formato: "inteiro" },
        { header: "Taxa de Comparecimento", key: "taxa", formato: "percentual", width: 22 },
      ];

      const linhasReservas = linhas.map((r) => ({
        data_iso: r.data_iso,
        posicao_numero: r.posicao_numero,
        colaborador: r.colaborador ?? "",
        hora_inicio: hhmm(r.hora_inicio),
        hora_fim: hhmm(r.hora_fim),
        status_label: STATUS_LABEL[r.status] ?? r.status,
        compareceu_label: r.compareceu ? "Sim" : "Não",
        reservado_em_br: dataHoraBR(r.reservado_em),
        checkin_em_br: dataHoraBR(r.checkin_em),
      }));
      const linhasRanking = rank.map((r) => ({
        colaborador: r.colaborador ?? "",
        reservas: r.reservas,
        comparecimentos: r.comparecimentos,
        ausencias: r.ausencias,
        cancelamentos: r.cancelamentos,
        taxa: (Number(r.taxa_comparecimento) || 0) / 100,
      }));

      const periodo = `${dataBR(de)} a ${dataBR(ate)}`;
      const nomeColab =
        userId === "todos"
          ? "Todos"
          : (usuarios ?? []).find((u) => u.user_id === userId)?.nome || "Colaborador";

      await exportarXlsx({
        arquivo: `Controle_Posicoes_${de}_a_${ate}.xlsx`,
        cabecalho: {
          titulo: "Controle de Posições · RH",
          subtitulo: `Escritório SP · ${periodo}`,
          info: [
            { rotulo: "Período", valor: periodo },
            { rotulo: "Colaborador", valor: nomeColab },
            { rotulo: "Posição", valor: posicao === "todas" ? "Todas" : `Posição ${posicao}` },
            { rotulo: "Status", valor: status === "todos" ? "Todos" : STATUS_LABEL[status] ?? status },
            { rotulo: "Gerado em", valor: new Date().toLocaleString("pt-BR") },
          ],
        },
        abas: [
          { nome: "Reservas", colunas: colsReservas, linhas: linhasReservas },
          { nome: "Ranking", colunas: colsRanking, linhas: linhasRanking, totalizar: ["reservas", "comparecimentos", "ausencias", "cancelamentos"] },
        ],
      });
      toast.success(`Controle_Posicoes_${de}_a_${ate}.xlsx`, { id: toastId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a planilha", { id: toastId });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div
      className="min-h-screen px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10"
      style={{ background: "#14405C" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Controle de Posições
            </h1>
            <p className="mt-1 text-white/70">
              Reservas, comparecimentos e ranking de uso do escritório de SP
            </p>
          </div>
          <Button onClick={exportar} disabled={exportando} className="gap-2">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar
          </Button>
        </div>

        {/* Filtros */}
        <div className="mb-6 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-white/70">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="bg-white text-slate-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="bg-white text-slate-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Colaborador</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-white text-slate-900">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(usuarios ?? []).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.nome || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Posição</Label>
            <Select value={posicao} onValueChange={setPosicao}>
              <SelectTrigger className="bg-white text-slate-900">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((n) => (
                  <SelectItem key={n} value={n}>
                    Posição {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white text-slate-900">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_OPCOES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumo */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Cartao titulo="Reservas" valor={resumo.total} icone={CalendarCheck} cor="#00BAF2" />
          <Cartao titulo="Comparecimentos" valor={resumo.comparecimentos} icone={CheckCircle2} cor="#22C55E" />
          <Cartao titulo="Ausências" valor={resumo.ausencias} icone={XCircle} cor="#EF4444" />
          <Cartao titulo="Cancelamentos" valor={resumo.cancelamentos} icone={Ban} cor="#8AAFC9" />
          <Cartao titulo="Posições ativas hoje" valor={resumo.hoje} icone={Users} cor="#00BAF2" />
        </div>

        {semPermissao && !carregandoReservas && linhas.length === 0 && (
          <p className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Nenhuma reserva encontrada para o período. Se você acredita que deveria ver dados aqui,
            fale com o administrador do Hub.
          </p>
        )}

        <Tabs defaultValue="reservas">
          <TabsList>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="reservas" className="mt-4">
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-center">Posição</th>
                    <th className="px-3 py-2 text-left">Colaborador</th>
                    <th className="px-3 py-2 text-center">Horário</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Compareceu</th>
                    <th className="px-3 py-2 text-center">Reservado em</th>
                    <th className="px-3 py-2 text-center">Check-in</th>
                    <th className="px-3 py-2 text-right">Ações</th>

                  </tr>
                </thead>
                <tbody>
                  {carregandoReservas && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                        Carregando…
                      </td>
                    </tr>
                  )}
                  {!carregandoReservas && linhas.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                        Nenhuma reserva no período.
                      </td>
                    </tr>
                  )}
                  {linhas.map((r, i) => (
                    <tr key={r.reserva_id} className={i % 2 ? "bg-slate-50" : undefined}>
                      <td className="px-3 py-2 text-slate-800">{dataBR(r.data ?? r.data_iso)}</td>
                      <td className="px-3 py-2 text-center font-medium text-slate-800">{r.posicao_numero}</td>
                      <td className="px-3 py-2 text-slate-800">{r.colaborador ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-slate-700">
                        {hhmm(r.hora_inicio)} às {hhmm(r.hora_fim)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={
                              r.status === "cancelada"
                                ? "border-slate-300 text-slate-600"
                                : r.status === "expirada"
                                  ? "border-red-300 text-red-600"
                                  : "border-cyan-400 text-cyan-700"
                            }
                          >
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                          {r.status === "cancelada" && r.motivo_cancelamento && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" aria-label="Ver motivo do cancelamento">
                                    <Info className="h-4 w-4 text-slate-500" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {r.motivo_cancelamento}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-center">
                        {r.compareceu ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <XCircle className="h-4 w-4" /> Não
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">{dataHoraBR(r.reservado_em) || "—"}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{dataHoraBR(r.checkin_em) || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {["reservada", "confirmada"].includes(r.status) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setAlvo(r)}
                            disabled={cancelandoId === r.reserva_id}
                          >
                            {cancelandoId === r.reserva_id && (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Cancelar
                          </Button>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="mt-4">
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Colaborador</th>
                    <th className="px-3 py-2 text-center">Reservas</th>
                    <th className="px-3 py-2 text-center">Comparecimentos</th>
                    <th className="px-3 py-2 text-center">Ausências</th>
                    <th className="px-3 py-2 text-center">Cancelamentos</th>
                    <th className="px-3 py-2 text-left">Taxa de comparecimento</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoRanking && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Carregando…
                      </td>
                    </tr>
                  )}
                  {!carregandoRanking && rank.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Sem dados no período.
                      </td>
                    </tr>
                  )}
                  {rank.map((r, i) => (
                    <tr key={r.user_id ?? i} className={i % 2 ? "bg-slate-50" : undefined}>
                      <td className="px-3 py-2 text-slate-800">{r.colaborador ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-slate-800">{r.reservas}</td>
                      <td className="px-3 py-2 text-center font-medium text-green-700">{r.comparecimentos}</td>
                      <td className="px-3 py-2 text-center text-red-600">{r.ausencias}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{r.cancelamentos}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={Number(r.taxa_comparecimento) || 0} className="h-2 w-28" />
                          <span className="text-slate-800">
                            {(Number(r.taxa_comparecimento) || 0).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <CancelarComMotivoDialog
          aberto={!!alvo}
          processando={!!cancelandoId}
          descricao={
            alvo
              ? `${alvo.colaborador ?? "Colaborador"} · posição ${alvo.posicao_numero} em ${dataBR(alvo.data ?? alvo.data_iso)}, das ${hhmm(alvo.hora_inicio)} às ${hhmm(alvo.hora_fim)}.`
              : ""
          }
          onFechar={() => setAlvo(null)}
          onConfirmar={cancelarReserva}
        />
      </div>

    </div>
  );
}
