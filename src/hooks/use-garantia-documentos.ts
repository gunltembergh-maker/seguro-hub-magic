// Anexos da demanda de Garantia.
//
// Três invariantes desta camada:
//  1. A VERSÃO É DO BANCO. O cliente nunca calcula `versao`: o trigger
//     garantia_documentos_versiona numera e garantia_documentos_marca_substituido
//     aponta a versão anterior. Aqui a gente só lê o valor de volta.
//  2. O bucket é privado e continua privado. Todo download passa por
//     createSignedUrl de 60 segundos, gerada no clique.
//  3. Os anexos do fluxo judicial são REFERENCIADOS, nunca copiados. O arquivo
//     segue no bucket garantia-judicial-anexos, com o mesmo caminho lido pelo
//     motor de e-mail. Renomear ou mover lá quebraria o motor.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BUCKET_ANEXOS } from "@/lib/garantia/anexos-download";
import {
  BUCKET_PIPELINE,
  TAMANHO_MAXIMO_BYTES,
  fluxoIADoTipo,
  podeAnalisarPorIA,
} from "@/lib/garantia/documentos-regra";
import type { AnaliseIA } from "@/lib/garantia/garantia-ia";

export interface DocumentoDemanda {
  id: string;
  demanda_id: string | null;
  tipo: string;
  caminho: string | null;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  versao: number;
  substituido_por_id: string | null;
  externo: boolean;
  solicitacao_id: string | null;
  caminho_externo: string | null;
  observacao: string | null;
  enviado_por: string | null;
  criado_em: string;
}

const CAMPOS_DOC =
  "id, demanda_id, tipo, caminho, nome_arquivo, tamanho_bytes, mime_type, versao, " +
  "substituido_por_id, externo, solicitacao_id, caminho_externo, observacao, enviado_por, criado_em";

export function useDocumentosDaDemanda(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "documentos", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<DocumentoDemanda[]> => {
      const { data, error } = await supabase
        .from("garantia_documentos")
        .select(CAMPOS_DOC)
        .eq("demanda_id", demandaId)
        .order("tipo")
        .order("versao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentoDemanda[];
    },
  });
}

export function useAnalisesDaDemanda(demandaId: string) {
  return useQuery({
    queryKey: ["garantia", "analises-ia", demandaId],
    queryFn: async (): Promise<AnaliseIA[]> => {
      const { data, error } = await supabase
        .from("garantia_analises_ia")
        .select(
          "id, demanda_id, documento_id, documentos_ids, fluxo, situacao, resumo, resultado, campos_sugeridos, aplicada, aplicada_por, aplicada_em, erro_mensagem, solicitada_por, criado_em, atualizado_em, job_id, classificacao, modalidade_id, modalidade_rotulo",
        )
        .eq("demanda_id", demandaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AnaliseIA[];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>, demandaId: string) {
  qc.invalidateQueries({ queryKey: ["garantia", "documentos", demandaId] });
  qc.invalidateQueries({ queryKey: ["garantia", "analises-ia", demandaId] });
  qc.invalidateQueries({ queryKey: ["garantia", "demandas"] });
}

export class ArquivoGrandeDemais extends Error {
  constructor() {
    super(
      "O arquivo passa de 20 MB, que é o teto por anexo. Reduza o PDF ou divida o documento antes de enviar.",
    );
  }
}

export function useEnviarDocumento(demandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      arquivo,
      tipo,
      produto,
      solicitarIA,
      observacao,
    }: {
      arquivo: File;
      tipo: string;
      produto: string;
      solicitarIA: boolean;
      observacao?: string;
    }): Promise<DocumentoDemanda> => {
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new ArquivoGrandeDemais();

      const { data: sessao } = await supabase.auth.getUser();
      const usuario = sessao.user?.id ?? null;

      // A versão não é calculada aqui. Para montar o caminho antes do INSERT,
      // o cliente só CONTA quantas versões já existem daquele tipo — o número
      // gravado na linha continua vindo do trigger, e é ele que a tela mostra.
      const { count } = await supabase
        .from("garantia_documentos")
        .select("id", { count: "exact", head: true })
        .eq("demanda_id", demandaId)
        .eq("tipo", tipo);

      const nomeLimpo = arquivo.name.replace(/[^\w.\-() ]+/g, "_");
      const caminho = `${demandaId}/${tipo}/${(count ?? 0) + 1}-${nomeLimpo}`;

      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_PIPELINE)
        .upload(caminho, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });
      if (erroUpload) throw new Error(`Não foi possível enviar o arquivo: ${erroUpload.message}`);

      const { data: documento, error } = await supabase
        .from("garantia_documentos")
        .insert({
          demanda_id: demandaId,
          tipo,
          caminho,
          nome_arquivo: arquivo.name,
          tamanho_bytes: arquivo.size,
          mime_type: arquivo.type || null,
          enviado_por: usuario,
          observacao: observacao || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        // lê a versão de volta: quem numerou foi o trigger
        .select(CAMPOS_DOC)
        .single();
      if (error) throw error;

      if (solicitarIA && podeAnalisarPorIA(tipo)) {
        // Só registra o PEDIDO. O motor de leitura será ligado na próxima
        // etapa; nada é chamado aqui.
        const { error: erroIA } = await supabase.from("garantia_analises_ia").insert({
          demanda_id: demandaId,
          documento_id: (documento as unknown as DocumentoDemanda).id,
          fluxo: fluxoIADoTipo(tipo, produto),
          situacao: "solicitada",
          solicitada_por: usuario,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        if (erroIA) throw erroIA;
        await supabase
          .from("garantia_demandas")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ ia_analise_solicitada: true } as any)
          .eq("id", demandaId);
      }

      return documento as unknown as DocumentoDemanda;
    },
    onSuccess: () => invalidar(qc, demandaId),
  });
}

