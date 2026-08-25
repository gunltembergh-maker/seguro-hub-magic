// =====================================================================
// Motor ab-motor-run (portado de supabase/functions/ab-motor-run/index.ts).
//
// Avalia todos os gatilhos para todas as empresas, precifica, prioriza e
// reescreve ab_evento e ab_lead. É o coração do sistema.
//
// Chamada: POST /api/public/hooks/ab-motor-run
//   {}                  → processa tudo
//   {"cnpj":"..."}      → só uma empresa
//   {"limite":N}        → processa em lote
// =====================================================================

import {
  admin, carregarParametros, carregarSinais, logIngest,
} from "./db.server.ts";
import { soDigitos } from "./format.ts";
import {
  bloqueios, catalogo, cnaePrioritario, GATILHOS,
  type Contexto, type EventoDetectado,
} from "./gatilhos.ts";
import { analisar, analisarProcesso } from "./nlp.ts";
import {
  agregar, precificar, prioridade, probSubscricao, urgencia, type Modalidade,
} from "./pricing.ts";
import { montarArgumento } from "./argumentos.ts";

const LOTE = 200;

export interface CorpoMotor { cnpj?: string; limite?: number }

export async function rodarMotor(corpo: CorpoMotor = {}): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();

  const params = await carregarParametros(sb);
  const nSinais = await carregarSinais(sb);

  const stats = { empresas: 0, eventos: 0, leads: 0, bloqueados: 0, sinais_atualizados: 0, erros: [] as string[] };

  try {
    // ---- empresas a processar -------------------------------------
    let q = sb.from("ab_empresa").select("*");
    if (corpo.cnpj) q = q.eq("cnpj", soDigitos(corpo.cnpj).padStart(14, "0"));
    const { data: empresasRaw, error: eErr } = await q.limit(corpo.limite ?? 5000);
    if (eErr) throw new Error(`empresas: ${eErr.message}`);
    const empresas = (empresasRaw ?? []) as Record<string, any>[];
    if (!empresas.length) return { status: 200, body: { ok: true, aviso: "nenhuma empresa na base", stats } };

    const ids = empresas.map((e) => e.id as string);

    // ---- carrega os fatos em lote (evita N+1) ---------------------
    const [procs, movs, inscs, ctrs, restrs, editais] = await Promise.all([
      lote(sb, "ab_processo", ids),
      Promise.resolve(null), // carregado depois, por processo_id
      lote(sb, "ab_inscricao_divida", ids),
      lote(sb, "ab_contrato_publico", ids),
      lote(sb, "ab_restritivo", ids),
      sb.from("ab_edital").select("*").eq("exige_garantia_proposta", true)
        .gte("data_encerramento", new Date().toISOString().slice(0, 10))
        .then((r) => (r.data ?? []) as Record<string, unknown>[]),
    ]);
    void movs;

    const procIds = (procs ?? []).map((p) => p.id as string);
    const movimentacoes = await loteCampo(sb, "ab_movimentacao", "processo_id", procIds);
    const movPorProc = agrupar(movimentacoes ?? [], "processo_id");

    const procPorEmpresa = agrupar(procs ?? [], "empresa_id");
    const inscPorEmpresa = agrupar(inscs ?? [], "empresa_id");
    const ctrPorEmpresa = agrupar(ctrs ?? [], "empresa_id");
    const restrPorEmpresa = agrupar(restrs ?? [], "empresa_id");

    // ---- limpa a saída anterior (sempre escopada ao lote) --------
    for (let i = 0; i < ids.length; i += LOTE) {
      const fatia = ids.slice(i, i + LOTE);
      await sb.from("ab_evento").delete().in("empresa_id", fatia);
      await sb.from("ab_lead").delete().in("empresa_id", fatia);
    }

    const eventosParaGravar: Record<string, unknown>[] = [];
    const leadsParaGravar: Record<string, unknown>[] = [];
    const processosParaAtualizar: Record<string, unknown>[] = [];
    const sinaisParaAtualizar: Record<string, unknown>[] = [];

    for (const emp of empresas) {
      stats.empresas++;

      const processos = (procPorEmpresa[emp.id] ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        movimentacoes: (movPorProc[p.id as string] ?? []).map((m: Record<string, unknown>) => ({
          id: m.id, tipo: m.tipo, texto: m.texto, codigo_tpu: m.codigo_tpu, data: m.data,
          sinaisGravados: (m.sinais ?? []) as string[],
        })),
      })) as any[];

      // deriva fase e garantia_prestada — fica visível na tela
      for (const p of processos) {
        const movsOrd = [...p.movimentacoes].sort(
          (a: any, b: any) => String(b.data ?? "").localeCompare(String(a.data ?? "")),
        );
        const a = analisarProcesso(movsOrd);
        processosParaAtualizar.push({
          id: p.id, fase: a.fase, garantia_prestada: a.garantiaPrestada,
        });
        for (const m of movsOrd) {
          const mid = (m as { id?: string }).id;
          if (!mid) continue;
          const sinais = analisar(m.texto, m.codigo_tpu, m.tipo).sinais;
          const gravados = (m as { sinaisGravados?: string[] }).sinaisGravados ?? [];
          const mudou = sinais.length !== gravados.length ||
            sinais.some((x, i) => x !== gravados[i]);
          if (mudou) sinaisParaAtualizar.push({ id: mid, sinais });
        }
      }

      const ctx: Contexto = {
        empresa: emp as Contexto["empresa"],
        processos: processos as Contexto["processos"],
        inscricoes: (inscPorEmpresa[emp.id] ?? []) as unknown as Contexto["inscricoes"],
        contratos: (ctrPorEmpresa[emp.id] ?? []) as unknown as Contexto["contratos"],
        restritivos: (restrPorEmpresa[emp.id] ?? []) as unknown as Contexto["restritivos"],
        // editais valem para a carteira elegível, filtrados por UF
        editais: (editais as unknown as Contexto["editais"]).filter(
          (ed) => !ed.uf || !emp.uf || ed.uf === emp.uf,
        ),
        params,
      };

      const bloq = bloqueios(ctx);
      const eventos: EventoDetectado[] = [];
      for (const g of GATILHOS) {
        try {
          eventos.push(...(g.fn(ctx) ?? []));
        } catch (err) {
          stats.erros.push(`${g.codigo}/${emp.cnpj}: ${(err as Error).message}`);
        }
      }
      // T8 (edital) só faz sentido para cliente/prospect sem bloqueio
      const filtrados = eventos.filter(
        (ev) => ev.gatilho !== "T8" || (!bloq.length && ["cliente", "prospect"].includes(emp.relacao)),
      );

      for (const ev of filtrados) {
        eventosParaGravar.push({
          empresa_id: emp.id, gatilho: ev.gatilho, modalidade: ev.modalidade,
          referencia: ev.referencia.slice(0, 80), descricao: ev.descricao,
          valor_base: ev.valorBase, deadline: ev.deadline,
          confianca: ev.confianca,
          // `verificar` chega como campo irmão de `evidencia` no gatilho, e
          // ab_evento não tem coluna para ele — sem dobrar aqui dentro, a
          // lista de qualificação simplesmente não era gravada, e a tela
          // lia `evidencia.verificar` de um objeto que nunca a teve.
          evidencia: ev.verificar?.length
            ? { ...(ev.evidencia ?? {}), verificar: ev.verificar }
            : ev.evidencia,
        });
        stats.eventos++;
      }

      // ---- consolida por modalidade -----------------------------
      const porMod = new Map<Modalidade, EventoDetectado[]>();
      for (const ev of filtrados) {
        const arr = porMod.get(ev.modalidade) ?? [];
        arr.push(ev);
        porMod.set(ev.modalidade, arr);
      }

      for (const [mod, evs] of porMod) {
        const melhor = evs.reduce((a, b) =>
          b.valorBase > a.valorBase || (b.valorBase === a.valorBase && b.confianca > a.confianca) ? b : a,
        );
        // T3 (CNDT) mede o MESMO débito dos processos: só entra se não
        // houver evento por processo.
        const temProcesso = evs.some((ev) => ["T1", "T2", "T4"].includes(ev.gatilho));
        const vistos = new Set<string>();
        const valores: number[] = [];
        for (const ev of evs) {
          if (ev.gatilho === "T3" && temProcesso) continue;
          if (vistos.has(ev.referencia)) continue;
          vistos.add(ev.referencia);
          valores.push(ev.valorBase);
        }
        const valorBase = agregar(valores, mod);
        const grande = evs.some((ev) => ev.grandeVulto);
        const preco = precificar(valorBase, mod, {
          fatorIs: melhor.fatorIs ?? null, grandeVulto: grande, params,
        });
        const prazos = evs.map((ev) => ev.deadline).filter(Boolean) as string[];
        const deadline = prazos.length ? prazos.sort()[0] : null;
        const urg = urgencia(deadline);
        const pSub = probSubscricao({
          porte: emp.porte, capitalSocial: emp.capital_social,
          situacaoCadastral: emp.situacao_cadastral,
          restritivos: [...new Set(ctx.restritivos.filter((r) => r.ativo).map((r) => r.tipo))],
          cnaePrioritario: cnaePrioritario(emp.cnae),
        });
        const meta = GATILHOS.find((g) => g.codigo === melhor.gatilho);
        // MAX e não média: se UM evento é fato comprovado, o lead é forte,
        // mesmo acompanhado de sinais fracos. Média puniria o lead por
        // trazer evidência adicional, o que é o incentivo errado.
        const confiancaLead = evs.reduce((m, ev) => Math.max(m, Number(ev.confianca)), 0);

        leadsParaGravar.push({
          empresa_id: emp.id,
          modalidade: mod,
          produto: meta?.produto ?? mod,
          gatilhos: [...new Set(evs.map((ev) => ev.gatilho))]
            .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
          valor_base: valorBase,
          importancia_segurada: preco.importanciaSegurada,
          premio_estimado: preco.premioRef,
          comissao_estimada: preco.comissao,
          economia_cliente: preco.economiaCliente,
          prioridade: prioridade(preco.premioRef, urg, pSub, bloq.length > 0, confiancaLead),
          urgencia: urg,
          prob_subscricao: pSub,
          confianca: confiancaLead,
          deadline,
          bloqueios: bloq.length ? bloq : null,
          argumento: montarArgumento({
            gatilho: melhor.gatilho, empresaNome: emp.razao_social, cnpj: emp.cnpj,
            referencia: melhor.referencia,
            orgao: processos.find((p: any) => p.numero === melhor.referencia)?.orgao_julgador ?? null,
            preco, params,
          }),
        });
        stats.leads++;
        if (bloq.length) stats.bloqueados++;
      }
    }

    // ---- grava em lote -------------------------------------------
    await atualizarDerivados(sb, processosParaAtualizar);
    await atualizarSinais(sb, sinaisParaAtualizar);
    stats.sinais_atualizados = sinaisParaAtualizar.length;
    await inserirEmLote(sb, "ab_evento", eventosParaGravar);
    await inserirEmLote(sb, "ab_lead", leadsParaGravar);

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "motor", status: stats.erros.length ? "parcial" : "ok",
      recebidos: stats.empresas, gravados: stats.leads,
      detalhe: `${stats.eventos} eventos, ${stats.leads} leads, ${stats.bloqueados} bloqueados` +
        `, dicionário: ${nSinais || "código"}` +
        (stats.erros.length ? ` · erros: ${stats.erros.slice(0, 3).join(" | ")}` : ""),
      duracao_ms: ms,
    });

    return { status: 200, body: { ok: true, stats, duracao_ms: ms, sinais_carregados: nSinais || "fallback" } };
  } catch (err) {
    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "motor", status: "erro", detalhe: (err as Error).message, duracao_ms: ms,
    }).catch(() => {});
    return { status: 500, body: { ok: false, erro: (err as Error).message, stats } };
  }
}

