// Retorno do comercial a uma demanda de Garantia que aguarda documento.
// O comercial, de propósito, não tem pode_garantia_pipeline(): a autorização
// dele é a checagem explícita de tem_permissao('menu_garantia_comercial') aqui
// no servidor, e a gravação usa o cliente administrativo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LIMITE_BYTES = 20 * 1024 * 1024;

const entrada = z.object({
  demanda_id: z.string().uuid(),
  resposta: z.string().trim().min(1).max(2000),
  anexos: z
    .array(
      z.object({
        nome_arquivo: z.string().min(1).max(255),
        mime_type: z.string().max(200),
        tamanho_bytes: z.number().int().positive().max(LIMITE_BYTES),
        base64: z.string().min(1),
      }),
    )
    .max(10)
    .optional(),
});

type Resultado = { ok: true } | { ok: false; erro: string; detalhe?: string };

export const responderComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data, context }): Promise<Resultado> => {
    const { supabase, userId } = context;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pode, error: ePerm } = await (supabase as any).rpc("tem_permissao", {
        p_chave: "menu_garantia_comercial",
        p_user: userId,
      });
      if (ePerm || pode !== true) return { ok: false, erro: "sem_permissao" };

      const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = lavoroAdmin as any;

      const { data: dem, error: eDem } = await db
        .from("garantia_demandas")
        .select("id, numero, legenda, status_atual, responsavel_tecnico_id, cadastrado_por")
        .eq("id", data.demanda_id)
        .maybeSingle();
      if (eDem) {
        console.error("responderComercial: demanda", eDem);
        return { ok: false, erro: "falha_leitura" };
      }
      if (!dem) return { ok: false, erro: "demanda_nao_aguarda_comercial" };
      const { data: st } = await db
        .from("garantia_status_catalogo")
        .select("com_quem")
        .eq("codigo", dem.status_atual)
        .maybeSingle();
      if (!st || !["comercial", "cliente_ou_comercial"].includes(st.com_quem)) {
        return { ok: false, erro: "demanda_nao_aguarda_comercial" };
      }

      // Anexos: upload pelo servidor (a policy do bucket exige o pipeline).
      for (const a of data.anexos ?? []) {
        const bytes = Buffer.from(a.base64, "base64");
        if (bytes.byteLength > LIMITE_BYTES) return { ok: false, erro: "arquivo_grande" };
        const nomeSeguro = a.nome_arquivo.replace(/[^\w.\-]+/g, "_");
        const caminho = `${dem.id}/comercial/${Date.now()}-${nomeSeguro}`;
        const { error: eUp } = await db.storage
          .from("garantia-pipeline-anexos")
          .upload(caminho, bytes, { contentType: a.mime_type || "application/octet-stream", upsert: false });
        if (eUp) {
          console.error("responderComercial: upload", eUp);
          return { ok: false, erro: "falha_upload" };
        }
        const { error: eDoc } = await db.from("garantia_documentos").insert({
          demanda_id: dem.id,
          tipo: "comercial",
          caminho,
          nome_arquivo: a.nome_arquivo,
          tamanho_bytes: bytes.byteLength,
          mime_type: a.mime_type || null,
          enviado_por: userId,
        });
        if (eDoc) {
          console.error("responderComercial: documento", eDoc);
          return { ok: false, erro: "falha_documento" };
        }
      }

      // Acrescenta à observação da linha aberta do histórico.
      const { data: abertas } = await db
        .from("garantia_status_historico")
        .select("id, observacao")
        .eq("demanda_id", dem.id)
        .is("fim", null);
      for (const h of abertas ?? []) {
        const novo = [h.observacao, `Retorno do comercial: ${data.resposta}`].filter(Boolean).join("\n");
        const { error: eH } = await db.from("garantia_status_historico").update({ observacao: novo }).eq("id", h.id);
        if (eH) {
          console.error("responderComercial: historico", eH);
          return { ok: false, erro: "falha_historico" };
        }
      }

      const destinos = [...new Set([dem.responsavel_tecnico_id, dem.cadastrado_por].filter(Boolean))] as string[];
      if (destinos.length) {
        const titulo = `Retorno do comercial: ${dem.legenda || dem.numero || "demanda de Garantia"}`;
        const { error: eN } = await db.from("hub_notificacoes").insert(
          destinos.map((u) => ({
            user_id: u,
            tipo: "garantia_retorno_comercial",
            titulo,
            mensagem: data.resposta,
            link: `/garantia/negociacao?demanda=${dem.id}`,
            dados: { demanda_id: dem.id },
            criado_por: userId,
          })),
        );
        if (eN) {
          console.error("responderComercial: aviso", eN);
          return { ok: false, erro: "falha_aviso", detalhe: "O retorno foi gravado, mas o corretor não foi avisado." };
        }
      }
      return { ok: true };
    } catch (e) {
      console.error("responderComercial", e);
      return { ok: false, erro: "falha_inesperada" };
    }
  });
