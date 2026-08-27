import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

import { adminImportarUsuarios, type ImportResultado } from "@/lib/admin-import-usuarios.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface LinhaImport {
  email: string;
  full_name: string;
  cpf: string | null;
  perfil: string;
  area: string | null;
  gestor: string | null;
  empresa: string | null;
  tipo_usuario: "interno" | "externo";
  times_receita: string[];
  active: boolean;
  blocked: boolean;
}

const ALIASES: Record<string, keyof LinhaImport> = {
  "email": "email", "e-mail": "email",
  "full_name": "full_name", "nome": "full_name", "nome completo": "full_name",
  "cpf": "cpf",
  "perfil": "perfil", "perfil de acesso": "perfil",
  "area": "area", "área": "area",
  "gestor": "gestor",
  "empresa": "empresa", "empresas atuante": "empresa",
  "tipo_usuario": "tipo_usuario", "tipo": "tipo_usuario",
  "times_receita": "times_receita", "time(s) de receita": "times_receita", "times de receita": "times_receita",
  "active": "active", "ativo": "active",
  "blocked": "blocked", "bloqueado": "blocked",
};

const norm = (v: unknown) => String(v ?? "").trim();
const bool = (v: unknown, def: boolean) => {
  const s = norm(v).toLowerCase();
  if (!s) return def;
  return ["sim", "true", "1", "yes", "s"].includes(s);
};

function parseSheet(buf: ArrayBuffer): LinhaImport[] {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: false });
  const headerIdx = matrix.findIndex((r) =>
    (r ?? []).some((c) => ["email", "e-mail"].includes(norm(c).toLowerCase())),
  );
  if (headerIdx < 0) throw new Error("Não encontrei a coluna 'email' na planilha.");

  const header = (matrix[headerIdx] ?? []).map((c) => ALIASES[norm(c).toLowerCase()]);
  const linhas: LinhaImport[] = [];

  for (const row of matrix.slice(headerIdx + 1)) {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => { if (key) obj[key] = norm((row ?? [])[i]); });
    if (!obj.email) continue;
    linhas.push({
      email: obj.email.toLowerCase(),
      full_name: obj.full_name ?? "",
      cpf: (obj.cpf ?? "").replace(/\D/g, "") || null,
      perfil: obj.perfil ?? "",
      area: obj.area || null,
      gestor: obj.gestor || null,
      empresa: obj.empresa || null,
      tipo_usuario: (obj.tipo_usuario ?? "").toLowerCase() === "externo" ? "externo" : "interno",
      times_receita: (obj.times_receita ?? "")
        .split(/[;,/]/)
        .map((t) => t.trim().toUpperCase().replace(/\s+/g, "_"))
        .filter((t) => ["TODOS", "GARANTIA", "BENEFICIOS", "DEMAIS_RAMOS"].includes(t)),
      active: bool(obj.active, true),
      blocked: bool(obj.blocked, false),
    });
  }
  return linhas;
}

export function ImportUsuariosModal({
  open, onOpenChange, emailsExistentes, perfisExistentes, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  emailsExistentes: string[];
  perfisExistentes: string[];
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [arquivo, setArquivo] = useState<string>("");
  const [resultados, setResultados] = useState<ImportResultado[] | null>(null);

  const importar = useServerFn(adminImportarUsuarios);
  const existentes = new Set(emailsExistentes.map((e) => e.toLowerCase()));
  const perfis = new Set(perfisExistentes.map((p) => p.trim().toLowerCase()));

  const statusDe = (l: LinhaImport) => {
    if (existentes.has(l.email)) return { label: "Já cadastrado — ignorado", tone: "muted" as const };
    if (!l.full_name) return { label: "Sem nome", tone: "erro" as const };
    if (!perfis.has(l.perfil.trim().toLowerCase())) return { label: `Perfil inexistente`, tone: "erro" as const };
    if (l.cpf && l.cpf.length !== 11) return { label: "CPF inválido", tone: "erro" as const };
    return { label: "Novo — será criado", tone: "ok" as const };
  };

  const novos = linhas.filter((l) => statusDe(l).tone === "ok");
  const comErro = linhas.filter((l) => statusDe(l).tone === "erro");

  const mut = useMutation({
    mutationFn: async () => importar({ data: { linhas: novos } }),
    onSuccess: (r) => {
      setResultados(r.resultados);
      const criados = r.resultados.filter((x) => x.status === "criado").length;
      toast.success(`${criados} usuário(s) criado(s)`);
      onDone();
    },
    onError: (e: Error) => toast.error("Falha na importação", { description: e.message }),
  });

  const reset = () => { setLinhas([]); setArquivo(""); setResultados(null); };

  const onFile = async (file: File) => {
    try {
      const parsed = parseSheet(await file.arrayBuffer());
      if (!parsed.length) throw new Error("Nenhuma linha com e-mail encontrada.");
      setLinhas(parsed);
      setArquivo(file.name);
      setResultados(null);
    } catch (e) {
      toast.error("Não consegui ler a planilha", { description: (e as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importar usuários (carga em massa)</DialogTitle>
          <DialogDescription>
            Envie a planilha (.xlsx/.csv). Quem já está cadastrado é ignorado — nenhum dado existente é alterado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }}
          />
          <Button variant="outline" className="gap-2" onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Escolher planilha
          </Button>
          {arquivo && <span className="text-sm text-muted-foreground">{arquivo}</span>}
        </div>

        {linhas.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{linhas.length} linhas</Badge>
            <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">{novos.length} novos</Badge>
            <Badge variant="outline">{linhas.length - novos.length - comErro.length} já cadastrados</Badge>
            {comErro.length > 0 && (
              <Badge className="border border-red-500/30 bg-red-500/10 text-red-700">{comErro.length} com problema</Badge>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          {linhas.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma planilha carregada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Times</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const s = statusDe(l);
                  const r = resultados?.find((x) => x.email === l.email);
                  return (
                    <TableRow key={l.email}>
                      <TableCell className="whitespace-nowrap">{l.full_name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.email}</TableCell>
                      <TableCell className="text-xs">{l.perfil || "—"}</TableCell>
                      <TableCell className="text-xs">{l.times_receita.join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r ? (
                          <Badge
                            className={
                              r.status === "criado"
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                : r.status === "erro"
                                  ? "border border-red-500/30 bg-red-500/10 text-red-700"
                                  : "border border-border bg-muted text-muted-foreground"
                            }
                          >
                            {r.status === "criado" ? "Criado" : r.status === "erro" ? r.detalhe : "Ignorado"}
                          </Badge>
                        ) : (
                          <Badge
                            className={
                              s.tone === "ok"
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                : s.tone === "erro"
                                  ? "border border-red-500/30 bg-red-500/10 text-red-700"
                                  : "border border-border bg-muted text-muted-foreground"
                            }
                          >
                            {s.label}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button
            className="gap-2"
            disabled={novos.length === 0 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {novos.length} usuário(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
