// Baixa e extrai os documentos de uma análise — compartilhado por
// analisarDocumento (agente 2) e classificarDocumento (agente 1).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArquivoExtraido } from "./extrair-texto";

export function idsDaAnalise(a: { documentos_ids?: string[] | null; documento_id?: string | null }): string[] {
  return (a.documentos_ids?.length ? a.documentos_ids : a.documento_id ? [a.documento_id] : []) as string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function baixarEExtrair(sb: SupabaseClient<any>, ids: string[]): Promise<ArquivoExtraido[]> {
  const { data: documentos, error: erroDoc } = await sb.from("garantia_documentos")
    .select("id, caminho, nome_arquivo, mime_type, externo")
    .in("id", ids);
  if (erroDoc || !documentos || documentos.length !== ids.length) throw new Error("Documento interno não encontrado.");
  const { extrairConteudoArquivo } = await import("./extrair-texto");
  const extraidos: ArquivoExtraido[] = [];
  // Mesma ordem em que a pessoa escolheu: o primeiro é o documento principal.
  for (const id of ids) {
    const documento = documentos.find((d: { id: string }) => d.id === id)!;
    if (!documento.caminho || documento.externo) throw new Error("Documento interno não encontrado.");
    const { data: arquivo, error: erroDownload } = await sb.storage
      .from("garantia-pipeline-anexos")
      .download(documento.caminho);
    if (erroDownload || !arquivo) throw new Error(`Falha ao baixar documento: ${erroDownload?.message ?? "arquivo vazio"}`);
    if (arquivo.size === 0) throw new Error("O documento armazenado está vazio.");
    const extraido = await extrairConteudoArquivo(new File([arquivo], documento.nome_arquivo, {
      type: documento.mime_type ?? "application/pdf",
    }));
    if (!extraido.partes.length && !extraido.conteudo.trim()) throw new Error(`O documento ${documento.nome_arquivo} não possui texto legível.`);
    extraidos.push(extraido);
  }
  return extraidos;
}

/** Mensagens já escritas para o usuário; qualquer outra vira texto genérico. */
export function mensagemParaUsuario(detalhe: string, generica: string): string {
  return /^(Este PDF parece escaneado|O documento .+ não possui texto legível\.|O documento armazenado está vazio\.)/.test(detalhe) ? detalhe : generica;
}
