import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { VisualizadorPdf } from "@/components/pdf/VisualizadorPdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { baixarDocumentoComoBlob, type DocumentoDemanda } from "@/hooks/use-garantia-documentos";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { mensagemDeErro } from "@/lib/erro";
import { aplicarCamposSugeridos, CAMPOS_APLICAVEIS, type AnaliseIA, type CamposSugeridosIA } from "@/lib/garantia/garantia-ia";
import { analisarDocumento } from "@/lib/garantia/ia/analisar-documento.functions";
import { comoResultadoDocumento, type CamposSugeridosComFonteIA, type ResultadoFiancaIA, type ResultadoSeguroGarantiaIA, type TrechoRelevanteIA } from "@/lib/garantia/ia/tipos";
import { dataHora, moeda } from "@/lib/garantia/formato";
import { useResponsaveis } from "@/hooks/use-entrada-demandas";

const CAMPOS_ATUAIS: Record<keyof CamposSugeridosIA, keyof DemandaLista | null> = {
  objeto: "objeto", importancia_segurada: "importancia_segurada", vigencia_exigida: "vigencia_exigida",
  percentual_garantia: "percentual_garantia", numero_processo: "numero_processo", numero_contrato: "numero_contrato",
  data_limite: "data_limite", segurado: "segurado_id",
  clausulas_obrigatorias: null, coberturas_adicionais: null, segurado_cnpj: null,
};

function paginaDaFonte(fonte?: string | null): number | null {
  const achado = fonte?.match(/(?:p[aá]g(?:ina)?\.?|pagina|page)\s*[:º°-]?\s*(\d+)/i);
  return achado ? Number(achado[1]) : null;
}
const valorTexto = (valor: unknown) => typeof valor === "number" ? moeda(valor) : String(valor ?? "—");

interface Props {
  aberto: boolean;
  onFechar: () => void;
  demanda: DemandaLista;
  documento: DocumentoDemanda;
  analise: AnaliseIA | null;
  onNovaAnalise: () => Promise<AnaliseIA>;
}

