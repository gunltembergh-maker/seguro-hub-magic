// =====================================================================
// Ingestão Portal da Transparência (portada de ab-ingest-transparencia).
//
// CEIS / CNEP / CEPIM — o filtro negativo (T12) e insumo de compliance.
// Token gratuito por e-mail:
//   https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
// Rate limit oficial: 400 req/min (700 entre 0h e 6h).
//
// Guarde o token como secret TRANSPARENCIA_API_TOKEN.
//
// DUAS MUDANÇAS EM RELAÇÃO À VERSÃO DENO, ambas por causa do runtime:
//
//  1. A versão antiga fazia 500 CNPJs × 3 cadastros com sleep de 170 ms
//     em série — 255 s no melhor caso, e a borda derruba perto de 60 s.
//     Agora há um marcador de ritmo global (160 ms entre requisições
//     quaisquer, o que respeita os 400/min) com concorrência de 6, e o
//     lote padrão é 30 CNPJs: ~90 requisições, ~15 s.
//  2. Como um lote não cobre a base inteira, a seleção é por RODÍZIO:
//     os menos recentemente consultados primeiro, gravando
//     ab_empresa.transparencia_checado_em. Sem isso o cron reconsultaria
//     eternamente os mesmos 30.
// =====================================================================

import { admin, fetchJson, logIngest } from "./db.server.ts";
import { soDigitos } from "./format.ts";

const BASE = process.env.TRANSPARENCIA_BASE ??
  "https://api.portaldatransparencia.gov.br/api-de-dados";

const CADASTROS: { rota: string; tipo: string }[] = [
  { rota: "ceis", tipo: "CEIS" },
  { rota: "cnep", tipo: "CNEP" },
  { rota: "cepim", tipo: "CEPIM" },
];

// 400 req/min = 150 ms por requisição; 160 ms deixa folga.
const ESPACO_MS = 160;
const CONCORRENCIA = 6;
const LOTE_PADRAO = 30;

/** Marcador de ritmo global: garante ESPACO_MS entre duas requisições quaisquer. */
function criarRitmo(espacoMs: number) {
  let proximo = 0;
  return async function ritmo(): Promise<void> {
    const agora = Date.now();
    const alvo = Math.max(agora, proximo);
    proximo = alvo + espacoMs;
    const espera = alvo - agora;
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  };
}

