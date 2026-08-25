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
// ---------------------------------------------------------------------
// DUAS CORREÇÕES depois do primeiro run real (900 recebidos, 900 descartados)
//
//  1. CURSOR PERSISTIDO. A janela de 2 dias tem ~113 páginas e uma chamada
//     lê ~9. Sem lembrar onde parou, o cron horário releria as páginas 1 a 9
//     para sempre e nunca chegaria na 10 — e o log diria "ok" todo dia.
//     Agora o ponto de parada vive em ab_ingest_estado.
//
//  2. O FILTRO DE UF ESTAVA NA ENTIDADE ERRADA. `unidadeOrgao.ufSigla` é a
//     UF do ÓRGÃO CONTRATANTE, não do fornecedor. Quem precisa da garantia
//     é o fornecedor. Um contrato de órgão do RS adjudicado a uma
//     construtora de São Paulo é lead de São Paulo — e o filtro por UF do
//     órgão descartava exatamente esses. Medido na amostra: 24% dos
//     contratos têm órgão em SP, ~4% passam de R$ 1 mi, e a interseção dos
//     dois deu ZERO em 45 linhas. Era o filtro, não o valor.
//
//     O payload de contrato do PNCP não traz a UF do fornecedor, então não
//     há como filtrar por ela na ingestão. A decisão: NÃO filtrar UF em
//     contratos (o recorte regional é feito depois, na fila, por
//     ab_empresa.uf) e manter `ufsOrgao` como opção explícita, desligada
//     por padrão. Filtro que descarta o alvo é pior que filtro nenhum.
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
import {
  buscarPagina, criarPrazo, ehRateLimit, esperaSugerida, itens, latencia,
} from "./orcamento.ts";

