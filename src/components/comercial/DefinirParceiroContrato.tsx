// Seletor para definir o parceiro de um contrato em VINCULO_A_CONFIRMAR:
// escolhe um parceiro existente ou cadastra um novo. Usado na fila do Canal
// Parceiros e no resultado do envio de contrato.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const NOVO = "__novo__";

export interface ResultadoVinculo {
  contrato_id?: string | null;
  canal_id?: string | null;
  canal_nome?: string | null;
  criou_parceiro?: boolean | null;
  situacao?: string | null;
  motivo?: string | null;
  pode_exportar?: boolean | null;
}

export interface ExtracaoParaVinculo {
  nomes?: string[] | null;
  cnpj?: string | null;
}

interface ParceiroSimples {
  canal_id: string;
  nome: string | null;
  razao_social: string | null;
}

export function usePodeDefinirVinculo() {
  return useQuery({
    queryKey: ["canal-parceiro-pode-definir-vinculo"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("pode_definir_vinculo_contrato" as never);
      if (error) throw error;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
}

function situacaoTexto(r: ResultadoVinculo | null) {
  if (!r) return "";
  if (r.situacao === "ATIVO") return "repasse liberado";
  return r.motivo ?? `situação ${r.situacao ?? "não informada"}`;
}

export function DefinirParceiroContrato({
  contratoId,
  extracao,
  onConcluido,
}: {
  contratoId: string;
  extracao?: ExtracaoParaVinculo | null;
  onConcluido?: (r: ResultadoVinculo | null) => void;
}) {
  const qc = useQueryClient();
  const [escolha, setEscolha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState({ nome: "", razao: "", cnpj: "", chave: "" });

  const parceiros = useQuery({
    queryKey: ["canal-parceiro-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_canal_parceiro_lista" as never);
      if (error) throw error;
      return (data ?? []) as unknown as ParceiroSimples[];
    },
    staleTime: 60_000,
  });

  function recarregar() {
    for (const k of [
      "canal-parceiro-situacao",
      "canal-parceiro-lista",
      "canal-parceiro-vigencias",
      "canal-parceiro-contratos",
      "canal-parceiro-percentuais",
      "canal-parceiro-pendencias-verificacao",
    ]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  }

  async function abrirNovo() {
    let ext = extracao ?? null;
    if (!ext) {
      const { data } = await supabase
        .from("canal_contratos")
        .select("extracao")
        .eq("id", contratoId)
        .maybeSingle();
      ext = ((data as { extracao?: ExtracaoParaVinculo } | null)?.extracao ?? null);
    }
    const nome = ext?.nomes?.[0] ?? "";
    setForm({ nome, razao: nome, cnpj: ext?.cnpj ?? "", chave: "" });
    setNovoAberto(true);
  }

  async function confirmarExistente() {
    if (!escolha || escolha === NOVO) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_resolver_vinculo" as never,
        { p_contrato_id: contratoId, p_canal_id: escolha } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as ResultadoVinculo | null;
      toast.success(`Vínculo confirmado. ${situacaoTexto(r)}.`);
      recarregar();
      onConcluido?.(r);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarNovo() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc(
        "rpc_canal_parceiro_vincular_novo" as never,
        {
          p_contrato_id: contratoId,
          p_nome: form.nome.trim(),
          p_razao_social: form.razao.trim() || null,
          p_cnpj: form.cnpj.trim() || null,
          p_chave_planilha: form.chave.trim() || null,
        } as never,
      );
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as ResultadoVinculo | null;
      const nome = r?.canal_nome ?? form.nome.trim();
      toast.success(
        r?.criou_parceiro === false
          ? `Contrato vinculado ao parceiro já existente ${nome}. ${situacaoTexto(r)}.`
          : `Parceiro ${nome} cadastrado e vinculado ao contrato. ${situacaoTexto(r)}.`,
      );
      setNovoAberto(false);
      setEscolha("");
      recarregar();
      onConcluido?.(r);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select
          value={escolha}
          onValueChange={(v) => {
            if (v === NOVO) {
              setEscolha("");
              void abrirNovo();
            } else setEscolha(v);
          }}
        >
          <SelectTrigger className="md:w-72">
            <SelectValue placeholder="Escolha o parceiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOVO} className="font-medium text-primary">
              + Parceiro novo (não está na lista)
            </SelectItem>
            {(parceiros.data ?? []).map((p) => (
              <SelectItem key={p.canal_id} value={p.canal_id}>
                {p.nome ?? p.razao_social ?? p.canal_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={confirmarExistente} disabled={!escolha || salvando}>
          {salvando && !novoAberto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar
        </Button>
      </div>

      <Dialog open={novoAberto} onOpenChange={(o) => !salvando && setNovoAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar parceiro novo</DialogTitle>
            <DialogDescription>
              O parceiro é criado e já fica vinculado a este contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dpc-nome">Nome do parceiro *</Label>
              <Input
                id="dpc-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dpc-razao">Razão social</Label>
              <Input
                id="dpc-razao"
                value={form.razao}
                onChange={(e) => setForm((f) => ({ ...f, razao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dpc-cnpj">CNPJ</Label>
              <Input
                id="dpc-cnpj"
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dpc-chave">Nome como aparece na base de repasse</Label>
              <Input
                id="dpc-chave"
                value={form.chave}
                onChange={(e) => setForm((f) => ({ ...f, chave: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Se na planilha o parceiro aparece com outro nome, escreva aqui. Em branco, usa o
                nome do parceiro.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={cadastrarNovo} disabled={!form.nome.trim() || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar e vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
