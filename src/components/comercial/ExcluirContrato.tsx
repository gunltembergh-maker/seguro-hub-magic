// Botão + diálogo para o ADMIN excluir um contrato que subiu errado.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hasRole } from "@/hooks/use-meu-perfil";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { mensagemDeErro } from "@/lib/erro";
import { removerArquivosContratoSemUso } from "@/lib/canal-parceiro/remover-arquivos.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const dia = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "?";

interface Retorno {
  excluidos?: number | null;
  reativado_id?: string | null;
  reativado_vigencia?: string | null;
  arquivos_sem_uso?: string[] | null;
}

export function BotaoExcluirContrato({
  contratoId,
  arquivoNome,
  parceiro,
  situacao,
  vigenciaInicio,
  vigenciaFim,
  className,
}: {
  contratoId: string | null | undefined;
  arquivoNome?: string | null;
  parceiro?: string | null;
  situacao?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  className?: string;
}) {
  const perfil = useMeuPerfilEfetivo();
  const isAdmin = hasRole(perfil, "ADMIN");
  const qc = useQueryClient();
  const removerArquivos = useServerFn(removerArquivosContratoSemUso);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!isAdmin || !contratoId) return null;

  async function excluir() {
    if (!motivo.trim() || !contratoId) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_excluir_contrato" as never,
        { p_contrato_id: contratoId, p_motivo: motivo.trim() } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as Retorno | null;
      const partes = ["Contrato excluído."];
      const n = r?.excluidos ?? 1;
      if (n > 1) partes.push(`Também foram excluídas ${n - 1} renovações geradas a partir dele.`);
      if (r?.reativado_id)
        partes.push(`O contrato anterior (vigência ${r.reativado_vigencia ?? ""}) voltou a valer.`);
      toast.success(partes.join(" "));

      const paths = (r?.arquivos_sem_uso ?? []).filter(Boolean);
      if (paths.length > 0) {
        removerArquivos({ data: { paths } }).catch((e) =>
          console.warn("Não foi possível remover arquivos sem uso", e),
        );
      }

      for (const k of [
        "canal-parceiro-situacao",
        "canal-parceiro-lista",
        "canal-parceiro-vigencias",
        "canal-parceiro-contratos",
        "canal-parceiro-percentuais",
        "canal-parceiro-pendencias-verificacao",
        "juridico-contratos",
      ]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      setAberto(false);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className={className ?? "text-destructive hover:text-destructive"}
        title="Excluir contrato"
        aria-label="Excluir contrato"
        onClick={(e) => {
          e.stopPropagation();
          setMotivo("");
          setAberto(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={aberto} onOpenChange={(o) => !salvando && setAberto(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-foreground">
                  <dt className="text-muted-foreground">Arquivo</dt>
                  <dd className="truncate">{arquivoNome ?? "Contrato"}</dd>
                  <dt className="text-muted-foreground">Parceiro</dt>
                  <dd>{parceiro ?? "Sem parceiro definido"}</dd>
                  <dt className="text-muted-foreground">Situação</dt>
                  <dd>{situacao ?? "Não informada"}</dd>
                  <dt className="text-muted-foreground">Vigência</dt>
                  <dd>
                    {vigenciaInicio || vigenciaFim
                      ? `${dia(vigenciaInicio)} a ${dia(vigenciaFim)}`
                      : "Não informada"}
                  </dd>
                </dl>
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
                  A exclusão não pode ser desfeita. Se este for o contrato vigente, o repasse do
                  parceiro volta a depender de contrato, a não ser que exista um contrato anterior
                  ainda vigente, que passa a valer. Renovações geradas a partir deste contrato
                  também são excluídas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="excluir-contrato-motivo">Motivo *</Label>
            <Textarea
              id="excluir-contrato-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={excluir} disabled={!motivo.trim() || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
