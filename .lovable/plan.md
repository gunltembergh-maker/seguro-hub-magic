# Diagnóstico: "Analisar com IA" em Garantia › Negociação

Somente diagnóstico. Nada foi editado, migrado ou publicado.

## Problema 1: a análise falha em 3 a 5 segundos

### A) Onde o servidor roda e se o pdf.js funciona lá
- `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`. O comentário do arquivo diz que o build usa "nitro (build-only using cloudflare as a default target)". Não existe `wrangler.*` no projeto. Em produção o servidor é um **Cloudflare Worker** (workerd), com o código todo empacotado e sem resolver módulos em tempo de execução.
- `pdfjs-dist` instalado: **6.3.289**.
- No sandbox, com Node, `pdfjs-dist/legacy/build/pdf.mjs` leu um PDF de 2 páginas: `getDocument` + `getTextContent` devolveram "Pagina um do edital de teste" e "Pagina dois garantia contratual". O único aviso foi `standardFontDataUrl`. **Não há workerd no sandbox**, então não consegui rodar no ambiente de produção. A causa abaixo vem da leitura do código da biblioteca, não de uma execução no Worker.
- Causa provável, lida em `node_modules/pdfjs-dist/legacy/build/pdf.mjs`:
  - l.22773-22777: quando `isNodeJS` (l.6277) é verdadeiro, o worker real fica desligado e `GlobalWorkerOptions.workerSrc ||= "./pdf.worker.mjs"`. Com nodejs_compat, o Worker tem `process`, então essa condição tende a ser verdadeira.
  - l.22952-22962: o "fake worker" faz `await import(this.workerSrc)`, um import dinâmico de `./pdf.worker.mjs` em tempo de execução, marcado `@vite-ignore`. Por isso o arquivo não entra no pacote do Worker e o import falha. No Node do sandbox funciona porque o arquivo existe no disco.
  - l.16099-16121: tenta `createRequire` + `@napi-rs/canvas` para DOMMatrix/Path2D. No Worker isso só gera aviso, mas é o mesmo pacote nativo que já quebrou o build antes.
- Evidências em produção (logs do servidor, última hora):
  - Às 17:28:24 e 17:28:38, `[garantia/ia] análise não concluída` aparece com `"erro":{}`. O `console.error` serializa o `Error` como `{}`, então a mensagem real se perde.
  - **Nenhuma** linha `[tc-lavoro/analysis-jobs]` no mesmo período. `encaminhar` (analysis-jobs.server.ts l.87, 104, 111) grava log em todos os caminhos: falta de credencial, erro de rede e qualquer status. Isso indica que o primeiro `postJob` não chegou a ser chamado.
  - O download do storage continua possível. Não dá para descartá-lo só pelos logs, mas é o ponto menos provável porque o mesmo padrão funciona em outros fluxos.

### B) Onde cada biblioteca é usada
- `unpdf` (servidor, funcionando):
  - `src/routes/api/canal-parceiro-validar-contrato.ts:328`: `getDocumentProxy` + `extractText` (validação de contrato do Canal Parceiros).
  - `src/lib/garantia/anp-audit.server.ts:5,28-30`: auditoria de apólice ANP (`auditarApoliceAnp`).
- `pdfjs-dist`:
  - `src/lib/garantia/ia/extrair-texto.ts:87-91`: **único uso no servidor** (legacy no servidor, normal no navegador).
  - `src/components/pdf/VisualizadorPdf.tsx:81-82` (navegador).
  - `src/lib/canal-parceiro/ocr-pdf.ts:45-46` (navegador).
- `unpdf` 1.8.0 traz em `dist/pdfjs.mjs` um pdf.js próprio com o worker embutido (`globalThis.pdfjsWorker={WorkerMessageHandler}`). Assim ele não precisa do import dinâmico. No sandbox também extraiu corretamente o mesmo PDF de teste.

### C) Como a tela Operacional faz a mesma análise
- A extração roda **no navegador**. `public/analise-limite/index.html:11-12` carrega pdf.js 3.11.174 da CDN com `workerSrc` da CDN, e `deepseek.js:234` chama `pdfjsLib.getDocument(...)`. Tesseract entra para PDFs escaneados.
- O navegador envia `POST /api/tc-lavoro/analysis-jobs` (deepseek.js l.3, 39-42), com Bearer do Hub e corpo `{ flow, files: mapArquivosParaJob(...) }` (l.877). Os arquivos vão já como texto em partes, sem o PDF. Depois faz polling em `/{jobId}/run` (l.109).
- O formato é o mesmo que a Negociação monta no servidor (`analisar-documento.functions.ts:152`). A diferença está só em **onde** o texto é extraído.
- Não confirmei se funciona em produção hoje: não houve chamada ao proxy na última hora para comparar, e não tenho sessão para testar.

### Correção mínima proposta (sem aplicar)
Em `extrair-texto.ts`, no ramo do servidor (`typeof window === "undefined"`), trocar `pdfjs-dist/legacy` por `unpdf`: `getDocumentProxy(bytes)` e, página a página, `pdf.getPage(i).getTextContent()`. Isso mantém as partes `[Pagina N]`, as citações e o OCR só no navegador. O ramo do navegador fica como está.
Junto, no `catch` de `analisarDocumento`, registrar `erro instanceof Error ? erro.message : mensagemDeErro(erro)`, para o log deixar de mostrar `{}`.
Primeiro passo ao implementar: confirmar a mensagem real com esse log, antes e depois da troca.

## Problema 2: `n?.destroy is not a function` ao fechar o diálogo

### D) O `destroy()` na versão 6.3.289
- Arquivo `node_modules/pdfjs-dist/types/src/display/api.d.ts`:
  - `PDFDocumentLoadingTask` (l.805) **tem** `destroy(): Promise<void>` (l.860).
  - `PDFDocumentProxy` (l.872-1449) **não tem** `destroy`, só `cleanup()` (l.1201).
  - `PDFWorker.destroy()` existe (l.1653).
- Confirmado em execução no sandbox: `typeof pdf.destroy === "undefined"` e `typeof loadingTask.destroy === "function"`.
- Isso explica o erro: `VisualizadorPdf.tsx:85` guarda o retorno de `.promise` (o documento) em `aberto`, e a limpeza em l.86 e l.92 chama `aberto.destroy()`. O `?.` só protege contra `aberto` nulo, não contra o método que não existe. O `TypeError` sobe para o error boundary.

### E) Outros componentes
`rg "\.destroy\(" src/` só encontra `VisualizadorPdf.tsx:86` e `:92`. `ocr-pdf.ts` e `extrair-texto.ts` não chamam `destroy`.

### Correção mínima proposta (sem aplicar)
Em `VisualizadorPdf.tsx`, guardar a `loadingTask` (`const tarefa = pdfjs.getDocument({ data })`) e usar `tarefa.destroy()` nas linhas 86 e 92. Também ajustar o tipo `PdfDoc` (l.6-10) para não declarar um `destroy` que não existe. Com isso, o documento também é liberado quando o diálogo fecha no meio do carregamento.
