// Aba Fontes e gatilhos — administração do módulo.
// Mostra o que está ligado, o que falta credencial, e permite disparar a
// ingestão e o motor manualmente.

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useFontes, useRodarFuncao, type RotinaAb } from "@/hooks/use-analise-background";
import { dataFmt, num, pct } from "@/lib/ab-format";
import { CATALOGO_GATILHOS, MODALIDADE_LABEL } from "@/lib/ab-types";
import { EstadoVazio, GatilhoBadge } from "@/components/analise-background/AbBits";

interface Fonte {
  chave: string;
  funcao: RotinaAb | null;
  label: string;
  gratuita: boolean;
  alimenta: string[];
  doc: string;
  body?: Record<string, unknown>;
  nota?: string;
}

const FONTES: Fonte[] = [
  {
    chave: "pncp", funcao: "ab-ingest-pncp", label: "PNCP — contratos e editais",
    gratuita: true, alimenta: ["T8", "T9", "T10"],
    doc: "https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos",
    body: { dias: 7, horizonte: 45 },
  },
  {
    chave: "pgfn", funcao: "ab-ingest-pgfn", label: "PGFN — Dívida Ativa da União",
    gratuita: true, alimenta: ["T6", "T5"],
    doc: "https://www.gov.br/pgfn/pt-br/assuntos/divida-ativa-da-uniao/transparencia-fiscal-1/dados-abertos",
    body: {},
    nota: "Carga inicial por CSV filtrado — o arquivo completo (~6 GB) não cabe numa requisição.",
  },
  {
    chave: "transparencia", funcao: "ab-ingest-transparencia",
    label: "Portal da Transparência — CEIS/CNEP/CEPIM",
    gratuita: true, alimenta: ["T12", "background check"],
    doc: "https://portaldatransparencia.gov.br/api-de-dados",
    body: {},
    nota: "Requer o secret TRANSPARENCIA_API_TOKEN (gratuito, por e-mail).",
  },
  {
    chave: "bureau", funcao: "ab-bureau-monitorar",
    label: "Bureau judicial (processos por CNPJ)",
    gratuita: false, alimenta: ["T1", "T2", "T4", "T13"],
    doc: "https://docs.judit.io/",
    body: { todosMonitorados: true },
    nota: "O botão registra os CNPJs marcados como monitorados; os andamentos chegam " +
      "por webhook em /api/public/hooks/ab-bureau-webhook. Configure BUREAU_PROVIDER, " +
      "BUREAU_API_KEY, BUREAU_CALLBACK_URL e BUREAU_WEBHOOK_SECRET.",
  },
  {
    chave: "rfb", funcao: "ab-enriquecer",
    label: "Receita Federal — cadastro de CNPJ",
    gratuita: true, alimenta: ["contato", "porte", "CNAE", "situação", "QSA"],
    doc: "https://minhareceita.org",
    body: {},
    nota: "É o que dá TELEFONE e endereço ao lead — sem isso o comercial tem o CNPJ e " +
      "não tem quem ligar. Também alimenta porte, capital social e CNAE, que pesam na " +
      "probabilidade de subscrição. E-mail tem cobertura baixa: a Receita raramente preenche.",
  },
  {
    chave: "motor", funcao: "ab-motor-run", label: "Motor de regras (gatilhos + preço)",
    gratuita: true, alimenta: ["todos"], doc: "", body: {},
  },
];

