SELECT cron.unschedule('canal-parceiro-vencimentos')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canal-parceiro-vencimentos');

SELECT cron.schedule(
  'canal-parceiro-vencimentos',
  '20 9 * * *',
  $$ SELECT net.http_post(
       url := 'https://project--ae780930-9fc8-45f0-9908-31d89569a898.lovable.app/api/public/hooks/canal-parceiro-vencimentos',
       headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaW1teWNka2tpeml5aHFra2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzQ0MDAsImV4cCI6MjA5OTExMDQwMH0._htjVkyhWr21gLcztb873HWu9O2BL0HELTLu1jGrPiQ"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);