export function AnaliseContratoDialog({ aberto, onFechar, demanda, documento, analise, onNovaAnalise }: Props) {
  const executar = useServerFn(analisarDocumento);
  const qc = useQueryClient();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [paginaAlvo, setPaginaAlvo] = useState<number>();
  const [processando, setProcessando] = useState(false);
  const [passo, setPasso] = useState("Preparando o documento…");
  const [local, setLocal] = useState<AnaliseIA | null>(analise);
  const [modalidade, setModalidade] = useState("");
  const [previa, setPrevia] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const { data: pessoas = [] } = useResponsaveis();

  useEffect(() => { setLocal(analise); }, [analise]);
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    baixarDocumentoComoBlob(documento).then((b) => { if (!cancelado) setBlob(b); }).catch((e) => toast.error(mensagemDeErro(e)));
    return () => { cancelado = true; setBlob(null); };
  }, [aberto, documento]);

  const resultado = comoResultadoDocumento(local?.resultado ?? null);
  const sugestoesBase = (local?.campos_sugeridos ?? {}) as unknown as CamposSugeridosComFonteIA;
  const variasModalidades = (sugestoesBase.modalidades?.length ?? 0) > 1;
  const sugestoes = useMemo(() => {
    const gerais = { ...sugestoesBase };
    delete gerais.modalidades;
    const escolha = sugestoesBase.modalidades?.find((m) => m.nome === modalidade);
    return { ...gerais, ...(escolha?.campos ?? (sugestoesBase.modalidades?.length === 1 ? sugestoesBase.modalidades[0].campos : {})) };
  }, [sugestoesBase, modalidade]);

  const analisar = async (forcar = false) => {
    setProcessando(true);
    try {
      let alvo = local;
      if (forcar || !alvo) alvo = await onNovaAnalise();
      if (alvo.situacao === "concluida" && !forcar) return;
      if (!blob) throw new Error("O documento ainda está sendo aberto.");
      setPasso("Analisando o contrato por partes…");
      const retorno = await executar({ data: { analiseId: alvo.id } });
      if (!retorno.ok) throw new Error(retorno.mensagem ?? "Não foi possível concluir a análise.");
      setLocal({ ...alvo, situacao: retorno.situacao, resultado: retorno.resultado ?? alvo.resultado, resumo: retorno.resumo ?? alvo.resumo, campos_sugeridos: (retorno.campos_sugeridos ?? alvo.campos_sugeridos) as never, atualizado_em: new Date().toISOString() });
      await qc.invalidateQueries({ queryKey: ["garantia", "analises-ia", demanda.id] });
    } catch (e) { toast.error(mensagemDeErro(e)); }
    finally { setProcessando(false); }
  };

  useEffect(() => {
    if (aberto && local && ["solicitada", "erro"].includes(local.situacao) && blob && !processando) void analisar();
    // O início automático ocorre uma vez quando os dados necessários ficam disponíveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, local?.id, blob]);

  const abrirPrevia = () => {
    const iniciais: Record<string, boolean> = {};
    for (const c of CAMPOS_APLICAVEIS) {
      const sugerido = sugestoes[c.chave as keyof typeof sugestoes];
      const campoAtual = CAMPOS_ATUAIS[c.chave];
      const atual = campoAtual ? demanda[campoAtual] : null;
      iniciais[c.chave] = !!sugerido && (atual === null || atual === undefined || atual === "");
    }
    setSelecionados(iniciais);
    setPrevia(true);
  };

  const aplicar = async () => {
    const campos: CamposSugeridosIA = {};
    for (const [chave, marcado] of Object.entries(selecionados)) {
      if (!marcado) continue;
      const sugerido = sugestoes[chave as keyof typeof sugestoes];
      if (sugerido && typeof sugerido === "object" && "valor" in sugerido) (campos as Record<string, unknown>)[chave] = sugerido.valor;
      if (chave === "segurado" && sugestoes.segurado?.cnpj) campos.segurado_cnpj = sugestoes.segurado.cnpj;
    }
    try {
      await aplicarCamposSugeridos(demanda.id, campos, local?.id);
      toast.success("Dados selecionados preenchidos.");
      setPrevia(false); onFechar();
      await qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
      await qc.invalidateQueries({ queryKey: ["garantia", "analises-ia", demanda.id] });
    } catch (e) { toast.error(mensagemDeErro(e)); }
  };

  const ir = (fonte?: string | null) => { const pagina = paginaDaFonte(fonte); if (pagina) setPaginaAlvo(pagina); };
  const seguro = resultado?.tipo === "Seguro Garantia" ? resultado as ResultadoSeguroGarantiaIA : null;
  const fianca = resultado?.tipo === "Fianca Locaticia" ? resultado as ResultadoFiancaIA : null;
  const trechos: TrechoRelevanteIA[] = seguro?.trechos_relevantes ?? fianca?.trechos_relevantes ?? [];
  const solicitante = pessoas.find((p) => p.user_id === local?.solicitada_por)?.nome;
  const listas = seguro ? [
    ["Pendências para emissão", seguro.pendencias_para_emissao],
    ["Perguntas para o cliente", seguro.perguntas_para_cliente_ou_comercial],
    ["Alertas de risco", seguro.alertas_de_risco],
  ] as const : [["Alertas de risco", fianca?.riscos?.map((r) => r.descricao) ?? []]] as const;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl min-w-0 overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Análise do contrato por IA</DialogTitle><DialogDescription>{documento.nome_arquivo}{local ? ` · solicitada em ${dataHora(local.criado_em)}` : ""}{solicitante ? ` por ${solicitante}` : ""}</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">{blob ? <VisualizadorPdf blob={blob} paginaAlvo={paginaAlvo} /> : <div className="flex h-72 items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abrindo documento…</div>}</div>
          <div className="min-w-0 space-y-5">
            {processando || local?.situacao === "processando" ? <div className="rounded-md border p-5 text-center"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#338B85]" /><p className="font-medium">{passo}</p><p className="mt-1 text-xs text-muted-foreground">O resultado fica guardado nesta demanda.</p></div> : null}
            {local?.situacao === "erro" && !processando ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{local.erro_mensagem}</div> : null}
            {resultado && !processando ? <>
              <section className="space-y-2"><h3 className="font-semibold text-[#14405C]">Resumo executivo</h3><p className="text-sm">{local?.resumo}</p>{seguro?.conclusao_operacional ? <div className="flex flex-wrap gap-2"><Badge variant={seguro.conclusao_operacional.pode_cotar ? "default" : "secondary"}>Pode cotar: {seguro.conclusao_operacional.pode_cotar ? "sim" : "não"}</Badge><Badge variant={seguro.conclusao_operacional.pode_emitir ? "default" : "secondary"}>Pode emitir: {seguro.conclusao_operacional.pode_emitir ? "sim" : "não"}</Badge><Badge variant="outline">Confiança {seguro.conclusao_operacional.nivel_confianca}</Badge><p className="w-full text-xs text-muted-foreground">{seguro.conclusao_operacional.motivo}</p></div> : fianca?.parecer ? <p className="text-sm"><strong>{fianca.parecer.recomendacao}:</strong> {fianca.parecer.justificativa}</p> : null}</section>
              {variasModalidades && <section className="space-y-2"><Label>Qual modalidade será usada?</Label><Select value={modalidade} onValueChange={setModalidade}><SelectTrigger><SelectValue placeholder="Escolha antes de preencher" /></SelectTrigger><SelectContent>{sugestoesBase.modalidades?.map((m) => <SelectItem key={m.nome} value={m.nome}>{m.nome}</SelectItem>)}</SelectContent></Select></section>}
              <section className="space-y-2"><h3 className="font-semibold text-[#14405C]">Dados extraídos</h3>{Object.entries(sugestoes).filter(([k]) => k !== "modalidades").map(([chave, campo]) => campo && typeof campo === "object" && "valor" in campo ? <div key={chave} className="rounded-md border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{CAMPOS_APLICAVEIS.find((c) => c.chave === chave)?.rotulo ?? chave}</p><p>{valorTexto(campo.valor)}</p></div>{paginaDaFonte(campo.fonte) ? <Button size="sm" variant="outline" onClick={() => ir(campo.fonte)}><ExternalLink className="mr-1 h-3.5 w-3.5" />Ver no documento</Button> : null}</div><p className="mt-1 text-xs text-muted-foreground">Fonte: {campo.fonte}</p></div> : null)}</section>
              {trechos.length > 0 && <section className="space-y-2"><h3 className="font-semibold text-[#14405C]">Trechos relevantes</h3>{trechos.map((t, i) => <div key={`${t.tema}-${i}`} className="rounded-md border p-3 text-sm"><div className="flex items-start justify-between gap-3"><strong>{t.tema}</strong>{paginaDaFonte(t.pagina_ou_localizacao) ? <Button size="sm" variant="outline" onClick={() => ir(t.pagina_ou_localizacao)}>Ver no documento</Button> : null}</div><blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground">{t.trecho}</blockquote><p className="mt-1 text-xs text-muted-foreground">{t.pagina_ou_localizacao}</p></div>)}</section>}
              {listas.map(([titulo, itens]) => itens.length ? <section key={titulo}><h3 className="font-semibold text-[#14405C]">{titulo}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{itens.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null)}
            </> : null}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row"><p className="mr-auto text-xs text-muted-foreground">O chat para ajustar a análise chega na próxima rodada.</p>{resultado && <Button variant="outline" onClick={() => void analisar(true)} disabled={processando}><RefreshCw className="mr-2 h-4 w-4" />Analisar de novo</Button>}<Button variant="ghost" onClick={onFechar}>Não preencher</Button><Button onClick={abrirPrevia} disabled={!resultado || processando || (variasModalidades && !modalidade)}><Sparkles className="mr-2 h-4 w-4" />Preencher os dados faltantes com esta análise</Button></DialogFooter>
      </DialogContent>

      <Dialog open={previa} onOpenChange={setPrevia}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Conferir preenchimento</DialogTitle><DialogDescription>Campos já preenchidos começam desmarcados. Marque-os somente se quiser substituir o trabalho atual.</DialogDescription></DialogHeader><div className="space-y-2">{CAMPOS_APLICAVEIS.map((c) => { const campo = sugestoes[c.chave as keyof typeof sugestoes]; if (!campo || typeof campo !== "object" || !("valor" in campo)) return null; const atualKey = CAMPOS_ATUAIS[c.chave]; const atual = atualKey ? demanda[atualKey] : null; return <label key={c.chave} className="flex items-start gap-3 rounded-md border p-3"><Checkbox checked={!!selecionados[c.chave]} onCheckedChange={(v) => setSelecionados((s) => ({ ...s, [c.chave]: v === true }))} /><span className="min-w-0 text-sm"><strong>{c.rotulo}</strong><span className="block text-muted-foreground">Atual: {valorTexto(atual)}</span><span className="block">Sugerido: {valorTexto(campo.valor)}</span><span className="block text-xs text-muted-foreground">Fonte: {campo.fonte}</span></span></label>; })}</div><DialogFooter><Button variant="ghost" onClick={() => setPrevia(false)}>Voltar</Button><Button onClick={aplicar} disabled={!Object.values(selecionados).some(Boolean)}><Check className="mr-2 h-4 w-4" />Confirmar preenchimento</Button></DialogFooter></DialogContent></Dialog>
    </Dialog>
  );
}
