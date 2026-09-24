import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { VisualizadorPdf } from "@/components/pdf/VisualizadorPdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { baixarDocumentoComoBlob, type DocumentoDemanda } from "@/hooks/use-garantia-documentos";
import type { DemandaLista } from "@/hooks/use-garantia-negociacao";
import { mensagemDeErro } from "@/lib/erro";
import { aplicarCamposSugeridos, CAMPOS_APLICAVEIS, type AnaliseIA, type CamposSugeridosIA } from "@/lib/garantia/garantia-ia";
import { analisarDocumento } from "@/lib/garantia/ia/analisar-documento.functions";
import { classificarDocumento, type ClassificacaoDocumento } from "@/lib/garantia/ia/classificar-documento.functions";
import { FL_MODALIDADES, SG_MODALIDADES, buscarModalidade, modalidadeDoHubParaWorker, type ProdutoModalidade } from "@/lib/garantia/ia/modalidades";
import { comoResultadoDocumento, type CamposSugeridosComFonteIA, type ModalidadeSeguroGarantiaIA, type ResultadoFiancaIA, type ResultadoSeguroGarantiaIA, type TrechoRelevanteIA, type ValorComFonte } from "@/lib/garantia/ia/tipos";
import { dataHora, moeda } from "@/lib/garantia/formato";
import { useResponsaveis } from "@/hooks/use-entrada-demandas";

const CAMPOS_ATUAIS: Record<keyof CamposSugeridosIA, keyof DemandaLista | null> = {
  objeto: "objeto", importancia_segurada: "importancia_segurada", vigencia_exigida: "vigencia_exigida",
  percentual_garantia: "percentual_garantia", numero_processo: "numero_processo", numero_contrato: "numero_contrato",
  data_limite: "data_limite", segurado: "segurado_id",
  clausulas_obrigatorias: null, coberturas_adicionais: null, segurado_cnpj: null,
};

function paginaDaFonte(fonte?: string | null): number | null {
  const achado = fonte?.match(/(?:p[aá]g(?:ina)?s?\.?|page)\s*[:º°-]?\s*(\d+)/i);
  return achado ? Number(achado[1]) : null;
}
const valorTexto = (valor: unknown) => typeof valor === "number" ? moeda(valor) : String(valor ?? "—");
const paginaDe = (c?: { pagina?: number | null; fonte?: string | null } | null) => c?.pagina ?? paginaDaFonte(c?.fonte) ?? null;
const ROTULO_PRODUTO: Record<string, string> = { seguro_garantia: "Seguro Garantia", fianca_locaticia: "Fiança locatícia", indefinido: "Produto não identificado" };
const ROTULO_DOC: Record<string, string> = { edital: "Edital", contrato: "Contrato", ata: "Ata", termo_homologacao: "Termo de homologação", contrato_locacao: "Contrato de locação", decisao_judicial: "Decisão judicial", minuta: "Minuta", proposta: "Proposta", outro: "Documento" };
const chaveCat = (produto: ProdutoModalidade, id: string) => `${produto}:${id}`;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  demanda: DemandaLista;
  documento: DocumentoDemanda;
  analise: AnaliseIA | null;
  onNovaAnalise: () => Promise<AnaliseIA>;
}

function PagLink({ pagina, ir }: { pagina: number | null; ir: (p: number) => void }) {
  if (!pagina) return null;
  return <button type="button" onClick={() => ir(pagina)} className="shrink-0 text-xs text-[#338B85] underline-offset-2 hover:underline">pág. {pagina}</button>;
}

