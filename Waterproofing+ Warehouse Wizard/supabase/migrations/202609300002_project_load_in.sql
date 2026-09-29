-- Project load-in.
--
-- The project manager builds tomorrow's load-in list the evening before; a
-- named crew member loads it between 6 and 7am and ticks it off for 50 points,
-- and the same person files that job's daily log by 4pm.
--
-- Items are a snapshot, not a live join: the label is copied from the task so
-- that editing or deleting a task list later does not rewrite what a crew
-- member was actually told to load last Tuesday. task_id is kept for
-- reference, and goes null rather than taking the row with it.
create table if not exists project_load_in (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  service_id text not null references services(id),
  load_in_date date not null,
  notes text,
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz
);
create index if not exists project_load_in_date_idx on project_load_in (load_in_date);
create index if not exists project_load_in_assignee_idx on project_load_in (assigned_to, load_in_date);

create table if not exists project_load_in_item (
  id uuid primary key default gen_random_uuid(),
  load_in_id uuid not null references project_load_in(id) on delete cascade,
  task_id uuid references truck_tasks(id) on delete set null,
  label text not null,
  section text,
  done_at timestamptz,
  done_by uuid references profiles(id)
);
create index if not exists project_load_in_item_parent_idx on project_load_in_item (load_in_id);

create table if not exists project_load_in_media (
  id uuid primary key default gen_random_uuid(),
  load_in_id uuid not null references project_load_in(id) on delete cascade,
  storage_key text not null,
  kind text not null default 'photo',
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists project_load_in_media_parent_idx on project_load_in_media (load_in_id);

alter table project_load_in enable row level security;
alter table project_load_in_item enable row level security;
alter table project_load_in_media enable row level security;

-- The whole team reads: a crew member has to see the list they were given,
-- and the rest of the crew seeing tomorrow's plan is not a problem.
drop policy if exists "load in readable by team" on project_load_in;
create policy "load in readable by team" on project_load_in for select using (auth.uid() is not null);

drop policy if exists "load in manager writes" on project_load_in;
create policy "load in manager writes" on project_load_in for insert with check (is_manager());

-- The manager edits the plan; the assignee may only mark it finished.
drop policy if exists "load in manager or assignee updates" on project_load_in;
create policy "load in manager or assignee updates" on project_load_in for update
  using (is_manager() or assigned_to = auth.uid())
  with check (is_manager() or assigned_to = auth.uid());

drop policy if exists "load in manager deletes" on project_load_in;
create policy "load in manager deletes" on project_load_in for delete using (is_manager());

drop policy if exists "load in items readable by team" on project_load_in_item;
create policy "load in items readable by team" on project_load_in_item for select using (auth.uid() is not null);

drop policy if exists "load in items manager writes" on project_load_in_item;
create policy "load in items manager writes" on project_load_in_item for insert with check (is_manager());

-- Ticking an item off is the assignee's job, so the update policy has to let
-- them through - this is the permission that was missing on transactions and
-- made Resolve silently do nothing for three weeks.
drop policy if exists "load in items tickable" on project_load_in_item;
create policy "load in items tickable" on project_load_in_item for update
  using (is_manager() or exists (
    select 1 from project_load_in parent where parent.id = load_in_id and parent.assigned_to = auth.uid()))
  with check (is_manager() or exists (
    select 1 from project_load_in parent where parent.id = load_in_id and parent.assigned_to = auth.uid()));

drop policy if exists "load in items manager deletes" on project_load_in_item;
create policy "load in items manager deletes" on project_load_in_item for delete using (is_manager());

drop policy if exists "load in media readable by team" on project_load_in_media;
create policy "load in media readable by team" on project_load_in_media for select using (auth.uid() is not null);

drop policy if exists "load in media manager writes" on project_load_in_media;
create policy "load in media manager writes" on project_load_in_media for insert with check (is_manager());

drop policy if exists "load in media manager deletes" on project_load_in_media;
create policy "load in media manager deletes" on project_load_in_media for delete using (is_manager());

-- Private bucket, same pattern as warehouse-receipts and daily-log-media.
insert into storage.buckets (id, name, public)
values ('project-load-in', 'project-load-in', false)
on conflict (id) do nothing;

drop policy if exists "team can read load in files" on storage.objects;
create policy "team can read load in files" on storage.objects for select using (
  bucket_id = 'project-load-in' and auth.uid() is not null
);

drop policy if exists "managers can upload load in files" on storage.objects;
create policy "managers can upload load in files" on storage.objects for insert with check (
  bucket_id = 'project-load-in' and is_manager()
);
