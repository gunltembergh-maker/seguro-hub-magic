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
        .select("id, status_atual")
        .eq("id", data.demanda_id)
        .maybeSingle();
      if (eDem) {
        console.error("responderComercial: demanda", eDem);
        return { ok: false, erro: "falha_leitura" };
      }
      if (!dem) return { ok: false, erro: "demanda_nao_aguarda_comercial" };
      if (!["aguard_comercial", "aguard_cliente_comercial", "aguard_doc_contrato", "aguard_doc_cadastro"].includes(dem.status_atual)) {
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

      // Status, histórico ("Retorno do comercial: ...") e aviso ao corretor: tudo na RPC,
      // com o cliente do próprio usuário para o histórico registrar quem respondeu.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eR } = await (supabase as any).rpc("rpc_garantia_comercial_responder", {
        _demanda_id: dem.id,
        _resposta: data.resposta,
      });
      if (eR) {
        console.error("responderComercial: responder", eR);
        return { ok: false, erro: "falha_historico", detalhe: eR.message };
      }
      return { ok: true };
    } catch (e) {
      console.error("responderComercial", e);
      return { ok: false, erro: "falha_inesperada" };
    }
  });
