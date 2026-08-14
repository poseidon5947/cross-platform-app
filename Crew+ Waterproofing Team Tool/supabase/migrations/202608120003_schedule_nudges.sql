create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

-- The service-role key used to authenticate the cron-triggered call lives in
-- Supabase Vault (set separately via `select vault.create_secret(...)`), not
-- in this file, so it never ends up in source control.
select vault.create_secret(
  'REPLACE_WITH_SERVICE_ROLE_KEY',
  'run_nudges_service_key',
  'Service role key used by the crew-run-nudges-daily cron job'
) where not exists (select 1 from vault.decrypted_secrets where name = 'run_nudges_service_key');

-- Daily at 15:00 UTC (08:00 America/Vancouver during PDT). Calls the
-- run-nudges Edge Function, which is idempotent per (user, type, ref) via
-- crew_notification_log, so re-running or missing a day is harmless.
select cron.schedule(
  'crew-run-nudges-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://ddcqyxwuvimxsgktlqya.supabase.co/functions/v1/run-nudges',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'run_nudges_service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
