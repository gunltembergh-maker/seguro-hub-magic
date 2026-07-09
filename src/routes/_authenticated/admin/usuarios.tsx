import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert, Pencil, UserCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { useAdminUsers, usePerfis, type AdminUser } from "@/hooks/use-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuariosPage,
});

function StatusBadge({ u }: { u: AdminUser }) {
  if (u.blocked) return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 border">Aguardando aprovação</Badge>;
  if (!u.active) return <Badge className="bg-muted text-muted-foreground border border-border">Inativo</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">Ativo</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AdminUsuariosPage() {
  const { data: perfil } = useMeuPerfil();
  const { data: users, isLoading } = useAdminUsers();
  const { data: perfis } = usePerfis();
  const qc = useQueryClient();

  const [approving, setApproving] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  if (!hasRole(perfil, "ADMIN")) {
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprove novos colaboradores, gerencie perfis de acesso e status de cada usuário.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Colaboradores ({users?.length ?? 0})</CardTitle></CardHeader>
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
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.perfil_nome ?? <span className="text-muted-foreground italic">sem perfil</span>}</TableCell>
                      <TableCell><StatusBadge u={u} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(u.ultimo_acesso)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {u.blocked && (
                            <Button size="sm" onClick={() => setApproving(u)} className="gap-1.5">
                              <UserCheck className="h-3.5 w-3.5" /> Aprovar
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setEditing(u)} className="gap-1.5">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!users?.length && (
                    <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {approving && (
        <ApproveDialog
          user={approving}
          perfis={perfis ?? []}
          onClose={() => setApproving(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setApproving(null); }}
        />
      )}

      {editing && (
        <EditDialog
          user={editing}
          perfis={perfis ?? []}
          onClose={() => setEditing(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ApproveDialog({ user, perfis, onClose, onDone }: { user: AdminUser; perfis: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const [perfilId, setPerfilId] = useState<string>("");
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
                {perfis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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

function EditDialog({ user, perfis, onClose, onDone }: { user: AdminUser; perfis: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const [perfilId, setPerfilId] = useState<string>(user.perfil_id ?? "");
  const [blocked, setBlocked] = useState(user.blocked);
  const [active, setActive] = useState(user.active);
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rpc_admin_update_user", {
        _user_id: user.user_id, _perfil_id: perfilId || null, _blocked: blocked, _active: active,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário atualizado"); onDone(); },
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{user.full_name ?? user.email}</div>
            <div className="text-muted-foreground">{user.email}</div>
          </div>
          <div className="space-y-2">
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger><SelectValue placeholder="Sem perfil" /></SelectTrigger>
              <SelectContent>
                {perfis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><div className="text-sm font-medium">Ativo</div><div className="text-xs text-muted-foreground">Usuário pode entrar no Hub</div></div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div><div className="text-sm font-medium">Bloqueado</div><div className="text-xs text-muted-foreground">Marca como aguardando aprovação</div></div>
            <Switch checked={blocked} onCheckedChange={setBlocked} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
