// Canal Parceiros — cadastro único de parceiro do grupo.
//
// Tudo que decide situação, vigência e liberação de repasse vem do banco.
// A tela só mostra e chama as RPCs; nunca calcula regra por conta própria.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  FileSignature,
  FileText,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasRole } from "@/hooks/use-meu-perfil";
import EnviarContratoParceiro from "@/components/comercial/EnviarContratoParceiro";
import {
  FilaVerificacaoContratos,
  usePendenciasVerificacao,
} from "@/components/comercial/FilaVerificacaoContratos";
import {
  FilaAlteracoesPercentual,
  useAlteracoesPercentual,
  type Alteracao,
} from "@/components/comercial/FilaAlteracoesPercentual";
import { SolicitarAlteracaoPercentual } from "@/components/comercial/SolicitarAlteracaoPercentual";
import { RepasseComercial } from "@/components/comercial/RepasseComercial";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cicloPadrao } from "@/lib/repasse/ciclo-datas";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ tipos */

interface Situacao {
  chave_planilha: string | null;
  canal_id: string | null;
  nome: string | null;
  situacao: string | null;
  pode_exportar: boolean | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  pct_demais_efetivo: number | null;
  minimo_repasse: number | null;
}

interface Parceiro {
  canal_id: string;
  nome: string | null;
  razao_social: string | null;
  cnpj: string | null;
  eh_parceiro: boolean | null;
  cadastro_origem: string | null;
  motivo_sem_contrato: string | null;
  chaves_planilha: string[] | null;
}

interface Contrato {
  contrato_id?: string | null;
  canal_id?: string | null;
  parceiro?: string | null;
  arquivo_nome?: string | null;
  tipo?: string | null;
  assinado?: boolean | null;
  assinado_em?: string | null;
  signatarios?: number | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  pct_beneficios?: number | null;
  pct_garantia?: number | null;
  pct_demais?: number | null;
  pct_demais_efetivo?: number | null;
  hash_sha256?: string | null;
  hash?: string | null;
  situacao?: string | null;
  motivo_bloqueio?: string | null;
  vigente?: boolean | null;
  substituido_por?: string | null;
  declarado_assinado?: boolean | null;
  origem_leitura?: string | null;
  assinatura_atestada_por?: string | null;
  assinatura_atestada_em?: string | null;
  corrigido_por_nome?: string | null;
  corrigido_em?: string | null;
  [k: string]: unknown;
}

interface Evento {
  tipo: string | null;
  detalhe: Record<string, unknown> | null;
  usuario: string | null;
  usuario_email: string | null;
  criado_em: string | null;
}

interface Vigencia {
  parceiro: string | null;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  situacao: string | null;
  aviso_60_enviado_em: string | null;
}

/* --------------------------------------------------------------- formatos */

const dia = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const pct = (v?: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const rotuloSituacao: Record<string, string> = {
  ATIVO: "Ativo",
  VINCULO_A_CONFIRMAR: "Vínculo a confirmar",
  SEM_CONTRATO: "Sem contrato",
  VENCIDO: "Vencido",
};

function BadgeContrato({ situacao }: { situacao?: string | null }) {
  const s = situacao ?? "SEM_CONTRATO";
  const texto = rotuloSituacao[s] ?? s;
  if (s === "ATIVO") {
    return (
      <Badge className="border-emerald-600/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-200">
        {texto}
      </Badge>
    );
  }
  if (s === "VINCULO_A_CONFIRMAR") {
    return (
      <Badge className="border-amber-600/40 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200">
        {texto}
      </Badge>
    );
  }
  return <Badge variant="destructive">{texto}</Badge>;
}

const rotuloLeitura: Record<string, string> = {
  TEXTO: "Texto",
  OCR: "OCR",
  MANUAL: "Manual",
};

/** Como o contrato foi lido. Âmbar quando a pessoa declarou assinatura e o
 *  arquivo não trouxe o bloco de assinatura. */
function BadgeLeitura({
  origem,
  declarado,
  assinado,
}: {
  origem?: string | null;
  declarado?: boolean | null;
  assinado?: boolean | null;
}) {
  const texto = rotuloLeitura[origem ?? ""] ?? "Texto";
  const divergente = declarado === true && assinado !== true;
  return (
    <Badge
      variant="outline"
      className={cn(
        divergente &&
          "border-amber-600/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
      )}
    >
      {texto}
      {divergente ? " · assinatura não encontrada" : ""}
    </Badge>
  );
}

const rotuloEvento: Record<string, string> = {
  CADASTRO_MANUAL: "Cadastro manual",
  CONTRATO_ENVIADO: "Contrato enviado",
  CONTRATO_SUBSTITUIDO: "Contrato substituído",
  CONTRATO_VENCIDO: "Contrato vencido",
  VINCULO_RESOLVIDO: "Vínculo confirmado",
  LIBERACAO_SOLICITADA: "Liberação solicitada",
  LIBERACAO_DECIDIDA: "Liberação decidida",
  EXPORTACAO: "Relatório exportado",
  CONTRATO_CORRIGIDO: "Contrato corrigido",
  ASSINATURA_ATESTADA: "Assinatura atestada",
};

/** Campos do CONTRATO_CORRIGIDO, com o rótulo que a pessoa reconhece. */
const CAMPOS_CORRECAO: Array<{ chave: string; rotulo: string; tipo: "pct" | "data" | "valor" }> = [
  { chave: "vigencia_inicio", rotulo: "Início da vigência", tipo: "data" },
  { chave: "vigencia_fim", rotulo: "Fim da vigência", tipo: "data" },
  { chave: "pct_beneficios", rotulo: "Benefícios", tipo: "pct" },
  { chave: "pct_garantia", rotulo: "Garantia", tipo: "pct" },
  { chave: "pct_demais", rotulo: "Demais ramos", tipo: "pct" },
  { chave: "minimo_repasse", rotulo: "Mínimo por ciclo", tipo: "valor" },
];

/* ------------------------------------------------------------------ dados */

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await supabase.rpc(nome as never, (args ?? {}) as never);
  if (error) throw error;
  return (data ?? []) as T[];
}

