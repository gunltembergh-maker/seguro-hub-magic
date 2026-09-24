// Amostra compacta do documento para o classificador (agente 1).
// Puro e testável: início do documento + janelas ao redor de palavras-chave,
// preservando o marcador [Pagina N] mais próximo de cada janela.

export const AMOSTRA_INICIO = 6000;
export const AMOSTRA_JANELA = 600;
export const AMOSTRA_MAX = 40000;

export const PALAVRAS_CHAVE = [
  "garantia", "seguro-garantia", "seguro garantia", "caução", "fiança", "fiança bancária",
  "garantia de proposta", "garantia contratual", "fiel cumprimento", "execução", "adiantamento",
  "retenção", "locação", "locador", "locatário", "aluguel", "processo judicial", "execução fiscal",
  "depósito recursal", "penhora",
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function paginaAntes(texto: string, pos: number): string | null {
  const antes = texto.slice(0, pos);
  const achados = [...antes.matchAll(/\[Pagina (\d+)\]/g)];
  return achados.length ? achados[achados.length - 1][1] : null;
}

/** `texto` já vem com os marcadores [Pagina N] (conteudo do ArquivoExtraido). */
export function montarAmostra(texto: string, max = AMOSTRA_MAX): string {
  const limpo = String(texto || "");
  if (limpo.length <= max) return limpo;
  const inicio = limpo.slice(0, AMOSTRA_INICIO);
  const regex = new RegExp(PALAVRAS_CHAVE.map(escapar).sort((a, b) => b.length - a.length).join("|"), "gi");
  const janelas: Array<[number, number]> = [];
  let fimUltima = AMOSTRA_INICIO;
  for (const m of limpo.matchAll(regex)) {
    const pos = m.index ?? 0;
    if (pos < fimUltima) continue;
    const ini = Math.max(fimUltima, pos - AMOSTRA_JANELA / 2);
    const fim = Math.min(limpo.length, pos + AMOSTRA_JANELA / 2);
    janelas.push([ini, fim]);
    fimUltima = fim;
  }
  let saida = inicio;
  for (const [ini, fim] of janelas) {
    const trecho = limpo.slice(ini, fim);
    const temMarcador = /\[Pagina \d+\]/.test(trecho.slice(0, 40));
    const pag = temMarcador ? null : paginaAntes(limpo, ini);
    const bloco = `\n…\n${pag ? `[Pagina ${pag}]\n` : ""}${trecho}`;
    if (saida.length + bloco.length > max) break;
    saida += bloco;
  }
  return saida;
}
