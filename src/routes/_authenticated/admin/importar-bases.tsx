import { Fragment, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, ShieldAlert, ChevronDown, ChevronRight, History, RefreshCw, Cloud } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasPermission } from "@/hooks/use-meu-perfil";
import { useLastImport } from "@/hooks/use-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";


export const Route = createFileRoute("/_authenticated/admin/importar-bases")({
  component: ImportarBasesPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// --- helpers ---------------------------------------------------------------
function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial → JS Date (1900 base, XLSX handles the bug for us)
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const iso = new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString().slice(0, 10);
    return iso;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function findSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet | null {
  const target = name.trim().toLowerCase();
  const match = wb.SheetNames.find((n) => n.trim().toLowerCase() === target);
  return match ? wb.Sheets[match] : null;
}

function readSheetByName(file: File, sheetName: string, startRow: number): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array", cellDates: false });
        const ws = findSheet(wb, sheetName);
        if (!ws) throw new Error(`Aba "${sheetName}" não encontrada`);
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: startRow - 1, defval: null });
        resolve(rows);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}


// Column resolver — case/space/accent-insensitive lookup
function pick(row: Record<string, unknown>, ...keys: string[]) {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const map = new Map<string, unknown>();
  for (const k of Object.keys(row)) map.set(norm(k), row[k]);
  for (const k of keys) {
    const v = map.get(norm(k));
    if (v !== undefined) return v;
  }
  return null;
}

// --- Gerencial mapping -----------------------------------------------------
function mapGerencial(row: Record<string, unknown>) {
  return {
    grupo: pick(row, "Grupo"),
    tomador: pick(row, "Tomador"),
    segurado: pick(row, "Segurado"),
    documento: pick(row, "Documento"),
    ramo: pick(row, "Ramo"),
    seguradora: pick(row, "Seguradora"),
    numero_apolice: pick(row, "Numero Apolice", "Número Apólice", "Numero da Apolice"),
    data_emissao: excelDateToISO(pick(row, "Data Emissao", "Data Emissão")),
    inicio_vigencia: excelDateToISO(pick(row, "Inicio Vigencia", "Início Vigência")),
    fim_vigencia: excelDateToISO(pick(row, "Fim Vigencia", "Fim Vigência")),
    periodo_atualizacao: pick(row, "Periodo Atualizacao", "Período Atualização"),
    valor_is: num(pick(row, "Valor IS")),
    premio_total: num(pick(row, "Premio Total", "Prêmio Total")),
    percentual_comissao: num(pick(row, "Percentual Comissao", "Percentual Comissão", "% Comissao")),
    comissao_emitida: num(pick(row, "Comissao Emitida", "Comissão Emitida")),
    qtd_parcelas: num(pick(row, "Qtd Parcelas", "Quantidade Parcelas")),
    premio_parcela: num(pick(row, "Premio Parcela", "Prêmio Parcela")),
    comissao_bruta: num(pick(row, "Comissao Bruta", "Comissão Bruta")),
    imposto_ret: num(pick(row, "Imposto Ret", "Imposto Retido")),
    valor_iss: num(pick(row, "Valor ISS")),
    valor_recebido_a_receber: num(pick(row, "Valor Recebido A Receber", "Valor Recebido/A Receber")),
    numero_da_parcela: num(pick(row, "Numero da Parcela", "Número da Parcela")),
    tipo_pagamento: pick(row, "Tipo Pagamento"),
    empresa_faturada: pick(row, "Empresa Faturada"),
    data_pagamento: excelDateToISO(pick(row, "Data Pagamento")),
    mes: num(pick(row, "Mes", "Mês")),
    ano: num(pick(row, "Ano")),
    fat_competencia: pick(row, "Fat Competencia", "Fat Competência"),
    status_parcela_comissao: pick(row, "Status Parcela Comissao", "Status Parcela Comissão"),
    analise: pick(row, "Analise", "Análise"),
    possui_repasse: pick(row, "Possui Repasse"),
    percentual_repasse: num(pick(row, "Percentual Repasse", "% Repasse")),
    parcelas: pick(row, "Parcelas"),
    percentual_imposto: num(pick(row, "Percentual Imposto", "% Imposto")),
    valor_repasse_total: num(pick(row, "Valor Repasse Total")),
    data_repasse: excelDateToISO(pick(row, "Data Repasse")),
    status_repasse: pick(row, "Status Repasse"),
    observacao: pick(row, "Observacao", "Observação"),
    card_id: pick(row, "Card ID", "Card Id"),
    responsavel: pick(row, "Responsavel", "Responsável"),
    data_card_finalizado: excelDateToISO(pick(row, "Data Card Finalizado")),
  };
}

