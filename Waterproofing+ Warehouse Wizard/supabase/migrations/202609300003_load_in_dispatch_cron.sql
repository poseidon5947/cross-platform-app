-- The load-in clock.
--
-- Hourly, not pinned to a UTC time. The function works out the Vancouver hour
-- itself and acts at 17:00, 06:00 and 16:00 local. A fixed UTC schedule is
-- correct today and an hour out from 1 November, when Vancouver leaves
-- daylight time - which is the drift already sitting in crew-run-nudges-daily
-- (0 15 * * * is 08:00 Pacific in October and 07:00 in November).
--
-- Reuses the run_nudges_service_key vault secret, so no key is written here.
select cron.unschedule('project-load-in-dispatch')
where exists (select 1 from cron.job where jobname = 'project-load-in-dispatch');

select cron.schedule(
  'project-load-in-dispatch',
  '4 * * * *',
  $$
  select net.http_post(
    url := 'https://ddcqyxwuvimxsgktlqya.supabase.co/functions/v1/load-in-dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'run_nudges_service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