/** Executa `tarefa` sobre `itens` com no máximo `n` em voo. */
async function comConcorrencia<T, R>(
  itens: T[], n: number, tarefa: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let cursor = 0;
  const trabalhador = async () => {
    while (true) {
      const i = cursor++;
      if (i >= itens.length) return;
      saida[i] = await tarefa(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return saida;
}

interface Achado {
  tipo: string;
  descricao: string;
  inicio: string | null;
  fim: string | null;
  raw: unknown;
}

export interface CorpoTransparencia { cnpjs?: string[]; limite?: number }

export async function ingestTransparencia(
  cfg: CorpoTransparencia = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();

  const token = process.env.TRANSPARENCIA_API_TOKEN;
  if (!token) {
    return {
      status: 400,
      body: {
        ok: false,
        erro: "sem_credencial",
        detalhe: "Defina o secret TRANSPARENCIA_API_TOKEN. É gratuito: " +
          "https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email",
      },
    };
  }

  const limite = Math.min(cfg.limite ?? LOTE_PADRAO, 60);
  let alvos = (cfg.cnpjs ?? []).map(soDigitos).filter((c) => c.length === 14);

  if (!alvos.length) {
    // rodízio: nunca consultados primeiro, depois os mais antigos
    const { data } = await sb
      .from("ab_empresa")
      .select("cnpj, transparencia_checado_em")
      .in("relacao", ["cliente", "prospect", "fornecedor"])
      .order("transparencia_checado_em", { ascending: true, nullsFirst: true })
      .limit(limite);
    alvos = (data ?? []).map((e: { cnpj: string }) => e.cnpj);
  }

  if (!alvos.length) {
    return { status: 200, body: { ok: true, aviso: "nenhuma empresa elegível", consultados: 0 } };
  }

  let recebidos = 0;
  let gravados = 0;
  let desativados = 0;
  const avisos: string[] = [];
  const ritmo = criarRitmo(ESPACO_MS);

  try {
    // ---- 1. resolve os ids das empresas numa ida só -----------------
    const { data: empresas, error: eErr } = await sb
      .from("ab_empresa").select("id, cnpj").in("cnpj", alvos);
    if (eErr) throw new Error(`empresas: ${eErr.message}`);
    const idPorCnpj = new Map(
      (empresas ?? []).map((e: { id: string; cnpj: string }) => [e.cnpj, e.id]),
    );
    const consultaveis = alvos.filter((c) => idPorCnpj.has(c));
    for (const c of alvos) {
      if (!idPorCnpj.has(c)) avisos.push(`${c}: fora da base — rode a ingestão de cadastro antes`);
    }

    // ---- 2. consulta os três cadastros, com ritmo e concorrência ----
    const porCnpj = new Map<string, Achado[]>();
    await comConcorrencia(consultaveis, CONCORRENCIA, async (cnpj) => {
      const encontrados: Achado[] = [];
      for (const { rota, tipo } of CADASTROS) {
        await ritmo();
        try {
          const url = `${BASE}/${rota}?codigoSancionado=${cnpj}&pagina=1`;
          const data = await fetchJson<Record<string, unknown>[]>(url, {
            headers: { "chave-api-dados": token },
          });
          const lista = Array.isArray(data) ? data : [];
          recebidos += lista.length;
          for (const it of lista) {
            const tipoSancao = it.tipoSancao as Record<string, unknown> | undefined;
            encontrados.push({
              tipo,
              descricao: String(
                tipoSancao?.descricaoResumida ?? it.descricaoFundamentacao ?? tipo,
              ),
              inicio: (it.dataInicioSancao as string | null)?.slice(0, 10) ?? null,
              fim: (it.dataFimSancao as string | null)?.slice(0, 10) ?? null,
              raw: it,
            });
          }
        } catch (err) {
          avisos.push(`${cnpj}/${rota}: ${(err as Error).message.slice(0, 90)}`);
        }
      }
      porCnpj.set(cnpj, encontrados);
    });

    // ---- 3. reconcilia restritivos, em lote -------------------------
    const ids = consultaveis.map((c) => idPorCnpj.get(c)!);
    const { data: existentes } = await sb
      .from("ab_restritivo")
      .select("id, empresa_id, tipo, ativo")
      .in("empresa_id", ids)
      .in("tipo", CADASTROS.map((c) => c.tipo));

    const paraDesativar: string[] = [];
    const paraInserir: Record<string, unknown>[] = [];

    for (const cnpj of consultaveis) {
      const empresaId = idPorCnpj.get(cnpj)!;
      const encontrados = porCnpj.get(cnpj) ?? [];
      const tiposAgora = new Set(encontrados.map((e) => e.tipo));

      // Sanção que saiu da lista deve deixar de bloquear o lead. Marcamos
      // como inativa em vez de apagar — o histórico importa para auditoria.
      for (const r of (existentes ?? []) as
        { id: string; empresa_id: string; tipo: string; ativo: boolean }[]) {
        if (r.empresa_id === empresaId && r.ativo && !tiposAgora.has(r.tipo)) {
          paraDesativar.push(r.id);
        }
      }
      for (const e of encontrados) {
        paraInserir.push({
          empresa_id: empresaId,
          tipo: e.tipo,
          descricao: e.descricao,
          inicio: e.inicio,
          fim: e.fim,
          ativo: true,
          fonte: "transparencia",
          raw: e.raw,
        });
      }
    }

    if (paraDesativar.length) {
      const { error } = await sb
        .from("ab_restritivo").update({ ativo: false }).in("id", paraDesativar);
      if (error) avisos.push(`desativar: ${error.message}`);
      else desativados = paraDesativar.length;
    }
    if (paraInserir.length) {
      const { error } = await sb.from("ab_restritivo").insert(paraInserir);
      if (error) avisos.push(`inserir: ${error.message}`);
      else gravados = paraInserir.length;
    }

    // ---- 4. carimba o rodízio ---------------------------------------
    if (consultaveis.length) {
      await sb
        .from("ab_empresa")
        .update({ transparencia_checado_em: new Date().toISOString() })
        .in("cnpj", consultaveis);
    }

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "transparencia",
      status: avisos.length ? "parcial" : "ok",
      recebidos,
      gravados,
      detalhe: `${consultaveis.length} CNPJ(s) consultados, ${desativados} sanção(ões) ` +
        `desativada(s)` + (avisos.length ? ` · ${avisos.slice(0, 3).join("; ")}` : ""),
      duracao_ms: ms,
    });
    return {
      status: 200,
      body: {
        ok: true,
        consultados: consultaveis.length,
        recebidos, gravados, desativados, avisos,
        duracao_ms: ms,
      },
    };
  } catch (err) {
    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "transparencia", status: "erro", detalhe: (err as Error).message, duracao_ms: ms,
    });
    return { status: 500, body: { ok: false, erro: (err as Error).message } };
  }
}
