// =====================================================================
// Ingestão PGFN (portada de supabase/functions/ab-ingest-pgfn).
//
// Dívida Ativa da União — o gatilho de maior ticket e custo zero (T6).
// Arquivos trimestrais em ZIP/CSV por UF em dadosabertos.pgfn.gov.br.
//
// A coluna de SITUAÇÃO é o que mais importa: separa quem ainda NÃO
// garantiu (alvo) de quem já garantiu ou está suspenso (não-alvo). É o
// filtro anti-falso-positivo mais valioso do motor.
//
// ATENÇÃO DE OPERAÇÃO: o arquivo completo tem ~6 GB e NÃO cabe numa
// requisição. Esta rota trabalha em dois modos:
//
//   modo "csv"    (padrão) — recebe um CSV já filtrado (por UF/faixa de
//                 valor) via body ou URL. Use para a carga inicial: baixe
//                 o ZIP da PGFN, filtre em planilha ou script local, e
//                 mande só as linhas que interessam.
//   modo "lista"  — consulta a Lista de Devedores por CNPJ, um a um, via
//                 integrador homologado. Barato e incremental. É o modo
//                 para rodar diariamente.
// =====================================================================

import {
  admin, logIngest, upsertEmLote, upsertEmpresasEmLote,
} from "./db.server.ts";
import { soDigitos, toNum } from "./format.ts";

interface Linha {
  cnpj: string;
  razao_social: string;
  uf: string | null;
  numero_inscricao: string;
  tipo: string | null;
  receita_origem: string | null;
  valor: number;
  situacao: string | null;
  data_inscricao: string | null;
}

/** Aceita os nomes de coluna que a PGFN já usou em safras diferentes. */
function pick(row: Record<string, string>, ...nomes: string[]): string | null {
  const chaves = Object.keys(row);
  for (const n of nomes) {
    const k = chaves.find((c) => c.trim().toUpperCase().replace(/\s+/g, "_") === n);
    if (k && row[k] !== undefined && row[k] !== "") return row[k];
  }
  return null;
}

function parseCsv(texto: string, delim = ";"): Record<string, string>[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const head = linhas[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ""));
  return linhas.slice(1).map((l) => {
    const cols = l.split(delim);
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = (cols[i] ?? "").trim().replace(/^"|"$/g, "")));
    return o;
  });
}

