drop table if exists crew_incident_report;

create table crew_incident_report (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  employee_role text not null,
  employee_phone text,
  location text not null,
  date_of_incident date not null,
  time_of_incident time not null,
  incident_cause text not null,
  incident_details text not null,
  action_taken text not null,
  police_notified boolean not null default false,
  follow_up_required text,
  photo_file_names jsonb not null default '[]'::jsonb,
  reported_by_user_id uuid not null references profiles(id) on delete cascade,
  reported_by_name text not null,
  reported_by_role text not null,
  reported_by_phone text,
  confirmed_by_user_id uuid references profiles(id) on delete set null,
  confirmed_by_name text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table crew_incident_report enable row level security;

create policy "incident reports self insert" on crew_incident_report for insert with check (
  reported_by_user_id = auth.uid()
);

create policy "incident reports self or manager readable" on crew_incident_report for select using (
  reported_by_user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "incident reports crew lead or owner confirm" on crew_incident_report for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
);
