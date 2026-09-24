// Mostra um PDF com pdf.js em <canvas>, sem iframe e sem o leitor do navegador.
import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<any>;
  destroy: () => Promise<void>;
};

function Pagina({ doc, numero, escala, largura, onVisivel, elementoRef }: {
  doc: PdfDoc; numero: number; escala: number; largura: number; onVisivel: (n: number) => void;
  elementoRef?: (elemento: HTMLDivElement | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(numero <= 2);
  const [proporcao, setProporcao] = useState(1.414);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const obs = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.isIntersecting) { setVisivel(true); onVisivel(numero); }
      }
    }, { rootMargin: "400px 0px", threshold: 0.01 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [numero, onVisivel]);

  useEffect(() => {
    if (!visivel || !largura) return;
    let cancelado = false;
    let tarefa: any = null;
    (async () => {
      const page = await doc.getPage(numero);
      if (cancelado) return;
      const base = page.getViewport({ scale: 1 });
      setProporcao(base.height / base.width);
      const cssLargura = largura * escala;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: (cssLargura / base.width) * dpr });
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${cssLargura}px`;
      c.style.height = `${cssLargura * (base.height / base.width)}px`;
      tarefa = page.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c });
      try { await tarefa.promise; } catch { /* cancelado */ }
    })();
    return () => { cancelado = true; tarefa?.cancel?.(); };
  }, [doc, numero, escala, largura, visivel]);

  const cssLargura = largura * escala;
  return (
    <div ref={(elemento) => { wrap.current = elemento; elementoRef?.(elemento); }} className="mx-auto mb-3 bg-white shadow" style={{ width: cssLargura, minHeight: cssLargura * proporcao }}>
      <canvas ref={canvas} className="block" />
    </div>
  );
}

export function VisualizadorPdf({ blob, paginaAlvo }: { blob: Blob; paginaAlvo?: number }) {
  const area = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [erro, setErro] = useState(false);
  const [escala, setEscala] = useState(1);
  const [largura, setLargura] = useState(0);
  const [atual, setAtual] = useState(1);
  const visiveis = useRef(new Set<number>());
  const paginas = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    let cancelado = false;
    let aberto: PdfDoc | null = null;
    setDoc(null); setErro(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const data = new Uint8Array(await blob.arrayBuffer());
        aberto = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDoc;
        if (cancelado) { void aberto.destroy(); return; }
        setDoc(aberto);
      } catch {
        if (!cancelado) setErro(true);
      }
    })();
    return () => { cancelado = true; void aberto?.destroy(); };
  }, [blob]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(200, el.clientWidth - 24));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!doc || paginaAlvo === undefined || paginaAlvo < 1 || paginaAlvo > doc.numPages) return;
    paginas.current.get(paginaAlvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [doc, paginaAlvo]);

  const aoVer = (n: number) => {
    visiveis.current.add(n);
    setAtual(n);
  };

  if (erro) {
    return (
      <div className="flex h-[75vh] items-center justify-center text-sm text-destructive">
        Não foi possível mostrar o contrato aqui. Use o botão Baixar.
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="flex h-[75vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Abrindo o contrato...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Página {atual} de {doc.numPages}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={escala <= 0.5}
            onClick={() => setEscala((e) => Math.max(0.5, Math.round((e - 0.25) * 100) / 100))}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center tabular-nums">{Math.round(escala * 100)}%</span>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={escala >= 2}
            onClick={() => setEscala((e) => Math.min(2, Math.round((e + 0.25) * 100) / 100))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEscala(1)}>
            <MoveHorizontal className="mr-1 h-4 w-4" /> Ajustar à largura
          </Button>
        </div>
      </div>
      <div ref={area} className="h-[75vh] overflow-auto rounded border bg-muted p-3">
        {largura > 0 && Array.from({ length: doc.numPages }, (_, i) => (
          <Pagina key={i + 1} doc={doc} numero={i + 1} escala={escala} largura={largura} onVisivel={aoVer}
            elementoRef={(elemento) => elemento ? paginas.current.set(i + 1, elemento) : paginas.current.delete(i + 1)} />
        ))}
      </div>
    </div>
  );
}
