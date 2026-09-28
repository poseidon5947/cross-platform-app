-- Three changes the client asked for in V19 and the Daily Log Fixes mark-up.
--
-- 1. A needs-review row that is not a material at all.
--    The Sept 4 historical import turned free-text like
--    "110ft x 15in sprayed, drain mat, term bar" into needs-review
--    transactions. 140 of them are work descriptions, not an item and a
--    quantity, so they can never honestly be resolved to a material - and
--    Resolve was the only action on the screen. They are kept rather than
--    deleted so the crew's original wording survives.
alter table transactions add column if not exists review_dismissed_at timestamptz;
alter table transactions add column if not exists review_dismissed_by uuid references profiles(id);

-- 2. Weather on a daily log. Optional, free text, never required.
alter table daily_logs add column if not exists weather text;

-- 3. Photos and video against a daily log.
create table if not exists daily_log_media (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  storage_key text not null,
  kind text not null default 'photo',
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists daily_log_media_log_idx on daily_log_media (daily_log_id);

alter table daily_log_media enable row level security;

-- Mirrors daily_logs: the team reads, the uploader writes.
drop policy if exists "daily log media readable by team" on daily_log_media;
create policy "daily log media readable by team" on daily_log_media for select using (
  auth.uid() is not null
);

drop policy if exists "daily log media self insert" on daily_log_media;
create policy "daily log media self insert" on daily_log_media for insert with check (
  uploaded_by = auth.uid()
);

drop policy if exists "daily log media manager delete" on daily_log_media;
create policy "daily log media manager delete" on daily_log_media for delete using (
  uploaded_by = auth.uid() or is_manager()
);

-- Same private-bucket pattern as warehouse-receipts and sop-media.
insert into storage.buckets (id, name, public)
values ('daily-log-media', 'daily-log-media', false)
on conflict (id) do nothing;

drop policy if exists "team can read daily log media" on storage.objects;
create policy "team can read daily log media" on storage.objects for select using (
  bucket_id = 'daily-log-media' and auth.uid() is not null
);

drop policy if exists "team can upload daily log media" on storage.objects;
create policy "team can upload daily log media" on storage.objects for insert with check (
  bucket_id = 'daily-log-media' and auth.uid() is not null
);