function mapRamo(row: Record<string, unknown>) {
  return { ramo: pick(row, "Ramo"), tipo_de_ramo: pick(row, "Tipo de Ramo", "Tipo Ramo") };
}

function mapCaixa(row: Record<string, unknown>) {
  return {
    tipo_lancamento: pick(row, "Tipo Lancamento", "Tipo Lançamento", "Tipo"),
    mes_referencia: pick(row, "Mes Referencia", "Mês Referência"),
    data_pagamento: excelDateToISO(pick(row, "Data Pagamento", "Data")),
    descricao: pick(row, "Descricao", "Descrição"),
    valor: num(pick(row, "Valor")),
    categoria: pick(row, "Categoria"),
    sub_categoria: pick(row, "Sub Categoria", "Subcategoria", "Sub-Categoria"),
    referencia: pick(row, "Referencia", "Referência"),
    observacoes: pick(row, "Observacoes", "Observações"),
    data_emissao_nota_fiscal: excelDateToISO(pick(row, "Data Emissao Nota Fiscal", "Data Emissão Nota Fiscal")),
  };
}

// --- page ------------------------------------------------------------------
function ImportarBasesPage() {
  const { data: perfil } = useMeuPerfil();
  const canGer = hasPermission(perfil, "menu_importar_gerencial");
  const canCx = hasPermission(perfil, "menu_importar_caixa");

  if (!canGer && !canCx) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-xl bg-white p-6 shadow-sm text-foreground">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#14405C]">Importação de Bases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada nova importação vira a versão atual — cargas anteriores ficam guardadas como histórico.
          </p>
        </header>

        <SharePointSyncCard />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {canGer && <GerencialCard />}
          {canCx && <CaixaCard />}
        </div>

        <HistoricoImportacoes />
      </div>
    </div>
  );
}

// Cron: a cada 6h em BRT (00, 06, 12, 18)
const SYNC_HOURS_BRT = [0, 6, 12, 18];

function getNextRunBRT(now = new Date()): Date {
  // BRT = UTC-3 (sem horário de verão desde 2019)
  const nowBRT = new Date(now.getTime() - 3 * 3600 * 1000);
  for (const h of SYNC_HOURS_BRT) {
    const cand = new Date(Date.UTC(
      nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate(), h, 0, 0
    ));
    if (cand.getTime() > nowBRT.getTime()) {
      return new Date(cand.getTime() + 3 * 3600 * 1000);
    }
  }
  const tomorrow = new Date(Date.UTC(
    nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate() + 1, SYNC_HOURS_BRT[0], 0, 0
  ));
  return new Date(tomorrow.getTime() + 3 * 3600 * 1000);
}

