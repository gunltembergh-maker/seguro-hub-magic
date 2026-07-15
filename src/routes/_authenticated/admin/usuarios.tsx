import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, ShieldAlert, Pencil, UserCheck, Users, UserX,
  Clock, ShieldOff, Search, Plus, Trash2, Activity, Lock, Unlock, Mail,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { usePerfis } from "@/hooks/use-admin-data";
import {
  useAdminUsersV2, useConvitesExternos, useAtividadeUsuario,
  useSendAuthEmail, usePreCadastrarUsuario, useUpdateUserV2,
  type AdminUserV2, type ConviteExterno,
} from "@/hooks/use-admin-users-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const [editing, setEditing] = useState<AdminUserV2 | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUserV2 | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserV2 | null>(null);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [convidarInternoOpen, setConvidarInternoOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
    qc.invalidateQueries({ queryKey: ["admin-convites-externos"] });
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
          <Button variant="outline" onClick={() => setConvidarInternoOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo cadastro
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
                        <TableHead>Status</TableHead>
                        <TableHead>Sessões</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(u => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell><TipoBadge u={u} /></TableCell>
                          <TableCell>{u.perfil_nome ?? <span className="italic text-muted-foreground">sem perfil</span>}</TableCell>
                          <TableCell><StatusBadge u={u} /></TableCell>
                          <TableCell className="text-center tabular-nums">{u.total_sessoes}</TableCell>
                          <TableCell className="text-muted-foreground">{formatUltimoAcesso(u.ultimo_acesso)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Ver detalhes" onClick={() => setDetailUser(u)}>
                                <Activity className="h-4 w-4" />
                              </Button>
                              {u.blocked && !u.perfil_id && (
                                <Button size="sm" onClick={() => setApproving(u)} className="gap-1.5">
                                  <UserCheck className="h-3.5 w-3.5" /> Aprovar
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(u)}>
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
                        <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
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
      {editing && (
        <EditDialog user={editing} perfis={perfis ?? []} onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); refresh(); }} />
      )}
      {detailUser && (
        <UserDetailSheet user={detailUser} onClose={() => setDetailUser(null)} />
      )}
      {convidarOpen && (
        <ConvidarExternoDialog perfis={perfis ?? []} onClose={() => setConvidarOpen(false)}
          onDone={() => { setConvidarOpen(false); refresh(); }} />
      )}
      {convidarInternoOpen && (
        <NovoInternoDialog perfis={perfis ?? []} onClose={() => setConvidarInternoOpen(false)} />
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

function EditDialog({ user, perfis, onClose, onDone }: { user: AdminUserV2; perfis: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [perfilId, setPerfilId] = useState(user.perfil_id ?? "");
  const [blocked, setBlocked] = useState(user.blocked);
  const [active, setActive] = useState(user.active);
  const mut = useUpdateUserV2();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="text-muted-foreground">E-mail (não editável)</div>
            <div className="font-medium">{user.email}</div>
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do colaborador" />
          </div>
          <div className="space-y-2">
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Sem perfil" /></SelectTrigger>
              <SelectContent>
                {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><div className="text-sm font-medium">Ativo</div><div className="text-xs text-muted-foreground">Usuário pode entrar no Hub</div></div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><div className="text-sm font-medium">Bloqueado</div><div className="text-xs text-muted-foreground">Impede o login (bane no auth)</div></div>
            <Switch checked={blocked} onCheckedChange={setBlocked} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate(
              { user_id: user.user_id, full_name: fullName, perfil_id: perfilId || null, blocked, active },
              { onSuccess: () => onDone() },
            )}
            disabled={mut.isPending}
            className="gap-2"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
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
      if (clean.endsWith(`@${LAVORO_DOMAIN}`)) throw new Error(`Use "Novo cadastro" para e-mails @${LAVORO_DOMAIN}`);
      if (!perfilId) throw new Error("Selecione um perfil");
      const { error } = await supabase.rpc("rpc_admin_convidar_externo" as never, {
        _email: clean, _perfil_id: perfilId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Convite externo criado", { description: "O usuário poderá entrar via login e será aprovado automaticamente." }); onDone(); },
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
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Peça ao usuário para entrar no Hub. Ao fazer login pela primeira vez, ele será aprovado automaticamente com o perfil escolhido.
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

function NovoInternoDialog({ onClose, perfis }: { onClose: () => void; perfis: { id: string; nome: string }[] }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const preCad = usePreCadastrarUsuario();
  const send = useSendAuthEmail();

  const handleSave = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { toast.error("E-mail inválido"); return; }
    if (!clean.endsWith(`@${LAVORO_DOMAIN}`)) { toast.error(`Use "Convidar externo" para e-mails fora de @${LAVORO_DOMAIN}`); return; }
    if (!perfilId) { toast.error("Selecione um perfil"); return; }
    await preCad.mutateAsync({ email: clean, full_name: fullName, perfil_id: perfilId });
    if (sendInvite) {
      try { await send.mutateAsync({ email: clean, tipo: "invite" }); } catch { /* toast handled */ }
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pré-cadastrar colaborador interno</DialogTitle>
          <DialogDescription>
            Cadastre um e-mail <strong>@{LAVORO_DOMAIN}</strong> já com perfil definido. Opcionalmente envie o convite por e-mail agora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail Lavoro</Label>
            <Input type="email" placeholder={`nome@${LAVORO_DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do colaborador" />
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
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enviar convite agora</div>
              <div className="text-xs text-muted-foreground">Envia o e-mail do Supabase Auth para o colaborador definir a senha.</div>
            </div>
            <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={preCad.isPending || send.isPending} className="gap-2">
            {(preCad.isPending || send.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailSheet({ user, onClose }: { user: AdminUserV2; onClose: () => void }) {
  const sendEmail = useSendAuthEmail();
  const doSend = (tipo: "invite" | "magiclink" | "recovery") =>
    sendEmail.mutate({ user_id: user.user_id, email: user.email, tipo });

  const { data: atividades, isLoading } = useAtividadeUsuario(user.user_id);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.full_name ?? user.email}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Perfil</div>
              <div className="font-medium">{user.perfil_nome ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Tipo</div>
              <div className="font-medium capitalize">{user.tipo_usuario}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Cadastrado em</div>
              <div className="font-medium">{formatDate(user.criado_em)}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Último acesso</div>
              <div className="font-medium">{formatUltimoAcesso(user.ultimo_acesso)}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Sessões totais</div>
              <div className="font-medium tabular-nums">{user.total_sessoes}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Papéis</div>
              <div className="font-medium">{user.roles.join(", ") || "—"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Ações rápidas</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={sendEmail.isPending}
                onClick={() => doSend("invite")}>
                <Mail className="h-3.5 w-3.5" /> Enviar convite
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={sendEmail.isPending}
                onClick={() => doSend("magiclink")}>
                <Mail className="h-3.5 w-3.5" /> Magic link
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={sendEmail.isPending}
                onClick={() => doSend("recovery")}>
                <Mail className="h-3.5 w-3.5" /> Resetar senha
              </Button>
            </div>
          </div>


          <div>
            <h3 className="mb-2 text-sm font-semibold">Atividade recente</h3>
            {isLoading ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !atividades?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            ) : (
              <ul className="space-y-2">
                {atividades.map((a, i) => (
                  <li key={i} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{a.tipo === "sessao" ? "🔓 Sessão iniciada" : a.tipo}</span>
                      <span className="text-muted-foreground">{formatDate(a.momento)}</span>
                    </div>
                    {Object.keys(a.detalhes ?? {}).length > 0 && (
                      <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
                        {JSON.stringify(a.detalhes, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
