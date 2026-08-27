import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, ShieldAlert, Pencil, UserCheck, Users, UserX,
  Clock, ShieldOff, Search, Plus, Trash2, Activity, Lock, Unlock, Mail, Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { usePerfis } from "@/hooks/use-admin-data";
import {
  useAdminUsersV2, useConvitesExternos,
  type AdminUserV2, type ConviteExterno,
} from "@/hooks/use-admin-users-v2";
import { UserFormModal, type UserFormInitial } from "@/components/admin/UserFormModal";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { ImportUsuariosModal } from "@/components/admin/ImportUsuariosModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuariosPage,
});

const LAVORO_DOMAIN = "lavoroseguros.com.br";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatUltimoAcesso(iso: string | null) {
  if (!iso) return "Nunca acessou";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `Hoje às ${time}`;
  const yst = new Date(now); yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return `Ontem às ${time}`;
  return `${d.toLocaleDateString("pt-BR")} às ${time}`;
}

function StatusBadge({ u }: { u: AdminUserV2 }) {
  if (u.blocked) return <Badge className="border border-red-500/30 bg-red-500/10 text-red-700">🔒 Bloqueado</Badge>;
  if (!u.active) return <Badge className="border border-border bg-muted text-muted-foreground">⏸ Inativo</Badge>;
  if (u.primeiro_acesso) return <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-700">⏳ Nunca acessou</Badge>;
  return <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">✅ Ativo</Badge>;
}

const TIME_LABEL: Record<string, string> = {
  GARANTIA: "Garantia",
  BENEFICIOS: "Benefícios",
  DEMAIS_RAMOS: "Demais Ramos",
};

function TimesReceitaBadge({ times, roles }: { times?: string[] | null; roles?: string[] | null }) {
  if ((roles ?? []).includes("ADMIN")) return <Badge variant="outline">Admin (tudo)</Badge>;
  if ((times ?? []).includes("TODOS")) return <Badge variant="secondary">Vê tudo</Badge>;
  const list = (times ?? []).filter((t) => t in TIME_LABEL);
  if (list.length === 0) return <Badge variant="outline">Sem receita</Badge>;
  return <Badge variant="secondary">{list.map((t) => TIME_LABEL[t]).join(" + ")}</Badge>;
}


function TipoBadge({ u }: { u: AdminUserV2 }) {
  return u.tipo_usuario === "externo"
    ? <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-700">Externo</Badge>
    : <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700">Interno</Badge>;
}

