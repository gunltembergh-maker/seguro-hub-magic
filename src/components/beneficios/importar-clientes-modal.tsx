import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReferencia } from "@/hooks/use-beneficios";

type Linha = {
  nome: string;
  documento: string;
  seguradora: string;
  canal: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  vidas: string;
  premio: string;
  apolice: string;
  problemas: string[];
};

const norm = (v: unknown) => String(v ?? "").trim();
const soDigitos = (v: string) => v.replace(/\D/g, "");

function paraISO(v: unknown): string {
  const s = norm(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) as unknown as number);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  return "";
}

function pick(row: Record<string, unknown>, ...chaves: string[]): string {
  for (const k of Object.keys(row)) {
    const kk = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (chaves.some((c) => kk.includes(c))) return norm(row[k]);
  }
  return "";
}

export function ImportarClientesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [passo, setPasso] = useState(1);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);
  const seguradoras = useReferencia("seguradoras");
  const canais = useReferencia("canais");
  const qc = useQueryClient();

  const reset = () => { setPasso(1); setLinhas([]); };

  const lerArquivo = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    const nomesSeg = new Set((seguradoras.data ?? []).map((s) => s.nome.toLowerCase()));

    const parsed: Linha[] = rows.map((r) => {
      const nome = pick(r, "cliente", "razao", "nome");
      const documento = soDigitos(pick(r, "cnpj", "cpf", "documento"));
      const seguradora = pick(r, "seguradora", "operadora");
      const canal = pick(r, "canal");
      const vigencia_inicio = paraISO(pick(r, "inicio"));
      const vigencia_fim = paraISO(pick(r, "fim", "vigencia"));
      const problemas: string[] = [];
      if (!nome) problemas.push("sem nome");
      if (!documento) problemas.push("sem CPF/CNPJ");
      if (seguradora && !nomesSeg.has(seguradora.toLowerCase())) problemas.push("seguradora nova");
      if (!vigencia_fim) problemas.push("sem vigência fim");
      return {
        nome, documento, seguradora, canal,
        vigencia_inicio, vigencia_fim,
        vidas: pick(r, "vidas"),
        premio: pick(r, "premio"),
        apolice: pick(r, "apolice"),
        problemas,
      };
    });

    setLinhas(parsed);
    setPasso(2);
  };

  const unicos = new Map(linhas.filter((l) => l.documento).map((l) => [l.documento, l]));
  const semDoc = linhas.filter((l) => !l.documento).length;
  const segNovas = new Set(
    linhas.filter((l) => l.problemas.includes("seguradora nova")).map((l) => l.seguradora),
  );

  const confirmar = async () => {
    setSalvando(true);
    try {
      const canalPadrao = (canais.data ?? []).find((c) => c.nome === "Lavoro") ?? (canais.data ?? [])[0];
      if (!canalPadrao) throw new Error("Cadastre ao menos um canal antes de importar.");

      // 1. seguradoras novas
      for (const nome of segNovas) {
        if (!nome) continue;
        await supabase.from("seguradoras").insert({ nome });
      }
      const { data: segs } = await supabase.from("seguradoras").select("id, nome");
      const mapaSeg = new Map((segs ?? []).map((s) => [s.nome.toLowerCase(), s.id]));
      const mapaCanal = new Map((canais.data ?? []).map((c) => [c.nome.toLowerCase(), c.id]));

      // 2. clientes
      const validos = [...unicos.values()].filter((l) => l.nome);
      for (const l of validos) {
        const canal_id = mapaCanal.get(l.canal.toLowerCase()) ?? canalPadrao.id;
        const { data: existente } = await supabase
          .from("clientes").select("id").eq("cpf_cnpj", l.documento).maybeSingle();
        let clienteId = existente?.id;
        if (!clienteId) {
          const { data, error } = await supabase
            .from("clientes")
            .insert({
              tipo_pessoa: l.documento.length === 11 ? "PF" : "PJ",
              nome_razao_social: l.nome,
              cpf_cnpj: l.documento,
              canal_id,
            })
            .select("id").single();
          if (error) throw error;
          clienteId = data.id;
        }
        const seguradora_id = mapaSeg.get(l.seguradora.toLowerCase());
        if (seguradora_id && l.vigencia_fim) {
          await supabase.from("contratos").insert({
            cliente_id: clienteId,
            seguradora_id,
            canal_id,
            numero_apolice: l.apolice || null,
            quantidade_vidas: l.vidas ? Number(soDigitos(l.vidas)) : null,
            premio_atual: l.premio ? Number(l.premio.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) : null,
            data_inicio_vigencia: l.vigencia_inicio || l.vigencia_fim,
            data_fim_vigencia: l.vigencia_fim,
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["beneficios"] });
      toast.success(`${validos.length} clientes importados.`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl" style={{ color: "#14405C" }}>
            Importar clientes e contratos em massa
          </DialogTitle>
          <DialogDescription>
            Passo {passo} de 3 — {passo === 1 ? "envio da planilha" : passo === 2 ? "prévia e validação" : "confirmação"}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex gap-2">
          {[1, 2, 3].map((p) => (
            <div key={p} className="h-1.5 flex-1 rounded-full" style={{ background: p <= passo ? "#00BAF2" : "#D9E1E8" }} />
          ))}
        </div>

        {passo === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Envie a planilha (.xlsx ou .csv) com colunas de cliente, CNPJ/CPF, seguradora, canal, vigência,
              vidas, prêmio e apólice. Cabeçalhos são reconhecidos automaticamente.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); }}
            />
          </div>
        )}

        {passo >= 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi valor={linhas.length} label="linhas no arquivo" />
              <Kpi valor={unicos.size} label="clientes únicos identificados" cor="#1E7F4F" />
              <Kpi valor={semDoc} label="sem CPF/CNPJ — revisar" cor="#D98418" />
              <Kpi valor={segNovas.size} label="seguradoras novas, confirmar nome" cor="#D98418" />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="p-3 text-left">Cliente</th>
                    <th className="p-3 text-left">Documento</th>
                    <th className="p-3 text-left">Seguradora atual</th>
                    <th className="p-3 text-left">Vigência fim</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 8).map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-3 font-semibold" style={{ color: "#14405C" }}>{l.nome || "—"}</td>
                      <td className="p-3 text-gray-500">{l.documento || "—"}</td>
                      <td className="p-3">{l.seguradora || "—"}</td>
                      <td className="p-3">{l.vigencia_fim || "—"}</td>
                      <td className="p-3 font-semibold" style={{ color: l.problemas.length ? "#D98418" : "#1E7F4F" }}>
                        {l.problemas.length ? "Revisar" : "Pronto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {passo >= 2 && <Button variant="outline" onClick={() => setPasso(1)}>Voltar</Button>}
          {passo === 2 && (
            <Button onClick={() => setPasso(3)} style={{ background: "#00BAF2" }} className="text-white">
              Revisar e confirmar
            </Button>
          )}
          {passo === 3 && (
            <Button onClick={confirmar} disabled={salvando} style={{ background: "#00BAF2" }} className="text-white">
              {salvando ? "Importando…" : "Confirmar importação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ valor, label, cor = "#14405C" }: { valor: number; label: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="font-display text-2xl font-bold" style={{ color: cor }}>{valor}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
