// Etapas 8 a 11 — emissão, financeiro, sinistro e baixa da apólice.
//
// Decisões que a tela reflete (e que o banco também garante):
//  · Lançar apólice é uma operação só (RPC): apólice + financeiro + avisos de
//    renovação + limite usado + movimento da demanda.
//  · Na fiança locatícia o vocabulário é LOCADOR e LOCATÁRIO — é como o
//    usuário fala, e são essas colunas que o banco exige.
//  · O financeiro NÃO conta tempo, e prêmio não pago não cancela apólice.
//  · A baixa devolve exatamente a importância segurada que a emissão somou.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
  ENCERRAMENTO_COM_DEVOLUCAO,
  TIPOS_ENCERRAMENTO,
  TIPOS_SINISTRO,
  diasParaVencer,
  nomeSeguradoraApolice,
  rotuloEncerramento,
  rotulosDasPartes,
  useApolicesDaDemanda,
  useAuditoriaApolice,
  useAvisosRenovacao,
  useDarBaixa,
  useEncerramentoDaApolice,
  useFamiliaApolice,
  useFinanceiroDaApolice,
  useLancarApolice,
  useRegistrarSinistro,
  useSalvarFinanceiro,
  useSinistrosDaApolice,
  type ApoliceGarantia,
  type FinanceiroApolice,
} from "@/hooks/use-garantia-apolices";
import { nomeSeguradoraCotacao, useCotacoes, useSeguradorasGarantia } from "@/hooks/use-garantia-crm";
import { useDocumentosDaDemanda } from "@/hooks/use-garantia-documentos";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { pendenciasEtapa8, rotuloTipoDocumento } from "@/lib/garantia/documentos-regra";
import { A_DEFINIR, dataCurta, dataHora, moeda } from "@/lib/garantia/formato";

const hoje = () => new Date().toISOString().slice(0, 10);
const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/* ------------------------------------------------------------------ */
/* Etapa 8 — lançamento                                               */
/* ------------------------------------------------------------------ */