function formatDateTimeBR(d: Date) {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

function SharePointSyncCard() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState<null | "all" | "gerencial" | "caixa">(null);

  const nextRun = getNextRunBRT();
  const countdown = useCountdown(nextRun);

  const { data: recent } = useQuery({
    queryKey: ["lavoro-sync-log", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lavoro_sync_log")
        .select("id, origem, base, status, linhas_importadas, mensagem_erro, criado_em")
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const runSync = async (base: "all" | "gerencial" | "caixa") => {
    setSyncing(base);
    try {
      const { data, error } = await supabase.functions.invoke("sync-lavoro-bases", {
        body: { trigger: "manual", base },
      });
      if (error) throw error;
      toast.success("Sync iniciada", {
        description: "A execução roda em background. Acompanhe abaixo.",
      });
      qc.invalidateQueries({ queryKey: ["lavoro-sync-log"] });
      console.log("[sync-lavoro-bases] invoke response", data);
    } catch (e: any) {
      toast.error("Falha ao iniciar sync", { description: e?.message ?? String(e) });
    } finally {
      setSyncing(null);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "sucesso") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">Sucesso</Badge>;
    if (s === "erro") return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 border">Erro</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 border">Em execução</Badge>;
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-primary" />
              Sync automático SharePoint (Lavoro)
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Roda a cada 6 horas (00h, 06h, 12h e 18h — horário de Brasília) puxando Gerencial + Caixa Bradesco direto do SharePoint via Microsoft Graph. Upload manual abaixo continua como fallback.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-background/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Próxima rodada:</span>
            <span className="font-semibold">{formatDateTimeBR(nextRun)} BRT</span>
          </div>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-primary">em {countdown}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runSync("all")} disabled={syncing !== null} className="gap-2">
            {syncing === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Forçar sync completa
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSync("gerencial")} disabled={syncing !== null} className="gap-2">
            {syncing === "gerencial" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Só Gerencial
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSync("caixa")} disabled={syncing !== null} className="gap-2">
            {syncing === "caixa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Só Caixa Bradesco
          </Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Últimas execuções</p>
            <span className="text-[10px] text-muted-foreground">Atualiza a cada 15s</span>
          </div>
          <div className="overflow-hidden rounded-md border border-primary/15 bg-background/60">
            {!recent || recent.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma execução registrada ainda.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Quando</th>
                    <th className="px-3 py-1.5 text-left font-medium">Origem</th>
                    <th className="px-3 py-1.5 text-left font-medium">Base</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-right font-medium">Linhas</th>
                    <th className="px-3 py-1.5 text-left font-medium">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-primary/10">
                      <td className="px-3 py-1.5 font-mono">{formatDateTimeBR(new Date(r.criado_em as string))}</td>
                      <td className="px-3 py-1.5 capitalize">{r.origem}</td>
                      <td className="px-3 py-1.5 capitalize">{r.base}</td>
                      <td className="px-3 py-1.5">{statusBadge(r.status as string)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.linhas_importadas ?? "—"}</td>
                      <td className="px-3 py-1.5 max-w-[240px] truncate text-rose-600" title={r.mensagem_erro ?? ""}>{r.mensagem_erro ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


interface Preview<T> { rows: T[]; extras?: { label: string; value: string }[]; }

function ImportCardShell({
  title, description, tipo, children,
}: { title: string; description: string; tipo: "gerencial" | "caixa"; children: React.ReactNode }) {
  const { data: last } = useLastImport(tipo);
  const isToday = last ? new Date(last).toDateString() === new Date().toDateString() : false;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> {title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          {isToday ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">Importado hoje</Badge>
          ) : last ? (
            <Badge variant="outline">Última: {new Date(last).toLocaleDateString("pt-BR")}</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Ainda não importado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function GerencialCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ ger: ReturnType<typeof mapGerencial>[]; ramo: ReturnType<typeof mapRamo>[] } | null>(null);
  const [reading, setReading] = useState(false);

  const parse = async (f: File) => {
    setReading(true); setPreview(null);
    try {
      const [gerRaw, ramoRaw] = await Promise.all([
        readSheetByName(f, "Gerencial", 2),
        // aux Ramo: header on row 1 (no title row)
        readSheetByName(f, "aux Ramo", 1).catch(() => [] as Record<string, unknown>[]),
      ]);
      setPreview({
        ger: gerRaw.map(mapGerencial),
        ramo: ramoRaw.map(mapRamo).filter((r): r is { ramo: unknown; tipo_de_ramo: unknown } & { ramo: string; tipo_de_ramo: string } => Boolean(r.ramo && r.tipo_de_ramo)),
      });
    } catch (e) {
      toast.error("Erro ao ler planilha", { description: (e as Error).message });
    } finally { setReading(false); }
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Nenhuma prévia");
      const { data: userData } = await supabase.auth.getUser();
      const { data: logInicio, error: logErr } = await supabase
        .from("lavoro_sync_log")
        .insert({ base: "gerencial", origem: "manual", status: "iniciado", usuario_id: userData.user?.id ?? null })
        .select()
        .single();
      if (logErr) throw logErr;

      try {
        const { data: syncData, error: resetErr } = await supabase.rpc("rpc_admin_gerencial_reset");
        if (resetErr) throw resetErr;
        const syncId = syncData as unknown as string;

        const BATCH = 500;
        let totalGer = 0;
        for (let i = 0; i < preview.ger.length; i += BATCH) {
          const chunk = preview.ger.slice(i, i + BATCH);
          const { data: n, error } = await supabase.rpc("rpc_admin_gerencial_append", {
            _rows: chunk as unknown as never, _sync_id: syncId,
          });
          if (error) throw error;
          totalGer += (n as unknown as number) ?? 0;
        }

        let totalRamo = 0;
        for (let i = 0; i < preview.ramo.length; i += BATCH) {
          const chunk = preview.ramo.slice(i, i + BATCH);
          const { data: n, error } = await supabase.rpc("rpc_admin_ramo_append", {
            _rows: chunk as unknown as never, _sync_id: syncId,
          });
          if (error) throw error;
          totalRamo += (n as unknown as number) ?? 0;
        }

        await supabase.from("lavoro_sync_log").update({
          status: "sucesso", sync_id: syncId, linhas_importadas: totalGer,
        }).eq("id", logInicio.id);

        return { linhas_gerencial: totalGer, linhas_ramo: totalRamo };
      } catch (error) {
        await supabase.from("lavoro_sync_log").update({
          status: "erro", mensagem_erro: String((error as Error)?.message ?? error),
        }).eq("id", logInicio.id);
        throw error;
      }
    },
    onSuccess: (res) => {
      toast.success("Base Gerencial importada", { description: `${res.linhas_gerencial} linhas + ${res.linhas_ramo} de-para` });
      setFile(null); setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-last-import", "gerencial"] });
      qc.invalidateQueries({ queryKey: ["lavoro-sync-log"] });
    },
    onError: (e: Error) => {
      toast.error("Falha na importação", { description: e.message });
      qc.invalidateQueries({ queryKey: ["lavoro-sync-log"] });
    },
  });



  const totalPremio = preview?.ger.reduce((s, r) => s + (r.premio_total ?? 0), 0) ?? 0;
  const totalCom = preview?.ger.reduce((s, r) => s + (r.comissao_bruta ?? 0), 0) ?? 0;

  return (
    <ImportCardShell title="Base Gerencial" description='Lê aba "Gerencial" (linha 2 em diante) + "aux Ramo".' tipo="gerencial">
      <div className="space-y-3">
        <Input type="file" accept=".xlsx,.xls" onChange={(e) => {
          const f = e.target.files?.[0] ?? null; setFile(f); if (f) parse(f);
        }} />
        {reading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha...</div>}
        {preview && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Linhas Gerencial</span><span className="font-medium tabular-nums">{preview.ger.length.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Linhas aux Ramo</span><span className="font-medium tabular-nums">{preview.ramo.length.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Soma Prêmio Total</span><span className="font-medium tabular-nums">{BRL.format(totalPremio)}</span></div>
            <div className="flex justify-between"><span>Soma Comissão Bruta</span><span className="font-medium tabular-nums">{BRL.format(totalCom)}</span></div>
          </div>
        )}
        <Button
          className="w-full gap-2"
          disabled={!preview || importMut.isPending}
          onClick={() => importMut.mutate()}
        >
          {importMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar importação
        </Button>
        {file && <p className="text-xs text-muted-foreground">Arquivo: {file.name}</p>}
      </div>
    </ImportCardShell>
  );
}

function CaixaCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof mapCaixa>[] | null>(null);
  const [reading, setReading] = useState(false);

  const parse = async (f: File) => {
    setReading(true); setPreview(null);
    try {
      const rows = await readSheetByName(f, "Descrição Financeira (Caixa)", 2);
      setPreview(rows.map(mapCaixa));
    } catch (e) {
      toast.error("Erro ao ler planilha", { description: (e as Error).message });
    } finally { setReading(false); }
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Nenhuma prévia");
      const { data: userData } = await supabase.auth.getUser();
      const { data: logInicio, error: logErr } = await supabase
        .from("lavoro_sync_log")
        .insert({ base: "caixa", origem: "manual", status: "iniciado", usuario_id: userData.user?.id ?? null })
        .select()
        .single();
      if (logErr) throw logErr;

      try {
        const { data: syncData, error: resetErr } = await supabase.rpc("rpc_admin_caixa_reset");
        if (resetErr) throw resetErr;
        const syncId = syncData as unknown as string;

        const BATCH = 500;
        let total = 0;
        for (let i = 0; i < preview.length; i += BATCH) {
          const chunk = preview.slice(i, i + BATCH);
          const { data: n, error } = await supabase.rpc("rpc_admin_caixa_append", {
            _rows: chunk as unknown as never, _sync_id: syncId,
          });
          if (error) throw error;
          total += (n as unknown as number) ?? 0;
        }

        await supabase.from("lavoro_sync_log").update({
          status: "sucesso", sync_id: syncId, linhas_importadas: total,
        }).eq("id", logInicio.id);

        return { linhas: total };
      } catch (error) {
        await supabase.from("lavoro_sync_log").update({
          status: "erro", mensagem_erro: String((error as Error)?.message ?? error),
        }).eq("id", logInicio.id);
        throw error;
      }
    },
    onSuccess: (res) => {
      toast.success("Base Caixa importada", { description: `${res.linhas} linhas` });
      setFile(null); setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-last-import", "caixa"] });
      qc.invalidateQueries({ queryKey: ["lavoro-sync-log"] });
    },
    onError: (e: Error) => {
      toast.error("Falha na importação", { description: e.message });
      qc.invalidateQueries({ queryKey: ["lavoro-sync-log"] });
    },
  });



  const total = preview?.reduce((s, r) => s + (r.valor ?? 0), 0) ?? 0;

  return (
    <ImportCardShell title="Caixa Bradesco" description='Lê aba "Descrição Financeira (Caixa)" (linha 2 em diante).' tipo="caixa">
      <div className="space-y-3">
        <Input type="file" accept=".xlsx,.xls" onChange={(e) => {
          const f = e.target.files?.[0] ?? null; setFile(f); if (f) parse(f);
        }} />
        {reading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha...</div>}
        {preview && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Linhas</span><span className="font-medium tabular-nums">{preview.length.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Soma Valor</span><span className="font-medium tabular-nums">{BRL.format(total)}</span></div>
          </div>
        )}
        <Button
          className="w-full gap-2"
          disabled={!preview || importMut.isPending}
          onClick={() => importMut.mutate()}
        >
          {importMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Confirmar importação
        </Button>
        {file && <p className="text-xs text-muted-foreground">Arquivo: {file.name}</p>}
      </div>
    </ImportCardShell>
  );
}

interface SyncLogRow {
  id: number;
  sync_id: string | null;
  origem: string;
  base: string;
  status: string;
  linhas_importadas: number | null;
  mensagem_erro: string | null;
  criado_em: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sucesso")
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">Sucesso</Badge>;
  if (status === "erro")
    return <Badge className="bg-red-500/15 text-red-700 border-red-500/30 border">Erro</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Iniciado</Badge>;
}

function HistoricoImportacoes() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["lavoro-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lavoro_sync_log")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as SyncLogRow[];
    },
    refetchInterval: 5000,
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" /> Histórico de Importações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2">Data/Hora</th>
                  <th className="px-2 py-2">Base</th>
                  <th className="px-2 py-2">Origem</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Linhas</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const isErr = row.status === "erro" && row.mensagem_erro;
                  const isOpen = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-border/50 hover:bg-muted/30">

                        <td className="px-2 py-2">
                          {isErr ? (
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Ver mensagem de erro"
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {new Date(row.criado_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-2 py-2">
                          {row.base === "gerencial" ? "Gerencial" : "Caixa Bradesco"}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-xs">
                            {row.origem === "manual" ? "Manual" : "Automático"}
                          </Badge>
                        </td>
                        <td className="px-2 py-2"><StatusBadge status={row.status} /></td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {row.linhas_importadas != null ? row.linhas_importadas.toLocaleString("pt-BR") : "—"}
                        </td>
                      </tr>
                      {isErr && isOpen ? (
                        <tr className="border-b border-border/50 bg-red-500/5">
                          <td></td>
                          <td colSpan={5} className="px-2 py-2 text-xs text-red-700 whitespace-pre-wrap break-words">
                            {row.mensagem_erro}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>

                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
