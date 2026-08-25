// =====================================================================
// Ingestão PNCP (portada de supabase/functions/ab-ingest-pncp).
//
// Duas fontes gratuitas, sem autenticação, do Portal Nacional de
// Contratações Públicas:
//   /v1/contratos               → gatilhos T9 e T10 (garantia contratual)
//   /v1/contratacoes/proposta   → gatilho T8 (garantia de proposta, art. 58)
//
// ---------------------------------------------------------------------
// POR QUE ESTA VERSÃO NÃO TEM "UM TIMEOUT MAIOR"
//
// O PNCP é lento e volumoso: /v1/contratos devolveu 26.867 contratos em
// 3 dias (≈9 mil/dia, nacional), e /v1/contratacoes/proposta não tem piso
// de data — devolve tudo que está com proposta aberta no país. Subir o
// timeout de um fetch para 30 s não resolve: 30 s É o orçamento de CPU
// inteiro de uma requisição no Cloudflare Workers, e a borda derruba a
// resposta perto de 60 s. O resultado seria uma ingestão que morre no
// meio, sem registrar onde parou.
//
// Então o controle aqui é de ORÇAMENTO, não de timeout:
//
//   * a rotina inteira tem um prazo (`orcamentoMs`, 45 s por padrão);
//   * o timeout de cada página é derivado do que resta do prazo;
//   * se o prazo aperta, ela PARA de propósito, grava o que já leu e
//     devolve `proxima_pagina` — o cron continua dali;
//   * se uma página aborta, tenta a MESMA página com metade do tamanho
//     antes de desistir (página grande é a causa usual da lentidão);
//   * as durações de cada página vão para o ab_ingest_log, para calibrar.
//
// E o volume é cortado na origem, não depois:
//
//   * `tamanhoPagina` padrão 100 (era 500) — resposta menor, menos abort;
//   * `valorMinimo` derivado de ab_parametro: um contrato só interessa se
//     5% dele (art. 98) chegar ao ticket mínimo. Com ticket 50 mil, isso
//     é R$ 1 mi de contrato. Calibrar o ticket calibra a ingestão;
//   * `ufs` filtra os editais na própria API (o parâmetro `uf` existe) e
//     os contratos no cliente (esse endpoint não tem filtro de UF).
//
// Parâmetros conferidos no OpenAPI do PNCP (v3/api-docs):
//   /v1/contratos             → dataInicial*, dataFinal*, pagina*, tamanhoPagina
//   /v1/contratacoes/proposta → dataFinal*, pagina*, uf, codigoModalidadeContratacao,
//                               codigoMunicipioIbge, cnpj, tamanhoPagina
// (* obrigatório). O envelope real é { data, totalRegistros, totalPaginas,
// numeroPagina, paginasRestantes, empty }.
// =====================================================================

import {
  aaaammdd, admin, carregarParametros, logIngest, upsertEmLote, upsertEmpresasEmLote,
} from "./db.server.ts";
import { soDigitos, toNum } from "./format.ts";
import { extrairExigenciaGarantia } from "./edital.ts";
import { FATOR_IS } from "./pricing.ts";
import { buscarPagina, criarPrazo, itens, latencia } from "./orcamento.ts";

const BASE = process.env.PNCP_BASE ?? "https://pncp.gov.br/api/consulta";
const OBRA_RX = /obra|engenharia|constru|pavimenta|saneament|rodovi/i;

export interface CorpoPncp {
  dias?: number;
  horizonte?: number;
  maxPaginas?: number;
  tamanhoPagina?: number;
  /** Primeira página de /v1/contratos a ler. Use o `proxima_pagina` da resposta anterior. */
  pagina?: number;
  /** Piso de valor do contrato. Se omitido, sai de ab_parametro. */
  valorMinimo?: number;
  /** UFs de interesse. Vazio = nacional. */
  ufs?: string[];
  /** Prazo total da rotina, em ms. */
  orcamentoMs?: number;
  /** Pular a fase de editais (útil para carga de contratos em várias chamadas). */
  soContratos?: boolean;
}