// ---------------------------------------------------------------------
type SB = ReturnType<typeof admin>;

async function lote(sb: SB, tabela: string, ids: string[]) {
  return await loteCampo(sb, tabela, "empresa_id", ids);
}

async function loteCampo(sb: SB, tabela: string, campo: string, ids: string[]) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await sb.from(tabela).select("*").in(campo, ids.slice(i, i + LOTE));
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return out;
}

function agrupar(rows: Record<string, unknown>[], campo: string) {
  const m: Record<string, Record<string, unknown>[]> = {};
  for (const r of rows) {
    const k = String(r[campo]);
    (m[k] ??= []).push(r);
  }
  return m;
}

async function inserirEmLote(sb: SB, tabela: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += LOTE) {
    const { error } = await sb.from(tabela).insert(rows.slice(i, i + LOTE));
    if (error) throw new Error(`insert ${tabela}: ${error.message}`);
  }
}

/** UPDATE em lote de fase/garantia_prestada, via rpc_ab_atualizar_derivados. */
async function atualizarDerivados(
  sb: ReturnType<typeof admin>, rows: Record<string, unknown>[],
) {
  for (let i = 0; i < rows.length; i += LOTE) {
    const { error } = await sb.rpc("rpc_ab_atualizar_derivados", {
      p_linhas: rows.slice(i, i + LOTE),
    });
    if (error) throw new Error(`rpc_ab_atualizar_derivados: ${error.message}`);
  }
}

/** UPDATE em lote de ab_movimentacao.sinais, via rpc_ab_atualizar_sinais. */
async function atualizarSinais(
  sb: ReturnType<typeof admin>, rows: Record<string, unknown>[],
) {
  for (let i = 0; i < rows.length; i += LOTE) {
    const { error } = await sb.rpc("rpc_ab_atualizar_sinais", {
      p_linhas: rows.slice(i, i + LOTE),
    });
    if (error) throw new Error(`rpc_ab_atualizar_sinais: ${error.message}`);
  }
}

export const _catalogo = catalogo;