/**
 * Registra (uma única vez) as referências aos anexos do formulário judicial.
 * Os arquivos NÃO são copiados: ficam onde estão, e a linha guarda só o
 * caminho de origem com externo = true.
 */
export function useVincularAnexosJudiciais(demandaId: string, solicitacaoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!solicitacaoId) return 0;
      const { data: solicitacao } = await supabase
        .from("garantia_judicial_solicitacoes")
        .select("id, protocolo, pdf_path, xlsx_path")
        .eq("id", solicitacaoId)
        .maybeSingle();
      if (!solicitacao) return 0;

      const { data: existentes } = await supabase
        .from("garantia_documentos")
        .select("caminho_externo")
        .eq("demanda_id", demandaId)
        .eq("externo", true);
      const jaVinculados = new Set((existentes ?? []).map((e) => e.caminho_externo));

      const candidatos = [
        {
          caminho_externo: solicitacao.pdf_path,
          // O PDF do formulário não é edital nem contrato: entra como "outro".
          tipo: "outro",
          nome_arquivo: `Formulario_${solicitacao.protocolo || "demanda"}.pdf`,
          mime_type: "application/pdf",
        },
        {
          caminho_externo: solicitacao.xlsx_path,
          tipo: "comparativo",
          nome_arquivo: `Consulta_Mercado_${solicitacao.protocolo || "demanda"}.xlsx`,
          mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ].filter((c) => c.caminho_externo && !jaVinculados.has(c.caminho_externo));

      if (!candidatos.length) return 0;

      const { error } = await supabase.from("garantia_documentos").insert(
        candidatos.map((c) => ({
          demanda_id: demandaId,
          tipo: c.tipo,
          nome_arquivo: c.nome_arquivo,
          mime_type: c.mime_type,
          externo: true,
          solicitacao_id: solicitacaoId,
          caminho_externo: c.caminho_externo,
          observacao: "Anexo do formulário de Garantia Judicial (somente leitura).",
        })) as never,
      );
      if (error) throw error;
      return candidatos.length;
    },
    onSuccess: () => invalidar(qc, demandaId),
  });
}

/** Download por URL assinada de 60 segundos, no bucket de origem do arquivo. */
export async function baixarDocumento(doc: DocumentoDemanda) {
  const bucket = doc.externo ? BUCKET_ANEXOS : BUCKET_PIPELINE;
  const caminho = doc.externo ? doc.caminho_externo : doc.caminho;
  if (!caminho) throw new Error("Este registro não tem arquivo associado.");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, 60, { download: doc.nome_arquivo });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível gerar o link do arquivo.");
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = doc.nome_arquivo;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Baixa o conteúdo para visualização e leitura local, sem tornar o bucket público. */
export async function baixarDocumentoComoBlob(doc: DocumentoDemanda): Promise<Blob> {
  const bucket = doc.externo ? BUCKET_ANEXOS : BUCKET_PIPELINE;
  const caminho = doc.externo ? doc.caminho_externo : doc.caminho;
  if (!caminho) throw new Error("Este registro não tem arquivo associado.");
  const { data, error } = await supabase.storage.from(bucket).download(caminho);
  if (error || !data) throw new Error(error?.message || "Não foi possível abrir o arquivo.");
  return data;
}
