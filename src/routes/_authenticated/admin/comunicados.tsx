import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  CalendarIcon,
  Search,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { PopupCard } from "@/components/popup-comunicado";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/comunicados")({
  component: AdminComunicadosPage,
});

interface PopupRow {
  id: string;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  perfis: string[] | null;
  destinatarios: string[] | null;
  paginas: string[] | null;
  logo_url: string | null;
  mostrar_nome_hub: boolean | null;
  created_at: string | null;
  total_dismiss: number | null;
}

interface RotaOption {
  rota: string;
  nome: string;
  ativo: boolean;
}
interface UsuarioOption {
  user_id: string;
  email: string;
  full_name: string;
}

type DestMode = "todos" | "perfil" | "especifico";

const PERFIS = ["ADMIN", "COLABORADOR"];

const defaultForm = {
  titulo: "",
  mensagem: "",
  ativo: true,
  data_inicio: new Date(),
  data_fim: null as Date | null,
  destinatario_mode: "todos" as DestMode,
  perfis: [] as string[],
  destinatarios: [] as string[],
  paginas: ["__all__"] as string[],
  logo_url: "__default__" as string,
  mostrar_nome_hub: true,
};

function AdminComunicadosPage() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = hasRole(perfil, "ADMIN");
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const { data: popups, isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-popups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_listar_popups");
      if (error) throw error;
      return (data || []) as unknown as PopupRow[];
    },
  });

  const { data: rotas } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-rotas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_listar_rotas");
      if (error) throw error;
      return (data || []) as unknown as RotaOption[];
    },
  });

  const { data: usuarios } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-usuarios-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users_simples");
      if (error) throw error;
      return ((data || []) as { user_id: string; email: string; full_name: string }[]).map(
        (u) => ({ user_id: u.user_id, email: u.email, full_name: u.full_name }),
      ) as UsuarioOption[];
    },
  });

  const filteredUsers = useMemo(() => {
    if (!usuarios) return [];
    if (!userSearch.trim()) return usuarios;
    const q = userSearch.toLowerCase();
    return usuarios.filter(
      (u) => u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [usuarios, userSearch]);

  const rotasMap = useMemo(() => {
    const m = new Map<string, string>(HUB_PAGINAS_MAP);
    (rotas || []).forEach((r) => { if (!m.has(r.rota)) m.set(r.rota, r.nome); });
    return m;
  }, [rotas]);

  // Catálogo do app + rotas extras cadastradas no banco que não constam no catálogo
  const gruposPaginas = useMemo(() => {
    const conhecidas = new Set(HUB_PAGINAS.flatMap((g) => g.paginas.map((p) => p.rota)));
    const extras = (rotas || []).filter((r) => !conhecidas.has(r.rota));
    return extras.length > 0
      ? [...HUB_PAGINAS, { grupo: "Outras", paginas: extras.map((r) => ({ rota: r.rota, nome: r.nome })) }]
      : HUB_PAGINAS;
  }, [rotas]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem gerenciar comunicados.
        </p>
      </div>
    );
  }

  const openNew = () => {
    setEditId(null);
    setForm({ ...defaultForm, data_inicio: new Date() });
    setUserSearch("");
    setModalOpen(true);
  };

  const openEdit = (p: PopupRow) => {
    setEditId(p.id);
    const mode: DestMode =
      p.destinatarios && p.destinatarios.length > 0
        ? "especifico"
        : p.perfis && p.perfis.length > 0
          ? "perfil"
          : "todos";
    setForm({
      titulo: p.titulo,
      mensagem: p.mensagem,
      ativo: p.ativo ?? true,
      data_inicio: p.data_inicio ? new Date(p.data_inicio) : new Date(),
      data_fim: p.data_fim ? new Date(p.data_fim) : null,
      destinatario_mode: mode,
      perfis: p.perfis || [],
      destinatarios: p.destinatarios || [],
      paginas: p.paginas && p.paginas.length > 0 ? p.paginas : ["__all__"],
      logo_url: p.logo_url === null ? "__default__" : p.logo_url === "" ? "__none__" : p.logo_url,
      mostrar_nome_hub: p.mostrar_nome_hub ?? true,
    });
    setUserSearch("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast.error("Título e mensagem são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const logoValue =
        form.logo_url === "__default__" ? null : form.logo_url === "__none__" ? "" : form.logo_url;
      const payload = {
        p_id: editId || undefined,
        p_titulo: form.titulo.trim(),
        p_mensagem: form.mensagem.trim(),
        p_ativo: form.ativo,
        p_data_inicio: form.data_inicio.toISOString(),
        p_data_fim: form.data_fim ? form.data_fim.toISOString() : undefined,
        p_perfis: form.destinatario_mode === "perfil" ? form.perfis : undefined,
        p_destinatarios:
          form.destinatario_mode === "especifico" ? form.destinatarios : undefined,
        p_paginas: form.paginas.includes("__all__") ? undefined : form.paginas,
        p_cor_fundo: "#14405C",
        p_botao_label: "Entendido!",
        p_logo_url: logoValue ?? undefined,
        p_mostrar_nome_hub: form.mostrar_nome_hub,
      };
      const { error } = await supabase.rpc("rpc_admin_salvar_popup", payload);
      if (error) throw error;
      toast.success(editId ? "Comunicado atualizado!" : "Comunicado criado!");
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-popups"] });
    } catch (e) {
      toast.error((e as Error).message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.rpc("rpc_admin_excluir_popup", {
        p_id: deleteId,
      });
      if (error) throw error;
      toast.success("Comunicado excluído.");
      qc.invalidateQueries({ queryKey: ["admin-popups"] });
    } catch (e) {
      toast.error((e as Error).message || "Erro ao excluir");
    } finally {
      setDeleteId(null);
    }
  };

  const getStatus = (p: PopupRow) => {
    if (!p.ativo) return "Inativo";
    if (p.data_fim && new Date(p.data_fim) < new Date()) return "Expirado";
    return "Ativo";
  };

  const statusColor = (s: string) =>
    s === "Ativo"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : s === "Expirado"
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

  const destLabel = (p: PopupRow) => {
    if (p.destinatarios && p.destinatarios.length > 0)
      return `${p.destinatarios.length} usuário(s)`;
    if (p.perfis && p.perfis.length > 0) return p.perfis.join(", ");
    return "Todos";
  };

  const paginasLabel = (p: PopupRow) => {
    if (!p.paginas || p.paginas.length === 0) return "Todas";
    return p.paginas.map((pg) => rotasMap.get(pg) || pg).join(", ");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Comunicados</h1>
            <p className="text-sm text-muted-foreground">
              Popups exibidos aos usuários dentro do Hub.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Comunicado
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Páginas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Dispensas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (!popups || popups.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum comunicado cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {popups?.map((p) => {
                const status = getStatus(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {p.titulo}
                    </TableCell>
                    <TableCell className="text-xs">{destLabel(p)}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">
                      {paginasLabel(p)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs border", statusColor(status))}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.data_inicio ? format(new Date(p.data_inicio), "dd/MM/yy") : "—"}
                      {" → "}
                      {p.data_fim ? format(new Date(p.data_fim), "dd/MM/yy") : "∞"}
                    </TableCell>
                    <TableCell className="text-center">{p.total_dismiss ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar Comunicado" : "Novo Comunicado"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conteúdo
                </h3>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Título do comunicado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={form.mensagem}
                    onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                    placeholder="Mensagem do comunicado"
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Destinatários
                </h3>
                <Select
                  value={form.destinatario_mode}
                  onValueChange={(v) =>
                    setForm({ ...form, destinatario_mode: v as DestMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os usuários</SelectItem>
                    <SelectItem value="perfil">Por role</SelectItem>
                    <SelectItem value="especifico">Usuários específicos</SelectItem>
                  </SelectContent>
                </Select>

                {form.destinatario_mode === "perfil" && (
                  <div className="flex flex-wrap gap-3">
                    {PERFIS.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={form.perfis.includes(p)}
                          onCheckedChange={(c) =>
                            setForm({
                              ...form,
                              perfis: c
                                ? [...form.perfis, p]
                                : form.perfis.filter((x) => x !== p),
                            })
                          }
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                )}

                {form.destinatario_mode === "especifico" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar por nome ou email…"
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {filteredUsers.map((u) => (
                        <label
                          key={u.email}
                          className="flex items-center gap-2 text-xs cursor-pointer py-0.5"
                        >
                          <Checkbox
                            checked={form.destinatarios.includes(u.email)}
                            onCheckedChange={(c) =>
                              setForm({
                                ...form,
                                destinatarios: c
                                  ? [...form.destinatarios, u.email]
                                  : form.destinatarios.filter((x) => x !== u.email),
                              })
                            }
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium">{u.full_name}</span>
                            <span className="text-muted-foreground">{u.email}</span>
                          </div>
                        </label>
                      ))}
                      {filteredUsers.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhum usuário encontrado
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Onde aparece
                </h3>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium">
                  <Checkbox
                    checked={form.paginas.includes("__all__")}
                    onCheckedChange={(c) =>
                      setForm({ ...form, paginas: c ? ["__all__"] : [] })
                    }
                  />
                  Todas as páginas
                </label>
                <div className="border-t pt-2 flex flex-wrap gap-2">
                  {(rotas || []).map((r) => (
                    <label
                      key={r.rota}
                      className="flex items-center gap-1.5 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={form.paginas.includes(r.rota)}
                        disabled={form.paginas.includes("__all__")}
                        onCheckedChange={(c) => {
                          const next = c
                            ? [...form.paginas.filter((x) => x !== "__all__"), r.rota]
                            : form.paginas.filter((x) => x !== r.rota);
                          setForm({
                            ...form,
                            paginas: next.length === 0 ? ["__all__"] : next,
                          });
                        }}
                      />
                      {r.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Período
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data de início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.data_inicio && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(form.data_inicio, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.data_inicio}
                          onSelect={(d) => d && setForm({ ...form, data_inicio: d })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de fim (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.data_fim && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.data_fim ? format(form.data_fim, "dd/MM/yyyy") : "Sem expiração"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.data_fim || undefined}
                          onSelect={(d) => setForm({ ...form, data_fim: d || null })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(c) => setForm({ ...form, ativo: c })}
                  />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.mostrar_nome_hub}
                    onCheckedChange={(c) => setForm({ ...form, mostrar_nome_hub: c })}
                  />
                  <Label>Mostrar "Hub Lavoro Seguros"</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pré-visualização
              </h3>
              <div className="rounded-xl bg-slate-100 p-4 flex items-start justify-center min-h-[400px]">
                <div className="relative w-full flex items-center justify-center pt-4">
                  <div className="absolute inset-0 bg-black/30 rounded-lg" />
                  <div className="relative z-10 w-full max-w-[340px]">
                    <PopupCard
                      titulo={form.titulo}
                      mensagem={form.mensagem}
                      mostrar_nome_hub={form.mostrar_nome_hub}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: "#14405C" }}
              className="text-white hover:opacity-90"
            >
              {saving ? "Publicando…" : "Publicar Comunicado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O comunicado e todas as dispensas serão
              removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
