import { mensagemDeErro } from "@/lib/erro";
// Alerta de vencimento de contrato de parceria para o jurídico.
// Server-only: usa service role e o envio gerenciado do Hub.
//
// A RPC já exclui os contratos avisados, então cada contrato recebe um único
// e-mail. O aviso só é marcado quando o envio dá certo — falhou, tenta amanhã.

const DESTINATARIO = "juridico@lavoroseguros.com.br";
const TIPO_AVISO = "VENCE_60_DIAS";
const DIAS = 60;

type Pendente = {
  contrato_id: string;
  canal_id: string | null;
  parceiro: string | null;
  razao_social: string | null;
  cnpj: string | null;
  arquivo_nome: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  dias_para_vencer: number | null;
  tipo_aviso: string | null;
  repasse_acumulado: number | null;
  renovacao_automatica: boolean | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
};

const dataBR = (iso: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const moedaBR = (v: number | null) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number | null) =>
  v == null ? "—" : `${Math.round(Number(v) * 100)}%`;

const percentuaisRepasse = (p: Pendente) => {
  const demais = p.pct_demais == null;
  return (
    `Benefícios ${pct(p.pct_beneficios)} · Garantia ${pct(p.pct_garantia)} · ` +
    `Demais ${pct(demais ? p.pct_garantia : p.pct_demais)}${demais ? " (herdado)" : ""}`
  );
};

export async function avisarVencimentosPendentes(): Promise<
  { ok: true; enviados: number; falhas?: number } | { ok: false; erro: string }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const { data, error } = await lavoroAdmin.rpc(
    "rpc_canal_parceiro_vencimentos_pendentes" as never,
    { p_dias: DIAS } as never,
  );
  if (error) return { ok: false, erro: error.message };

  const pendentes = (data ?? []) as Pendente[];
  if (pendentes.length === 0) return { ok: true, enviados: 0 };

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  let enviados = 0;
  let falhas = 0;

  for (const p of pendentes) {
    const messageId = crypto.randomUUID();
    try {
      const resultado = await sendTemplateEmail("canal-parceiro-vencimento", DESTINATARIO, {
        idempotencyKey: messageId,
        templateData: {
          parceiro: p.parceiro ?? "—",
          razaoSocial: p.razao_social ?? "—",
          cnpj: p.cnpj && p.cnpj.trim() ? p.cnpj : "CNPJ não cadastrado",
          vigenciaInicio: dataBR(p.vigencia_inicio),
          vigenciaFim: dataBR(p.vigencia_fim),
          diasParaVencer: Number(p.dias_para_vencer ?? 0),
          arquivoNome: p.arquivo_nome ?? "—",
          repasseAcumulado: moedaBR(p.repasse_acumulado),
          percentuais: percentuaisRepasse(p),
          renovacaoAutomatica: p.renovacao_automatica,
        },
      });

      if (!resultado.sent) {
        falhas += 1;
        continue;
      }

      const { error: erroMarca } = await lavoroAdmin.rpc(
        "canal_parceiro_marcar_aviso" as never,
        {
          p_contrato_id: p.contrato_id,
          p_tipo: TIPO_AVISO,
          p_destinatario: DESTINATARIO,
          p_message_id: messageId,
        } as never,
      );
      if (erroMarca) {
        console.error("[canal-parceiro-vencimentos] falha ao marcar aviso", erroMarca.message);
      }
      enviados += 1;
    } catch (e) {
      falhas += 1;
      console.error(
        "[canal-parceiro-vencimentos] falha no envio",
        p.contrato_id,
        mensagemDeErro(e),
      );
    }
  }

  return { ok: true, enviados, falhas };
}