export function AnaliseContratoDialog({ aberto, onFechar, demanda, documento, analise, onNovaAnalise }: Props) {
  const executar = useServerFn(analisarDocumento);
  const classificar = useServerFn(classificarDocumento);
  const qc = useQueryClient();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [paginaAlvo, setPaginaAlvo] = useState<number>();
  const [processando, setProcessando] = useState(false);
  const [passo, setPasso] = useState("Preparando o documento…");
  const [local, setLocal] = useState<AnaliseIA | null>(analise);
  const [modalidadeLegada, setModalidadeLegada] = useState("");
  const [previa, setPrevia] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [classif, setClassif] = useState<ClassificacaoDocumento | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [escolha, setEscolha] = useState("");
  const [acompanhar, setAcompanhar] = useState(true);
  const [largo, setLargo] = useState(true);
  const [objetoAberto, setObjetoAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const { data: pessoas = [] } = useResponsaveis();
  const financeiro = local?.fluxo === "financeiro";

  useEffect(() => { setLocal(analise); }, [analise]);
  useEffect(() => {
    const c = (local?.classificacao ?? null) as unknown as ClassificacaoDocumento | null;
    if (c && Array.isArray(c.modalidades)) setClassif(c);
  }, [local?.classificacao]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setLargo(mq.matches);
    f(); mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    baixarDocumentoComoBlob(documento).then((b) => { if (!cancelado) setBlob(b); }).catch((e) => toast.error(mensagemDeErro(e)));
    return () => { cancelado = true; setBlob(null); };
  }, [aberto, documento]);

  /** Clique explícito: sempre leva à página, mesmo que seja a mesma de antes. */
  const ir = useCallback((p: number) => { setPaginaAlvo(undefined); requestAnimationFrame(() => setPaginaAlvo(p)); }, []);

  const produtoDemanda: ProdutoModalidade = (local?.fluxo === "fianca_locaticia" || demanda.produto === "fianca_locaticia") ? "fianca_locaticia" : "seguro_garantia";

  /** Agente 2. */
  const rodarAnalise = async (alvo: AnaliseIA, modalidadeKey: string | null) => {
    const [produto, id] = modalidadeKey ? modalidadeKey.split(":") as [ProdutoModalidade, string] : [null, null];
    const mod = id ? buscarModalidade(id, produto) : null;
    setEscolhendo(false);
    setPasso(mod ? `Analisando ${mod.label}…` : "Analisando o contrato por partes…");
    const retorno = await executar({ data: { analiseId: alvo.id, ...(mod ? { modalidadeId: mod.chave } : {}) } });
    if (!retorno.ok) throw new Error(retorno.mensagem ?? "Não foi possível concluir a análise.");
    setLocal({ ...alvo, situacao: retorno.situacao, resultado: retorno.resultado ?? alvo.resultado, resumo: retorno.resumo ?? alvo.resumo, campos_sugeridos: (retorno.campos_sugeridos ?? alvo.campos_sugeridos) as never, modalidade_id: mod?.id ?? alvo.modalidade_id, modalidade_rotulo: mod?.label ?? alvo.modalidade_rotulo, fluxo: mod ? mod.produto : alvo.fluxo, atualizado_em: new Date().toISOString() });
    await qc.invalidateQueries({ queryKey: ["garantia", "analises-ia", demanda.id] });
  };

  /** Agente 1 → decide se segue direto ou pede a escolha. */
  const iniciar = async (alvo: AnaliseIA) => {
    if (alvo.fluxo === "financeiro") return rodarAnalise(alvo, null);
    if (alvo.modalidade_id) return rodarAnalise(alvo, chaveCat(alvo.fluxo === "fianca_locaticia" ? "fianca_locaticia" : "seguro_garantia", alvo.modalidade_id));
    setPasso("Identificando o tipo de demanda…");
    let c: ClassificacaoDocumento = { produto: "indefinido", modalidades: [], falhou: true };
    let sugerida: string | null = null;
    try {
      const r = await classificar({ data: { analiseId: alvo.id } });
      if (r.ok) { c = r.classificacao; sugerida = r.sugerida; }
    } catch { /* classificação nunca trava: cai na escolha manual */ }
    setClassif(c);
    const produto: ProdutoModalidade = c.produto === "fianca_locaticia" ? "fianca_locaticia" : c.produto === "seguro_garantia" ? "seguro_garantia" : produtoDemanda;
    if (c.modalidades.length === 1) return rodarAnalise(alvo, chaveCat(produto, c.modalidades[0].id));
    if (c.modalidades.length > 1 && sugerida) return rodarAnalise(alvo, chaveCat(produto, sugerida));
    const doHub = modalidadeDoHubParaWorker(demanda.modalidade);
    setEscolha(c.modalidades.length > 1 ? chaveCat(produto, c.modalidades[0].id) : doHub ? chaveCat(doHub.produto, doHub.id) : "");
    setEscolhendo(true);
  };

  const executarComAviso = async (fn: () => Promise<void>) => {
    setProcessando(true);
    try { await fn(); } catch (e) { toast.error(mensagemDeErro(e)); } finally { setProcessando(false); }
  };

  const analisar = (forcar = false) => executarComAviso(async () => {
    let alvo = local;
    if (forcar || !alvo) { alvo = await onNovaAnalise(); setLocal(alvo); setClassif(null); }
    if (alvo.situacao === "concluida" && !forcar) return;
    if (!blob) throw new Error("O documento ainda está sendo aberto.");
    await iniciar(alvo);
  });

  const analisarEscolha = () => executarComAviso(async () => { if (local && escolha) await rodarAnalise(local, escolha); });

  /** Nova análise para outra modalidade do mesmo documento. */
  const analisarOutra = (key: string) => executarComAviso(async () => {
    const nova = await onNovaAnalise();
    if (classif) await supabase.from("garantia_analises_ia").update({ classificacao: classif as unknown as Json }).eq("id", nova.id);
    setLocal({ ...nova, classificacao: classif as unknown as Json });
    await rodarAnalise(nova, key);
  });

  useEffect(() => {
    if (aberto && local && ["solicitada", "erro"].includes(local.situacao) && blob && !processando) void analisar();
    // O início automático ocorre uma vez quando os dados necessários ficam disponíveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, local?.id, blob]);

  const resultado = comoResultadoDocumento(local?.resultado ?? null);
  const sugestoesBase = (local?.campos_sugeridos ?? {}) as unknown as CamposSugeridosComFonteIA;
  // Fallback para análises antigas (sem modalidade_id) com várias modalidades.
  const variasModalidades = !local?.modalidade_id && (sugestoesBase.modalidades?.length ?? 0) > 1;
  const sugestoes = useMemo(() => {
    const gerais = { ...sugestoesBase };
    delete gerais.modalidades;
    const escolhida = sugestoesBase.modalidades?.find((m) => m.nome === modalidadeLegada);
    // Análises antigas: une processo/contrato num só e descarta data limite.
    const numero = gerais.numero_contrato ?? gerais.numero_processo;
    delete gerais.numero_processo;
    delete gerais.data_limite;
    if (numero) gerais.numero_contrato = numero;
    return { ...gerais, ...(escolhida?.campos ?? (sugestoesBase.modalidades?.length === 1 ? sugestoesBase.modalidades[0].campos : {})) } as CamposSugeridosComFonteIA;
  }, [sugestoesBase, modalidadeLegada]);

  const seguro = resultado?.tipo === "Seguro Garantia" ? resultado as ResultadoSeguroGarantiaIA : null;
  const fianca = resultado?.tipo === "Fianca Locaticia" ? resultado as ResultadoFiancaIA : null;
  const modResultado: ModalidadeSeguroGarantiaIA | undefined = seguro?.modalidades?.find((m) => m.nome === modalidadeLegada) ?? seguro?.modalidades?.[0];
  const trechos: (TrechoRelevanteIA & { pagina?: number | null })[] = seguro?.trechos_relevantes ?? fianca?.trechos_relevantes ?? [];
  const solicitante = pessoas.find((p) => p.user_id === local?.solicitada_por)?.nome;
  const atencao = (seguro ? [...(seguro.pendencias_para_emissao ?? []), ...(seguro.alertas_de_risco ?? [])] : fianca?.riscos?.map((r) => r.descricao) ?? []).slice(0, 3);

  // ── O PDF acompanha a rolagem do resultado ────────────────────────────────
  const seguir = acompanhar && largo && !!resultado && !processando;
  useEffect(() => {
    const root = painel.current;
    if (!seguir || !root) return;
    const visiveis = new Set<Element>();
    let ultima: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const avaliar = () => {
      const topo = root.getBoundingClientRect().top;
      let melhor: { d: number; p: number } | null = null;
      visiveis.forEach((el) => {
        const p = Number((el as HTMLElement).dataset.pagina);
        if (!p) return;
        const d = Math.abs(el.getBoundingClientRect().top - topo);
        if (!melhor || d < melhor.d) melhor = { d, p };
      });
      const m = melhor as { d: number; p: number } | null;
      if (m && m.p !== ultima) { ultima = m.p; setPaginaAlvo(m.p); }
    };
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) e.isIntersecting ? visiveis.add(e.target) : visiveis.delete(e.target);
      clearTimeout(timer);
      timer = setTimeout(avaliar, 200);
    }, { root, threshold: 0 });
    root.querySelectorAll("[data-pagina]").forEach((el) => io.observe(el));
    return () => { clearTimeout(timer); io.disconnect(); };
  }, [seguir, local?.id, local?.atualizado_em, modalidadeLegada]);

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

  // ── Ficha ────────────────────────────────────────────────────────────────
  const vigIni: ValorComFonte<string | null> | undefined = modResultado?.vigencia_inicio ?? (fianca?.dados_gerais?.vigencia_inicio as ValorComFonte<string | null> | undefined);
  const vigFim: ValorComFonte<string | null> | undefined = modResultado?.vigencia_fim ?? (fianca?.dados_gerais?.vigencia_fim as ValorComFonte<string | null> | undefined);
  const pctTexto = sugestoes.percentual_garantia ? `${String(sugestoes.percentual_garantia.valor).replace(".", ",")}%` : null;
  const base = modResultado?.base_calculo?.valor ?? null;
  const produtoRotulo = seguro ? "Seguro Garantia" : fianca ? "Fiança locatícia" : "";
  const modRotulo = local?.modalidade_rotulo ?? (modalidadeLegada || modResultado?.nome || "");
  const linhas: Array<{ rotulo: string; valor: React.ReactNode; pagina: number | null; vazio?: boolean }> = resultado && !financeiro ? [
    { rotulo: "Tipo", valor: [produtoRotulo, modRotulo].filter(Boolean).join(" · "), pagina: null },
    { rotulo: "Importância segurada", valor: sugestoes.importancia_segurada ? moeda(sugestoes.importancia_segurada.valor) : "Não consta no documento", pagina: paginaDe(sugestoes.importancia_segurada), vazio: !sugestoes.importancia_segurada },
    { rotulo: "% da garantia", valor: pctTexto ? `${pctTexto}${base ? ` · ${base}` : ""}` : base ?? "Não consta no documento", pagina: paginaDe(sugestoes.percentual_garantia) ?? paginaDaFonte(modResultado?.base_calculo?.fonte), vazio: !pctTexto && !base },
    { rotulo: "Tomador", valor: sugestoes.tomador ? `${sugestoes.tomador.valor}${sugestoes.tomador.cnpj ? ` · ${sugestoes.tomador.cnpj}` : ""}` : "Não consta no documento", pagina: paginaDe(sugestoes.tomador), vazio: !sugestoes.tomador },
    { rotulo: "Segurado", valor: sugestoes.segurado ? `${sugestoes.segurado.valor}${sugestoes.segurado.cnpj ? ` · ${sugestoes.segurado.cnpj}` : ""}` : "Não consta no documento", pagina: paginaDe(sugestoes.segurado), vazio: !sugestoes.segurado },
    ...(vigIni?.valor || vigFim?.valor ? [
      { rotulo: "Vigência início", valor: vigIni?.valor ?? "—", pagina: paginaDaFonte(vigIni?.fonte) ?? paginaDe(sugestoes.vigencia_exigida) },
      { rotulo: "Vigência fim", valor: vigFim?.valor ?? "—", pagina: paginaDaFonte(vigFim?.fonte) ?? paginaDe(sugestoes.vigencia_exigida) },
    ] : [{ rotulo: "Vigência", valor: modResultado?.vigencia_obs?.valor ?? sugestoes.vigencia_exigida?.valor ?? "Não consta no documento", pagina: paginaDe(sugestoes.vigencia_exigida) ?? paginaDaFonte(modResultado?.vigencia_obs?.fonte), vazio: !modResultado?.vigencia_obs?.valor && !sugestoes.vigencia_exigida }]),
    ...(sugestoes.objeto ? [{ rotulo: "Objeto", valor: <span className={objetoAberto ? "" : "line-clamp-2"}>{sugestoes.objeto.valor}</span>, pagina: paginaDe(sugestoes.objeto) }] : []),
    ...(sugestoes.numero_contrato ? [{ rotulo: "Nº do contrato/processo", valor: sugestoes.numero_contrato.valor, pagina: paginaDe(sugestoes.numero_contrato) }] : []),
  ] : [];

  const outrasModalidades = (classif?.modalidades ?? []).filter((m) => m.id !== local?.modalidade_id);
  const produtoClassif: ProdutoModalidade = classif?.produto === "fianca_locaticia" ? "fianca_locaticia" : classif?.produto === "seguro_garantia" ? "seguro_garantia" : produtoDemanda;
  const rotuloMod = (id: string) => buscarModalidade(id, produtoClassif)?.label ?? id;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl min-w-0 overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>{financeiro ? "Análise financeira por IA" : "Análise do contrato por IA"}</DialogTitle><DialogDescription>{documento.nome_arquivo}{(local?.documentos_ids?.length ?? 0) > 1 ? ` e mais ${local!.documentos_ids.length - 1} (páginas referem-se a este)` : ""}{local ? ` · solicitada em ${dataHora(local.criado_em)}` : ""}{solicitante ? ` por ${solicitante}` : ""}</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="order-2 min-w-0 lg:order-1">{blob ? <VisualizadorPdf blob={blob} paginaAlvo={paginaAlvo} /> : <div className="flex h-72 items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abrindo documento…</div>}</div>
          <div ref={painel} className="order-1 min-w-0 space-y-4 lg:order-2 lg:max-h-[calc(75vh+2.5rem)] lg:overflow-y-auto lg:pr-1">
            {classif && !financeiro && (
              <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
                <p className="text-muted-foreground">{ROTULO_DOC[classif.tipo_documento ?? "outro"] ?? "Documento"} · {ROTULO_PRODUTO[classif.produto]}{classif.falhou ? " · não foi possível identificar" : ""}</p>
                {classif.modalidades.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{classif.modalidades.map((m) => {
                  const key = chaveCat(produtoClassif, m.id);
                  const ativo = escolhendo ? escolha === key : local?.modalidade_id === m.id;
                  return <span key={m.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${ativo ? "border-[#338B85] bg-[#338B85]/10" : "bg-background"}`}>
                    <button type="button" disabled={!escolhendo} onClick={() => setEscolha(key)} className="disabled:cursor-default">{rotuloMod(m.id)}</button>
                    <PagLink pagina={m.pagina} ir={ir} />
                  </span>;
                })}</div>}
              </div>
            )}
            {escolhendo && !processando && (
              <div className="space-y-2 rounded-md border p-3">
                <Label>{(classif?.modalidades.length ?? 0) > 1 ? "Esta demanda é de qual garantia?" : "Qual modalidade analisar?"}</Label>
                {(classif?.modalidades.length ?? 0) <= 1 && (
                  <Select value={escolha} onValueChange={setEscolha}>
                    <SelectTrigger><SelectValue placeholder="Escolha a modalidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup><SelectLabel>Seguro Garantia</SelectLabel>{SG_MODALIDADES.map((m) => <SelectItem key={chaveCat(m.produto, m.id)} value={chaveCat(m.produto, m.id)}>{m.label}</SelectItem>)}</SelectGroup>
                      <SelectGroup><SelectLabel>Fiança locatícia</SelectLabel>{FL_MODALIDADES.map((m) => <SelectItem key={chaveCat(m.produto, m.id)} value={chaveCat(m.produto, m.id)}>{m.label}</SelectItem>)}</SelectGroup>
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" onClick={() => void analisarEscolha()} disabled={!escolha}>Analisar esta</Button>
              </div>
            )}
            {processando || local?.situacao === "processando" ? <div className="rounded-md border p-5 text-center"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#338B85]" /><p className="font-medium">{passo}</p><p className="mt-1 text-xs text-muted-foreground">O resultado fica guardado nesta demanda.</p></div> : null}
            {local?.situacao === "erro" && !processando && !escolhendo ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{local.erro_mensagem}</div> : null}
            {resultado && !processando ? <>
              {variasModalidades && <section className="space-y-1"><Label className="text-xs">Modalidades lidas nesta análise</Label><Select value={modalidadeLegada} onValueChange={setModalidadeLegada}><SelectTrigger><SelectValue placeholder="Escolha antes de preencher" /></SelectTrigger><SelectContent>{sugestoesBase.modalidades?.map((m) => <SelectItem key={m.nome} value={m.nome}>{m.nome}</SelectItem>)}</SelectContent></Select></section>}

              {financeiro ? (
                <section className="space-y-2"><h3 className="font-semibold text-[#14405C]">Resumo</h3><p className="text-sm">{local?.resumo}</p></section>
              ) : (
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#14405C]">Ficha para o corretor</h3>
                    {largo && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={acompanhar} onCheckedChange={setAcompanhar} className="scale-75" />Acompanhar no PDF</label>}
                  </div>
                  <dl className="divide-y rounded-md border text-sm">
                    {linhas.map((l) => (
                      <div key={l.rotulo} data-pagina={l.pagina ?? undefined} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-start gap-2 px-3 py-1.5">
                        <dt className="text-xs text-muted-foreground">{l.rotulo}</dt>
                        <dd className={l.vazio ? "text-muted-foreground" : ""}>{l.valor}{l.rotulo === "Objeto" && <button type="button" onClick={() => setObjetoAberto((v) => !v)} className="block text-xs text-[#338B85]">{objetoAberto ? "ver menos" : "ver mais"}</button>}</dd>
                        <PagLink pagina={l.pagina} ir={ir} />
                      </div>
                    ))}
                  </dl>
                  {seguro?.conclusao_operacional && <div className="flex flex-wrap gap-1.5"><Badge variant={seguro.conclusao_operacional.pode_cotar ? "default" : "secondary"} className="text-[10px]">Pode cotar: {seguro.conclusao_operacional.pode_cotar ? "sim" : "não"}</Badge><Badge variant={seguro.conclusao_operacional.pode_emitir ? "default" : "secondary"} className="text-[10px]">Pode emitir: {seguro.conclusao_operacional.pode_emitir ? "sim" : "não"}</Badge><Badge variant="outline" className="text-[10px]">Confiança {seguro.conclusao_operacional.nivel_confianca}</Badge></div>}
                  {fianca?.parecer?.recomendacao && <Badge variant="outline" className="text-[10px]">{fianca.parecer.recomendacao}</Badge>}
                </section>
              )}

              {atencao.length > 0 && <section><h3 className="text-sm font-semibold text-[#14405C]">Atenção</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{atencao.map((x, i) => <li key={i} data-pagina={paginaDaFonte(x) ?? undefined}>{x}</li>)}</ul></section>}

              {!financeiro && local?.modalidade_id && outrasModalidades.length > 0 && (
                <p className="text-xs text-muted-foreground">Analisar outra modalidade: {outrasModalidades.map((m, i) => <span key={m.id}>{i > 0 && " · "}<button type="button" className="text-[#338B85] hover:underline" onClick={() => void analisarOutra(chaveCat(produtoClassif, m.id))}>{rotuloMod(m.id)}</button></span>)}</p>
              )}

              <details className="group rounded-md border">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-[#14405C]">Detalhes da leitura<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
                <div className="space-y-4 border-t p-3">
                  {!financeiro && local?.resumo && <section className="space-y-1"><h4 className="text-sm font-semibold">Resumo executivo</h4><p className="text-sm">{local.resumo}</p>{seguro?.conclusao_operacional?.motivo && <p className="text-xs text-muted-foreground">{seguro.conclusao_operacional.motivo}</p>}</section>}
                  {trechos.length > 0 && <section className="space-y-2"><h4 className="text-sm font-semibold">Trechos relevantes</h4>{trechos.map((t, i) => { const p = t.pagina ?? paginaDaFonte(t.pagina_ou_localizacao); return <div key={`${t.tema}-${i}`} data-pagina={p ?? undefined} className="rounded-md border p-2.5 text-sm"><div className="flex items-start justify-between gap-3"><strong>{t.tema}</strong><PagLink pagina={p} ir={ir} /></div><blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">{t.trecho}</blockquote></div>; })}</section>}
                  {(modResultado?.clausulas_necessarias?.length || fianca?.clausulas_necessarias?.length) ? <section><h4 className="text-sm font-semibold">Cláusulas necessárias</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{(modResultado?.clausulas_necessarias ?? fianca?.clausulas_necessarias ?? []).map((c, i) => <li key={i} data-pagina={paginaDaFonte(c.fonte) ?? undefined}>{c.descricao} <PagLink pagina={paginaDaFonte(c.fonte)} ir={ir} /></li>)}</ul></section> : null}
                  {fianca?.clausulas_criticas?.length ? <section><h4 className="text-sm font-semibold">Cláusulas críticas</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{fianca.clausulas_criticas.map((c, i) => <li key={i} data-pagina={paginaDaFonte(c.fonte) ?? undefined}><strong>{c.titulo}</strong>: {c.descricao}</li>)}</ul></section> : null}
                  {seguro && ([["Pendências para emissão", seguro.pendencias_para_emissao], ["Perguntas para o cliente", seguro.perguntas_para_cliente_ou_comercial], ["Alertas de risco", seguro.alertas_de_risco]] as const).map(([titulo, itens]) => itens?.length ? <section key={titulo}><h4 className="text-sm font-semibold">{titulo}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{itens.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null)}
                  {fianca?.riscos?.length ? <section><h4 className="text-sm font-semibold">Riscos</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{fianca.riscos.map((r, i) => <li key={i}>{r.descricao}</li>)}</ul></section> : null}
                  {(seguro?.parecer?.justificativa || fianca?.parecer?.justificativa) && <section><h4 className="text-sm font-semibold">Parecer</h4><p className="text-sm">{seguro?.parecer?.justificativa ?? fianca?.parecer?.justificativa}</p></section>}
                </div>
              </details>
            </> : null}
            <p className="text-xs text-muted-foreground">A IA pode cometer erros. Confira no documento antes de usar.</p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">{resultado && <Button variant="outline" onClick={() => void analisar(true)} disabled={processando}><RefreshCw className="mr-2 h-4 w-4" />Analisar de novo</Button>}<Button variant="ghost" onClick={onFechar}>Não preencher</Button><Button onClick={abrirPrevia} disabled={!resultado || processando || financeiro || (variasModalidades && !modalidadeLegada)}><Sparkles className="mr-2 h-4 w-4" />Preencher os dados faltantes com esta análise</Button></DialogFooter>
      </DialogContent>

      <Dialog open={previa} onOpenChange={setPrevia}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Conferir preenchimento</DialogTitle><DialogDescription>Campos já preenchidos começam desmarcados. Marque-os somente se quiser substituir o trabalho atual.</DialogDescription></DialogHeader><div className="space-y-2">
        {sugestoes.tomador && <div className="flex items-start gap-3 rounded-md border p-3 opacity-80"><Checkbox checked={false} disabled /><span className="min-w-0 text-sm"><strong>Tomador</strong><span className="block text-muted-foreground">Atual: {demanda.cliente?.nome ?? "—"}</span><span className="block">Lido: {sugestoes.tomador.valor}{sugestoes.tomador.cnpj ? ` · ${sugestoes.tomador.cnpj}` : ""}</span><span className="block text-xs text-muted-foreground">O tomador já vem da Entrada; confira se bate.</span></span></div>}
        {CAMPOS_APLICAVEIS.map((c) => { const campo = sugestoes[c.chave as keyof typeof sugestoes]; if (!campo || typeof campo !== "object" || !("valor" in campo)) return null; const atualKey = CAMPOS_ATUAIS[c.chave]; const atual = c.chave === "segurado" ? demanda.segurado?.nome ?? null : c.chave === "numero_contrato" ? demanda.numero_contrato ?? demanda.numero_processo : atualKey ? demanda[atualKey] : null; const fmtPct = (v: unknown) => c.chave === "percentual_garantia" && typeof v === "number" ? `${String(v).replace(".", ",")} %` : valorTexto(v); return <label key={c.chave} className="flex items-start gap-3 rounded-md border p-3"><Checkbox checked={!!selecionados[c.chave]} onCheckedChange={(v) => setSelecionados((s) => ({ ...s, [c.chave]: v === true }))} /><span className="min-w-0 text-sm"><strong>{c.rotulo}</strong><span className="block text-muted-foreground">Atual: {fmtPct(atual)}</span><span className="block">Sugerido: {fmtPct(campo.valor)}</span><span className="block text-xs text-muted-foreground">Fonte: {campo.fonte}</span></span></label>; })}
      </div><DialogFooter><Button variant="ghost" onClick={() => setPrevia(false)}>Voltar</Button><Button onClick={aplicar} disabled={!Object.values(selecionados).some(Boolean)}><Check className="mr-2 h-4 w-4" />Confirmar preenchimento</Button></DialogFooter></DialogContent></Dialog>
    </Dialog>
  );
}
