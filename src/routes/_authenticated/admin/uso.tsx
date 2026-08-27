import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ShieldAlert, Loader2, Activity, Clock, Users, MousePointerClick } from "lucide-react";

import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import {
  useUsoResumo, useUsoPaginas, useUsoDiario, useAuditoria, useUsoDetalhado,
  type UsoResumo, type AuditItem,
} from "@/hooks/use-uso-plataforma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";

export const Route = createFileRoute("/_authenticated/admin/uso")({
  component: ProtegidoAdminUsoPage,
  head: () => ({
    meta: [
      { title: "Relatório de uso por usuário — Hub Lavoro Seguros" },
      { name: "description", content: "Acompanhe diariamente o uso da plataforma por usuário e a auditoria de alterações administrativas." },
      { property: "og:title", content: "Relatório de uso por usuário — Hub Lavoro" },
      { property: "og:description", content: "Uso diário por usuário, páginas acessadas, tempo logado e auditoria administrativa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtDateTime = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
const fmtDate = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");

function baixarCsv(nome: string, linhas: (string | number | null)[][]) {
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${isoDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtDur = (seg: number) => {
  const s = Math.max(0, Math.round(seg));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

function AdminUsoPage() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = hasRole(perfil, "ADMIN");

  const hoje = new Date();
  const inicio = new Date(hoje.getTime() - 29 * 86_400_000);
  const [de, setDe] = useState(isoDate(inicio));
  const [ate, setAte] = useState(isoDate(hoje));
  const [userId, setUserId] = useState<string>("todos");

  const alvo = userId === "todos" ? null : userId;
  const resumo = useUsoResumo(de, ate);
  const paginas = useUsoPaginas(de, ate, alvo);
  const diario = useUsoDiario(de, ate, alvo);
  const auditoria = useAuditoria(de, ate);

  const [exportando, setExportando] = useState(false);
  const detalhado = useUsoDetalhado(de, ate, alvo, exportando);
  const jaExportou = useRef(false);

  const usuariosTodos = (resumo.data ?? []) as UsoResumo[];
  const usuarios = useMemo(
    () => (alvo ? usuariosTodos.filter((u) => u.user_id === alvo) : usuariosTodos),
    [usuariosTodos, alvo],
  );

  useEffect(() => {
    if (!exportando || !detalhado.data || jaExportou.current) return;
    jaExportou.current = true;
    baixarCsv("uso-detalhado-completo", [
      ["Usuário", "E-mail", "Perfil", "Dia", "Área (menu pai)", "Página filha", "Rota completa", "Título", "Entrada", "Saída/último sinal", "Permanência (s)", "Permanência"],
      ...detalhado.data.map((d) => [
        d.full_name, d.email, d.perfil_nome, fmtDate(d.dia), d.area, d.subpagina ?? "—",
        d.rota, d.titulo, fmtDateTime(d.entrou_em), fmtDateTime(d.ultimo_ping_em),
        d.duracao_seg, fmtDur(d.duracao_seg),
      ]),
    ]);
    setExportando(false);
    jaExportou.current = false;
  }, [exportando, detalhado.data]);

  const metrics = useMemo(() => {
    const rows = usuarios;
    const ativos = rows.filter((r) => r.total_paginas > 0);
    return {
      ativos: ativos.length,
      inativos: rows.length - ativos.length,
      paginas: rows.reduce((s, r) => s + r.total_paginas, 0),
      horas: Math.round(rows.reduce((s, r) => s + r.tempo_total_min, 0) / 6) / 10,
    };
  }, [usuarios]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta tela é restrita a administradores.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Relatório de Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o comportamento diário de cada usuário: onde acessou, quantas vezes, horários e tempo de permanência.
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Usuário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {usuariosTodos.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="default"
            className="gap-2"
            disabled={exportando}
            onClick={() => setExportando(true)}
          >
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar relatório completo
          </Button>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Usuários ativos no período", value: metrics.ativos, icon: Users, tone: "text-emerald-600" },
          { label: "Sem nenhum acesso", value: metrics.inativos, icon: Clock, tone: "text-amber-600" },
          { label: "Páginas abertas", value: metrics.paginas, icon: MousePointerClick, tone: "text-primary" },
          { label: "Horas de permanência", value: metrics.horas, icon: Activity, tone: "text-cyan-600" },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="flex items-center gap-3 py-4">
              <m.icon className={`h-5 w-5 ${m.tone}`} />
              <div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-xl font-semibold">{m.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Por usuário</TabsTrigger>
          <TabsTrigger value="paginas">Por página</TabsTrigger>
          <TabsTrigger value="diario">Dia a dia</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria admin</TabsTrigger>
        </TabsList>

        {/* ---- Resumo por usuário ---- */}
        <TabsContent value="resumo" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Comportamento por usuário</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 text-foreground hover:text-accent-foreground"
                onClick={() => baixarCsv("uso-por-usuario", [
                  ["Usuário", "E-mail", "Perfil", "Dias ativos", "Sessões", "Páginas", "Tempo (min)", "Primeiro acesso", "Último acesso", "Dias sem acessar", "Página mais usada"],
                  ...usuarios.map((u) => [u.full_name, u.email, u.perfil_nome, u.dias_ativos, u.sessoes, u.total_paginas, u.tempo_total_min, fmtDateTime(u.primeiro_acesso), fmtDateTime(u.ultimo_acesso), u.dias_sem_acessar, u.top_rota]),
                ])}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {resumo.isLoading ? <Carregando /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead className="text-center">Dias ativos</TableHead>
                        <TableHead className="text-center">Sessões</TableHead>
                        <TableHead className="text-center">Páginas</TableHead>
                        <TableHead className="text-center">Tempo (min)</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="text-center">Dias sem acessar</TableHead>
                        <TableHead>Onde mais acessa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuarios.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell>
                            <div className="font-medium">{u.full_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell className="text-sm">{u.perfil_nome ?? "—"}</TableCell>
                          <TableCell className="text-center tabular-nums">{u.dias_ativos}</TableCell>
                          <TableCell className="text-center tabular-nums">{u.sessoes}</TableCell>
                          <TableCell className="text-center tabular-nums">{u.total_paginas}</TableCell>
                          <TableCell className="text-center tabular-nums">{u.tempo_total_min}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDateTime(u.ultimo_acesso)}</TableCell>
                          <TableCell className="text-center">
                            {u.dias_sem_acessar === null ? (
                              <Badge variant="outline">nunca acessou</Badge>
                            ) : u.dias_sem_acessar >= 7 ? (
                              <Badge variant="destructive">{u.dias_sem_acessar}</Badge>
                            ) : (
                              <span className="tabular-nums">{u.dias_sem_acessar}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.top_rota ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Por página ---- */}
        <TabsContent value="paginas" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Páginas acessadas</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 text-foreground hover:text-accent-foreground"
                onClick={() => baixarCsv("uso-por-pagina", [
                  ["Usuário", "E-mail", "Rota", "Título", "Acessos", "Dias com acesso", "Tempo total (min)", "Permanência mínima", "Permanência média", "Permanência máxima", "Primeiro acesso", "Último acesso"],
                  ...(paginas.data ?? []).map((p) => [p.full_name, p.email, p.rota, p.titulo, p.acessos, p.dias, p.tempo_min, fmtDur(p.tempo_min_seg), fmtDur(p.tempo_medio_seg), fmtDur(p.tempo_max_seg), fmtDateTime(p.primeiro_em), fmtDateTime(p.ultimo_em)]),
                ])}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {paginas.isLoading ? <Carregando /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Página</TableHead>
                        <TableHead className="text-center">Acessos</TableHead>
                        <TableHead className="text-center">Dias</TableHead>
                        <TableHead className="text-center">Tempo (min)</TableHead>
                        <TableHead className="text-center">Mín.</TableHead>
                        <TableHead className="text-center">Média</TableHead>
                        <TableHead className="text-center">Máx.</TableHead>
                        <TableHead>Último acesso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paginas.data ?? []).map((p, i) => (
                        <TableRow key={`${p.user_id}-${p.rota}-${i}`}>
                          <TableCell>
                            <div className="font-medium">{p.full_name ?? p.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{p.rota}</div>
                            {p.titulo && <div className="text-xs text-muted-foreground">{p.titulo}</div>}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{p.acessos}</TableCell>
                          <TableCell className="text-center tabular-nums">{p.dias}</TableCell>
                          <TableCell className="text-center tabular-nums">{p.tempo_min}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{fmtDur(p.tempo_min_seg)}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{fmtDur(p.tempo_medio_seg)}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{fmtDur(p.tempo_max_seg)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDateTime(p.ultimo_em)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Dia a dia ---- */}
        <TabsContent value="diario" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Detalhamento diário</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 text-foreground hover:text-accent-foreground"
                onClick={() => baixarCsv("uso-diario", [
                  ["Dia", "Usuário", "E-mail", "Páginas", "Tempo (min)", "Primeiro acesso", "Último acesso", "Rotas"],
                  ...(diario.data ?? []).map((d) => [fmtDate(d.dia), d.full_name, d.email, d.paginas, d.tempo_min, fmtDateTime(d.primeiro_em), fmtDateTime(d.ultimo_em), d.rotas.join(" | ")]),
                ])}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {diario.isLoading ? <Carregando /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dia</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-center">Páginas</TableHead>
                        <TableHead className="text-center">Tempo (min)</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Saída</TableHead>
                        <TableHead>Rotas visitadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(diario.data ?? []).map((d, i) => (
                        <TableRow key={`${d.dia}-${d.user_id}-${i}`}>
                          <TableCell className="whitespace-nowrap">{fmtDate(d.dia)}</TableCell>
                          <TableCell className="font-medium">{d.full_name ?? d.email}</TableCell>
                          <TableCell className="text-center tabular-nums">{d.paginas}</TableCell>
                          <TableCell className="text-center tabular-nums">{d.tempo_min}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDateTime(d.primeiro_em)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDateTime(d.ultimo_em)}</TableCell>
                          <TableCell className="max-w-md text-xs text-muted-foreground">{d.rotas.join(", ")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Auditoria ---- */}
        <TabsContent value="auditoria" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Alterações administrativas</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Toda criação, alteração ou exclusão de usuário e de perfil é registrada aqui e notificada por e-mail na hora.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 text-foreground hover:text-accent-foreground"
                onClick={() => baixarCsv("auditoria-admin", [
                  ["Data/hora", "Administrador", "Ação", "Entidade", "Alvo", "Alterações", "Notificado em"],
                  ...(auditoria.data ?? []).map((a) => [
                    fmtDateTime(a.created_at),
                    a.ator_email ? `${a.ator_nome ?? ""} <${a.ator_email}>` : "sistema",
                    a.acao, a.entidade, a.alvo_descricao, descreveMudancas(a), fmtDateTime(a.notificado_em),
                  ]),
                ])}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {auditoria.isLoading ? <Carregando /> : (
                <div className="space-y-3">
                  {(auditoria.data ?? []).map((a) => (
                    <div key={a.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {rotuloAcao(a.acao)} · {rotuloEntidade(a.entidade)} — {a.alvo_descricao ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Administrador: {a.ator_email ? `${a.ator_nome ?? "—"} (${a.ator_email})` : "sistema / processo automático"}
                        {a.notificado_em ? " · e-mail enviado" : a.notificacao_erro ? ` · falha no e-mail: ${a.notificacao_erro}` : " · e-mail pendente"}
                      </div>
                      {a.mudancas && Object.keys(a.mudancas).length > 0 && (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="py-1 text-left">Campo</th>
                                <th className="py-1 text-left">Antes</th>
                                <th className="py-1 text-left">Depois</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(a.mudancas).map(([campo, v]) => (
                                <tr key={campo} className="border-t border-border/60">
                                  <td className="py-1 pr-3">{campo}</td>
                                  <td className="py-1 pr-3 text-muted-foreground">{valor(v?.antes)}</td>
                                  <td className="py-1 font-medium">{valor(v?.depois)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                  {(auditoria.data ?? []).length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma alteração no período.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Carregando() {
  return (
    <div className="grid place-items-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function valor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v) || "—";
}

function rotuloAcao(a: string) {
  return { INSERT: "Criação", UPDATE: "Alteração", DELETE: "Exclusão" }[a] ?? a;
}

function rotuloEntidade(e: string) {
  return { profiles: "Usuário", user_roles: "Papel de usuário", perfis_acesso: "Perfil de acesso" }[e] ?? e;
}

function descreveMudancas(a: AuditItem): string {
  if (!a.mudancas) return "";
  return Object.entries(a.mudancas)
    .map(([campo, v]) => `${campo}: ${valor(v?.antes)} -> ${valor(v?.depois)}`)
    .join(" | ");
}

function ProtegidoAdminUsoPage() {
  return (
    <SuperAdminGate area="uso" titulo="O Relatório de Uso">
      <AdminUsoPage />
    </SuperAdminGate>
  );
}
