// =====================================================================
// Ingestão PNCP (portada de supabase/functions/ab-ingest-pncp).
//
// Duas fontes gratuitas, sem autenticação, do Portal Nacional de
// Contratações Públicas:
//   /v1/contratos               → gatilhos T9 e T10 (garantia contratual)
//   /v1/contratacoes/proposta   → gatilho T8 (garantia de proposta, art. 58)
//
// MUDANÇA EM RELAÇÃO À VERSÃO DENO: aqui não há um upsert por item. O
// runtime do Hub é Cloudflare Workers — a borda derruba a resposta perto
// de 60 s, e 2.000 itens × 2 idas ao banco não cabem nisso. Agora são
// N páginas de rede + 3 idas ao banco por bloco.
//
// VALIDAR no primeiro run: o envelope do PNCP às vezes vem como
// { data: [...], totalPaginas } e às vezes como { items: [...] }. O código
// aceita as duas formas e registra no log qual veio.
// =====================================================================

import {
  aaaammdd, admin, fetchJson, logIngest, upsertEmLote, upsertEmpresasEmLote,
} from "./db.server.ts";
import { soDigitos, toNum } from "./format.ts";
import { extrairExigenciaGarantia } from "./edital.ts";

const BASE = process.env.PNCP_BASE ?? "https://pncp.gov.br/api/consulta";
const OBRA_RX = /obra|engenharia|constru|pavimenta|saneament|rodovi/i;

interface Envelope<T> {
  data?: T[];
  items?: T[];
  totalPaginas?: number;
  totalRegistros?: number;
}

function itens<T>(env: Envelope<T> | null): T[] {
  if (!env) return [];
  return env.data ?? env.items ?? [];
}

export interface CorpoPncp {
  dias?: number;
  horizonte?: number;
  maxPaginas?: number;
  tamanhoPagina?: number;
}

