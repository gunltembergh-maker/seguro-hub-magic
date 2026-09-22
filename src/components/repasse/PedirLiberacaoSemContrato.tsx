// Canal Parceiros — pedido de liberação de repasse sem contrato assinado.
//
// O anexo com o De Acordo é obrigatório: o arquivo sobe primeiro e a RPC só é
// chamada com o caminho gravado. Quem valida e aprova é o banco.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { slugCanal } from "@/lib/repasse/exportar-repasse";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BUCKET = "canal-parceiros-contratos";
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const sanitizar = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "de-acordo";

export function PedirLiberacaoSemContrato({
  aberto,
  onFechar,
  onSucesso,
  canal,
  parceiro,
  ano,
  mes,
  valor,
}: {
  aberto: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
  canal: string;
  parceiro: string;
  ano: number;
  mes: number;
  valor?: number;
}) {
  const queryClient = useQueryClient();

  const [justificativa, setJustificativa] = useState("");
  const [email, setEmail] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) return;
    setJustificativa("");
    setEmail("");
    setArquivo(null);
  }, [aberto]);

  const podeEnviar =
    justificativa.trim().length > 0 && emailValido(email) && arquivo !== null && !enviando;

  async function enviar() {
    if (!arquivo || !podeEnviar) return;
    setEnviando(true);
    try {
      const path = `liberacoes/${slugCanal(canal)}/${Date.now()}-${sanitizar(arquivo.name)}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(path, arquivo, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_solicitar_liberacao" as never,
        {
          p_canal_planilha: canal,
          p_ano: ano,
          p_mes: mes,
          p_justificativa: justificativa.trim(),
          p_email_de_acordo: email.trim(),
          p_anexo_path: path,
          p_anexo_nome: arquivo.name,
        } as never,
      );
      if (error) throw error;

      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string | null } | null;
      toast.success(r?.mensagem ?? "Pedido registrado.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-liberacoes"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
      onSucesso?.();
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedir liberação sem contrato</DialogTitle>
          <DialogDescription>{parceiro}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Este parceiro não tem contrato assinado no Hub. Para liberar o envio, anexe o De Acordo do
          Jurídico ou da diretoria. O Financeiro confere e aprova.
        </p>

        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{parceiro}</p>
          <p className="text-muted-foreground">
            Ciclo de {MESES[mes - 1]}/{ano}
          </p>
          {valor != null ? (
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {BRL(valor)}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lib-justificativa">Justificativa</Label>
            <Textarea
              id="lib-justificativa"
              rows={4}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique por que este repasse precisa sair sem contrato assinado."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lib-email">E-mail de quem deu o De Acordo</Label>
            <Input
              id="lib-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@lavoroseguros.com.br"
              aria-invalid={email.trim() !== "" && !emailValido(email)}
            />
            <p className="text-xs text-muted-foreground">Jurídico ou diretoria</p>
            {email.trim() !== "" && !emailValido(email) ? (
              <p className="text-xs text-destructive">Informe um e-mail válido.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lib-anexo">Anexo com o De Acordo</Label>
            <Input
              id="lib-anexo"
              type="file"
              accept=".pdf,image/*,.msg,.eml"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PedirLiberacaoSemContrato;
