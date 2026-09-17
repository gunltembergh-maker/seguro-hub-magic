// Download dos anexos da demanda de Garantia Judicial.
//
// O bucket é privado: a URL assinada é gerada no clique, vale 60 segundos e
// não fica guardada em estado. A RLS de leitura (pode_ver_garantia_formulario)
// é quem decide se o usuário pode baixar.
import { supabase } from "@/integrations/supabase/client";

export const BUCKET_ANEXOS = "garantia-judicial-anexos";

export function nomeArquivoPdf(protocolo: string | null) {
  return `Formulario_${protocolo || "demanda"}.pdf`;
}

export function nomeArquivoXlsx(protocolo: string | null) {
  return `Consulta_Mercado_${protocolo || "demanda"}.xlsx`;
}

/** Gera a URL assinada sob demanda e dispara o download. */
export async function baixarAnexo(path: string, nomeArquivo: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(path, 60, { download: nomeArquivo });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível gerar o link do arquivo.");
  }

  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = nomeArquivo;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
