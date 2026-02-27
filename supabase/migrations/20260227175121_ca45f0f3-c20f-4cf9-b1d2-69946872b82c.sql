-- Schedule cleanup_expired_holds() every 5 minutes via pg_cron
SELECT cron.schedule(
  'cleanup-expired-stock-holds',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_holds();$$
);