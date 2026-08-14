create table if not exists crew_push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table crew_push_subscription enable row level security;

create policy "push subscriptions self manage" on crew_push_subscription for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Idempotency log so the scheduled nudge worker never double-sends the same
-- notification within the same period (mirrors the (type, ref) pattern
-- already used for points_events). Written only by the service-role worker.
create table if not exists crew_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, type, ref)
);

alter table crew_notification_log enable row level security;

create policy "notification log self readable" on crew_notification_log for select using (user_id = auth.uid() or is_admin());
