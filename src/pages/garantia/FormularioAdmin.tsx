// Lista das demandas recebidas pelo formulário público de Seguro Garantia
// Judicial. Somente leitura: a gravação continua exclusiva do service_role
// (endpoint público + job), e a RLS só libera SELECT.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, FileSpreadsheet, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const POR_PAGINA = 25;

const STATUS = [
  { valor: "recebida", rotulo: "Recebida", classe: "bg-slate-100 text-slate-700 border-slate-200" },
  { valor: "consultando_mercado", rotulo: "Consultando mercado", classe: "bg-blue-100 text-blue-700 border-blue-200" },
  { valor: "mercado_consultado", rotulo: "Mercado consultado", classe: "bg-purple-100 text-purple-700 border-purple-200" },
  { valor: "email_enviado", rotulo: "E-mail enviado", classe: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { valor: "erro", rotulo: "Erro", classe: "bg-red-100 text-red-700 border-red-200" },
] as const;

type Linha = {
  id: string;
  protocolo: string | null;
  criado_em: string;
  nome_tomador: string | null;
  cnpj_tomador: string | null;
  numero_processo: string | null;
  status: string;
  email_enviado_em: string | null;
  alerta_enviado_em: string | null;
  erro_mensagem: string | null;
  pdf_path: string | null;
  xlsx_path: string | null;
  natureza: string | null;
  solicitante: string | null;
};

const COLUNAS =
  "id,protocolo,criado_em,nome_tomador,cnpj_tomador,numero_processo,status," +
  "email_enviado_em,alerta_enviado_em,erro_mensagem,pdf_path,xlsx_path," +
  "natureza:dados_formulario->>naturezaRotulo," +
  "solicitante:dados_formulario->responsavel->>nome";

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatarDuracao(inicio: string, fim: string | null) {
  if (!fim) return "";
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function EtiquetaStatus({ status }: { status: string }) {
  const def = STATUS.find((s) => s.valor === status);
  return (
    <Badge variant="outline" className={def?.classe ?? "bg-slate-100 text-slate-700 border-slate-200"}>
      {def?.rotulo ?? status}
    </Badge>
  );
}

export default function GarantiaFormularioAdmin() {
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(0);

  const filtros = useMemo(
    () => ({ dataInicial, dataFinal, statusSelecionados, buscaAplicada }),
    [dataInicial, dataFinal, statusSelecionados, buscaAplicada],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["garantia-formulario-admin", filtros, pagina],
    queryFn: async () => {
      let q = supabase
        .from("garantia_judicial_solicitacoes")
        .select(COLUNAS, { count: "exact" })
        .order("criado_em", { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

      if (dataInicial) q = q.gte("criado_em", `${dataInicial}T00:00:00-03:00`);
      if (dataFinal) q = q.lte("criado_em", `${dataFinal}T23:59:59-03:00`);
      if (statusSelecionados.length) q = q.in("status", statusSelecionados);
      if (buscaAplicada.trim()) {
        const t = buscaAplicada.trim().replace(/[,()]/g, " ");
        q = q.or(
          [
            `protocolo.ilike.*${t}*`,
            `nome_tomador.ilike.*${t}*`,
            `cnpj_tomador.ilike.*${t}*`,
            `numero_processo.ilike.*${t}*`,
          ].join(","),
        );
      }

      const { data: linhas, count, error: err } = await q;
      if (err) throw err;
      return { linhas: (linhas ?? []) as unknown as Linha[], total: count ?? 0 };
    },
  });

  const linhas = data?.linhas ?? [];
  const total = data?.total ?? 0;
  const ultimaPagina = Math.max(0, Math.ceil(total / POR_PAGINA) - 1);

  function alternarStatus(valor: string) {
    setPagina(0);
    setStatusSelecionados((atual) =>
      atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor],
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Formulário Admin
          </h1>
          <p className="mt-1 text-muted-foreground">
            Demandas recebidas pelo formulário público de Seguro Garantia Judicial
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="gfa-de" className="text-xs text-muted-foreground">De</Label>
            <Input
              id="gfa-de"
              type="date"
              className="w-[160px]"
              value={dataInicial}
              onChange={(e) => {
                setPagina(0);
                setDataInicial(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="gfa-ate" className="text-xs text-muted-foreground">Até</Label>
            <Input
              id="gfa-ate"
              type="date"
              className="w-[160px]"
              value={dataFinal}
              onChange={(e) => {
                setPagina(0);
                setDataFinal(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[220px] justify-between">
                  {statusSelecionados.length
                    ? `${statusSelecionados.length} selecionado(s)`
                    : "Todos os status"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[260px] space-y-2">
                {STATUS.map((s) => (
                  <label key={s.valor} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={statusSelecionados.includes(s.valor)}
                      onCheckedChange={() => alternarStatus(s.valor)}
                    />
                    {s.rotulo}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPagina(0);
              setBuscaAplicada(busca);
            }}
          >
            <div className="flex min-w-[240px] flex-1 flex-col gap-1">
              <Label htmlFor="gfa-busca" className="text-xs text-muted-foreground">
                Busca (protocolo, tomador, CNPJ ou processo)
              </Label>
              <Input
                id="gfa-busca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite e pressione Enter"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Recebida em</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo até o e-mail</TableHead>
                  <TableHead>Anexos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!isLoading && error && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-destructive">
                      Não foi possível carregar as demandas. Verifique se você tem permissão de acesso.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && !error && linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhuma demanda encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}

                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      <div className="flex items-center gap-1.5">
                        {l.protocolo ?? "—"}
                        {l.alerta_enviado_em && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <BellRing className="h-4 w-4 text-amber-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Alerta enviado a operações em {formatarDataHora(l.alerta_enviado_em)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatarDataHora(l.criado_em)}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{l.nome_tomador ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.cnpj_tomador ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.numero_processo ?? "—"}</TableCell>
                    <TableCell>{l.natureza ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.solicitante ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <EtiquetaStatus status={l.status} />
                        {l.status === "erro" && l.erro_mensagem && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[360px] whitespace-pre-wrap">
                              {l.erro_mensagem}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatarDuracao(l.criado_em, l.email_enviado_em)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText
                          className={`h-4 w-4 ${l.pdf_path ? "text-[#338B85]" : "text-muted-foreground/30"}`}
                        />
                        <FileSpreadsheet
                          className={`h-4 w-4 ${l.xlsx_path ? "text-[#338B85]" : "text-muted-foreground/30"}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} demanda(s) · página {Math.min(pagina + 1, ultimaPagina + 1)} de {ultimaPagina + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= ultimaPagina}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