/* ------------------------------------------------------------------ tela */

export default function CanalParceirosTela() {
  const queryClient = useQueryClient();
  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  const [novoAberto, setNovoAberto] = useState(false);
  const [enviarPara, setEnviarPara] = useState<{ canalId: string | null; nome?: string } | null>(
    null,
  );
  const [detalhe, setDetalhe] = useState<{ canalId: string; nome: string } | null>(null);

  const situacoes = useQuery({
    queryKey: ["canal-parceiro-situacao"],
    queryFn: () => rpc<Situacao>("rpc_canal_parceiro_situacao"),
    staleTime: 60_000,
  });

  const lista = useQuery({
    queryKey: ["canal-parceiro-lista"],
    queryFn: () => rpc<Parceiro>("rpc_canal_parceiro_lista"),
    staleTime: 60_000,
  });

  const vigencias = useQuery({
    queryKey: ["canal-parceiro-vigencias"],
    queryFn: () => rpc<Vigencia>("rpc_canal_parceiro_vigencias"),
    staleTime: 60_000,
  });

  const contratosTodos = useQuery({
    queryKey: ["canal-parceiro-contratos", null],
    queryFn: () => rpc<Contrato>("rpc_canal_parceiro_contratos", { p_canal_id: null }),
    staleTime: 60_000,
    enabled: isAdmin,
  });

  /* Mesma consulta da tabela de repasse (mesma chave de cache, sem chamada nova). */
  const ciclo = useMemo(() => cicloPadrao(new Set<string>()), []);
  const repasseCiclo = useQuery({
    queryKey: ["lavoro-repasse-por-canal", ciclo.ano, ciclo.mes, "PROVISIONADO", null, null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_lavoro_repasse_por_canal" as never,
        {
          p_ano: ciclo.ano,
          p_mes: ciclo.mes,
          p_modo: "PROVISIONADO",
          p_canal_repasse: null,
          p_situacao_repasse: null,
        } as never,
      );
      if (error) throw error;
      return (data || []) as {
        ciclo_ano: number;
        ciclo_mes: number;
        canal_repasse: string;
        valor: number;
      }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const resumoCiclo = useMemo(() => {
    const porCanal = new Map<string, number>();
    for (const r of repasseCiclo.data ?? []) {
      if (r.ciclo_ano !== ciclo.ano || r.ciclo_mes !== ciclo.mes) continue;
      porCanal.set(r.canal_repasse, (porCanal.get(r.canal_repasse) ?? 0) + Number(r.valor || 0));
    }
    let valor = 0;
    let parceiros = 0;
    for (const v of porCanal.values()) {
      valor += v;
      if (v > 0) parceiros += 1;
    }
    return { parceiros, valor };
  }, [repasseCiclo.data, ciclo]);

  function recarregarTudo() {
    queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
    queryClient.invalidateQueries({ queryKey: ["canal-parceiro-lista"] });
    queryClient.invalidateQueries({ queryKey: ["canal-parceiro-vigencias"] });
    queryClient.invalidateQueries({ queryKey: ["canal-parceiro-contratos"] });
  }

  const linhasSituacao = situacoes.data ?? [];
  const totalCanais = linhasSituacao.length;
  const ativos = linhasSituacao.filter((s) => s.situacao === "ATIVO").length;
  const semContrato = totalCanais - ativos;

  const situacaoPorCanal = useMemo(() => {
    const m = new Map<string, Situacao>();
    for (const s of linhasSituacao) if (s.canal_id) m.set(s.canal_id, s);
    return m;
  }, [linhasSituacao]);

  /** Trava da exportação: quem o banco libera, por chave normalizada do canal. */
  const podeExportarPorChave = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const s of linhasSituacao) {
      if (s.chave_planilha) m.set(s.chave_planilha, s.pode_exportar === true);
    }
    return m;
  }, [linhasSituacao]);

  /** Autorizações da diretoria em vigor: é o percentual que a exportação usa. */
  const alteracoesAprovadas = useAlteracoesPercentual("APROVADA");
  const aprovadaPorCanal = useMemo(() => {
    const m = new Map<string, Alteracao>();
    for (const a of alteracoesAprovadas.data ?? []) if (a.canal_id) m.set(a.canal_id, a);
    return m;
  }, [alteracoesAprovadas.data]);

  /** Base da tabela: parceiros cadastrados + canais da planilha ainda sem parceiro. */
  const linhas = useMemo(() => {
    const parceiros = lista.data ?? [];
    const usados = new Set(parceiros.map((p) => p.canal_id));
    const base = parceiros.map((p) => ({
      chave: p.canal_id,
      canalId: p.canal_id as string | null,
      nome: p.nome ?? p.razao_social ?? "—",
      razaoSocial: p.razao_social ?? null,
      cnpj: p.cnpj ?? null,
      chaves: p.chaves_planilha ?? [],
      origem: p.cadastro_origem ?? "—",
      s: situacaoPorCanal.get(p.canal_id) ?? null,
    }));
    const soltos = linhasSituacao
      .filter((s) => !s.canal_id || !usados.has(s.canal_id))
      .map((s) => ({
        chave: `planilha:${s.chave_planilha ?? s.nome ?? ""}`,
        canalId: s.canal_id ?? null,
        nome: s.nome ?? s.chave_planilha ?? "—",
        razaoSocial: null as string | null,
        cnpj: null as string | null,
        chaves: s.chave_planilha ? [s.chave_planilha] : [],
        origem: "Planilha de repasse",
        s,
      }));
    return [...base, ...soltos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [lista.data, linhasSituacao, situacaoPorCanal]);

  const vinculosPendentes = (contratosTodos.data ?? []).filter(
    (c) => c.situacao === "VINCULO_A_CONFIRMAR",
  );

  /* Contagens das três filas, para montar (ou esconder) o bloco "Precisa de você". */
  const pendVerificacao = usePendenciasVerificacao();
  const altPendentes = useAlteracoesPercentual("PENDENTE");
  const nVinculos = isAdmin ? vinculosPendentes.length : 0;
  const nVerificacao = (pendVerificacao.data ?? []).length;
  const nAlteracoes = (altPendentes.data ?? []).length;
  const filasAtivas = [nVinculos, nVerificacao, nAlteracoes].filter((n) => n > 0).length;
  const umaFilaSo = filasAtivas === 1;

  const carregando = situacoes.isLoading || lista.isLoading;
  const erro = situacoes.error ?? lista.error ?? vigencias.error;

  return (
    <div className="space-y-6">
      {/* cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Canal Parceiros
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Cadastro único de parceiro do grupo, universal para todos os ramos. É ele que libera ou
            trava o repasse.
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo parceiro
        </Button>
      </div>

      {erro ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não deu para carregar</AlertTitle>
          <AlertDescription>{erro instanceof Error ? erro.message : String(erro)}</AlertDescription>
        </Alert>
      ) : null}

      {/* faixa de números */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Parceiros com repasse no ciclo" valor={String(resumoCiclo.parceiros)} />
        <Kpi titulo="Com contrato assinado e ativo" valor={String(ativos)} />
        <Kpi
          titulo="Sem contrato assinado"
          valor={String(semContrato)}
          className={semContrato > 0 ? "text-destructive" : undefined}
        />
        <Kpi
          titulo="Valor do ciclo corrente"
          valor={resumoCiclo.valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
          className="font-mono text-primary"
        />
      </div>

      {/* precisa de você — as três filas juntas, some quando não há nada */}
      {filasAtivas > 0 ? (
        <Card className="border-amber-600/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Precisa de você
            </CardTitle>
            <CardDescription>
              Pendências que travam contrato ou repasse até alguém resolver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {nVinculos > 0 ? (
              <section className="space-y-3">
                {umaFilaSo ? null : (
                  <h3 className="text-sm font-semibold text-foreground">
                    Vínculos a confirmar · {nVinculos}
                  </h3>
                )}
                <VinculosAConfirmar
                  semCard
                  contratos={vinculosPendentes}
                  parceiros={lista.data ?? []}
                  onResolvido={recarregarTudo}
                />
              </section>
            ) : null}

            {nVerificacao > 0 ? (
              <section className="space-y-3">
                {umaFilaSo ? null : (
                  <h3 className="text-sm font-semibold text-foreground">
                    Conferência de contratos · {nVerificacao}
                  </h3>
                )}
                <FilaVerificacaoContratos semCard />
              </section>
            ) : null}

            {nAlteracoes > 0 ? (
              <section className="space-y-3">
                {umaFilaSo ? null : (
                  <h3 className="text-sm font-semibold text-foreground">
                    Alterações de percentual · {nAlteracoes}
                  </h3>
                )}
                <FilaAlteracoesPercentual semCard />
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="repasse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repasse">Repasse do ciclo</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="vigencias">Vigências</TabsTrigger>
        </TabsList>

        <TabsContent value="repasse">
          <RepasseComercial podeExportarPorChave={podeExportarPorChave} />
        </TabsContent>

        <TabsContent value="parceiros">
          <Card>
            <CardHeader>
              <CardTitle>Parceiros</CardTitle>
              <CardDescription>
                Clique na linha para ver contratos e aditivos do parceiro.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parceiro</TableHead>
                      <TableHead>Razão social</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Benefícios</TableHead>
                      <TableHead>Garantia</TableHead>
                      <TableHead>Demais ramos</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carregando ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                          Carregando
                        </TableCell>
                      </TableRow>
                    ) : linhas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                          Nenhum parceiro por aqui ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      linhas.map((l) => {
                        const demaisHerdado = l.s?.pct_demais == null && l.s?.pct_garantia != null;
                        const dias = l.s?.dias_para_vencer ?? null;
                        const aut = l.canalId ? (aprovadaPorCanal.get(l.canalId) ?? null) : null;
                        return (
                          <TableRow
                            key={l.chave}
                            className={l.canalId ? "cursor-pointer" : undefined}
                            onClick={() =>
                              l.canalId && setDetalhe({ canalId: l.canalId, nome: l.nome })
                            }
                          >
                            <TableCell>
                              <div className="font-medium text-foreground">{l.nome}</div>
                              {l.chaves.length > 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  {l.chaves.join(" · ")}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {l.razaoSocial ? (
                                <div>
                                  <div className="text-sm text-foreground">{l.razaoSocial}</div>
                                  {l.cnpj ? (
                                    <div className="text-xs text-muted-foreground">{l.cnpj}</div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <BadgeContrato situacao={l.s?.situacao ?? "SEM_CONTRATO"} />
                            </TableCell>
                            <TableCell>
                              {l.s?.vigencia_fim ? (
                                <div>
                                  <div className="text-sm">{dia(l.s.vigencia_fim)}</div>
                                  {dias != null ? (
                                    <div
                                      className={cn(
                                        "text-xs",
                                        dias < 30
                                          ? "font-medium text-destructive"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {dias < 0
                                        ? `vencido há ${Math.abs(dias)} dias`
                                        : `${dias} dias`}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <CelulaPct
                              contrato={l.s?.pct_beneficios}
                              autorizado={aut?.pct_beneficios ?? null}
                              autorizadoEm={aut?.aprovado_em ?? null}
                            />
                            <CelulaPct
                              contrato={l.s?.pct_garantia}
                              autorizado={aut?.pct_garantia ?? null}
                              autorizadoEm={aut?.aprovado_em ?? null}
                            />
                            {(() => {
                              const autorizadoDemais = aut?.pct_demais ?? aut?.pct_garantia ?? null;
                              const herdadoDeGarantia =
                                autorizadoDemais != null &&
                                aut?.pct_demais == null &&
                                aut?.pct_garantia != null;
                              return (
                                <CelulaPct
                                  contrato={l.s?.pct_demais_efetivo}
                                  autorizado={autorizadoDemais}
                                  autorizadoEm={aut?.aprovado_em ?? null}
                                  herdadoDeGarantia={herdadoDeGarantia}
                                  rodape={
                                    autorizadoDemais == null && demaisHerdado
                                      ? "herdado de Garantia"
                                      : null
                                  }
                                />
                              );
                            })()}
                            <TableCell className="text-sm text-muted-foreground">
                              {l.origem}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setEnviarPara({ canalId: l.canalId, nome: l.nome });
                                }}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar contrato
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vigencias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Vigências
              </CardTitle>
              <CardDescription>
                O jurídico é avisado automaticamente 60 dias antes do vencimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parceiro</TableHead>
                      <TableHead>Fim da vigência</TableHead>
                      <TableHead>Dias restantes</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Aviso ao jurídico</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vigencias.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nenhuma vigência registrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (vigencias.data ?? []).map((v, i) => {
                        const critico = (v.dias_para_vencer ?? 999) < 30;
                        return (
                          <TableRow key={`${v.parceiro}-${v.vigencia_fim}-${i}`}>
                            <TableCell className="font-medium">{v.parceiro ?? "—"}</TableCell>
                            <TableCell>{dia(v.vigencia_fim)}</TableCell>
                            <TableCell
                              className={cn(
                                "tabular-nums",
                                critico ? "font-semibold text-destructive" : undefined,
                              )}
                            >
                              {v.dias_para_vencer ?? "—"}
                            </TableCell>
                            <TableCell>
                              <BadgeContrato situacao={v.situacao} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {v.aviso_60_enviado_em
                                ? `Enviado em ${dataHora(v.aviso_60_enviado_em)}`
                                : "Não enviado"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* diálogos */}
      <NovoParceiro
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        onFeito={recarregarTudo}
      />

      <EnviarContratoParceiro
        aberto={!!enviarPara}
        canalId={enviarPara?.canalId ?? null}
        canalNome={enviarPara?.nome}
        onFechar={() => setEnviarPara(null)}
        onSucesso={() => {
          recarregarTudo();
          setEnviarPara(null);
        }}
      />

      <DetalheParceiro
        canalId={detalhe?.canalId ?? null}
        nome={detalhe?.nome ?? ""}
        situacao={detalhe?.canalId ? (situacaoPorCanal.get(detalhe.canalId) ?? null) : null}
        onFechar={() => setDetalhe(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- KPI */

const rotuloStatusAlteracao: Record<string, string> = {
  PENDENTE: "Aguardando aprovação",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  SUPERADA: "Superada",
};

/** Percentual do contrato — ou o autorizado pela diretoria, que é o que vale. */
function CelulaPct({
  contrato,
  autorizado,
  autorizadoEm,
  herdadoDeGarantia,
  rodape,
}: {
  contrato?: number | null;
  autorizado?: number | null;
  autorizadoEm?: string | null;
  herdadoDeGarantia?: boolean;
  rodape?: string | null;
}) {
  const temAutorizacao = autorizado != null;
  const title = herdadoDeGarantia
    ? `Autorizado pela diretoria em ${dia(autorizadoEm)} (percentual de Garantia, herdado para Demais ramos) · contrato: ${pct(contrato)}`
    : `Autorizado pela diretoria em ${dia(autorizadoEm)} · contrato: ${pct(contrato)}`;
  return (
    <TableCell className="tabular-nums">
      <span className="inline-flex items-center gap-1.5">
        {pct(temAutorizacao ? autorizado : contrato)}
        {temAutorizacao ? (
          <Badge
            variant="outline"
            className="border-amber-600/40 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            title={title}
          >
            diretoria
          </Badge>
        ) : null}
      </span>
      {rodape ? <div className="text-xs text-muted-foreground">{rodape}</div> : null}
    </TableCell>
  );
}

function Kpi({ titulo, valor, className }: { titulo: string; valor: string; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums text-foreground", className)}>
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------- novo parceiro */

function NovoParceiro({
  aberto,
  onFechar,
  onFeito,
}: {
  aberto: boolean;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const [caminho, setCaminho] = useState<"escolha" | "manual">("escolha");
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    cnpj: "",
    contato_nome: "",
    contato_email: "",
    email_financeiro: "",
    motivo: "",
  });

  function fechar() {
    setCaminho("escolha");
    setForm({
      nome: "",
      razao_social: "",
      cnpj: "",
      contato_nome: "",
      contato_email: "",
      email_financeiro: "",
      motivo: "",
    });
    onFechar();
  }

  async function salvar() {
    if (!form.nome.trim() || !form.motivo.trim() || salvando) return;
    setSalvando(true);
    try {
      const { error } = await supabase.rpc(
        "rpc_canal_parceiro_cadastrar_manual" as never,
        {
          p_canal_id: null,
          p_nome: form.nome.trim(),
          p_razao_social: form.razao_social.trim() || null,
          p_cnpj: form.cnpj.trim() || null,
          p_contato_nome: form.contato_nome.trim() || null,
          p_contato_email: form.contato_email.trim() || null,
          p_email_financeiro: form.email_financeiro.trim() || null,
          p_motivo: form.motivo.trim(),
        } as never,
      );
      if (error) throw error;
      toast.success("Parceiro cadastrado. A exportação de repasse segue travada até o contrato.");
      onFeito();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Dialog
        open={aberto && !enviarAberto}
        onOpenChange={(v) => {
          if (!v) fechar();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
            <DialogDescription>
              O cadastro é único para todo o grupo, vale para todos os ramos.
            </DialogDescription>
          </DialogHeader>

          {caminho === "escolha" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setEnviarAberto(true)}
                className="w-full rounded-lg border border-emerald-600/40 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
              >
                <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
                  <FileSignature className="h-4 w-4" />
                  Subir o contrato assinado
                  <Badge className="ml-auto border-emerald-600/40 bg-white text-emerald-700 hover:bg-white">
                    recomendado
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
                  O sistema lê o PDF, cadastra o parceiro e libera o repasse.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCaminho("manual")}
                className="w-full rounded-lg border p-4 text-left transition hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" />
                  Cadastro manual
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra o parceiro para consulta.{" "}
                  <strong>Não libera a exportação de repasse</strong> — isso só acontece com o
                  contrato assinado no Hub.
                </p>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert className="border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Este caminho não libera repasse</AlertTitle>
                <AlertDescription>
                  O parceiro fica cadastrado, mas a exportação continua travada até o contrato
                  assinado ser enviado.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  id="np-nome"
                  rotulo="Nome do parceiro"
                  valor={form.nome}
                  onChange={(v) => setForm((f) => ({ ...f, nome: v }))}
                />
                <Campo
                  id="np-razao"
                  rotulo="Razão social"
                  valor={form.razao_social}
                  onChange={(v) => setForm((f) => ({ ...f, razao_social: v }))}
                />
                <Campo
                  id="np-cnpj"
                  rotulo="CNPJ"
                  valor={form.cnpj}
                  onChange={(v) => setForm((f) => ({ ...f, cnpj: v }))}
                />
                <Campo
                  id="np-contato"
                  rotulo="Contato"
                  valor={form.contato_nome}
                  onChange={(v) => setForm((f) => ({ ...f, contato_nome: v }))}
                />
                <Campo
                  id="np-contato-email"
                  rotulo="E-mail do contato"
                  valor={form.contato_email}
                  onChange={(v) => setForm((f) => ({ ...f, contato_email: v }))}
                />
                <Campo
                  id="np-financeiro"
                  rotulo="E-mail do financeiro"
                  valor={form.email_financeiro}
                  onChange={(v) => setForm((f) => ({ ...f, email_financeiro: v }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="np-motivo">Motivo do cadastro sem contrato</Label>
                <Textarea
                  id="np-motivo"
                  rows={3}
                  value={form.motivo}
                  onChange={(ev) => setForm((f) => ({ ...f, motivo: ev.target.value }))}
                  placeholder="Obrigatório. Explique por que o parceiro está sendo cadastrado sem contrato."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={fechar} disabled={salvando}>
              Cancelar
            </Button>
            {caminho === "manual" ? (
              <Button
                onClick={salvar}
                disabled={!form.nome.trim() || !form.motivo.trim() || salvando}
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnviarContratoParceiro
        aberto={enviarAberto}
        canalId={null}
        onFechar={() => setEnviarAberto(false)}
        onSucesso={() => {
          onFeito();
          setEnviarAberto(false);
          fechar();
        }}
      />
    </>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} value={valor} onChange={(ev) => onChange(ev.target.value)} />
    </div>
  );
}

/* --------------------------------------------------- vínculos a confirmar */

function VinculosAConfirmar({
  contratos,
  parceiros,
  onResolvido,
  semCard = false,
}: {
  contratos: Contrato[];
  parceiros: Parceiro[];
  onResolvido: () => void;
  semCard?: boolean;
}) {
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  async function resolver(contratoId: string) {
    const canalId = escolha[contratoId];
    if (!canalId) return;
    setSalvando(contratoId);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_resolver_vinculo" as never,
        {
          p_contrato_id: contratoId,
          p_canal_id: canalId,
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as {
        situacao?: string;
        pode_exportar?: boolean;
      } | null;
      toast.success(
        r?.pode_exportar
          ? "Vínculo confirmado. Repasse liberado."
          : `Vínculo confirmado. Situação: ${r?.situacao ?? "—"}.`,
      );
      onResolvido();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(null);
    }
  }

  const conteudo = (
    <div className="space-y-3">
      {contratos.map((c) => {
        const id = String(c.contrato_id ?? "");
        return (
          <div
            key={id}
            className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{c.arquivo_nome ?? "Contrato"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.motivo_bloqueio ?? "Sem motivo informado."}
              </p>
            </div>
            <Select
              value={escolha[id] ?? ""}
              onValueChange={(v) => setEscolha((e) => ({ ...e, [id]: v }))}
            >
              <SelectTrigger className="md:w-72">
                <SelectValue placeholder="Escolha o parceiro" />
              </SelectTrigger>
              <SelectContent>
                {parceiros.map((p) => (
                  <SelectItem key={p.canal_id} value={p.canal_id}>
                    {p.nome ?? p.razao_social ?? p.canal_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => resolver(id)}
              disabled={!escolha[id] || salvando === id}
              size="sm"
            >
              {salvando === id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        );
      })}
    </div>
  );

  if (semCard) return conteudo;

  return (
    <Card className="border-amber-600/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Vínculos a confirmar
        </CardTitle>
        <CardDescription>
          Contratos recebidos que o sistema não conseguiu ligar a um parceiro. Escolha a quem cada
          documento pertence.
        </CardDescription>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  );
}

/* -------------------------------------------------------- detalhe parceiro */

function DetalheParceiro({
  canalId,
  nome,
  situacao,
  onFechar,
}: {
  canalId: string | null;
  nome: string;
  situacao?: Situacao | null;
  onFechar: () => void;
}) {
  const [pedirAlteracao, setPedirAlteracao] = useState(false);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const meuPerfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(meuPerfil, "ADMIN");

  async function abrirDocumento(id: string, path: string) {
    if (abrindo) return;
    setAbrindo(id);
    try {
      const { data, error } = await supabase.storage
        .from("canal-parceiros-contratos")
        .createSignedUrl(path, 300);
      if (error) throw new Error(error.message);
      window.open(data?.signedUrl, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAbrindo(null);
    }
  }

  const contratos = useQuery({
    queryKey: ["canal-parceiro-contratos", canalId],
    queryFn: () => rpc<Contrato>("rpc_canal_parceiro_contratos", { p_canal_id: canalId }),
    enabled: !!canalId,
  });

  const todasAlteracoes = useAlteracoesPercentual(null);
  const alteracoesDoCanal = (todasAlteracoes.data ?? []).filter((a) => a.canal_id === canalId);

  const linhas = contratos.data ?? [];

  return (
    <Sheet
      open={!!canalId}
      onOpenChange={(v) => {
        if (!v) onFechar();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>
            Contratos e aditivos deste parceiro. A versão antiga nunca é apagada: fica guardada como
            histórico.
          </SheetDescription>
        </SheetHeader>

        {/* alteração de percentual com De Acordo da diretoria */}
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canalId}
            onClick={() => setPedirAlteracao(true)}
          >
            <FileSignature className="mr-2 h-4 w-4" />
            Solicitar alteração de percentual
          </Button>

          {alteracoesDoCanal.map((a) => (
            <div
              key={a.alteracao_id}
              className={cn(
                "rounded-md border p-2 text-xs",
                a.status === "SUPERADA" ? "text-muted-foreground opacity-60" : "",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="outline">{rotuloStatusAlteracao[a.status ?? ""] ?? a.status}</Badge>
                <span className="tabular-nums">
                  {[
                    a.pct_beneficios != null ? `Benefícios ${pct(a.pct_beneficios)}` : null,
                    a.pct_garantia != null ? `Garantia ${pct(a.pct_garantia)}` : null,
                    a.pct_demais != null ? `Demais ramos ${pct(a.pct_demais)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
                <span className="text-muted-foreground">
                  pedido por {a.solicitado_por_nome ?? "—"}
                </span>
                <span className="text-muted-foreground">
                  {a.aprovado_por_nome ? `aprovado por ${a.aprovado_por_nome}` : "sem aprovação"}
                </span>
                {a.status === "SUPERADA" ? <span>substituída pelo contrato</span> : null}
              </div>
            </div>
          ))}
        </div>

        {canalId ? (
          <SolicitarAlteracaoPercentual
            aberto={pedirAlteracao}
            canalId={canalId}
            canalNome={nome}
            pctAtuais={{
              beneficios: situacao?.pct_beneficios ?? null,
              garantia: situacao?.pct_garantia ?? null,
              demais: situacao?.pct_demais_efetivo ?? null,
              minimo: situacao?.minimo_repasse ?? null,
            }}
            onFechar={() => setPedirAlteracao(false)}
          />
        ) : null}

        <div className="mt-4 space-y-3">
          {contratos.isLoading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Carregando
            </p>
          ) : contratos.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {contratos.error instanceof Error
                  ? contratos.error.message
                  : String(contratos.error)}
              </AlertDescription>
            </Alert>
          ) : linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato enviado para este parceiro ainda.
            </p>
          ) : (
            linhas.map((c, i) => {
              const vigente = c.situacao === "ATIVO" || c.vigente === true;
              const hash = (c.hash_sha256 ?? c.hash ?? null) as string | null;
              return (
                <div
                  key={String(c.contrato_id ?? i)}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    vigente
                      ? "border-emerald-600/40 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {c.arquivo_nome ?? "Documento"}
                      </p>
                      <p className="text-xs">
                        {c.tipo ?? "Contrato"}
                        {vigente ? " · vigente" : " · substituído"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <BadgeContrato situacao={c.situacao} />
                      <BadgeLeitura
                        origem={c.origem_leitura}
                        declarado={c.declarado_assinado}
                        assinado={c.assinado}
                      />
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <InfoAssinatura contrato={c} />
                    <Info
                      rotulo="Signatários"
                      valor={c.signatarios != null ? String(c.signatarios) : "—"}
                    />
                    <Info
                      rotulo="Vigência"
                      valor={`${dia(c.vigencia_inicio)} a ${dia(c.vigencia_fim)}`}
                    />
                    <Info rotulo="Benefícios" valor={pct(c.pct_beneficios)} />
                    <Info rotulo="Garantia" valor={pct(c.pct_garantia)} />
                    <InfoDemais
                      rotulo="Demais ramos"
                      pctDemais={c.pct_demais}
                      pctDemaisEfetivo={c.pct_demais_efetivo}
                      pctGarantia={c.pct_garantia}
                    />
                    <Info rotulo="Hash" valor={hash ? `${hash.slice(0, 12)}…` : "—"} />
                    <InfoCorrecao contrato={c} />
                  </dl>

                  {c.motivo_bloqueio ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      {c.motivo_bloqueio}
                    </p>
                  ) : null}

                  {typeof c.arquivo_path === "string" && c.arquivo_path ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      disabled={abrindo === String(c.contrato_id ?? i)}
                      onClick={() =>
                        void abrirDocumento(String(c.contrato_id ?? i), c.arquivo_path as string)
                      }
                    >
                      {abrindo === String(c.contrato_id ?? i) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Abrir o documento
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <Historico canalId={canalId} />

        {isAdmin && canalId ? (
          <div className="mt-6 border-t pt-4">
            <Button size="sm" variant="destructive" onClick={() => setExcluirAberto(true)}>
              Excluir parceiro
            </Button>
          </div>
        ) : null}

        <ExcluirParceiroDialog
          aberto={excluirAberto}
          canalId={canalId}
          nome={nome}
          onFechar={() => setExcluirAberto(false)}
          onExcluido={() => {
            setExcluirAberto(false);
            queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
            queryClient.invalidateQueries({ queryKey: ["canal-parceiro-lista"] });
            queryClient.invalidateQueries({ queryKey: ["canal-parceiro-vigencias"] });
            queryClient.invalidateQueries({ queryKey: ["canal-parceiro-contratos"] });
            onFechar();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------- excluir parceiro (ADMIN) */

function ExcluirParceiroDialog({
  aberto,
  canalId,
  nome,
  onFechar,
  onExcluido,
}: {
  aberto: boolean;
  canalId: string | null;
  nome: string;
  onFechar: () => void;
  onExcluido: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    if (!canalId || !motivo.trim() || excluindo) return;
    setExcluindo(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_excluir" as never,
        {
          p_canal_id: canalId,
          p_motivo: motivo.trim(),
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string } | null;
      toast.success(r?.mensagem ?? "Parceiro excluído.");
      setMotivo("");
      onExcluido();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) onFechar();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Excluir parceiro</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>

        <SuperAdminGate area="canal-parceiro-excluir" titulo="Excluir parceiro do cadastro">
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                O parceiro sai do cadastro e perde o vínculo com a planilha. Contratos e histórico
                ficam guardados.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="excluir-motivo">Motivo</Label>
              <Textarea
                id="excluir-motivo"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explique por que este parceiro está saindo do cadastro."
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onFechar} disabled={excluindo}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => void excluir()}
                disabled={!motivo.trim() || excluindo}
              >
                {excluindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Excluir
              </Button>
            </DialogFooter>
          </div>
        </SuperAdminGate>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- histórico */

function textoDetalhe(ev: Evento): string | null {
  const d = ev.detalhe ?? {};
  const v = (k: string) => (d[k] == null ? null : String(d[k]));
  if (ev.tipo === "CONTRATO_ENVIADO") return null; // tratado em destaque
  const pedacos = [
    v("parceiro"),
    v("arquivo_nome"),
    v("motivo"),
    v("justificativa"),
    v("observacao"),
    v("situacao"),
    v("status"),
    v("ciclo"),
  ].filter(Boolean) as string[];
  return pedacos.length ? pedacos.join(" · ") : null;
}

function Historico({ canalId }: { canalId: string | null }) {
  const eventos = useQuery({
    queryKey: ["canal-parceiro-eventos", canalId],
    queryFn: () => rpc<Evento>("rpc_canal_parceiro_eventos", { p_canal_id: canalId, p_limite: 50 }),
    enabled: !!canalId,
  });

  const linhas = eventos.data ?? [];

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-semibold">Histórico</h3>
      {eventos.isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Carregando
        </p>
      ) : eventos.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {eventos.error instanceof Error ? eventos.error.message : String(eventos.error)}
          </AlertDescription>
        </Alert>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <ol className="space-y-2">
          {linhas.map((ev, i) => {
            const d = ev.detalhe ?? {};
            const declarado = d["declarado_assinado"] === true;
            const assinado = d["assinado"] === true;
            const origem = d["origem_leitura"] == null ? null : String(d["origem_leitura"]);
            const quem = ev.usuario || ev.usuario_email || "—";
            return (
              <li key={i} className="rounded-md border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {rotuloEvento[ev.tipo ?? ""] ?? ev.tipo ?? "Evento"}
                  </span>
                  <span className="text-muted-foreground">{dataHora(ev.criado_em)}</span>
                  <span className="text-muted-foreground">· {quem}</span>
                </div>

                {ev.tipo === "CONTRATO_ENVIADO" ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        declarado &&
                          !assinado &&
                          "border-amber-600/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
                      )}
                    >
                      {declarado
                        ? `${quem} declarou que estava assinado`
                        : "declarado como não assinado"}
                    </Badge>
                    <Badge variant="outline">
                      Assinatura no arquivo: {assinado ? "encontrada" : "não encontrada"}
                    </Badge>
                    <BadgeLeitura origem={origem} declarado={declarado} assinado={assinado} />
                    {d["arquivo_nome"] ? (
                      <span className="text-muted-foreground">{String(d["arquivo_nome"])}</span>
                    ) : null}
                  </div>
                ) : ev.tipo === "CONTRATO_CORRIGIDO" ? (
                  <Correcao detalhe={d} />
                ) : (
                  (() => {
                    const t = textoDetalhe(ev);
                    return t ? <p className="mt-1 text-muted-foreground">{t}</p> : null;
                  })()
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Correção do contrato: só o que mudou, no formato "Garantia: 20% → 25%".
 *  Campo que ficou igual não entra — numa conferência ele só atrapalha. */
function Correcao({ detalhe }: { detalhe: Record<string, unknown> }) {
  const antes = (detalhe["antes"] ?? {}) as Record<string, unknown>;
  const depois = (detalhe["depois"] ?? {}) as Record<string, unknown>;
  const motivo = detalhe["motivo"] == null ? null : String(detalhe["motivo"]);

  const mostrar = (v: unknown, tipo: "pct" | "data" | "valor") => {
    if (v == null || v === "") return "—";
    if (tipo === "pct") return pct(Number(v));
    if (tipo === "data") return dia(String(v));
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const mudancas = CAMPOS_CORRECAO.filter(
    (c) => JSON.stringify(antes[c.chave] ?? null) !== JSON.stringify(depois[c.chave] ?? null),
  );

  return (
    <div className="mt-1 space-y-1">
      {mudancas.length === 0 ? (
        <p className="text-muted-foreground">Nenhum campo foi alterado.</p>
      ) : (
        <ul className="space-y-0.5">
          {mudancas.map((c) => (
            <li key={c.chave} className="text-foreground">
              {c.rotulo}:{" "}
              <span className="text-muted-foreground">{mostrar(antes[c.chave], c.tipo)}</span> →{" "}
              <span className="font-medium">{mostrar(depois[c.chave], c.tipo)}</span>
            </li>
          ))}
        </ul>
      )}
      {motivo ? <p className="text-muted-foreground">{motivo}</p> : null}
    </div>
  );
}

/** Assinatura lida do arquivo e assinatura atestada por gente são informações
 *  diferentes: quando existirem as duas, as duas aparecem. */
function InfoAssinatura({ contrato }: { contrato: Contrato }) {
  const atestada = contrato.assinatura_atestada_por
    ? `atestada por ${contrato.assinatura_atestada_por} em ${dia(contrato.assinatura_atestada_em)}`
    : null;
  return (
    <div>
      <dt className="text-muted-foreground">Assinatura</dt>
      <dd className="space-y-1 font-medium text-foreground">
        {contrato.assinado ? (
          <div>
            {contrato.assinado_em ? dataHora(contrato.assinado_em) : "encontrada"}{" "}
            <span className="text-muted-foreground">lida do arquivo</span>
          </div>
        ) : atestada ? null : (
          <div className="text-muted-foreground">não encontrada</div>
        )}
        {atestada ? (
          <Badge className="border-amber-600/40 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200">
            {atestada}
          </Badge>
        ) : null}
      </dd>
    </div>
  );
}

function InfoCorrecao({ contrato }: { contrato: Contrato }) {
  if (!contrato.corrigido_em) return null;
  return (
    <div>
      <dt className="text-muted-foreground">Correção</dt>
      <dd>
        <Badge
          variant="outline"
          title={`Corrigido por ${contrato.corrigido_por_nome ?? "—"} em ${dataHora(contrato.corrigido_em)}`}
        >
          corrigido
        </Badge>
      </dd>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}

function InfoDemais({
  rotulo,
  pctDemais,
  pctDemaisEfetivo,
  pctGarantia,
}: {
  rotulo: string;
  pctDemais?: number | null;
  pctDemaisEfetivo?: number | null;
  pctGarantia?: number | null;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium text-foreground">
        {pctDemais != null ? (
          pct(pctDemais)
        ) : pctGarantia != null ? (
          <>
            {pct(pctDemaisEfetivo ?? pctGarantia)}{" "}
            <span className="text-muted-foreground">(herdado de Garantia)</span>
          </>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}
