// =====================================================================
// Monitoramento contínuo no bureau.
//
// Registra documentos para varredura recorrente. Os andamentos chegam
// depois, pelo webhook. A diferença entre monitorar e consultar:
// a consulta é uma foto (e uma tarifa), o monitoramento é assinatura —
// e é o que faz o gatilho T4 chegar no dia em que a penhora acontece,
// não no dia em que alguém lembrou de pesquisar.
//
// Toda a conversa com o fornecedor está em provedores.server.ts. Aqui
// ficam só a seleção dos alvos, o teto de lote e o log.
// =====================================================================

import { admin, logIngest } from "./db.server.ts";
import { soDigitos } from "./format.ts";
import { TERMOS_CONSTRICAO } from "./nlp.ts";
import { provedorAtivo } from "./provedores.server.ts";

// Teto seguro para a janela da borda (Cloudflare Workers).
const LOTE = 40;

export interface CorpoMonitorar {
  cnpjs?: string[];
  todosMonitorados?: boolean;
}

export async function bureauMonitorar(
  cfgCorpo: CorpoMonitorar = {},
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();

  let alvos = (cfgCorpo.cnpjs ?? [])
    .map(soDigitos)
    .filter((c) => c.length === 14 || c.length === 11);

  if (cfgCorpo.todosMonitorados) {
    const { data } = await sb.from("ab_empresa").select("cnpj").eq("monitorado", true);
    alvos = [...new Set([...alvos, ...(data ?? []).map((e: { cnpj: string }) => e.cnpj)])];
  }
  if (!alvos.length) {
    return { status: 400, body: { ok: false, erro: "informe cnpjs ou todosMonitorados" } };
  }

  const { cfg, impl, erro } = await provedorAtivo(sb);

  if (erro) {
    return { status: 500, body: { ok: false, erro, provedor: cfg.chave } };
  }

  if (!cfg.capacidades.monitoramento || !impl.monitorar) {
    return {
      status: 200,
      body: {
        ok: true,
        provedor: cfg.chave,
        registrados: 0,
        aviso:
          "Nenhum bureau judicial com monitoramento contratado. O Hub segue " +
          "funcionando com as fontes gratuitas (T3, T6, T8, T9, T10), mas os " +
          "gatilhos T1, T2, T4 e T13 dependem de processo por documento com " +
          "texto de andamento — isso não existe de graça.",
        proximo_passo:
          "Defina BUREAU_PROVIDER, BUREAU_API_KEY, BUREAU_CALLBACK_URL e " +
          "BUREAU_WEBHOOK_SECRET, ative o fornecedor em ab_provedor e chame de novo.",
        termos_que_serao_monitorados: TERMOS_CONSTRICAO,
        filtro_nativo_de_termos: cfg.capacidades.filtro_termos,
      },
    };
  }

  if (!process.env.BUREAU_CALLBACK_URL) {
    return {
      status: 400,
      body: {
        ok: false,
        erro: "BUREAU_CALLBACK_URL não definida",
        detalhe: "Aponte para https://<dominio-do-hub>/api/public/hooks/ab-bureau-webhook",
      },
    };
  }

  const lote = alvos.slice(0, LOTE);
  const resultados: { documento: string; ok: boolean; detalhe: string }[] = [];

  for (const documento of lote) {
    try {
      const r = await impl.monitorar(cfg, documento);
      await sb.from("ab_empresa")
        .update({ monitorado: true })
        .eq("cnpj", documento.padStart(14, "0"));
      resultados.push({ documento, ok: true, detalhe: JSON.stringify(r).slice(0, 160) });
    } catch (err) {
      resultados.push({ documento, ok: false, detalhe: (err as Error).message });
    }
  }

  const ok = resultados.filter((r) => r.ok).length;
  const custo = ok * Number(cfg.custo_monitoramento_mes ?? 0);

  await logIngest(sb, {
    fonte: "bureau_monitoramento",
    status: ok === lote.length ? "ok" : "parcial",
    recebidos: lote.length,
    gravados: ok,
    detalhe: `provedor ${cfg.chave} · ${ok}/${lote.length} registrados` +
      (alvos.length > lote.length ? ` · ${alvos.length - lote.length} na fila` : "") +
      (custo ? ` · custo mensal estimado ${custo.toFixed(2)}` : ""),
    duracao_ms: Date.now() - t0,
  });

  return {
    status: 200,
    body: {
      ok: true,
      provedor: cfg.chave,
      filtro_nativo_de_termos: cfg.capacidades.filtro_termos,
      registrados: ok,
      restantes: alvos.length - lote.length,
      custo_mensal_estimado: custo,
      resultados,
    },
  };
}
