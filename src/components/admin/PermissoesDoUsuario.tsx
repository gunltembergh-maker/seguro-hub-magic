import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PermissaoUsuario {
  chave: string;
  rotulo: string;
  area: string;
  ordem: number;
  exige_concessao: boolean;
  valor_do_perfil: boolean;
  excecao: boolean | null;
  efetivo: boolean;
  motivo: string | null;
  definido_por_nome: string | null;
  definido_em: string | null;
}

interface PainelProps {
  userId: string | null;
  userNome: string;
}

interface DialogProps {
  aberto: boolean;
  userId: string | null;
  userNome: string;
  onFechar: () => void;
}

function formatDT(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function PainelPermissoesUsuario({ userId, userNome }: PainelProps) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: permissoes, isLoading } = useQuery({
    queryKey: ["admin-permissoes-usuario", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PermissaoUsuario[]> => {
      const { data, error } = await supabase.rpc("rpc_admin_permissoes_usuario" as never, {
        p_user_id: userId,
      } as never);
      if (error) throw error;
      return (data as unknown as PermissaoUsuario[]) ?? [];
    },
  });

  const definir = useMutation({
    mutationFn: async (vars: { chave: string; permitido: boolean | null; motivo: string | null }) => {
      const { error } = await supabase.rpc("rpc_admin_definir_permissao_usuario" as never, {
        p_user_id: userId,
        p_chave: vars.chave,
        p_permitido: vars.permitido,
        p_motivo: vars.motivo,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-permissoes-usuario", userId] });
      qc.invalidateQueries({ queryKey: ["meu-perfil"] });
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const list = permissoes ?? [];
    if (!q) return list;
    return list.filter((p) => p.rotulo.toLowerCase().includes(q) || p.chave.toLowerCase().includes(q));
  }, [permissoes, busca]);

  const areas = useMemo(() => {
    const mapa = new Map<string, PermissaoUsuario[]>();
    for (const p of filtradas) {
      const arr = mapa.get(p.area) ?? [];
      arr.push(p);
      mapa.set(p.area, arr);
    }
    return [...mapa.entries()];
  }, [filtradas]);

  const resumo = useMemo(() => {
    const list = permissoes ?? [];
    return {
      total: list.filter((p) => p.efetivo).length,
      excecoes: list.filter((p) => p.excecao !== null && p.excecao !== undefined).length,
    };
  }, [permissoes]);

  if (!userId) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por rótulo ou chave..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {resumo.total} permissões no total · {resumo.excecoes} com exceção
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : areas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma permissão encontrada.</p>
      ) : (
        <div className="space-y-5">
          {areas.map(([area, itens]) => (
            <div key={area}>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{area}</div>
              <div className="space-y-1.5">
                {itens.map((p) => (
                  <LinhaPermissao key={p.chave} p={p} definir={definir} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function PermissoesDoUsuario({ aberto, userId, userNome, onFechar }: DialogProps) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões de {userNome}</DialogTitle>
          <DialogDescription>
            Exceções por cima do perfil. A exceção ganha de tudo, inclusive de Administrador.
          </DialogDescription>
        </DialogHeader>
        <PainelPermissoesUsuario userId={userId} userNome={userNome} />
      </DialogContent>
    </Dialog>
  );
}

function LinhaPermissao({
  p,
  definir,
}: {
  p: PermissaoUsuario;
  definir: ReturnType<typeof useMutation<void, Error, { chave: string; permitido: boolean | null; motivo: string | null }>>;
}) {
  const selecionado: "herda" | "liberado" | "bloqueado" =
    p.excecao === null || p.excecao === undefined ? "herda" : p.excecao ? "liberado" : "bloqueado";

  const escolher = (alvo: "herda" | "liberado" | "bloqueado", motivo: string | null) => {
    definir.mutate({
      chave: p.chave,
      permitido: alvo === "herda" ? null : alvo === "liberado",
      motivo,
    });
  };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{p.rotulo}</p>
          <p className="text-xs text-muted-foreground">
            {p.exige_concessao
              ? "precisa ser concedida, não vem do perfil nem de ser Administrador"
              : p.valor_do_perfil
                ? "o perfil libera"
                : "o perfil não libera"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <BotaoHerda selecionado={selecionado === "herda"} disabled={definir.isPending} onEscolher={() => escolher("herda", null)} />
            <BotaoComMotivo
              rotulo="Liberado"
              selecionado={selecionado === "liberado"}
              disabled={definir.isPending}
              onConfirmar={(motivo) => escolher("liberado", motivo)}
            />
            <BotaoComMotivo
              rotulo="Bloqueado"
              selecionado={selecionado === "bloqueado"}
              disabled={definir.isPending}
              onConfirmar={(motivo) => escolher("bloqueado", motivo)}
            />
          </div>
          {p.efetivo ? (
            <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">tem acesso</Badge>
          ) : (
            <Badge className="border border-border bg-muted text-muted-foreground">sem acesso</Badge>
          )}
        </div>
      </div>

      {p.motivo && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {p.motivo}, por {p.definido_por_nome ?? "—"} em {formatDT(p.definido_em)}
        </p>
      )}
    </div>
  );
}

function BotaoHerda({ selecionado, disabled, onEscolher }: { selecionado: boolean; disabled: boolean; onEscolher: () => void }) {
  return (
    <Button size="sm" variant={selecionado ? "default" : "outline"} disabled={disabled} onClick={onEscolher} className="text-xs">
      Herda
    </Button>
  );
}

function BotaoComMotivo({
  rotulo,
  selecionado,
  disabled,
  onConfirmar,
}: {
  rotulo: string;
  selecionado: boolean;
  disabled: boolean;
  onConfirmar: (motivo: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setMotivo(""); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={selecionado ? "default" : "outline"} disabled={disabled} className="text-xs">
          {rotulo}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" align="end">
        <p className="text-xs text-muted-foreground">Motivo (opcional)</p>
        <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: pedido da diretoria" />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button
            size="sm"
            onClick={() => { onConfirmar(motivo.trim() || null); setAberto(false); setMotivo(""); }}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
