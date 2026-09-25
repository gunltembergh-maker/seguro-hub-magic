import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { mensagemDeErro } from "@/lib/erro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ArrowLeft, UserPlus, ShieldAlert, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/avisos-canal-parceiros")({
  component: AvisosCanalParceirosPage,
});

type Destinatario = {
  user_id: string;
  nome: string;
  email: string;
  origem: string;
  recebe: boolean;
};

type UsuarioSimples = { user_id: string; nome: string; email: string };

const GRUPOS = [
  { key: "canal_vencimento_juridico", label: "Jurídico" },
  { key: "canal_vencimento_comercial", label: "Comercial" },
] as const;

type GrupoKey = (typeof GRUPOS)[number]["key"];

function AvisosCanalParceirosPage() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = hasRole(perfil, "ADMIN");
  const qc = useQueryClient();

  const [grupo, setGrupo] = useState<GrupoKey>("canal_vencimento_juridico");
  const [addOpen, setAddOpen] = useState(false);
  const [adicionando, setAdicionando] = useState(false);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["admin-canal-destinatarios", grupo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_canal_destinatarios" as never, {
        p_grupo: grupo,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Destinatario[];
    },
    enabled: isAdmin,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["admin-list-users-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users_simples" as never);
      if (error) throw error;
      return (data ?? []) as unknown as UsuarioSimples[];
    },
    enabled: isAdmin && addOpen,
  });

  const jaNaLista = useMemo(() => new Set(lista.map((d) => d.user_id)), [lista]);

  const invalidar = () =>
    qc.invalidateQueries({ queryKey: ["admin-canal-destinatarios"] });

  const definir = async (userId: string, recebe: boolean | null) => {
    const { error } = await supabase.rpc("rpc_admin_canal_destinatario_definir" as never, {
      p_grupo: grupo,
      p_user_id: userId,
      p_recebe: recebe,
    } as never);
    if (error) {
      toast.error(mensagemDeErro(error));
      return;
    }
    toast.success(
      recebe === null
        ? "Voltou ao automático"
        : recebe
          ? "Pessoa incluída nos avisos"
          : "Pessoa excluída dos avisos",
    );
    invalidar();
  };

  const adicionar = async (userId: string) => {
    setAdicionando(true);
    try {
      await definir(userId, true);
      setAddOpen(false);
    } finally {
      setAdicionando(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
      </div>
    );
  }

  const manual = (d: Destinatario) =>
    d.origem.includes("Admin");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/admin/usuarios"><ArrowLeft className="w-4 h-4" /> Admin</Link>
        </Button>
      </div>

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Quem recebe os avisos de vencimento de contrato
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avisos de 60 e 30 dias vão para o Jurídico e o Comercial. Avisos de 15 dias e
          diários vão só para o Jurídico. No Comercial, recebem automaticamente as pessoas
          com a Área Comercial Lavoro; aqui você desliga quem não deve receber e inclui
          outras pessoas. O juridico@lavoroseguros.com.br recebe sempre.
        </p>
      </header>

      {/* Abas */}
      <div className="flex gap-2">
        {GRUPOS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGrupo(g.key)}
            className={`px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
              grupo === g.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">
            {GRUPOS.find((g) => g.key === grupo)?.label} ({lista.length})
          </CardTitle>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Adicionar pessoa
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Por que está na lista</TableHead>
                <TableHead>Recebe</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupo === "canal_vencimento_juridico" && (
                <TableRow className="bg-muted/40">
                  <TableCell className="font-medium" colSpan={2}>
                    juridico@lavoroseguros.com.br
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    caixa do Jurídico
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" colSpan={2}>
                    recebe sempre
                  </TableCell>
                </TableRow>
              )}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin inline-block" />
                  </TableCell>
                </TableRow>
              ) : lista.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-6">
                    {grupo === "canal_vencimento_comercial"
                      ? "Ninguém com a Área Comercial Lavoro ainda. Defina a Área no cadastro do usuário ou use Adicionar pessoa."
                      : "Ninguém na lista"}
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((d) => (
                  <TableRow key={d.user_id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{d.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.origem}</TableCell>
                    <TableCell>
                      <Switch
                        checked={d.recebe}
                        onCheckedChange={(v) => definir(d.user_id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {manual(d) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs"
                          onClick={() => definir(d.user_id, null)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Voltar ao automático
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adicionar pessoa */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar pessoa</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Buscar por nome ou e-mail" />
            <CommandList>
              <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
              <CommandGroup>
                {usuarios
                  .filter((u) => !jaNaLista.has(u.user_id))
                  .map((u) => (
                    <CommandItem
                      key={u.user_id}
                      value={`${u.nome} ${u.email}`}
                      disabled={adicionando}
                      onSelect={() => adicionar(u.user_id)}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{u.nome}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
