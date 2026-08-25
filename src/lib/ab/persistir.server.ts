// =====================================================================
// Gravação de processos e andamentos, compartilhada pelos dois caminhos
// de entrada: o webhook do bureau e a consulta sob demanda.
//
// Um só lugar de propósito. Se cada caminho gravasse por conta, o
// classificador rodaria em um e não no outro, e o time descobriria isso
// pela pior via possível: um lead que não apareceu.
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { analisar } from "./nlp.ts";
import { soDigitos } from "./format.ts";
import { upsertEmpresasEmLote } from "./db.server.ts";
import type { ProcNorm } from "./normalizar.ts";

export interface ResultadoPersistencia {
  processos: number;
  movimentacoes: number;
  com_sinal: number;
  empresas: string[];
  avisos: string[];
}

/**
 * Grava os processos normalizados, classificando cada andamento novo.
 *
 * Deduplicação de andamento por (data, primeiros 80 caracteres do texto).
 * Não é elegante, mas é o que funciona: nenhum fornecedor entrega id
 * estável de movimento, e o mesmo andamento volta em toda varredura.
 */
export async function persistirProcessos(
  sb: SupabaseClient,
  processos: ProcNorm[],
  provedor: string,
): Promise<ResultadoPersistencia> {
  const out: ResultadoPersistencia = {
    processos: 0, movimentacoes: 0, com_sinal: 0, empresas: [], avisos: [],
  };
  if (!processos.length) return out;

  const fonte = `bureau:${provedor}`;

  const mapa = await upsertEmpresasEmLote(
    sb,
    processos.map((p) => ({
      cnpj: p.documento,
      razao_social: p.razao_social ?? undefined,
      uf: p.uf ?? undefined,
      monitorado: true,
    })),
  );

  const afetadas = new Set<string>();

  for (const p of processos) {
    const doc = soDigitos(p.documento).padStart(14, "0");
    const empresaId = mapa.get(doc);
    if (!empresaId) { out.avisos.push(`${p.numero}: empresa não resolvida`); continue; }
    afetadas.add(doc);

    const { data: proc, error } = await sb.from("ab_processo").upsert({
      empresa_id: empresaId,
      numero: p.numero,
      area: p.area,
      tribunal: p.tribunal,
      uf: p.uf,
      orgao_julgador: p.orgao_julgador,
      classe: p.classe,
      classe_codigo: p.classe_codigo,
      status: p.status,
      polo: p.polo,
      distribuicao: p.distribuicao,
      valor_causa: p.valor_causa || null,
      valor_execucao: p.valor_execucao || null,
      assuntos: p.assuntos,
      fonte,
      raw: p.raw,
    }, { onConflict: "empresa_id,numero" }).select("id").single();

    if (error || !proc) { out.avisos.push(`${p.numero}: ${error?.message}`); continue; }
    out.processos++;
    const processoId = (proc as { id: string }).id;

    const { data: existentes } = await sb
      .from("ab_movimentacao").select("data, texto").eq("processo_id", processoId);
    const chaves = new Set(
      (existentes ?? []).map((m: { data: string | null; texto: string | null }) =>
        `${m.data ?? ""}|${(m.texto ?? "").slice(0, 80)}`),
    );

    const novas: Record<string, unknown>[] = [];
    for (const m of p.movimentacoes) {
      const chave = `${m.data ?? ""}|${(m.texto ?? "").slice(0, 80)}`;
      if (chaves.has(chave)) continue;
      chaves.add(chave);
      const a = analisar(m.texto, m.codigo_tpu, m.tipo);
      if (a.sinais.length) out.com_sinal++;
      novas.push({
        processo_id: processoId,
        data: m.data,
        tipo: m.tipo,
        codigo_tpu: m.codigo_tpu,
        texto: m.texto,
        fonte,
        sinais: a.sinais,
      });
    }
    if (novas.length) {
      const { error: mErr } = await sb.from("ab_movimentacao").insert(novas);
      if (mErr) out.avisos.push(`movs ${p.numero}: ${mErr.message}`);
      else out.movimentacoes += novas.length;
    }
  }

  out.empresas = [...afetadas];
  return out;
}
