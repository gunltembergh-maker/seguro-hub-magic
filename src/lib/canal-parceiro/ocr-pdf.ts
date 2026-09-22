// OCR de contrato no navegador.
//
// Usado só quando a camada de texto do PDF vem corrompida (export do Word com
// mapa de fontes quebrado). Renderiza cada página em canvas com pdf.js a ~150
// DPI, em escala de cinza, e reconhece com tesseract.js (idioma `por`) em web
// worker, para não travar a interface.
//
// Tudo aqui é browser-only: os imports são dinâmicos de propósito.

export const OCR_MAX_PAGINAS = 20;

const DPI = 150;
const ESCALA = DPI / 72; // pdf.js trabalha em 72 DPI

export interface ProgressoOcr {
  pagina: number;
  paginas: number;
}

/** Erro com `paginas` quando o PDF passa do limite de páginas do OCR. */
export class PdfLongoDemais extends Error {
  paginas: number;
  constructor(paginas: number) {
    super(`PDF com ${paginas} páginas, acima do limite de ${OCR_MAX_PAGINAS} para reconhecimento.`);
    this.paginas = paginas;
  }
}

function paraCinza(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = g;
    d[i + 1] = g;
    d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
}

export async function ocrPdf(
  arquivo: File,
  onProgresso?: (p: ProgressoOcr) => void,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: dados }).promise;
  const paginas = pdf.numPages;
  if (paginas > OCR_MAX_PAGINAS) throw new PdfLongoDemais(paginas);

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");

  try {
    const partes: string[] = [];
    for (let n = 1; n <= paginas; n++) {
      onProgresso?.({ pagina: n, paginas });
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: ESCALA });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Não consegui preparar a imagem da página.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
      paraCinza(ctx, canvas.width, canvas.height);

      const { data } = await worker.recognize(canvas);
      partes.push(data.text ?? "");
      canvas.width = 0;
      canvas.height = 0;
    }
    onProgresso?.({ pagina: paginas, paginas });
    return partes.join("\n");
  } finally {
    await worker.terminate();
  }
}