export async function ingestPncp(
  cfg: CorpoPncp = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();
  const prazo = criarPrazo(Math.min(cfg.orcamentoMs ?? 45_000, 55_000));

  const dias = cfg.dias ?? 2;
  const horizonte = cfg.horizonte ?? 30;
  const maxPaginas = Math.min(cfg.maxPaginas ?? 20, 200);
  const tamanhoPagina = Math.min(cfg.tamanhoPagina ?? 100, 500);
  const paginaInicial = Math.max(cfg.pagina ?? 1, 1);
  const ufs = (cfg.ufs ?? []).map((u) => u.trim().toUpperCase()).filter((u) => u.length === 2);

  // Um contrato só é lead se 5% dele (art. 98) alcançar o ticket mínimo.
  const params = await carregarParametros(sb);
  const valorMinimo = cfg.valorMinimo ??
    Math.round(params.ticket_minimo / (FATOR_IS.PERFORMANCE || 0.05));

  const resumo = {
    contratos: 0,
    contratos_recebidos: 0,
    contratos_descartados: 0,
    editais: 0,
    editais_recebidos: 0,
    paginas_lidas: 0,
    total_paginas: 0,
    proxima_pagina: null as number | null,
    ms_por_pagina: [] as number[],
  };
  const avisos: string[] = [];
  let parcial = false;

  // -------- 1. contratos assinados (T9 / T10) ----------------------
  try {
    const fim = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    const janela = `dataInicial=${aaaammdd(ini)}&dataFinal=${aaaammdd(fim)}`;

    const brutos: Record<string, unknown>[] = [];
    let pagina = paginaInicial;
    let totalPaginas = 0;

    for (let lidas = 0; lidas < maxPaginas; lidas++) {
      if (!prazo.cabeOutraPagina()) {
        parcial = true;
        avisos.push(`prazo: paginação de contratos interrompida na página ${pagina}`);
        break;
      }
      const { env, ms, tamanhoUsado } = await buscarPagina<Record<string, unknown>>(
        (t) => `${BASE}/v1/contratos?${janela}&pagina=${pagina}&tamanhoPagina=${t}`,
        tamanhoPagina,
        prazo,
      );
      resumo.ms_por_pagina.push(ms);
      resumo.paginas_lidas++;
      if (tamanhoUsado !== tamanhoPagina) {
        avisos.push(`página ${pagina} refeita com tamanhoPagina=${tamanhoUsado}`);
      }

      const lista = itens(env);
      totalPaginas = env?.totalPaginas ?? totalPaginas;
      if (pagina === paginaInicial) {
        if (!lista.length) avisos.push("PNCP /contratos devolveu lista vazia");
        else if (env?.items && !env?.data) avisos.push("envelope veio como {items}");
      }
      brutos.push(...lista);
      pagina++;
      if (!totalPaginas || pagina > totalPaginas) break;
    }

    resumo.total_paginas = totalPaginas;
    resumo.contratos_recebidos = brutos.length;
    resumo.proxima_pagina = totalPaginas && pagina <= totalPaginas ? pagina : null;
    if (resumo.proxima_pagina) parcial = true;

    // ---- filtros antes de escrever ------------------------------
    const elegiveis = brutos.filter((it) => {
      if (soDigitos(it.niFornecedor).length !== 14) return false;
      if (toNum(it.valorGlobal ?? it.valorInicial) < valorMinimo) return false;
      if (ufs.length) {
        const uf = String(
          (it.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla ?? "",
        ).toUpperCase();
        if (uf && !ufs.includes(uf)) return false;
      }
      return true;
    });
    resumo.contratos_descartados = brutos.length - elegiveis.length;

    if (elegiveis.length) {
      const mapa = await upsertEmpresasEmLote(
        sb,
        elegiveis.map((it) => ({
          cnpj: soDigitos(it.niFornecedor),
          razao_social: it.nomeRazaoSocialFornecedor,
          uf: (it.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla,
        })),
      );

      const vistos = new Set<string>();
      const contratos = elegiveis.flatMap((it) => {
        const cnpj = soDigitos(it.niFornecedor).padStart(14, "0");
        const empresaId = mapa.get(cnpj);
        if (!empresaId) return [];
        const identificador = String(
          it.numeroControlePNCP ?? it.numeroContratoEmpenho ?? `${cnpj}:${it.dataAssinatura}`,
        );
        const chave = `${empresaId}|${identificador}`;
        if (vistos.has(chave)) return []; // o PNCP repete itens na virada de página
        vistos.add(chave);
        const objeto = String(it.objetoContrato ?? "");
        return [{
          empresa_id: empresaId,
          identificador,
          orgao: (it.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial ?? null,
          objeto,
          valor: toNum(it.valorGlobal ?? it.valorInicial),
          data_assinatura: (it.dataAssinatura as string | null)?.slice(0, 10) ?? null,
          vigencia_fim: (it.dataVigenciaFim as string | null)?.slice(0, 10) ?? null,
          obra_engenharia: OBRA_RX.test(objeto),
          fonte: "pncp",
          raw: it,
        }];
      });

      const rc = await upsertEmLote(
        sb, "ab_contrato_publico", contratos, "empresa_id,identificador",
      );
      resumo.contratos = rc.gravados;
      avisos.push(...rc.erros.slice(0, 3));
    }
  } catch (err) {
    parcial = true;
    avisos.push(`contratos: ${(err as Error).message}`);
  }

  // -------- 2. editais com proposta aberta (T8) --------------------
  // Este endpoint não tem piso de data — devolve tudo que está aberto no
  // país — e é o mais lento dos dois. Só entra se sobrou orçamento, e
  // sempre por UF quando houver UF, porque é o que reduz a resposta.
  if (!cfg.soContratos) {
    if (!prazo.cabeOutraPagina()) {
      parcial = true;
      avisos.push("prazo: fase de editais não rodou — chame de novo com soContratos=false");
    } else {
      const fimProposta = new Date();
      fimProposta.setDate(fimProposta.getDate() + horizonte);
      const recortes = ufs.length ? ufs.map((u) => `&uf=${u}`) : [""];
      const vistosEd = new Set<string>();
      const editais: Record<string, unknown>[] = [];

      for (const recorte of recortes) {
        if (!prazo.cabeOutraPagina()) {
          parcial = true;
          avisos.push(`prazo: editais interrompidos${recorte ? ` em ${recorte.slice(4)}` : ""}`);
          break;
        }
        try {
          const { env, ms } = await buscarPagina<Record<string, unknown>>(
            (t) =>
              `${BASE}/v1/contratacoes/proposta?dataFinal=${aaaammdd(fimProposta)}` +
              `${recorte}&pagina=1&tamanhoPagina=${t}`,
            tamanhoPagina,
            prazo,
          );
          resumo.ms_por_pagina.push(ms);
          const lista = itens(env);
          resumo.editais_recebidos += lista.length;

          for (const it of lista) {
            const identificador = String(it.numeroControlePNCP ?? "");
            if (!identificador || vistosEd.has(identificador)) continue;
            vistosEd.add(identificador);
            const objeto = String(it.objetoCompra ?? "");
            // A exigência de garantia está no TEXTO. Aqui lemos o que vem
            // no payload; baixar o PDF do edital é a fase 2.
            const texto = [objeto, it.informacaoComplementar, it.justificativaPresencial]
              .filter(Boolean).join(" ");
            const exig = extrairExigenciaGarantia(texto);
            const unidade = it.unidadeOrgao as Record<string, unknown> | undefined;
            editais.push({
              identificador,
              orgao: (it.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial ?? null,
              objeto,
              valor_estimado: toNum(it.valorTotalEstimado),
              modalidade: it.modalidadeNome ?? null,
              data_encerramento:
                (it.dataEncerramentoProposta as string | null)?.slice(0, 10) ?? null,
              uf: unidade?.ufSigla ?? null,
              exige_garantia_proposta: exig.proposta,
              exige_garantia_contratual: exig.contratual,
              percentual_garantia: exig.percentual,
              trecho_garantia: exig.trecho,
              fonte: "pncp",
              raw: it,
            });
          }
        } catch (err) {
          parcial = true;
          avisos.push(`editais${recorte ? ` ${recorte.slice(4)}` : ""}: ${(err as Error).message}`);
        }
      }

      if (editais.length) {
        const re = await upsertEmLote(sb, "ab_edital", editais, "identificador");
        resumo.editais = re.gravados;
        avisos.push(...re.erros.slice(0, 3));
      }
    }
  }

  // -------- log e resposta ----------------------------------------
  const ms = Date.now() - t0;
  const { media, pico } = latencia(resumo.ms_por_pagina);

  await logIngest(sb, {
    fonte: "pncp",
    status: parcial || avisos.length ? "parcial" : "ok",
    recebidos: resumo.contratos_recebidos + resumo.editais_recebidos,
    gravados: resumo.contratos + resumo.editais,
    detalhe:
      `contratos ${resumo.contratos}/${resumo.contratos_recebidos} ` +
      `(${resumo.contratos_descartados} abaixo de ${valorMinimo} ou fora das UFs), ` +
      `editais ${resumo.editais}/${resumo.editais_recebidos}, ` +
      `páginas ${resumo.paginas_lidas}/${resumo.total_paginas || "?"}, ` +
      `fetch média ${media}ms pico ${pico}ms` +
      (resumo.proxima_pagina ? `, retomar em ${resumo.proxima_pagina}` : "") +
      (avisos.length ? ` · ${avisos.slice(0, 4).join("; ")}` : ""),
    duracao_ms: ms,
  });

  // Parcial não é erro: é o comportamento correto quando o prazo aperta.
  // O cron continua de onde parou. 500 só se nada entrou e houve falha.
  const nadaEntrou = resumo.contratos === 0 && resumo.editais === 0;
  const status = nadaEntrou && avisos.length ? 500 : 200;
  return {
    status,
    body: {
      ok: status === 200,
      parcial,
      valor_minimo: valorMinimo,
      ufs: ufs.length ? ufs : "nacional",
      resumo: { ...resumo, fetch_media_ms: media, fetch_pico_ms: pico },
      avisos,
      duracao_ms: ms,
    },
  };
}
