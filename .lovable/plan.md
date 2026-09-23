# Ajustar layout e responsividade das telas de Entrada e Garantia

## Escopo
- Corrigir a largura mínima do conteúdo autenticado e do cabeçalho superior para impedir que conteúdo largo empurre a página.
- Criar o componente compartilhado `PaginaHub` com cabeçalho, trilha, título, subtítulo, ações, abas roláveis e corpo centralizado.
- Aplicar o novo invólucro somente em Entrada de Demandas, Negociação, CRM e Painel da Garantia.
- Ajustar apenas classes e invólucros de espaçamento, quebra e rolagem nas tabelas, filtros, quadros, gráficos, painéis laterais e diálogos dessas telas.

## Implementação
- Preservar todos os textos, consultas, ações, permissões e rotas existentes.
- Fazer o `GarantiaShell` compor `PaginaHub` e fornecer somente a navegação das abas.
- Em Entrada de Demandas, manter no celular Protocolo, Cliente, Ramo e Destino; mover Assunto para uma linha secundária e ocultar Chegada, Canal e a coluna própria de Assunto até telas grandes.
- Conter larguras mínimas apenas nos elementos com rolagem própria, sem esconder estouros no corpo da página.
- Tornar filtros fluidos, colunas de kanban fixas e roláveis, gráficos encolhíveis e diálogos/painéis laterais adequados ao telefone.

## Verificação
- Executar `bunx tsgo --noEmit`.
- Medir `scrollWidth - clientWidth` em 360px, 768px e 1440px nas quatro telas.
- Confirmar visualmente o botão do cabeçalho, os respiros laterais e a rolagem interna de tabelas e quadros.
- Não criar migration e não publicar.
