import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, ClipboardList, History, Activity, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useSendAuthEmail, useAtividadeUsuario, type AdminUserV2 } from "@/hooks/use-admin-users-v2";

function formatDT(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCpf(cpf: string | null | undefined) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function parseUA(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

function StatusBadge({ blocked, active, primeiro_acesso }: { blocked: boolean; active: boolean; primeiro_acesso: boolean }) {
  if (blocked) return <Badge className="border border-red-500/30 bg-red-500/10 text-red-700">Bloqueado</Badge>;
  if (!active) return <Badge className="border bg-muted text-muted-foreground">Inativo</Badge>;
  if (primeiro_acesso) return <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-700">Nunca acessou</Badge>;
  return <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">Ativo</Badge>;
}

interface Props {
  user: AdminUserV2 | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (u: AdminUserV2) => void;
  onBlock?: (u: AdminUserV2) => void;
  onDelete?: (u: AdminUserV2) => void;
}

export function UserDetailSheet({ user, open, onOpenChange, onEdit, onBlock, onDelete }: Props) {
  const qc = useQueryClient();
  const sendEmail = useSendAuthEmail();

  const { data: detalhe } = useQuery({
    queryKey: ["admin-detalhe-usuario", user?.user_id],
    enabled: open && !!user?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_detalhe_usuario" as never, { _user_id: user!.user_id } as never);
      if (error) throw error;
      return data as { perfil: Record<string, unknown>; total_sessoes: number; total_atividades: number };
    },
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["admin-sessoes", user?.user_id],
    enabled: open && !!user?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sessions_log")
        .select("id, iniciado_em, ip, user_agent")
        .eq("user_id", user!.user_id)
        .order("iniciado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atividades, isLoading: loadingAtividades } = useAtividadeUsuario(open ? user?.user_id ?? null : null);

  const bloquearMut = useMutation({
    mutationFn: async (blocked: boolean) => {
      const { error } = await supabase.rpc("rpc_admin_toggle_bloqueio" as never, {
        _user_id: user!.user_id, _blocked: blocked,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-users-v2"] }); },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  if (!user) return null;

  const perfil = (detalhe?.perfil ?? {}) as Record<string, unknown>;
  const cpf = (perfil.cpf as string) ?? null;
  const empresa = (perfil.empresa as string) ?? user.tipo_usuario === "externo" ? "" : "Lavoro Seguros";
  const area = (perfil.area as string) ?? null;
  const gestor = (perfil.gestor as string) ?? null;
  const criadoEm = (perfil.created_at as string) ?? user.criado_em;
  const perfilNome = (perfil.perfil_nome as string) ?? user.perfil_nome;

  const send = (tipo: "invite" | "magiclink" | "recovery") =>
    sendEmail.mutate({ user_id: user.user_id, email: user.email, tipo });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-6 pb-0">
          <SheetHeader>
            <SheetTitle className="text-xl">{user.full_name ?? user.email}</SheetTitle>
            <SheetDescription>Histórico completo do usuário</SheetDescription>
          </SheetHeader>
        </div>

        <Tabs defaultValue="perfil" className="mt-4">
          <div className="px-6">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="perfil" className="text-xs gap-1"><User className="h-3.5 w-3.5" /> Perfil</TabsTrigger>
              <TabsTrigger value="convites" className="text-xs gap-1"><ClipboardList className="h-3.5 w-3.5" /> Convites</TabsTrigger>
              <TabsTrigger value="sessoes" className="text-xs gap-1"><History className="h-3.5 w-3.5" /> Sessões</TabsTrigger>
              <TabsTrigger value="atividade" className="text-xs gap-1"><Activity className="h-3.5 w-3.5" /> Atividade</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="perfil" className="px-6 pb-6 mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="E-mail" value={user.email} />
              <Field label="CPF" mono value={formatCpf(cpf)} />
              <Field label="Perfil" value={perfilNome ?? "—"} />
              <Field label="Financial Advisor/Finder" value="-" />
              <Field label="Área" value={area ?? "-"} />
              <Field label="Gestor" value={gestor ?? "-"} />
              <Field label="Empresa" value={empresa || "-"} />
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <StatusBadge blocked={user.blocked} active={user.active} primeiro_acesso={user.primeiro_acesso} />
              </div>
              <Field label="Cadastrado em" value={formatDate(criadoEm)} />
              <Field label="Último Acesso" value={user.ultimo_acesso ? formatDT(user.ultimo_acesso) : "Nunca"} />
              <Field label="Total de Sessões" value={String(detalhe?.total_sessoes ?? user.total_sessoes ?? 0)} />
              <Field label="Convite enviado" value={user.convite_enviado_em ? formatDT(user.convite_enviado_em) : "Não enviado"} />
              <Field label="Convite aceito" value={user.convite_aceito_em ? formatDT(user.convite_aceito_em) : "Pendente"} />

            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {onEdit && <Button size="sm" variant="outline" onClick={() => onEdit(user)}>Editar</Button>}
              <Button size="sm" variant="outline" onClick={() => bloquearMut.mutate(!user.blocked)} disabled={bloquearMut.isPending}>
                {user.blocked ? "Desbloquear" : "Bloquear"}
              </Button>
              {onDelete && (
                <Button size="sm" variant="destructive" onClick={() => onDelete(user)}>Excluir</Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="convites" className="px-6 pb-6 mt-4">
            <div className="mb-4 space-y-1">
              <h3 className="text-sm font-semibold">Ações de convite</h3>
              <p className="text-xs text-muted-foreground">Envie convite, magic link ou recuperação de senha para este usuário.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => send("invite")} disabled={sendEmail.isPending}>Enviar convite</Button>
              <Button size="sm" variant="outline" onClick={() => send("magiclink")} disabled={sendEmail.isPending}>Magic link</Button>
              <Button size="sm" variant="outline" onClick={() => send("recovery")} disabled={sendEmail.isPending}>Resetar senha</Button>
            </div>
          </TabsContent>

          <TabsContent value="sessoes" className="px-6 pb-6 mt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Histórico de Sessões</h3>
                <p className="text-xs text-muted-foreground">Últimas 30 sessões registradas</p>
              </div>
              <Badge variant="outline" className="text-xs">{detalhe?.total_sessoes ?? sessions?.length ?? 0} total</Badge>
            </div>

            {loadingSessions ? (
              <div className="grid place-items-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !sessions?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data / Hora</TableHead>
                      <TableHead className="text-xs">IP</TableHead>
                      <TableHead className="text-xs">Dispositivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{formatDT(s.iniciado_em)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.ip ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{parseUA(s.user_agent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="atividade" className="px-6 pb-6 mt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Atividade no Hub</h3>
                <p className="text-xs text-muted-foreground">Últimas 100 ações registradas</p>
              </div>
              <Badge variant="outline" className="text-xs">{detalhe?.total_atividades ?? atividades?.length ?? 0} total</Badge>
            </div>

            {loadingAtividades ? (
              <div className="grid place-items-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !atividades?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {atividades.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border p-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize">{a.tipo === "sessao" ? "Sessão iniciada" : a.tipo}</p>
                      {Object.keys(a.detalhes ?? {}).length > 0 && (
                        <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
                          {JSON.stringify(a.detalhes, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDT(a.momento)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