export default function FontesGatilhos({ podeExecutar }: { podeExecutar: boolean }) {
  const { data, isLoading } = useFontes();
  const rodar = useRodarFuncao();

  const executar = async (funcao: RotinaAb, body: Record<string, unknown>) => {
    try {
      const r = await rodar.mutateAsync({ nome: funcao, body });
      toast.success(`${funcao} concluída`, {
        description: JSON.stringify(r).slice(0, 180),
      });
    } catch (e) {
      toast.error(`${funcao} falhou`, { description: (e as Error).message });
    }
  };

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) =>
      <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (!data) return <EstadoVazio titulo="Sem dados de operação" />;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Conectores
        </h3>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">Fonte</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alimenta</TableHead>
                <TableHead>Última execução</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="min-w-[240px]">Detalhe</TableHead>
                {podeExecutar && <TableHead className="text-right">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {FONTES.map((f) => {
                const log = data.ultimoPorFonte[f.chave];
                return (
                  <TableRow key={f.chave}>
                    <TableCell>
                      <div className="font-medium text-[13px]">{f.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {f.funcao ?? "webhook"}
                      </div>
                      {f.doc && (
                        <a href={f.doc} target="_blank" rel="noreferrer"
                          className="text-xs underline text-muted-foreground">
                          documentação
                        </a>
                      )}
                      {f.nota && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 max-w-sm">
                          {f.nota}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.gratuita ? "default" : "secondary"} className="text-[10px]">
                        {f.gratuita ? "grátis" : "paga"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.alimenta.map((g) =>
                          g.startsWith("T")
                            ? <GatilhoBadge key={g} codigo={g} />
                            : <span key={g} className="text-xs text-muted-foreground">{g}</span>,
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {log ? (
                        <>
                          {dataFmt(log.created_at)}
                          <div>
                            <Badge
                              variant={log.status === "ok" ? "default"
                                : log.status === "erro" ? "destructive" : "secondary"}
                              className="text-[10px] mt-0.5"
                            >
                              {log.status}
                            </Badge>
                          </div>
                        </>
                      ) : <span className="text-muted-foreground">nunca</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[13px]">
                      {log ? num(log.gravados) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log?.detalhe ?? ""}
                    </TableCell>
                    {podeExecutar && (
                      <TableCell className="text-right">
                        {f.funcao ? (
                          <Button
                            size="sm" variant="secondary"
                            disabled={rodar.isPending}
                            onClick={() => executar(f.funcao!, f.body ?? {})}
                          >
                            Rodar
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">webhook</span>}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Catálogo de gatilhos
        </h3>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Cód.</TableHead>
                <TableHead className="min-w-[280px]">Gatilho</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead className="min-w-[240px]">Produto</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Eventos hoje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATALOGO_GATILHOS.map((g) => (
                <TableRow key={g.codigo}>
                  <TableCell><GatilhoBadge codigo={g.codigo} /></TableCell>
                  <TableCell className="text-[13px] font-medium">{g.nome}</TableCell>
                  <TableCell className="text-xs">{MODALIDADE_LABEL[g.modalidade]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.produto}</TableCell>
                  <TableCell className="text-xs">
                    {g.fonte}
                    {!g.gratuita && (
                      <Badge variant="secondary" className="text-[10px] ml-1.5">paga</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[13px]">
                    {num(data.eventosPorGatilho[g.codigo] ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Dicionário de constrição</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              É o classificador que substitui o campo “bloqueio judicial” que nenhum fornecedor
              vende. Editável em <code className="text-[11px]">ab_sinal</code> — sem deploy.
            </p>
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Sinal</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs text-right">Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sinais.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-[11px]">{s.nome}</TableCell>
                      <TableCell className="text-xs">{s.categoria}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {num(Number(s.peso), 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Parâmetros de negócio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            {data.parametros.map((p) => (
              <div key={p.chave} className="flex items-baseline gap-3">
                <span className="font-mono text-xs w-[170px] shrink-0">{p.chave}</span>
                <span className="tabular-nums font-medium w-[90px] text-right">
                  {p.chave.includes("taxa") || p.chave.includes("comissao") ||
                    p.chave.includes("selic") || p.chave.includes("acrescimo")
                    ? pct(Number(p.valor), 2)
                    : num(Number(p.valor), 0)}
                </span>
                <span className="text-xs text-muted-foreground">{p.descricao}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              O time de Garantia calibra taxa, comissão e ticket mínimo direto na tabela{" "}
              <code className="text-[11px]">ab_parametro</code>. O motor lê a cada execução.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de execuções
        </h3>
        <div className="rounded-lg border overflow-hidden max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Quando</TableHead>
                <TableHead className="text-xs">Fonte</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Recebidos</TableHead>
                <TableHead className="text-xs text-right">Gravados</TableHead>
                <TableHead className="text-xs text-right">Tempo</TableHead>
                <TableHead className="text-xs min-w-[280px]">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{l.fonte}</TableCell>
                  <TableCell>
                    <Badge
                      variant={l.status === "ok" ? "default"
                        : l.status === "erro" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{num(l.recebidos)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{num(l.gravados)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {l.duracao_ms ? `${num(l.duracao_ms / 1000, 1)}s` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.detalhe}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