function AdminUsuariosPage() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = hasRole(perfil, "ADMIN");

  const { data: users, isLoading } = useAdminUsersV2();
  const { data: perfis } = usePerfis();
  const { data: convites } = useConvitesExternos();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [perfilFilter, setPerfilFilter] = useState("Todos");

  const [approving, setApproving] = useState<AdminUserV2 | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUserV2 | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserV2 | null>(null);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<UserFormInitial | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
    qc.invalidateQueries({ queryKey: ["admin-convites-externos"] });
    qc.invalidateQueries({ queryKey: ["admin-detalhe-usuario"] });
  };

  const openCreate = () => { setFormInitial(null); setFormOpen(true); };
  const openEdit = (u: AdminUserV2) => {
    setFormInitial({
      isEdit: true,
      user_id: u.user_id,
      email: u.email,
      full_name: u.full_name,
      cpf: u.cpf ?? null,
      perfil_id: u.perfil_id,
      area: u.area ?? null,
      gestor: u.gestor ?? null,
      empresa: u.empresa ?? null,
      tipo_usuario: u.tipo_usuario,
      blocked: u.blocked,
      active: u.active,
      times_receita: u.times_receita ?? [],
    });
    setFormOpen(true);
  };



  const metrics = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      ativos: list.filter(u => !u.blocked && u.active && !u.primeiro_acesso).length,
      nuncaAcessou: list.filter(u => !u.blocked && u.active && u.primeiro_acesso).length,
      bloqueados: list.filter(u => u.blocked).length,
      externos: list.filter(u => u.tipo_usuario === "externo").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (users ?? []).filter(u => {
      const matchQ = !q || u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "Todos"
        || (statusFilter === "Ativo" && !u.blocked && u.active && !u.primeiro_acesso)
        || (statusFilter === "Nunca acessou" && !u.blocked && u.active && u.primeiro_acesso)
        || (statusFilter === "Bloqueado" && u.blocked)
        || (statusFilter === "Inativo" && !u.blocked && !u.active);
      const matchTipo = tipoFilter === "Todos" || u.tipo_usuario === tipoFilter.toLowerCase();
      const matchPerfil = perfilFilter === "Todos" || u.perfil_id === perfilFilter;
      return matchQ && matchStatus && matchTipo && matchPerfil;
    });
  }, [users, search, statusFilter, tipoFilter, perfilFilter]);

  const bloquearMut = useMutation({
    mutationFn: async ({ user, blocked }: { user: AdminUserV2; blocked: boolean }) => {
      const { error } = await supabase.rpc("rpc_admin_toggle_bloqueio" as never, {
        _user_id: user.user_id, _blocked: blocked,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_, vars) => { toast.success(vars.blocked ? "Usuário bloqueado" : "Usuário desbloqueado"); refresh(); },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const excluirMut = useMutation({
    mutationFn: async (user: AdminUserV2) => {
      const { error } = await supabase.rpc("rpc_admin_excluir_usuario" as never, {
        _user_id: user.user_id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário excluído"); setDeletingUser(null); refresh(); },
    onError: (e: Error) => toast.error("Falha ao excluir", { description: e.message }),
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta tela é restrita a administradores.</p>
      </div>
    );
  }

  const metricCards = [
    { label: "Total", value: metrics.total, icon: Users, tone: "text-primary" },
    { label: "Ativos", value: metrics.ativos, icon: UserCheck, tone: "text-emerald-600" },
    { label: "Nunca acessou", value: metrics.nuncaAcessou, icon: Clock, tone: "text-amber-600" },
    { label: "Bloqueados", value: metrics.bloqueados, icon: ShieldOff, tone: "text-red-600" },
    { label: "Externos", value: metrics.externos, icon: UserX, tone: "text-purple-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre, aprove, bloqueie, edite perfis e acompanhe a atividade de cada usuário do Hub Lavoro.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2 text-foreground hover:text-accent-foreground">
            <Upload className="h-4 w-4" /> Importar planilha
          </Button>
          <Button variant="outline" onClick={openCreate} className="gap-2 text-foreground hover:text-accent-foreground">
            <Plus className="h-4 w-4" /> Pré-cadastrar Usuário
          </Button>
          <Button onClick={() => setConvidarOpen(true)} className="gap-2">
            <Mail className="h-4 w-4" /> Convidar externo
          </Button>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map(m => (
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

      {(() => {
        const pendentes = (users ?? []).filter(u => u.blocked && !u.perfil_id);
        if (!pendentes.length) return null;
        return (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-800">
                <Clock className="h-4 w-4" /> Aguardando aprovação ({pendentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pendentes.map(u => (
                  <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-background p-2 text-sm">
                    <div>
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={() => setApproving(u)}>
                      <UserCheck className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })()}

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="convites">Convites externos ({convites?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Todos", "Ativo", "Nunca acessou", "Bloqueado", "Inativo"].map(s =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Todos", "Interno", "Externo"].map(s =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={perfilFilter} onValueChange={setPerfilFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os perfis</SelectItem>
                    {(perfis ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <CardTitle className="text-base">Colaboradores ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Time(s) Receita</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sessões</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(u => (
                        <TableRow key={u.user_id} className="cursor-pointer" onClick={() => setDetailUser(u)}>
                          <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell><TipoBadge u={u} /></TableCell>
                          <TableCell>{u.perfil_nome ?? <span className="italic text-muted-foreground">sem perfil</span>}</TableCell>
                          <TableCell><TimesReceitaBadge times={u.times_receita} roles={(u.roles ?? []) as string[]} /></TableCell>
                          <TableCell><StatusBadge u={u} /></TableCell>
                          <TableCell className="text-center tabular-nums">{u.total_sessoes}</TableCell>
                          <TableCell className="text-muted-foreground">{formatUltimoAcesso(u.ultimo_acesso)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => setDetailUser(u)}>
                                <Activity className="h-4 w-4" />
                              </Button>
                              {u.blocked && !u.perfil_id && (
                                <Button size="sm" onClick={() => setApproving(u)} className="gap-1.5">
                                  <UserCheck className="h-3.5 w-3.5" /> Aprovar
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                title={u.blocked ? "Desbloquear" : "Bloquear"}
                                onClick={() => bloquearMut.mutate({ user: u, blocked: !u.blocked })}
                                disabled={bloquearMut.isPending}
                              >
                                {u.blocked ? <Unlock className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-amber-600" />}
                              </Button>
                              <Button
                                size="sm" variant="ghost" title="Excluir"
                                onClick={() => setDeletingUser(u)}
                                disabled={u.user_id === perfil?.user_id}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!filtered.length && (
                        <TableRow><TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convites" className="mt-4">
          <ConvitesExternosTab convites={convites ?? []} onChanged={refresh} />
        </TabsContent>
      </Tabs>

      {approving && (
        <ApproveDialog user={approving} perfis={perfis ?? []} onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); refresh(); }} />
      )}

      <UserFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formInitial}
        onSaved={refresh}
      />

      <ImportUsuariosModal
        open={importOpen}
        onOpenChange={setImportOpen}
        emailsExistentes={(users ?? []).map((u) => u.email)}
        perfisExistentes={(perfis ?? []).map((p) => p.nome)}
        onDone={refresh}
      />

      <UserDetailSheet
        user={detailUser}
        open={!!detailUser}
        onOpenChange={(o) => !o && setDetailUser(null)}
        onEdit={(u) => { setDetailUser(null); openEdit(u); }}
        onDelete={(u) => { setDetailUser(null); setDeletingUser(u); }}
      />

      {convidarOpen && (
        <ConvidarExternoDialog perfis={perfis ?? []} onClose={() => setConvidarOpen(false)}
          onDone={() => { setConvidarOpen(false); refresh(); }} />
      )}

      {deletingUser && (
        <AlertDialog open onOpenChange={(o) => !o && setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Isto remove <strong>{deletingUser.full_name ?? deletingUser.email}</strong>, seus papéis e o histórico de sessões,
                e bane o login. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => excluirMut.mutate(deletingUser)} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ------------------- Dialogs -------------------

function ApproveDialog({ user, perfis, onClose, onDone }: { user: AdminUserV2; perfis: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const [perfilId, setPerfilId] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!perfilId) throw new Error("Selecione um perfil");
      const { error } = await supabase.rpc("rpc_admin_approve_user", { _user_id: user.user_id, _perfil_id: perfilId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário aprovado"); onDone(); },
    onError: (e: Error) => toast.error("Falha ao aprovar", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Aprovar usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{user.full_name ?? user.email}</div>
            <div className="text-muted-foreground">{user.email}</div>
          </div>
          <div className="space-y-2">
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
              <SelectContent>
                {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!perfilId || mut.isPending} className="gap-2">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvidarExternoDialog({ perfis, onClose, onDone }: { perfis: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(clean)) throw new Error("E-mail inválido");
      if (clean.endsWith(`@${LAVORO_DOMAIN}`)) throw new Error(`Use "Pré-cadastrar Usuário" para e-mails @${LAVORO_DOMAIN}`);
      if (!perfilId) throw new Error("Selecione um perfil");
      const { error } = await supabase.rpc("rpc_admin_convidar_externo" as never, {
        _email: clean, _perfil_id: perfilId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Convite externo criado"); onDone(); },
    onError: (e: Error) => toast.error("Falha ao convidar", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário externo</DialogTitle>
          <DialogDescription>
            E-mails fora do domínio <strong>@{LAVORO_DOMAIN}</strong> só entram se estiverem nesta lista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail externo</Label>
            <Input type="email" placeholder="parceiro@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
              <SelectContent>
                {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Convidar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvitesExternosTab({ convites, onChanged }: { convites: ConviteExterno[]; onChanged: () => void }) {
  const removerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rpc_admin_remover_convite_externo" as never, { _id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Convite removido"); onChanged(); },
    onError: (e: Error) => toast.error("Falha ao remover", { description: e.message }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">E-mails externos autorizados</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Aceito em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convites.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>{c.perfil_nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.criado_em)}</TableCell>
                  <TableCell>{c.aceito_em ? formatDate(c.aceito_em) : <span className="italic text-muted-foreground">pendente</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => removerMut.mutate(c.id)} disabled={removerMut.isPending}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!convites.length && (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Nenhum convite externo cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