function FormularioLancamento({ demanda }: { demanda: DemandaLista }) {
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const { data: cotacoes = [] } = useCotacoes(demanda.id);
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const lancar = useLancarApolice();

  const tipos = useMemo(() => new Set(docs.map((d) => d.tipo)), [docs]);
  const pendencias = pendenciasEtapa8(tipos);
  const escolhida = cotacoes.find((c) => c.escolhida) ?? null;
  const partes = rotulosDasPartes(demanda.produto);

  const [numeroApolice, setNumeroApolice] = useState("");
  const [endosso, setEndosso] = useState("0");
  const [emissao, setEmissao] = useState(hoje());
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [objeto, setObjeto] = useState(demanda.objeto ?? "");
  const [importancia, setImportancia] = useState(
    demanda.importancia_segurada != null ? String(demanda.importancia_segurada) : "",
  );
  const [premio, setPremio] = useState(escolhida?.premio != null ? String(escolhida.premio) : "");
  const [comissaoPct, setComissaoPct] = useState(
    escolhida?.comissao_pct != null ? String(escolhida.comissao_pct) : "",
  );
  const [vencimento, setVencimento] = useState("");

  const comissaoValor =
    numero(premio) != null && numero(comissaoPct) != null
      ? (numero(premio)! * numero(comissaoPct)!) / 100
      : null;

  const enviar = async () => {
    if (pendencias.length) {
      toast.error("Anexe os documentos obrigatórios na aba Documentos antes de lançar.");
      return;
    }
    if (!numeroApolice.trim()) {
      toast.error("Informe o número da apólice.");
      return;
    }
    try {
      const r = await lancar.mutateAsync({
        demandaId: demanda.id,
        dados: {
          numero_apolice: numeroApolice.trim(),
          numero_endosso: Number(endosso || 0),
          data_emissao: emissao || null,
          vigencia_inicio: inicio || null,
          vigencia_fim: fim || null,
          objeto: objeto || null,
          importancia_segurada: numero(importancia),
          premio: numero(premio),
          comissao_pct: numero(comissaoPct),
          vencimento_boleto: vencimento || null,
        },
      });
      toast.success(
        r.limite_atualizado
          ? "Apólice lançada. Financeiro aberto, avisos de renovação criados e limite do cliente atualizado."
          : "Apólice lançada. Não havia linha de limite dessa seguradora na consulta vigente, então o limite usado não foi alterado.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar a apólice.");
    }
  };

  return (
    <div className="space-y-4">
      {pendencias.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Falta anexar para poder lançar
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {pendencias.map((p) => (
              <li key={p.tipo}>
                {p.texto} <span className="text-xs">— {p.motivo}.</span> Use a aba Documentos com o
                tipo “{rotuloTipoDocumento(p.tipo!)}”.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border p-3 text-sm">
        <p>
          Seguradora (da cotação escolhida):{" "}
          <strong>{escolhida ? nomeSeguradoraCotacao(escolhida, seguradoras) : A_DEFINIR}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          {partes.cliente}: {demanda.cliente?.nome ?? A_DEFINIR} · {partes.segurado}:{" "}
          {demanda.segurado?.nome ?? A_DEFINIR}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Número da apólice *</Label>
          <Input value={numeroApolice} onChange={(e) => setNumeroApolice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Número do endosso</Label>
          <Input type="number" min={0} value={endosso} onChange={(e) => setEndosso(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Data de emissão</Label>
          <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Vencimento do boleto</Label>
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Vigência inicial</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Vigência final</Label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Importância segurada</Label>
          <Input value={importancia} onChange={(e) => setImportancia(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Prêmio</Label>
          <Input value={premio} onChange={(e) => setPremio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Comissão %</Label>
          <Input value={comissaoPct} onChange={(e) => setComissaoPct(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Comissão (calculada)</Label>
          <Input value={comissaoValor != null ? moeda(comissaoValor) : ""} readOnly disabled />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Objeto</Label>
          <Textarea rows={3} value={objeto} onChange={(e) => setObjeto(e.target.value)} />
        </div>
      </div>

      <Button onClick={enviar} disabled={lancar.isPending}>
        {lancar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Lançar apólice
      </Button>
      <p className="text-xs text-muted-foreground">
        O lançamento cria a apólice vigente, abre o financeiro com o prêmio em aberto, cria os avisos
        de renovação de 120, 90, 60 e 30 dias e soma a importância segurada ao limite usado do
        cliente naquela seguradora.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 9 — financeiro                                               */
/* ------------------------------------------------------------------ */

function BlocoFinanceiro({ apolice }: { apolice: ApoliceGarantia }) {
  const { data: fin } = useFinanceiroDaApolice(apolice.id);
  const salvar = useSalvarFinanceiro(apolice.id);
  const [rascunho, setRascunho] = useState<Partial<FinanceiroApolice>>({});

  if (!fin) return <p className="text-sm text-muted-foreground">Financeiro ainda não aberto.</p>;
  const v = { ...fin, ...rascunho };
  const mudar = (campo: keyof FinanceiroApolice, valor: unknown) =>
    setRascunho((r) => ({ ...r, [campo]: valor }));

  const gravar = async () => {
    try {
      await salvar.mutateAsync(rascunho);
      setRascunho({});
      toast.success("Financeiro atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <h4 className="font-semibold text-[#14405C]">Financeiro</h4>
      <p className="text-xs text-muted-foreground">
        Esta etapa não conta tempo: o relógio da demanda termina quando a apólice é conferida,
        lançada e enviada ao financeiro. Prêmio não pago não cancela a apólice — o financeiro cobra.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Vencimento do boleto</Label>
          <Input
            type="date"
            value={v.vencimento_boleto?.slice(0, 10) ?? ""}
            onChange={(e) => mudar("vencimento_boleto", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label>Status do prêmio</Label>
          <Select value={v.status_premio} onValueChange={(x) => mudar("status_premio", x)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="em_aberto">Em aberto</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data de pagamento</Label>
          <Input
            type="date"
            value={v.data_pagamento_premio?.slice(0, 10) ?? ""}
            onChange={(e) => mudar("data_pagamento_premio", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label>Comissão prevista</Label>
          <Input value={moeda(v.comissao_prevista)} readOnly disabled />
        </div>
        <div className="space-y-1">
          <Label>Comissão recebida</Label>
          <Input
            value={v.comissao_recebida ?? ""}
            onChange={(e) => mudar("comissao_recebida", numero(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>Data do recebimento</Label>
          <Input
            type="date"
            value={v.data_recebimento?.slice(0, 10) ?? ""}
            onChange={(e) => mudar("data_recebimento", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label>Repasse para</Label>
          <Input
            value={v.repasse_para ?? ""}
            placeholder="Canal ou comercial"
            onChange={(e) => mudar("repasse_para", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label>Valor do repasse</Label>
          <Input
            value={v.repasse_valor ?? ""}
            onChange={(e) => mudar("repasse_valor", numero(e.target.value))}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={gravar} disabled={salvar.isPending || !Object.keys(rascunho).length}>
          Salvar financeiro
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={salvar.isPending}
          onClick={async () => {
            await salvar.mutateAsync({ enviado_financeiro_em: new Date().toISOString() });
            toast.success("Enviado ao financeiro.");
          }}
        >
          Enviar ao financeiro
        </Button>
        {v.enviado_financeiro_em && (
          <Badge variant="secondary">enviado em {dataCurta(v.enviado_financeiro_em)}</Badge>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sinistro                                                           */
/* ------------------------------------------------------------------ */

function BlocoSinistro({ apolice, demanda }: { apolice: ApoliceGarantia; demanda: DemandaLista }) {
  const { data: sinistros = [] } = useSinistrosDaApolice(apolice.id);
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const registrar = useRegistrarSinistro(apolice);
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("expectativa");
  const [data, setData] = useState(hoje());
  const [prazos, setPrazos] = useState("");
  const [situacao, setSituacao] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [comQuem, setComQuem] = useState<"sinistro_regulacao" | "sinistro_acompanhamento">(
    "sinistro_regulacao",
  );

  const notificacoes = docs.filter((d) => d.tipo === "notificacao_sinistro");

  const gravar = async () => {
    try {
      await registrar.mutateAsync({
        tipo,
        data,
        prazos: prazos || null,
        situacao_regulacao: situacao || null,
        documento_id: documentoId || null,
        observacao: observacao || null,
        status_demanda: comQuem,
      });
      setAberto(false);
      toast.success("Sinistro registrado. A apólice continua na carteira, marcada em sinistro.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o sinistro.");
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-[#14405C]">Sinistro</h4>
        <Button size="sm" variant="outline" onClick={() => setAberto((a) => !a)}>
          {aberto ? "Fechar" : "Registrar sinistro"}
        </Button>
      </div>
      {sinistros.length > 0 ? (
        <ul className="space-y-1">
          {sinistros.map((s) => (
            <li key={s.id}>
              {TIPOS_SINISTRO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo} ·{" "}
              {dataCurta(s.data)} · {s.situacao_regulacao ?? "regulação não informada"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Nenhum sinistro registrado.</p>
      )}

      {aberto && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SINISTRO.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Prazos</Label>
              <Input value={prazos} onChange={(e) => setPrazos(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Situação da regulação</Label>
              <Input value={situacao} onChange={(e) => setSituacao(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notificação do segurado</Label>
              <Select value={documentoId} onValueChange={setDocumentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Anexo já enviado" />
                </SelectTrigger>
                <SelectContent>
                  {notificacoes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      v{d.versao} — {d.nome_arquivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quem está com a bola</Label>
              <Select value={comQuem} onValueChange={(x) => setComQuem(x as typeof comQuem)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sinistro_regulacao">Seguradora (regulação)</SelectItem>
                  <SelectItem value="sinistro_acompanhamento">Nós (acompanhamento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            rows={2}
            placeholder="Observação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          <Button size="sm" onClick={gravar} disabled={registrar.isPending}>
            Gravar sinistro
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 11 — baixa                                                   */
/* ------------------------------------------------------------------ */

function BlocoBaixa({ apolice, demanda }: { apolice: ApoliceGarantia; demanda: DemandaLista }) {
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const { data: encerramento } = useEncerramentoDaApolice(apolice.id);
  const baixa = useDarBaixa(apolice.id);
  const [tipo, setTipo] = useState("baixa_obrigacao_cumprida");
  const [data, setData] = useState(hoje());
  const [documentoId, setDocumentoId] = useState("");
  const [premioDevolver, setPremioDevolver] = useState("");
  const [estorno, setEstorno] = useState("");
  const [observacao, setObservacao] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  const elegiveis = docs.filter((d) =>
    ["termo_liberacao", "endosso_cancelamento"].includes(d.tipo),
  );
  const comDevolucao = ENCERRAMENTO_COM_DEVOLUCAO.includes(tipo);

  if (encerramento) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <h4 className="font-semibold text-[#14405C]">Encerramento</h4>
        <p>
          {rotuloEncerramento(encerramento.tipo)} em {dataCurta(encerramento.data)}.
        </p>
        <p className="text-xs text-muted-foreground">
          A apólice saiu da carteira ativa e ficou no histórico. Nada foi apagado, e a importância
          segurada voltou para o limite do cliente.
        </p>
      </div>
    );
  }

  const gravar = async () => {
    if (!documentoId) {
      toast.error("Anexe e escolha o termo de liberação ou o endosso de cancelamento.");
      return;
    }
    if (!confirmado) {
      toast.error("Confirme a baixa marcando a caixa de confirmação.");
      return;
    }
    try {
      const r = await baixa.mutateAsync({
        tipo,
        data,
        documento_id: documentoId,
        premio_devolver: comDevolucao ? numero(premioDevolver) : null,
        estorno_comissao: comDevolucao ? numero(estorno) : null,
        observacao: observacao || null,
      });
      toast.success(
        r?.limite_devolvido
          ? "Baixa concluída. O limite do cliente foi devolvido."
          : "Baixa concluída. Não havia linha de limite vigente dessa seguradora para devolver.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível dar baixa.");
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <h4 className="font-semibold text-[#14405C]">Dar baixa na apólice</h4>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Tipo *</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_ENCERRAMENTO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data *</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Documento *</Label>
          <Select value={documentoId} onValueChange={setDocumentoId}>
            <SelectTrigger>
              <SelectValue placeholder="Termo de liberação ou endosso de cancelamento" />
            </SelectTrigger>
            <SelectContent>
              {elegiveis.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {rotuloTipoDocumento(d.tipo)} v{d.versao} — {d.nome_arquivo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!elegiveis.length && (
            <p className="text-xs text-amber-700">
              Nenhum documento elegível anexado. Envie o termo de liberação ou o endosso de
              cancelamento na aba Documentos.
            </p>
          )}
        </div>
        {comDevolucao && (
          <>
            <div className="space-y-1">
              <Label>Prêmio a devolver</Label>
              <Input value={premioDevolver} onChange={(e) => setPremioDevolver(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estorno de comissão</Label>
              <Input value={estorno} onChange={(e) => setEstorno(e.target.value)} />
            </div>
          </>
        )}
      </div>
      <Textarea
        rows={2}
        placeholder="Observação"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
      />
      <label className="flex items-start gap-2 text-xs">
        <Checkbox checked={confirmado} onCheckedChange={(c) => setConfirmado(c === true)} />
        <span>
          Confirmo a baixa. Fica registrado quem confirmou{comDevolucao ? " e aprovou o estorno" : ""}.
        </span>
      </label>
      <Button size="sm" variant="destructive" onClick={gravar} disabled={baixa.isPending}>
        {baixa.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Concluir baixa
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Histórico da apólice                                               */
/* ------------------------------------------------------------------ */

function BlocoHistorico({
  apolice,
  demanda,
  podeVerTempo,
}: {
  apolice: ApoliceGarantia;
  demanda: DemandaLista;
  podeVerTempo: boolean;
}) {
  const { data: familia = [] } = useFamiliaApolice(apolice);
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const { data: auditoria = [] } = useAuditoriaApolice(apolice.id);
  const { data: avisos = [] } = useAvisosRenovacao(apolice.id);

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <h4 className="font-semibold text-[#14405C]">Histórico da apólice</h4>

      <div>
        <p className="font-medium">Apólice mãe, endossos e renovações</p>
        <ul className="list-disc pl-5">
          {familia.map((a) => (
            <li key={a.id}>
              {a.numero_apolice} / endosso {a.numero_endosso} · {a.situacao}
              {a.id === apolice.id ? " (esta)" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-medium">Documentos versionados</p>
        <ul className="list-disc pl-5">
          {docs.map((d) => (
            <li key={d.id}>
              {rotuloTipoDocumento(d.tipo)} v{d.versao} — {d.nome_arquivo}
              {d.substituido_por_id ? " (substituída)" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-medium">Avisos de renovação</p>
        {avisos.length ? (
          <ul className="list-disc pl-5">
            {avisos.map((a) => (
              <li key={a.id}>
                {a.dias_antes} dias antes · {dataCurta(a.data_aviso)} ·{" "}
                {a.enviado ? "enviado" : "pendente"}
                {a.demanda_renovacao_id ? " · renovação aberta" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Nenhum aviso criado.</p>
        )}
      </div>

      <div>
        <p className="font-medium">Alterações registradas</p>
        {auditoria.length ? (
          <ul className="space-y-1">
            {auditoria.map((l) => (
              <li key={l.id}>
                {l.campo}: {l.valor_anterior ?? "—"} → {l.valor_novo ?? "—"}
                {podeVerTempo ? ` · ${dataHora(l.data)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Nenhuma alteração registrada.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aba                                                                */
/* ------------------------------------------------------------------ */

export function AbaApolice({
  demanda,
  podeVerTempo,
}: {
  demanda: DemandaLista;
  podeVerTempo: boolean;
}) {
  const { data: apolices = [], isLoading } = useApolicesDaDemanda(demanda.id);
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const apolice = apolices[0] ?? null;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (demanda.etapa === "8" || !apolice) return <FormularioLancamento demanda={demanda} />;

  if (demanda.etapa === "9") return <BlocoFinanceiro apolice={apolice} />;

  const dias = diasParaVencer(apolice);

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 bg-[#338B85] hover:bg-[#338B85]">
            <Check className="h-3 w-3" /> {apolice.numero_apolice} / endosso {apolice.numero_endosso}
          </Badge>
          <Badge variant="outline">{apolice.situacao}</Badge>
          {dias != null && dias <= 120 && (
            <Badge variant="destructive">vence em {dias} dia(s)</Badge>
          )}
        </div>
        <p className="mt-2">
          {nomeSeguradoraApolice(apolice, seguradoras)} · IS {moeda(apolice.importancia_segurada)} ·
          Prêmio {moeda(apolice.premio)} · Comissão {moeda(apolice.comissao_valor)}
        </p>
        <p className="text-xs text-muted-foreground">
          Vigência {dataCurta(apolice.vigencia_inicio)} a {dataCurta(apolice.vigencia_fim)}
        </p>
      </div>

      <BlocoFinanceiro apolice={apolice} />
      <Separator />
      <BlocoSinistro apolice={apolice} demanda={demanda} />
      <BlocoBaixa apolice={apolice} demanda={demanda} />
      <BlocoHistorico apolice={apolice} demanda={demanda} podeVerTempo={podeVerTempo} />
    </div>
  );
}
