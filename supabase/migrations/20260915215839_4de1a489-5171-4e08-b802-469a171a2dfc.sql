-- lovable-cron-fallback-reviewed: 1440 runs/day; a rota processa uma solicitação por vez com polling de consulta de mercado que pode levar até ~50s, e precisa retomar trabalhos que não couberam no orçamento de tempo. O job só consulta uma linha por execução e, quando não há pendências, retorna imediatamente.
select cron.schedule(
  'garantia-judicial-consultar-mercado',
  '* * * * *',
  replace(
    (select command from cron.job where jobname = 'garantia-judicial-consultar-mercado'),
    'body := ''{}''::jsonb',
    'body := ''{}''::jsonb,
    timeout_milliseconds := 60000'
  )
);