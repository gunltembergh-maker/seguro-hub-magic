// =====================================================================
// Callback do bureau judicial.
//
// Recebe o payload da Judit / Digesto / Escavador, normaliza, classifica
// cada andamento, grava e reavalia o motor só para os documentos afetados.
//
// Configure esta URL no painel do fornecedor:
//   https://<dominio-do-hub>/api/public/hooks/ab-bureau-webhook?secret=...
//
// Duas coisas aqui são deliberadas:
//
//  * A normalização e a gravação NÃO vivem neste arquivo. Vivem em
//    normalizar.ts e persistir.server.ts, compartilhadas com a consulta
//    sob demanda (solicitacao.server.ts). Se cada caminho tivesse a sua
//    cópia, o classificador rodaria em um e não no outro, e a falha
//    apareceria como um lead que simplesmente não veio.
//  * O motor é chamado em processo (`rodarMotor`), não por HTTP com a
//    service_role num header. Além de mais rápido, evita a chave
//    circulando na rede.
// =====================================================================

import { admin, logIngest } from "./db.server.ts";
import { normalizarPayload } from "./normalizar.ts";
import { persistirProcessos } from "./persistir.server.ts";
import { rodarMotor } from "./motor.server.ts";

// Quantos documentos o webhook reavalia na própria chamada. Acima disso o
// cron do motor pega o resto: melhor perder alguns segundos de latência
// no lead do que estourar a borda e perder o payload inteiro.
const MAX_REAVALIACOES = 15;

export async function bureauWebhook(
  payload: unknown,
): Promise<{ status: number; body: unknown }> {
  const t0 = Date.now();
  const sb = admin();
  const provedor = (process.env.BUREAU_PROVIDER ?? "judit").toLowerCase();

  const stats = {
    processos: 0, movimentacoes: 0, com_sinal: 0,
    documentos: 0, reavaliados: 0, leads: 0,
  };
  const avisos: string[] = [];

  try {
    const processos = normalizarPayload(payload, provedor);

    if (!processos.length) {
      // Payload que não casa com o normalizador é quase sempre mudança de
      // contrato do fornecedor. Registrar as chaves recebidas é o que
      // permite consertar em minutos em vez de adivinhar.
      const chaves = Object.keys((payload ?? {}) as Record<string, unknown>).slice(0, 20);
      await logIngest(sb, {
        fonte: "bureau",
        status: "parcial",
        recebidos: 0,
        detalhe: `payload sem processo reconhecível — chaves: ${chaves.join(", ") || "(vazio)"}`,
      });
      return {
        status: 200,
        body: { ok: true, aviso: "nada reconhecido", amostra: chaves },
      };
    }

    const r = await persistirProcessos(sb, processos, provedor);
    stats.processos = r.processos;
    stats.movimentacoes = r.movimentacoes;
    stats.com_sinal = r.com_sinal;
    stats.documentos = r.empresas.length;
    avisos.push(...r.avisos);

    const aReavaliar = r.empresas.slice(0, MAX_REAVALIACOES);
    for (const cnpj of aReavaliar) {
      try {
        const m = await rodarMotor({ cnpj });
        const corpo = (m.body ?? {}) as { stats?: { leads?: number } };
        stats.leads += corpo.stats?.leads ?? 0;
        stats.reavaliados++;
      } catch (err) {
        avisos.push(`motor ${cnpj}: ${(err as Error).message}`);
      }
    }
    if (r.empresas.length > aReavaliar.length) {
      avisos.push(
        `${r.empresas.length - aReavaliar.length} documento(s) ficaram para o motor agendado`,
      );
    }

    const ms = Date.now() - t0;
    await logIngest(sb, {
      fonte: "bureau",
      status: avisos.length ? "parcial" : "ok",
      recebidos: processos.length,
      gravados: stats.processos,
      detalhe: `${stats.movimentacoes} andamento(s) novo(s), ${stats.com_sinal} com sinal, ` +
        `${stats.reavaliados}/${stats.documentos} documento(s) reavaliado(s), ` +
        `${stats.leads} lead(s)` +
        (avisos.length ? ` · ${avisos.slice(0, 3).join("; ")}` : ""),
      duracao_ms: ms,
    });

    return { status: 200, body: { ok: true, provedor, stats, avisos, duracao_ms: ms } };
  } catch (err) {
    await logIngest(sb, {
      fonte: "bureau",
      status: "erro",
      detalhe: (err as Error).message,
      duracao_ms: Date.now() - t0,
    });
    return { status: 500, body: { ok: false, erro: (err as Error).message, stats } };
  }
}
