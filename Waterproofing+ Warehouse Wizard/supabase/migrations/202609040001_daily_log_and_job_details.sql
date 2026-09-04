alter table sites add column if not exists drive_folder_url text;

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  service_id text not null,
  date date not null,
  materials_installed text,
  work_completed text not null,
  challenges text,
  to_do_next_time text not null,
  completed_by_user_id uuid not null references profiles(id) on delete cascade,
  submitted_by_user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table daily_logs enable row level security;

create policy "daily logs readable by team" on daily_logs for select using (auth.uid() is not null);

create policy "daily logs self insert" on daily_logs for insert with check (submitted_by_user_id = auth.uid());

create table if not exists crew_point_pool (
  id text primary key default 'default',
  points integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table crew_point_pool enable row level security;

create policy "crew point pool readable by team" on crew_point_pool for select using (auth.uid() is not null);

create policy "crew point pool admin write" on crew_point_pool for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
