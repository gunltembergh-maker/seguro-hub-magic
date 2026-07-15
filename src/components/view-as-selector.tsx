import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/contexts/view-as-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UsuarioSimples {
  user_id: string;
  full_name: string | null;
  email: string;
  perfil_nome: string | null;
  role: string | null;
}

export function ViewAsSelector() {
  const { isAdmin, viewAsUserId, setViewAs, realPerfil } = useViewAs();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: usuarios = [] } = useQuery({
    queryKey: ["view-as-users"],
    enabled: isAdmin && open,
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioSimples[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_list_users_simples" as never);
      if (error) throw error;
      return (data ?? []) as UsuarioSimples[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const semEuMesmo = usuarios.filter((u) => u.user_id !== realPerfil?.user_id);
    if (!q) return semEuMesmo;
    return semEuMesmo.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [usuarios, busca, realPerfil?.user_id]);

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          title="Visualizar como outro usuário"
        >
          <Eye className="h-3.5 w-3.5" />
          Minha Visão
          {viewAsUserId && (
            <span className="ml-1 rounded-full bg-amber-400/90 px-1.5 text-[10px] font-semibold text-amber-950">
              ativo
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuário..."
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-1">
            {viewAsUserId && (
              <button
                type="button"
                onClick={() => {
                  setViewAs(null);
                  setOpen(false);
                }}
                className="mb-1 w-full rounded-md bg-amber-100 px-3 py-2 text-left text-xs font-medium text-amber-900 hover:bg-amber-200"
              >
                ← Voltar à minha visão
              </button>
            )}
            {filtrados.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            )}
            {filtrados.map((u) => {
              const ativo = viewAsUserId === u.user_id;
              return (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => {
                    setViewAs(u.user_id);
                    setOpen(false);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${
                    ativo ? "bg-accent" : ""
                  }`}
                >
                  <div className="font-medium">{u.full_name || u.email}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{u.email}</span>
                    {u.role && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-primary/10 px-1 text-primary">{u.role}</span>
                      </>
                    )}
                    {u.perfil_nome && (
                      <>
                        <span>·</span>
                        <span>{u.perfil_nome}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
