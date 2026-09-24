// Sugestão de prêmio estimado para a janela "Registrar perda". Puro e testável.
//
// Ordem: cotação escolhida → menor prêmio cotado → fórmula de mercado
// (IS × taxa anual × prazo/365), com a taxa média da modalidade no Hub
// (mínimo de amostras) ou a taxa de referência configurada.

export const MIN_AMOSTRAS_MEDIA = 5;

export interface CotacaoParaEstimativa {
  premio: number | null;
  escolhida: boolean;
  seguradora: string;
}

export interface EntradaEstimativa {
  cotacoes: CotacaoParaEstimativa[];
  importanciaSegurada: number | null;
  prazoDias: number;
  /** Taxa anual em % (1 = 1% a.a.). */
  taxaReferenciaPct: number;
  mediaModalidade: { media: number | null; amostras: number } | null;
  rotuloModalidade: string;
}

export type OrigemEstimativa = "cotacao_escolhida" | "menor_cotacao" | "media_modalidade" | "taxa_referencia";

export interface Sugestao {
  premio: number;
  origem: OrigemEstimativa;
  descricao: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
const arred = (v: number) => Math.round(v * 100) / 100;

export function sugerirPremio(e: EntradaEstimativa): Sugestao | null {
  const escolhida = e.cotacoes.find((c) => c.escolhida && c.premio != null && c.premio > 0);
  if (escolhida) {
    return {
      premio: arred(escolhida.premio!),
      origem: "cotacao_escolhida",
      descricao: `prêmio da cotação escolhida — ${escolhida.seguradora}`,
    };
  }
  const comPremio = e.cotacoes.filter((c) => c.premio != null && c.premio > 0);
  if (comPremio.length) {
    const menor = comPremio.reduce((a, b) => (b.premio! < a.premio! ? b : a));
    return {
      premio: arred(menor.premio!),
      origem: "menor_cotacao",
      descricao: `menor prêmio cotado — ${menor.seguradora}`,
    };
  }
  const is = e.importanciaSegurada;
  if (is == null || !(is > 0)) return null;
  const prazo = e.prazoDias > 0 ? e.prazoDias : 365;

  const m = e.mediaModalidade;
  const usaMedia = !!m && m.media != null && m.media > 0 && m.amostras >= MIN_AMOSTRAS_MEDIA;
  const taxa = usaMedia ? m!.media! : e.taxaReferenciaPct;
  if (!(taxa > 0)) return null;

  const premio = arred((is * (taxa / 100) * prazo) / 365);
  const fonte = usaMedia
    ? `média de ${m!.amostras} cotações de ${e.rotuloModalidade} nos últimos 12 meses`
    : "taxa de referência";
  return {
    premio,
    origem: usaMedia ? "media_modalidade" : "taxa_referencia",
    descricao: `estimativa: ${brl(is)} × ${pct(taxa)} a.a. × ${prazo}/365 dias (${fonte})`,
  };
}

export function comissaoEstimada(premio: number | null, comissaoPct: number): number | null {
  if (premio == null || !(premio > 0)) return null;
  return arred((premio * comissaoPct) / 100);
}