function normalizarData(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function normalizarLinha(row: Record<string, string>): Linha | null {
  const doc = soDigitos(
    pick(row, "CPF_CNPJ", "CPF/CNPJ", "NUMERO_INSCRICAO_DEVEDOR", "DOCUMENTO"),
  );
  // CPF vem mascarado na base da PGFN; só trabalhamos PJ.
  if (doc.length !== 14) return null;
  const dataBruta = pick(row, "DATA_INSCRICAO", "DT_INSCRICAO");
  return {
    cnpj: doc,
    razao_social: (pick(row, "NOME_DEVEDOR", "NOME", "RAZAO_SOCIAL") ?? "").trim(),
    uf: (pick(row, "UF_DEVEDOR", "UF_UNIDADE_RESPONSAVEL", "UF") ?? "").trim().slice(0, 2) || null,
    numero_inscricao: (pick(row, "NUMERO_INSCRICAO", "INSCRICAO") ?? "").trim(),
    tipo: pick(row, "TIPO_DEVEDOR", "TIPO_CREDITO", "NATUREZA"),
    receita_origem: pick(row, "RECEITA_PRINCIPAL", "TIPO_CREDITO", "NATUREZA_DIVIDA"),
    valor: toNum(pick(row, "VALOR_CONSOLIDADO", "VALOR")),
    situacao: (pick(row, "SITUACAO_INSCRICAO", "TIPO_SITUACAO_INSCRICAO", "SITUACAO") ?? "")
      .trim() || null,
    data_inscricao: dataBruta ? normalizarData(dataBruta) : null,
  };
}

export interface CorpoPgfn {
  modo?: "csv" | "lista";
  csv?: string;
  csvUrl?: string;
  ente?: string;
  valorMinimo?: number;
  cnpjs?: string[];
}

export async function ingestPgfn(
  cfg: CorpoPgfn = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();

  const modo = cfg.modo ?? "csv";
  const ente = cfg.ente ?? "UNIAO";
  const valorMinimo = cfg.valorMinimo ?? 100_000;
  let recebidos = 0;
  let gravados = 0;
  const avisos: string[] = [];

  try {
    let linhas: Linha[] = [];

    if (modo === "csv") {
      let texto = cfg.csv ?? "";
      if (!texto && cfg.csvUrl) {
        const r = await fetch(cfg.csvUrl);
        if (!r.ok) throw new Error(`csvUrl HTTP ${r.status}`);
        texto = await r.text();
      }
      if (!texto) {
        return {
          status: 400,
          body: {
            ok: false,
            erro: "informe csv (conteúdo) ou csvUrl",
            como_usar:
              "Baixe o ZIP em https://dadosabertos.pgfn.gov.br/{ANO}_trimestre_{NN}/, " +
              "filtre por UF e faixa de valor, e mande só as linhas relevantes. " +
              "O arquivo completo (~6 GB) não cabe numa requisição.",
          },
        };
      }
      const rows = parseCsv(texto);
      recebidos = rows.length;
      linhas = rows
        .map(normalizarLinha)
        .filter((l): l is Linha => l !== null && l.valor >= valorMinimo);
    } else {
      // modo lista: consulta pontual. Sem API oficial pública, o caminho
      // regular é um integrador homologado (Infosimples/Direct Data) —
      // configure PGFN_LISTA_URL apontando para ele.
      const endpoint = process.env.PGFN_LISTA_URL;
      if (!endpoint) {
        return {
          status: 400,
          body: {
            ok: false,
            erro: "modo lista requer PGFN_LISTA_URL configurada",
            detalhe:
              "A PGFN não publica API REST oficial da Lista de Devedores. Use um " +
              "integrador homologado (ex.: Infosimples, preço público) e aponte " +
              "PGFN_LISTA_URL para ele, ou use o modo csv.",
          },
        };
      }
      avisos.push("modo lista usa integrador externo — confira a tarifa por consulta");
      // 40 consultas é o teto seguro para a janela da borda. Acima disso,
      // fatie a lista em chamadas sucessivas.
      const alvos = (cfg.cnpjs ?? []).slice(0, 40);
      for (const cnpj of alvos) {
        const r = await fetch(`${endpoint}?cnpj=${soDigitos(cnpj)}`, {
          headers: { Authorization: `Bearer ${process.env.PGFN_LISTA_TOKEN ?? ""}` },
        });
        if (!r.ok) { avisos.push(`${cnpj}: HTTP ${r.status}`); continue; }
        const payload = await r.json();
        const itens = (payload.data ?? payload.inscricoes ?? []) as Record<string, string>[];
        recebidos += itens.length;
        linhas.push(...itens.map(normalizarLinha).filter((l): l is Linha => l !== null));
      }
      if ((cfg.cnpjs ?? []).length > 40) {
        avisos.push(`lista truncada em 40 de ${cfg.cnpjs!.length} CNPJs — chame de novo`);
      }
    }

    // ---- persistência ------------------------------------------------
    const porCnpj = new Map<string, Linha[]>();
    for (const l of linhas) {
      const arr = porCnpj.get(l.cnpj) ?? [];
      arr.push(l);
      porCnpj.set(l.cnpj, arr);
    }

    const mapa = await upsertEmpresasEmLote(
      sb,
      [...porCnpj.entries()].map(([cnpj, itens]) => ({
        cnpj,
        razao_social: itens[0].razao_social || undefined,
        uf: itens[0].uf ?? undefined,
      })),
    );

    const rows: Record<string, unknown>[] = [];
    for (const [cnpj, itens] of porCnpj) {
      const empresaId = mapa.get(cnpj.padStart(14, "0"));
      if (!empresaId) { avisos.push(`${cnpj}: empresa não resolvida`); continue; }
      itens.forEach((l, idx) => {
        rows.push({
          empresa_id: empresaId,
          ente,
          numero_inscricao: l.numero_inscricao || `${cnpj}:${ente}:${idx}`,
          tipo: l.tipo,
          receita_origem: l.receita_origem,
          valor: l.valor,
          situacao: l.situacao,
          data_inscricao: l.data_inscricao,
          fonte: "pgfn",
        });
      });
    }

    const r = await upsertEmLote(
      sb, "ab_inscricao_divida", rows, "empresa_id,ente,numero_inscricao",
    );
    gravados = r.gravados;
    avisos.push(...r.erros.slice(0, 3));

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "pgfn",
      status: avisos.length ? "parcial" : "ok",
      recebidos,
      gravados,
      detalhe: `modo ${modo}, ente ${ente}, valor mínimo ${valorMinimo}` +
        (avisos.length ? ` · ${avisos.slice(0, 3).join("; ")}` : ""),
      duracao_ms: ms,
    });
    return {
      status: 200,
      body: { ok: true, recebidos, gravados, empresas: porCnpj.size, avisos, duracao_ms: ms },
    };
  } catch (err) {
    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "pgfn", status: "erro", detalhe: (err as Error).message, duracao_ms: ms,
    });
    return { status: 500, body: { ok: false, erro: (err as Error).message, recebidos, gravados } };
  }
}
