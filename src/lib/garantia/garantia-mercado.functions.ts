// Consulta a mercado da demanda (etapa 3 do pipeline de Garantia).
//
// A normalização do payload do Worker é SEMPRE resumirResultadoMercado():
// mesma fonte da tela Análise de Limite, da planilha e do e-mail. Nada é
// reparseado aqui.
//
// O Worker é chamado pelo módulo servidor extraído do motor judicial, que
// injeta as credenciais Cloudflare Access. O browser nunca fala com o Worker
// nem vê URL, corpo de erro upstream ou stack trace.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resumirResultadoMercado } from "./garantia-judicial-normalizar";
import { recalcularConsulta } from "./limites-regra";

const entrada = z.object({
  demandaId: z.string().uuid(),
  forcar: z.boolean().optional(),
});

export type RetornoConsultaMercado =
  | { ok: true; consultaId: string; reaproveitada: boolean; completa?: boolean; exige_cadastro?: boolean }
  | { ok: false; erro: string; mensagem?: string };

export const consultarMercadoDaDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }): Promise<RetornoConsultaMercado> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const userId = context.userId as string;

    const { data: podePipeline } = await sb.rpc("pode_garantia_pipeline");
    if (!podePipeline) return { ok: false, erro: "sem_permissao" };

    const { data: demanda, error: erroDemanda } = await sb
      .from("garantia_demandas")
      .select("id, produto, cliente_id, cliente:hub_clientes(id, nome, cpf_cnpj, tipo_pessoa)")
      .eq("id", data.demandaId)
      .maybeSingle();
    if (erroDemanda || !demanda) return { ok: false, erro: "demanda_nao_encontrada" };

    if (demanda.produto === "fianca_locaticia") {
      return { ok: false, erro: "produto_sem_consulta" };
    }

    const cnpjDigits = String(demanda.cliente?.cpf_cnpj ?? "").replace(/\D/g, "");
    if (cnpjDigits.length !== 14) return { ok: false, erro: "cliente_pf" };

    // Consulta válida não se refaz sozinha: é chamada paga em tempo e em cota.
    if (!data.forcar) {
      const { data: vigentes } = await sb
        .from("garantia_consultas_mercado")
        .select("id, completa")
        .eq("cliente_id", demanda.cliente_id)
        .is("substituida_por_id", null)
        .gt("valida_ate", new Date().toISOString())
        .order("consultada_em", { ascending: false })
        .limit(1);
      const vigente = vigentes?.[0];
      if (vigente) {
        return { ok: true, consultaId: vigente.id as string, reaproveitada: true };
      }
    }

    const { data: config } = await sb
      .from("garantia_seguradoras_config")
      .select("chave_mercado, identificador_api, ativa_garantia")
      .not("identificador_api", "is", null)
      .eq("ativa_garantia", true);
    const seguradoras = (config ?? [])
      .map((c: { identificador_api: string | null }) => c.identificador_api)
      .filter((v: string | null): v is string => !!v);
    if (!seguradoras.length) return { ok: false, erro: "sem_seguradoras_ativas" };

    const { consultarWorkerLimites, sanitizarResultado } = await import(
      "./garantia-mercado-worker.server"
    );
    const resposta = await consultarWorkerLimites({
      cnpjDigits,
      seguradoras,
      forceRefresh: !!data.forcar,
    });

    if (resposta.tipo !== "ok") {
      // Detalhe fica no log do servidor; o cliente recebe só o tipo.
      console.error("[garantia/mercado] consulta não concluída", {
        demandaId: data.demandaId,
        tipo: resposta.tipo,
        status: resposta.tipo === "erro_upstream" ? resposta.status : undefined,
      });
      return {
        ok: false,
        erro: resposta.tipo,
        mensagem:
          resposta.tipo === "em_andamento"
            ? "A consulta ainda está sendo processada pelas seguradoras. Tente novamente em instantes."
            : "Não foi possível concluir a consulta a mercado agora.",
      };
    }

    const bruto = sanitizarResultado(resposta.resultado);
    const resumo = resumirResultadoMercado(bruto);

    const capacidadeTotal = resumo.com_limite.reduce((t, s) => t + (s.capacidade || 0), 0);

    const { data: nova, error: erroInsert } = await sb
      .from("garantia_consultas_mercado")
      .insert({
        cliente_id: demanda.cliente_id,
        demanda_id: demanda.id,
        origem: "api",
        resultado_bruto: bruto,
        total_com_limite: resumo.com_limite.length,
        total_sem_limite: resumo.sem_limite.length,
        total_nao_consultado: resumo.nao_consultado.length,
        capacidade_total: capacidadeTotal,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (erroInsert || !nova) {
      console.error("[garantia/mercado] falha ao gravar consulta", erroInsert);
      return { ok: false, erro: "falha_ao_gravar" };
    }

    const linhas = resumo.seguradoras.map((s) => ({
      consulta_id: nova.id,
      cliente_id: demanda.cliente_id,
      chave_mercado: s.key,
      status_mercado: s.statusKey,
      grupo_mercado: s.grupo,
      limite_total: s.capacidade || null,
      modalidades: s.modalidades,
      mensagem: s.mensagem || null,
      origem: "api",
      registrado_por: userId,
    }));
    if (linhas.length) {
      const { error: erroLinhas } = await sb.from("garantia_limites_tomador").insert(linhas);
      if (erroLinhas) {
        console.error("[garantia/mercado] falha ao gravar limites", erroLinhas);
        return { ok: false, erro: "falha_ao_gravar_limites" };
      }
    }

    // A consulta anterior não é apagada: ela é o histórico da evolução do
    // limite do tomador, só passa a apontar para a que a substituiu.
    await sb
      .from("garantia_consultas_mercado")
      .update({ substituida_por_id: nova.id })
      .eq("cliente_id", demanda.cliente_id)
      .is("substituida_por_id", null)
      .neq("id", nova.id);

    const recalculo = await recalcularConsulta(sb, nova.id as string, demanda.id as string);

    return {
      ok: true,
      consultaId: nova.id as string,
      reaproveitada: false,
      completa: recalculo?.completa ?? false,
      exige_cadastro: recalculo?.exige_cadastro ?? false,
    };
  });
