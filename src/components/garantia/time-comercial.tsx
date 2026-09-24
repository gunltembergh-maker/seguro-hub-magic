// Time comercial de Garantia: quem recebe o pedido de documento. Só ADMIN vê
// e edita (a policy do banco garante; a tela só esconde o bloco).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import { useSalvarMembroComercial, useTimeComercial } from "@/hooks/use-garantia-comercial";
import { mensagemDeErro } from "@/lib/erro";

export function TimeComercialBotao() {
  const { data: perfil } = useMeuPerfil();
  const ehAdmin = hasRole(perfil, "ADMIN");
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const { data: time = [], isLoading } = useTimeComercial(ehAdmin && aberto);
  const { data: pessoas = [] } = useResponsaveis();
  const salvar = useSalvarMembroComercial();
  const { data: acesso = new Map<string, boolean>() } = useQuery({
    queryKey: ["garantia", "time-comercial-acesso"],
    enabled: ehAdmin && aberto,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("rpc_garantia_time_comercial_acesso");
      if (error) throw error;
      return new Map(((data ?? []) as { user_id: string; tem_acesso: boolean }[]).map((r) => [r.user_id, r.tem_acesso]));
    },
  });

  if (!ehAdmin) return null;
  const nome = (id: string) => pessoas.find((p) => p.user_id === id)?.nome ?? "Pessoa sem nome";
  const disponiveis = pessoas.filter((p) => !time.some((t) => t.user_id === p.user_id && t.ativo));

  const alterar = async (userId: string, ativo: boolean) => {
    try {
      await salvar.mutateAsync({ userId, ativo });
      toast.success(ativo ? "Incluído no time comercial." : "Desativado do time comercial.");
      setNovo("");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o time comercial."));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-tour="gar-time-comercial">
          <Users className="mr-1 h-4 w-4" /> Time comercial
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Time comercial</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Quem recebe no sino o pedido de documento feito na Análise da demanda.
        </p>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ul className="space-y-2">
            {time.length === 0 && <li className="text-sm text-muted-foreground">Ninguém cadastrado.</li>}
            {time.map((t) => (
              <li key={t.user_id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className={t.ativo ? "" : "text-muted-foreground line-through"}>
                  {nome(t.user_id)}
                  {acesso.get(t.user_id) === false && (
                    <span className="ml-2 rounded bg-muted px-1.5 text-xs text-muted-foreground no-underline">sem acesso à aba</span>
                  )}
                </span>
                <Button size="sm" variant="ghost" disabled={salvar.isPending} onClick={() => void alterar(t.user_id, !t.ativo)}>
                  {t.ativo ? "Desativar" : "Reativar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={novo} onValueChange={setNovo}>
            <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Incluir pessoa" /></SelectTrigger>
            <SelectContent>
              {disponiveis.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!novo || salvar.isPending} onClick={() => void alterar(novo, true)}>Incluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
