-- lovable-cron-fallback-reviewed: 1440 runs/day; processa fila de consultas externas com orçamento de tempo por chamada, mesmo padrão do job existente dispatch-scheduled-newsletters
SELECT cron.schedule(
  'garantia-judicial-consultar-mercado',
  '* * * * *',
  replace(
    (SELECT command FROM cron.job WHERE jobid = 6),
    'dispatch-scheduled-newsletters',
    'garantia-judicial-consultar-mercado'
  )
);