export async function ingestPncp(
  cfg: CorpoPncp = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();

  const dias = cfg.dias ?? 7;
  const horizonte = cfg.horizonte ?? 30;
  // 3 páginas × 500 é o que cabe com folga na janela da borda. Para carga
  // histórica, chame várias vezes com `dias` menor em vez de aumentar isto.
  const maxPaginas = Math.min(cfg.maxPaginas ?? 3, 10);
  const tamanhoPagina = Math.min(cfg.tamanhoPagina ?? 500, 500);

  const resumo = { contratos: 0, contratos_recebidos: 0, editais: 0, editais_recebidos: 0 };
  const avisos: string[] = [];

  try {
    // ---------- 1. contratos assinados (T9 / T10) ------------------
    const fim = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);

    const brutos: Record<string, unknown>[] = [];
    for (let pagina = 1; pagina <= maxPaginas; pagina++) {
      const url = `${BASE}/v1/contratos?dataInicial=${aaaammdd(ini)}` +
        `&dataFinal=${aaaammdd(fim)}&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`;
      const env = await fetchJson<Envelope<Record<string, unknown>>>(url);
      const lista = itens(env);
      if (pagina === 1) {
        if (!lista.length) avisos.push("PNCP /contratos devolveu lista vazia");
        else if (env?.items && !env?.data) avisos.push("envelope veio como {items}");
      }
      brutos.push(...lista);
      if (!env?.totalPaginas || pagina >= env.totalPaginas) break;
    }
    resumo.contratos_recebidos = brutos.length;

    const validos = brutos.filter((it) => soDigitos(it.niFornecedor).length === 14);
    const mapa = await upsertEmpresasEmLote(
      sb,
      validos.map((it) => ({
        cnpj: soDigitos(it.niFornecedor),
        razao_social: it.nomeRazaoSocialFornecedor,
      })),
    );

    const linhasContrato = validos.flatMap((it) => {
      const cnpj = soDigitos(it.niFornecedor).padStart(14, "0");
      const empresaId = mapa.get(cnpj);
      if (!empresaId) return [];
      const objeto = String(it.objetoContrato ?? "");
      const orgao = (it.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial;
      return [{
        empresa_id: empresaId,
        identificador: String(
          it.numeroControlePNCP ?? it.numeroContratoEmpenho ?? `${cnpj}:${it.dataAssinatura}`,
        ),
        orgao: orgao ?? null,
        objeto,
        valor: toNum(it.valorGlobal ?? it.valorInicial),
        data_assinatura: (it.dataAssinatura as string | null)?.slice(0, 10) ?? null,
        vigencia_fim: (it.dataVigenciaFim as string | null)?.slice(0, 10) ?? null,
        obra_engenharia: OBRA_RX.test(objeto),
        fonte: "pncp",
        raw: it,
      }];
    });

    // dedupe: o PNCP repete o mesmo contrato entre páginas na virada do dia
    const vistos = new Set<string>();
    const contratos = linhasContrato.filter((l) => {
      const k = `${l.empresa_id}|${l.identificador}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    const rc = await upsertEmLote(sb, "ab_contrato_publico", contratos, "empresa_id,identificador");
    resumo.contratos = rc.gravados;
    avisos.push(...rc.erros.slice(0, 3));

    // ---------- 2. editais com proposta aberta (T8) ----------------
    const fimProposta = new Date();
    fimProposta.setDate(fimProposta.getDate() + horizonte);
    const urlEd = `${BASE}/v1/contratacoes/proposta?dataFinal=${aaaammdd(fimProposta)}` +
      `&pagina=1&tamanhoPagina=${tamanhoPagina}`;
    const envEd = await fetchJson<Envelope<Record<string, unknown>>>(urlEd);
    const listaEd = itens(envEd);
    resumo.editais_recebidos = listaEd.length;

    const vistosEd = new Set<string>();
    const editais = listaEd.flatMap((it) => {
      const identificador = String(it.numeroControlePNCP ?? "");
      if (!identificador || vistosEd.has(identificador)) return [];
      vistosEd.add(identificador);
      const objeto = String(it.objetoCompra ?? "");
      // A exigência de garantia está no TEXTO. Aqui lemos o que vem no
      // payload; baixar o PDF do edital é a fase 2.
      const texto = [objeto, it.informacaoComplementar, it.justificativaPresencial]
        .filter(Boolean).join(" ");
      const exig = extrairExigenciaGarantia(texto);
      const unidade = it.unidadeOrgao as Record<string, unknown> | undefined;
      return [{
        identificador,
        orgao: (it.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial ?? null,
        objeto,
        valor_estimado: toNum(it.valorTotalEstimado),
        modalidade: it.modalidadeNome ?? null,
        data_encerramento: (it.dataEncerramentoProposta as string | null)?.slice(0, 10) ?? null,
        uf: unidade?.ufSigla ?? null,
        exige_garantia_proposta: exig.proposta,
        exige_garantia_contratual: exig.contratual,
        percentual_garantia: exig.percentual,
        trecho_garantia: exig.trecho,
        fonte: "pncp",
        raw: it,
      }];
    });

    const re = await upsertEmLote(sb, "ab_edital", editais, "identificador");
    resumo.editais = re.gravados;
    avisos.push(...re.erros.slice(0, 3));

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "pncp",
      status: avisos.length ? "parcial" : "ok",
      recebidos: resumo.contratos_recebidos + resumo.editais_recebidos,
      gravados: resumo.contratos + resumo.editais,
      detalhe: `contratos ${resumo.contratos}/${resumo.contratos_recebidos}, ` +
        `editais ${resumo.editais}/${resumo.editais_recebidos}` +
        (avisos.length ? ` · ${avisos.join("; ")}` : ""),
      duracao_ms: ms,
    });
    return { status: 200, body: { ok: true, resumo, avisos, duracao_ms: ms } };
  } catch (err) {
    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "pncp", status: "erro", detalhe: (err as Error).message, duracao_ms: ms,
    });
    return { status: 500, body: { ok: false, erro: (err as Error).message, resumo } };
  }
}
