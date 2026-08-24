// =====================================================================
// Extração da exigência de garantia no texto do edital.
//
// O PNCP entrega metadados; a exigência de garantia (art. 58 — proposta;
// arts. 96–102 — contratual) está no TEXTO. Este módulo é o começo do
// extrator: regex sobre o texto disponível no payload. Quando o PDF do
// edital for baixado, a mesma função roda sobre o texto extraído, sem
// mudar a interface.
// =====================================================================

import { normalizar } from "./nlp.ts";

const RX_PROPOSTA =
  /garantia (de|da) (proposta|participacao)|garantia de licitacao|bid ?bond/;
const RX_CONTRATUAL =
  /garantia (contratual|de execucao|do contrato)|performance ?bond|seguro[- ]garantia|clausula de retomada|caucao/;
const RX_PCT = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g;
const RX_JANELA = /[^.]{0,220}(?:garantia|caucao|seguro[- ]garantia)[^.]{0,220}\./;

export interface Exigencia {
  proposta: boolean;
  contratual: boolean;
  percentual: number | null;
  trecho: string | null;
}

export function extrairExigenciaGarantia(texto: string | null | undefined): Exigencia {
  const base = normalizar(texto);
  const vazio: Exigencia = { proposta: false, contratual: false, percentual: null, trecho: null };
  if (!base) return vazio;

  const ex: Exigencia = {
    proposta: RX_PROPOSTA.test(base),
    contratual: RX_CONTRATUAL.test(base),
    percentual: null,
    trecho: null,
  };
  if (!ex.proposta && !ex.contratual) return ex;

  const janela = base.match(RX_JANELA);
  if (janela) {
    ex.trecho = janela[0].trim().slice(0, 400);
    const pcts = [...ex.trecho.matchAll(RX_PCT)]
      .map((m) => Number.parseFloat(m[1].replace(",", ".")))
      .filter((p) => p > 0 && p <= 30);
    if (pcts.length) ex.percentual = Math.min(...pcts) / 100;
  }
  // defaults legais: 1% proposta (art. 58) / 5% contratual (art. 98)
  if (ex.percentual === null) ex.percentual = ex.proposta ? 0.01 : 0.05;
  return ex;
}
