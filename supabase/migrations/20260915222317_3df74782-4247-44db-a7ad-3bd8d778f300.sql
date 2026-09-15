select cron.schedule(
  'sync-market-news-hourly',
  '0 * * * *',
  replace(
    (select command from cron.job where jobid = 5),
    'body:=''{}''::jsonb',
    'body:=''{}''::jsonb,
    timeout_milliseconds := 60000'
  )
);