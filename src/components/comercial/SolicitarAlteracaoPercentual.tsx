// Canal Parceiros — pedido de alteração de percentual com De Acordo da diretoria.
//
// A tela só monta o pedido: quem valida justificativa, e-mail, anexo e quem
// pode aprovar é o banco. Percentual é digitado em porcentagem e vai em fração.
import { mensagemDeErro } from "@/lib/erro";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

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

export interface PctAtuais {
  beneficios?: number | null;
  garantia?: number | null;
  demais?: number | null;
  minimo?: number | null;
}

const hoje = (v?: number | null) =>
  v == null
    ? "hoje: —"
    : `hoje: ${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** 30 vira 0,30. Campo vazio vira null: não muda. */
function paraFracao(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Number((n / 100).toFixed(4)) : null;
}

function paraNumero(v: string): number | null {
  const t = v.trim().replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function campoPctInvalido(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  return !Number.isFinite(Number(t.replace(",", ".")));
}

function campoMonetarioInvalido(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  return !Number.isFinite(Number(t.replace(/\./g, "").replace(",", ".")));
}

const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const sanitizar = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "de-acordo";

export function SolicitarAlteracaoPercentual({
  aberto,
  canalId,
  canalNome,
  pctAtuais,
  onFechar,
  onSucesso,
}: {
  aberto: boolean;
  canalId: string;
  canalNome: string;
  pctAtuais: PctAtuais;
  onFechar: () => void;
  onSucesso?: () => void;
}) {
  const queryClient = useQueryClient();

  const [beneficios, setBeneficios] = useState("");
  const [garantia, setGarantia] = useState("");
  const [demais, setDemais] = useState("");
  const [minimo, setMinimo] = useState("");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [diretor, setDiretor] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) return;
    setBeneficios("");
    setGarantia("");
    setDemais("");
    setMinimo("");
    setVigenciaFim("");
    setJustificativa("");
    setDiretor("");
    setArquivo(null);
  }, [aberto]);

  const temValor =
    beneficios.trim() !== "" ||
    garantia.trim() !== "" ||
    demais.trim() !== "" ||
    minimo.trim() !== "" ||
    vigenciaFim.trim() !== "";

  const pctBeneficiosInvalido = campoPctInvalido(beneficios);
  const pctGarantiaInvalido = campoPctInvalido(garantia);
  const pctDemaisInvalido = campoPctInvalido(demais);
  const minimoInvalido = campoMonetarioInvalido(minimo);
  const algumNumeroInvalido =
    pctBeneficiosInvalido || pctGarantiaInvalido || pctDemaisInvalido || minimoInvalido;

  const podeEnviar =
    justificativa.trim().length > 0 &&
    emailValido(diretor) &&
    arquivo !== null &&
    temValor &&
    !algumNumeroInvalido &&
    !enviando;

  async function enviar() {
    if (!arquivo || !podeEnviar) return;
    setEnviando(true);
    try {
      const path = `alteracoes/${canalId}/${Date.now()}-${sanitizar(arquivo.name)}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(path, arquivo, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_solicitar_alteracao" as never,
        {
          p_canal_id: canalId,
          p_justificativa: justificativa.trim(),
          p_diretor_email: diretor.trim(),
          p_pct_beneficios: paraFracao(beneficios),
          p_pct_garantia: paraFracao(garantia),
          p_pct_demais: paraFracao(demais),
          p_minimo: paraNumero(minimo),
          p_vigencia_fim: vigenciaFim.trim() || null,
          p_anexo_path: path,
          p_anexo_nome: arquivo.name,
        } as never,
      );
      if (error) throw error;

      const r = (Array.isArray(data) ? data[0] : data) as { mensagem?: string | null } | null;
      toast.success(r?.mensagem ?? "Pedido enviado para aprovação.");
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-alteracoes"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-situacao"] });
      queryClient.invalidateQueries({ queryKey: ["canal-parceiro-eventos"] });
      onSucesso?.();
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar alteração de percentual</DialogTitle>
          <DialogDescription>{canalNome}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Use isto quando a diretoria autorizar um percentual diferente do que está no contrato, ou
          enquanto a assinatura do contrato não sai. A autorização vale até um contrato novo entrar
          em vigor, e aí ela é substituída automaticamente.
        </p>

        <div className="space-y-4">
          <CampoPct
            id="alt-beneficios"
            rotulo="Benefícios"
            atual={pctAtuais.beneficios}
            valor={beneficios}
            onChange={setBeneficios}
            erro={pctBeneficiosInvalido}
          />
          <CampoPct
            id="alt-garantia"
            rotulo="Garantia"
            atual={pctAtuais.garantia}
            valor={garantia}
            onChange={setGarantia}
            erro={pctGarantiaInvalido}
          />
          <CampoPct
            id="alt-demais"
            rotulo="Demais ramos"
            atual={pctAtuais.demais}
            valor={demais}
            onChange={setDemais}
            erro={pctDemaisInvalido}
          />

          <div className="space-y-1.5">
            <Label htmlFor="alt-minimo">Mínimo por ciclo (R$)</Label>
            <Input
              id="alt-minimo"
              inputMode="decimal"
              placeholder="opcional"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
            />
            {minimoInvalido ? (
              <p className="text-xs text-destructive">
                Informe apenas números nos percentuais, por exemplo 30 ou 27,5.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alt-vigencia">Nova data fim de vigência</Label>
            <Input
              id="alt-vigencia"
              type="date"
              value={vigenciaFim}
              onChange={(e) => setVigenciaFim(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alt-justificativa">Justificativa</Label>
            <Textarea
              id="alt-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Por que este percentual precisa mudar agora?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alt-diretor">E-mail do diretor que deu o De Acordo</Label>
            <Input
              id="alt-diretor"
              type="email"
              value={diretor}
              onChange={(e) => setDiretor(e.target.value)}
              placeholder="diretor@lavoroseguros.com.br"
            />
            {diretor.trim() && !emailValido(diretor) ? (
              <p className="text-xs text-destructive">Informe um e-mail válido.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alt-anexo">Anexo com o De Acordo</Label>
            <Input
              id="alt-anexo"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.msg,.eml,application/pdf,image/*"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Pode ser o PDF, a imagem ou o próprio e-mail encaminhado (.msg ou .eml).
            </p>
          </div>

          {!temValor ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Informe ao menos um percentual, o mínimo ou a nova vigência.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!podeEnviar}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampoPct({
  id,
  rotulo,
  atual,
  valor,
  onChange,
  erro,
}: {
  id: string;
  rotulo: string;
  atual?: number | null;
  valor: string;
  onChange: (v: string) => void;
  erro?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo} (%)</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          inputMode="decimal"
          placeholder="não muda"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{hoje(atual)}</span>
      </div>
      {erro ? (
        <p className="text-xs text-destructive">
          Informe apenas números nos percentuais, por exemplo 30 ou 27,5.
        </p>
      ) : null}
    </div>
  );
}

export default SolicitarAlteracaoPercentual;
