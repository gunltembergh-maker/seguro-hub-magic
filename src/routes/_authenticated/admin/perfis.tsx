import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ShieldAlert, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { usePerfis, PERMISSION_KEYS, PERMISSION_GROUPS, type PerfilAcesso } from "@/hooks/use-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/perfis")({
  component: AdminPerfisPage,
});

const PROTECTED_NAMES = ["Admin", "Diretoria Geral"];

function AdminPerfisPage() {
  const { data: perfil } = useMeuPerfil();
  const { data: perfis, isLoading } = usePerfis();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PerfilAcesso | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PerfilAcesso | null>(null);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rpc_admin_delete_perfil", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfil removido"); qc.invalidateQueries({ queryKey: ["admin-perfis"] }); setDeleting(null); },
    onError: (e: Error) => toast.error("Falha ao remover", { description: e.message }),
  });

  if (!hasRole(perfil, "ADMIN")) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Perfis de Acesso</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie perfis e permissões por módulo.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="h-4 w-4" /> Novo perfil</Button>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(perfis ?? []).map((p) => {
            const isProtected = PROTECTED_NAMES.includes(p.nome);
            const activeCount = Object.values(p.permissoes).filter(Boolean).length;
            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {isProtected && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        {p.nome}
                      </CardTitle>
                      {p.descricao && <p className="mt-1 text-xs text-muted-foreground">{p.descricao}</p>}
                    </div>
                    <Badge variant="outline">{activeCount}/{PERMISSION_KEYS.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {PERMISSION_GROUPS.map((g) => (
                      <div key={g.title}>
                        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h4>
                        <ul className="space-y-0.5 text-xs">
                          {g.items.map((it) => (
                            <li
                              key={it.key}
                              className={
                                (it.child ? "pl-3 " : "") +
                                (p.permissoes[it.key]
                                  ? "text-foreground"
                                  : "text-muted-foreground/60 line-through")
                              }
                            >
                              {it.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(p)} disabled={isProtected}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <PerfilDialog
          perfil={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onDone={() => { qc.invalidateQueries({ queryKey: ["admin-perfis"] }); setEditing(null); setCreating(false); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Usuários com este perfil ficarão sem perfil atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && delMut.mutate(deleting.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PerfilDialog({ perfil, onClose, onDone }: { perfil: PerfilAcesso | null; onClose: () => void; onDone: () => void }) {
  const [nome, setNome] = useState<string>(perfil?.nome ?? "");
  const [descricao, setDescricao] = useState<string>(perfil?.descricao ?? "");
  const [perms, setPerms] = useState<Record<string, boolean>>(perfil?.permissoes ?? {});
  const isProtected = perfil && PROTECTED_NAMES.includes(perfil.nome);

  const mut = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome do perfil");
      const { error } = await supabase.rpc("rpc_admin_upsert_perfil", {
        _id: perfil?.id ?? null, _nome: nome.trim(), _descricao: descricao.trim() || null, _permissoes: perms,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(perfil ? "Perfil atualizado" : "Perfil criado"); onDone(); },
    onError: (e: Error) => toast.error("Falha ao salvar", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{perfil ? "Editar perfil" : "Novo perfil"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={!!isProtected} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Permissões</Label>
            <p className="text-xs text-muted-foreground">
              Novos itens (pai ou filho) aparecem aqui automaticamente, sempre desabilitados. Habilite conforme o perfil.
            </p>
            <div className="max-h-[50vh] space-y-5 overflow-y-auto rounded-lg border border-border p-3">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.title} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h4>
                  <div className="space-y-2">
                    {g.items.map((it) => (
                      <div
                        key={it.key}
                        className={"flex items-center justify-between gap-3 " + (it.child ? "pl-4" : "")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm">{it.label}</div>
                          {it.desc && <p className="truncate text-xs text-muted-foreground">{it.desc}</p>}
                        </div>
                        <Switch
                          checked={!!perms[it.key]}
                          onCheckedChange={(v) => setPerms((p) => ({ ...p, [it.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
