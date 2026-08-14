# Atualizar Análise de Limite com a última versão do GitHub

Comparei o repositório `kyuri887/TC-Lavoro` (commit mais recente: "fix: badges JNS/Junto e grid de limites fixo em 3 colunas", 14/08/2026) com os arquivos publicados em `public/analise-limite/`. As diferenças são pequenas e ficam todas dentro dessa área.

## O que mudou no repositório

1. **Nova seguradora "Now Seguros"** — entra na lista de consulta automática (passa de 8 para 9 seguradoras), com logo próprio e usando o mesmo normalizador de resposta das seguradoras Onpoint.
2. **Correção de badges de status**
   - Junto: "Corretor não possui permissão para visualizar o Tomador" passa a ser classificado como *nomeado com outro corretor*, em vez de erro.
   - JNS: "Risco negado por questões técnicas" passa a mostrar o badge neutro *Sem limite*, em vez de âmbar "Instável"/vermelho "Erro".
3. **Grid de limites fixo em 3 colunas** no desktop (3x3 para as 9 seguradoras), caindo para 2 colunas até 900px e 1 coluna até 560px.

## O que vou fazer

- Atualizar `public/analise-limite/app.js`, `styles.css` e `index.html` com o conteúdo do repositório.
- Adicionar o novo arquivo `public/analise-limite/assets/now-logo.png`.
- `deepseek.js` está idêntico — nada a fazer.

## Fora do escopo (não vou tocar)

- Rota `/garantia/analise-limite`, sidebar, permissões e qualquer outra tela do Hub.
- Arquivos do repositório que não fazem parte do app embarcado (`SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `workers/` — worker Cloudflare e migrations, que não rodam dentro do Hub).