// Depois de tantas falhas consecutivas na MESMA página, ela é abandonada e
// registrada em paginas_puladas. Perder ~100 contratos de uma página é
// muito melhor que travar a varredura inteira nela: sem isso, o cursor não
// avança e toda execução seguinte queima o orçamento no mesmo ponto.
const TETO_FALHAS_POR_PAGINA = 3;

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
  /**
   * UFs do ÓRGÃO contratante. Desligado por padrão, e de propósito: a UF
   * do órgão não é a UF do fornecedor, e é o fornecedor que precisa da
   * garantia. Use só quando o alvo for realmente o órgão.
   */
  ufsOrgao?: string[];
  /** UFs dos editais — aqui o filtro é da própria API e vale a pena. */
  ufs?: string[];
  /** Ignora o cursor salvo e recomeça da página 1. */
  reiniciar?: boolean;
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
  const norm = (l?: string[]) =>
    (l ?? []).map((u) => u.trim().toUpperCase()).filter((u) => u.length === 2);
  const ufs = norm(cfg.ufs);              // editais (filtro da API)
  const ufsOrgao = norm(cfg.ufsOrgao);    // contratos (opt-in explícito)

  // ---- cursor: onde a última execução parou -----------------------
  const fim0 = new Date();
  const ini0 = new Date();
  ini0.setDate(ini0.getDate() - dias);
  const janelaIni = ini0.toISOString().slice(0, 10);
  const janelaFim = fim0.toISOString().slice(0, 10);

  const { data: estadoRaw } = await sb
    .from("ab_ingest_estado").select("*").eq("fonte", "pncp_contratos").maybeSingle();
  const estado = estadoRaw as {
    cursor_pagina: number; janela_inicio: string | null; janela_fim: string | null;
    total_paginas: number | null; ciclos: number; paginas_no_ciclo: number;
    rate_limited_ate: string | null; falhas_na_pagina: number;
    paginas_puladas: number[] | null;
  } | null;

  // Back-off do 429: enquanto a punição vale, não vale nem tentar.
  if (estado?.rate_limited_ate && new Date(estado.rate_limited_ate) > new Date()) {
    const seg = Math.ceil(
      (new Date(estado.rate_limited_ate).getTime() - Date.now()) / 1000,
    );
    return {
      status: 200,
      body: {
        ok: true, parcial: true, rate_limited: true,
        detalhe: `PNCP em back-off por limite de taxa. Faltam ~${seg}s.`,
        proxima_janela: estado.rate_limited_ate,
      },
    };
  }

  const janelaMudou =
    estado?.janela_inicio !== janelaIni || estado?.janela_fim !== janelaFim;
  const paginaInicial = cfg.pagina
    ? Math.max(cfg.pagina, 1)
    : cfg.reiniciar || !estado || janelaMudou
      ? 1
      : Math.max(estado.cursor_pagina, 1);

  // Um contrato só é lead se 5% dele (art. 98) alcançar o ticket mínimo.
  const params = await carregarParametros(sb);
  const valorMinimo = cfg.valorMinimo ??
    Math.round(params.ticket_minimo / (FATOR_IS.PERFORMANCE || 0.05));

  const falhasHerdadas = estado && !janelaMudou ? (estado.falhas_na_pagina ?? 0) : 0;

  const resumo = {
    contratos: 0,
    contratos_recebidos: 0,
    // Descarte agregado não diz nada acionável. "900 descartados" custou uma
    // investigação; "900 fora das UFs" teria custado cinco segundos.
    descartados: { sem_cnpj: 0, abaixo_do_valor: 0, fora_das_ufs: 0 },
    editais: 0,
    editais_recebidos: 0,
    paginas_lidas: 0,
    total_paginas: 0,
    proxima_pagina: null as number | null,
    ms_por_pagina: [] as number[],
  };
  const avisos: string[] = [];
  let parcial = false;
  let rateLimitSeg = 0;
  let falhasNaPagina = 0;
  let pularPagina: number | null = null;

  // -------- 1. contratos assinados (T9 / T10) ----------------------
  try {
    const janela = `dataInicial=${aaaammdd(ini0)}&dataFinal=${aaaammdd(fim0)}`;

    const brutos: Record<string, unknown>[] = [];
    let pagina = paginaInicial;
    let totalPaginas = 0;

    for (let lidas = 0; lidas < maxPaginas; lidas++) {
      if (!prazo.cabeOutraPagina()) {
        parcial = true;
        avisos.push(`prazo: paginação de contratos interrompida na página ${pagina}`);
        break;
      }
      let resposta;
      try {
        resposta = await buscarPagina<Record<string, unknown>>(
          (pg) => `${BASE}/v1/contratos?${janela}` +
            `&pagina=${pg.pagina}&tamanhoPagina=${pg.tamanho}`,
          { pagina, tamanho: tamanhoPagina },
          prazo,
        );
      } catch (err) {
        if (ehRateLimit(err)) {
          // Limite de taxa não se resolve insistindo. Para, guarda até
          // quando, e grava o que já leu.
          rateLimitSeg = esperaSugerida(err);
          parcial = true;
          avisos.push(`PNCP limitou a taxa (429) na página ${pagina} — ` +
            `back-off de ${rateLimitSeg}s`);
          break;
        }
        // Falha nesta página. Conta, e decide entre tentar de novo depois
        // ou abandoná-la para a varredura poder seguir.
        parcial = true;
        falhasNaPagina = (pagina === paginaInicial ? falhasHerdadas : 0) + 1;
        if (falhasNaPagina >= TETO_FALHAS_POR_PAGINA) {
          pularPagina = pagina;
          avisos.push(
            `página ${pagina} abandonada após ${falhasNaPagina} tentativas ` +
            `(${(err as Error).message.slice(0, 120)}) — registrada para nova ` +
            `tentativa num ciclo futuro`,
          );
        } else {
          avisos.push(
            `página ${pagina} falhou (tentativa ${falhasNaPagina} de ` +
            `${TETO_FALHAS_POR_PAGINA}): ${(err as Error).message.slice(0, 140)}`,
          );
        }
        break;
      }
      const { env, ms, usado } = resposta;
      resumo.ms_por_pagina.push(ms);
      resumo.paginas_lidas++;
      if (usado.tamanho !== tamanhoPagina) {
        // O deslocamento é preservado: mesmo trecho, página menor.
        avisos.push(
          `trecho da página ${pagina} lido como página ${usado.pagina} ` +
          `com tamanhoPagina=${usado.tamanho}`,
        );
      }

      const lista = itens(env);
      totalPaginas = env?.totalPaginas ?? totalPaginas;
      if (pagina === paginaInicial) {
        if (!lista.length) avisos.push("PNCP /contratos devolveu lista vazia");
        else if (env?.items && !env?.data) avisos.push("envelope veio como {items}");
      }
      brutos.push(...lista);
      falhasNaPagina = 0;   // página lida: o contador desta página zera
      pagina++;
      if (!totalPaginas || pagina > totalPaginas) break;
    }

    resumo.total_paginas = totalPaginas;
    resumo.contratos_recebidos = brutos.length;
    resumo.proxima_pagina = totalPaginas && pagina <= totalPaginas ? pagina : null;
    if (resumo.proxima_pagina) parcial = true;

    // ---- filtros antes de escrever ------------------------------
    const elegiveis = brutos.filter((it) => {
      // Fornecedor pessoa física (CPF) não contrata seguro garantia de
      // execução; ~4% da amostra. Não é erro, é fora do escopo.
      if (soDigitos(it.niFornecedor).length !== 14) {
        resumo.descartados.sem_cnpj++;
        return false;
      }
      if (toNum(it.valorGlobal ?? it.valorInicial) < valorMinimo) {
        resumo.descartados.abaixo_do_valor++;
        return false;
      }
      if (ufsOrgao.length) {
        const uf = String(
          (it.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla ?? "",
        ).toUpperCase();
        if (uf && !ufsOrgao.includes(uf)) {
          resumo.descartados.fora_das_ufs++;
          return false;
        }
      }
      return true;
    });

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
            (pg) =>
              `${BASE}/v1/contratacoes/proposta?dataFinal=${aaaammdd(fimProposta)}` +
              `${recorte}&pagina=${pg.pagina}&tamanhoPagina=${pg.tamanho}`,
            { pagina: 1, tamanho: tamanhoPagina },
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

  // -------- grava o cursor ----------------------------------------
  // Escreve mesmo em falha: o que foi lido foi lido, e reler é desperdício.
  // Três cuidados que a primeira versão errava:
  //  * total_paginas só é sobrescrito quando esta execução aprendeu algo —
  //    senão um run que falhou apagaria o 118 que já sabíamos;
  //  * página abandonada avança o cursor e fica registrada, para a
  //    varredura não travar nela para sempre;
  //  * "janela completa" só quando ela realmente terminou.
  const totalPag = resumo.total_paginas || estado?.total_paginas || 0;
  const puladas = new Set<number>(estado?.paginas_puladas ?? []);
  if (pularPagina) puladas.add(pularPagina);

  const cursorNovo = pularPagina
    ? pularPagina + 1
    : (resumo.proxima_pagina ?? paginaInicial);
  const terminou = totalPag > 0 && cursorNovo > totalPag;

  await sb.from("ab_ingest_estado").upsert({
    fonte: "pncp_contratos",
    cursor_pagina: terminou ? 1 : cursorNovo,
    janela_inicio: janelaIni,
    janela_fim: janelaFim,
    total_paginas: totalPag || null,
    ciclos: (estado?.ciclos ?? 0) + (terminou ? 1 : 0),
    paginas_no_ciclo: terminou
      ? 0
      : (janelaMudou ? 0 : (estado?.paginas_no_ciclo ?? 0)) + resumo.paginas_lidas,
    falhas_na_pagina: pularPagina ? 0 : falhasNaPagina,
    // O ciclo novo recomeça sem dívida: as páginas puladas voltam a ser
    // tentadas do zero em vez de carregar a marca para sempre.
    paginas_puladas: terminou ? [] : [...puladas].sort((a, b) => a - b),
    ultima_execucao: new Date().toISOString(),
    rate_limited_ate: rateLimitSeg
      ? new Date(Date.now() + rateLimitSeg * 1000).toISOString()
      : null,
    detalhe: terminou
      ? `varredura completa da janela ${janelaIni}..${janelaFim}` +
        (puladas.size ? ` (${puladas.size} página(s) pulada(s), serão retentadas)` : "")
      : `próxima página ${cursorNovo} de ${totalPag || "?"}` +
        (falhasNaPagina ? ` · ${falhasNaPagina} falha(s) nela` : ""),
  }, { onConflict: "fonte" });

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
      `(descartados: ${resumo.descartados.sem_cnpj} sem CNPJ, ` +
      `${resumo.descartados.abaixo_do_valor} abaixo de ${valorMinimo}, ` +
      `${resumo.descartados.fora_das_ufs} fora das UFs do órgão), ` +
      `editais ${resumo.editais}/${resumo.editais_recebidos}, ` +
      (resumo.paginas_lidas
        ? `páginas ${paginaInicial}–${paginaInicial + resumo.paginas_lidas - 1} de ${totalPag || "?"}, `
        : `nenhuma página lida (tentativa na ${paginaInicial} de ${totalPag || "?"}), `) +
      `fetch média ${media}ms pico ${pico}ms` +
      (terminou ? ", janela completa" : `, retomar em ${cursorNovo}`) +
      (pularPagina ? `, página ${pularPagina} abandonada` : "") +
      (avisos.length ? ` · ${avisos.slice(0, 4).join("; ")}` : ""),
    duracao_ms: ms,
  });

  // Parcial não é erro: é o comportamento correto quando o prazo aperta.
  // O cron continua de onde parou. 500 só se nada entrou e houve falha.
  // Pular página é comportamento previsto, não falha: responder 500 faria o
  // cron tratar como incidente uma rotina que está justamente se
  // recuperando. 500 fica para o que não tem plano B.
  const nadaEntrou = resumo.contratos === 0 && resumo.editais === 0;
  const status = nadaEntrou && avisos.length && !pularPagina && !rateLimitSeg ? 500 : 200;
  return {
    status,
    body: {
      ok: status === 200,
      parcial,
      rate_limited: rateLimitSeg > 0,
      proxima_pagina_salva: terminou ? 1 : cursorNovo,
      paginas_puladas: [...puladas].sort((a, b) => a - b),
      falhas_na_pagina: pularPagina ? 0 : falhasNaPagina,
      valor_minimo: valorMinimo,
      pagina_inicial: paginaInicial,
      janela: `${janelaIni}..${janelaFim}`,
      ufs_orgao: ufsOrgao.length ? ufsOrgao : "sem filtro (a UF do órgão não é a do fornecedor)",
      ufs_editais: ufs.length ? ufs : "nacional",
      resumo: { ...resumo, fetch_media_ms: media, fetch_pico_ms: pico },
      avisos,
      duracao_ms: ms,
    },
  };
}
