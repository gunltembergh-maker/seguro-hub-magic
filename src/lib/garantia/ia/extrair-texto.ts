// CÓPIA DECLARADA de public/analise-limite/deepseek.js.
// Qualquer mudança de comportamento deve ser feita nos dois lugares. O arquivo
// em public/ é estático e não pode ser importado pelo bundle da aplicação.

export const MAX_PDF_PAGES = 600;
export const TEXT_CHUNK_SIZE = 30000;
export const OCR_TEXT_THRESHOLD = 100;

export interface ParteExtraida {
  indice: number;
  pagina: number | null;
  rotulo: string;
  conteudo: string;
}
export interface ArquivoExtraido {
  nome: string;
  tipo: "texto";
  conteudo: string;
  partes: ParteExtraida[];
  meta: Record<string, string | number>;
}

export function quebrarTextoEmPartes(texto: string, maxChars: number, metaBase: Record<string, unknown> = {}) {
  const clean = String(texto || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const partes: Array<{ indice: number; conteudo: string } & Record<string, unknown>> = [];
  let offset = 0;
  let indice = 1;
  while (offset < clean.length) {
    let end = Math.min(offset + maxChars, clean.length);
    if (end < clean.length) {
      const lastBreak = Math.max(clean.lastIndexOf("\n\n", end), clean.lastIndexOf("\n", end), clean.lastIndexOf(". ", end), clean.lastIndexOf("; ", end), clean.lastIndexOf(" ", end));
      if (lastBreak > offset + Math.floor(maxChars * 0.6)) end = lastBreak + 1;
    }
    const conteudo = clean.slice(offset, end).trim();
    if (conteudo) partes.push({ indice, conteudo, ...metaBase });
    indice += 1;
    offset = end;
  }
  return partes;
}

function comAvisoTruncado(partes: ParteExtraida[], aviso: string) {
  if (!aviso) return partes;
  return partes.map((parte) => ({ ...parte, conteudo: `${aviso}\n${parte.conteudo}` }));
}

async function extrairPDFcomOCR(pdf: any, totalPaginas: number): Promise<{ textoCompleto: string; partes: ParteExtraida[] }> {
  if (typeof document === "undefined") {
    // O servidor (Worker) não tem canvas nativo; OCR só roda no navegador.
    throw new Error("Este PDF parece escaneado (sem texto digital). A leitura por imagem não está disponível nesta análise.");
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["por", "eng"]);
  let textoCompleto = "";
  const partes: ParteExtraida[] = [];
  let chunkBuffer = "";
  let chunkStartPage: number | null = null;
  try {
    for (let i = 1; i <= totalPaginas; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new Error("Não foi possível preparar a página para leitura.");
      await page.render({ canvas, canvasContext, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      const pageText = data.text.replace(/\s+/g, " ").trim();
      if (!pageText) continue;
      textoCompleto += `[Pagina ${i}]\n${pageText}\n\n`;
      const bloco = `[Pagina ${i}]\n${pageText}\n\n`;
      if (!chunkBuffer) { chunkBuffer = bloco; chunkStartPage = i; continue; }
      if ((chunkBuffer + bloco).length <= TEXT_CHUNK_SIZE) { chunkBuffer += bloco; continue; }
      partes.push({ indice: partes.length + 1, pagina: chunkStartPage, rotulo: chunkStartPage === i - 1 ? `Pagina ${chunkStartPage}` : `Paginas ${chunkStartPage}-${i - 1}`, conteudo: chunkBuffer.trim() });
      chunkBuffer = bloco;
      chunkStartPage = i;
    }
    if (chunkBuffer && chunkStartPage !== null) partes.push({ indice: partes.length + 1, pagina: chunkStartPage, rotulo: chunkStartPage === totalPaginas ? `Pagina ${chunkStartPage}` : `Paginas ${chunkStartPage}-${totalPaginas}`, conteudo: chunkBuffer.trim() });
    return { textoCompleto: textoCompleto.trim(), partes };
  } finally { await worker.terminate(); }
}

export async function extrairPDF(file: File): Promise<ArquivoExtraido> {
  const pdfjs = typeof window === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const totalPaginas = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let textoCompleto = "";
  const partes: ParteExtraida[] = [];
  let chunkBuffer = "";
  let chunkStartPage: number | null = null;
  for (let i = 1; i <= totalPaginas; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ").replace(/\s+/g, " ").trim();
    if (!pageText) continue;
    textoCompleto += `[Pagina ${i}]\n${pageText}\n\n`;
    const blocoPagina = `[Pagina ${i}]\n${pageText}\n\n`;
    if (!chunkBuffer) { chunkBuffer = blocoPagina; chunkStartPage = i; continue; }
    if ((chunkBuffer + blocoPagina).length <= TEXT_CHUNK_SIZE) { chunkBuffer += blocoPagina; continue; }
    partes.push({ indice: partes.length + 1, pagina: chunkStartPage, rotulo: chunkStartPage === i - 1 ? `Pagina ${chunkStartPage}` : `Paginas ${chunkStartPage}-${i - 1}`, conteudo: chunkBuffer.trim() });
    chunkBuffer = blocoPagina;
    chunkStartPage = i;
  }
  if (chunkBuffer && chunkStartPage !== null) partes.push({ indice: partes.length + 1, pagina: chunkStartPage, rotulo: chunkStartPage === totalPaginas ? `Pagina ${chunkStartPage}` : `Paginas ${chunkStartPage}-${totalPaginas}`, conteudo: chunkBuffer.trim() });
  const aviso = pdf.numPages > totalPaginas ? `[Aviso: ${file.name} tem ${pdf.numPages} paginas; apenas as ${totalPaginas} primeiras foram lidas. Registre essa limitacao na analise.]` : "";
  if (textoCompleto.trim().length < Math.max(OCR_TEXT_THRESHOLD, totalPaginas * 100)) {
    const ocr = await extrairPDFcomOCR(pdf, totalPaginas);
    const finais = comAvisoTruncado(ocr.partes, aviso);
    return { nome: file.name, tipo: "texto", conteudo: [ocr.textoCompleto, aviso].filter(Boolean).join("\n\n"), partes: finais, meta: { origem: "pdf-ocr", totalPaginas, paginasNoArquivo: pdf.numPages, totalPartes: finais.length } };
  }
  const finais = comAvisoTruncado(partes, aviso);
  return { nome: file.name, tipo: "texto", conteudo: [textoCompleto.trim(), aviso].filter(Boolean).join("\n\n"), partes: finais, meta: { origem: "pdf", totalPaginas, paginasNoArquivo: pdf.numPages, totalPartes: finais.length } };
}

export async function extrairConteudoArquivo(file: File): Promise<ArquivoExtraido> {
  if (file.name.toLowerCase().endsWith(".pdf")) return extrairPDF(file);
  const texto = await file.text();
  const partes = quebrarTextoEmPartes(texto, TEXT_CHUNK_SIZE).map((p, i) => ({ indice: i + 1, pagina: null, rotulo: `Parte ${i + 1}`, conteudo: p.conteudo }));
  return { nome: file.name, tipo: "texto", conteudo: texto, partes, meta: { origem: "texto", totalPartes: partes.length } };
}

export function mapArquivosParaJob(arquivos: ArquivoExtraido[]) {
  return arquivos.map((item) => ({ nome: item.nome, tipo: "texto" as const, conteudo: item.partes.length ? "" : item.conteudo, partes: item.partes.map((p, i) => ({ indice: p.indice || i + 1, rotulo: p.rotulo || `Parte ${i + 1}`, pagina: p.pagina || null, conteudo: p.conteudo })), meta: item.meta }));
}
