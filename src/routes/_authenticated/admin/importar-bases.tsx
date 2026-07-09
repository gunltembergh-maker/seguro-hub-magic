import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, ShieldAlert } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole, hasPermission } from "@/hooks/use-meu-perfil";
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
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Importação de Bases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada nova importação substitui completamente a base anterior. Confira contagem e soma antes de confirmar.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {canGer && <GerencialCard />}
        {canCx && <CaixaCard />}
      </div>
    </div>
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
      return { linhas_gerencial: totalGer, linhas_ramo: totalRamo };
    },
    onSuccess: (res) => {
      toast.success("Base Gerencial importada", { description: `${res.linhas_gerencial} linhas + ${res.linhas_ramo} de-para` });
      setFile(null); setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-last-import", "gerencial"] });
    },
    onError: (e: Error) => toast.error("Falha na importação", { description: e.message }),
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
      return { linhas: total };
    },
    onSuccess: (res) => {
      toast.success("Base Caixa importada", { description: `${res.linhas} linhas` });
      setFile(null); setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-last-import", "caixa"] });
    },
    onError: (e: Error) => toast.error("Falha na importação", { description: e.message }),
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
