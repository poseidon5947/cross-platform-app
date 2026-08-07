create table if not exists crew_incident_report (
  id uuid primary key default gen_random_uuid(),
  reported_by_user_id uuid not null references profiles(id) on delete cascade,
  date_of_report date not null,
  date_of_incident date not null,
  time_of_incident time not null,
  location text not null check (location in ('on_site', 'in_shop', 'on_the_road', 'other')),
  location_other text,
  job_title text not null,
  supervisor_foreman text not null,
  property_type text not null check (property_type in ('company_vehicle', 'personal_vehicle', 'company_tool', 'customer_property', 'other')),
  property_type_other text,
  asset_description text not null,
  asset_id_or_plate text,
  property_owner text not null,
  incident_description text not null,
  damage_type text not null,
  estimated_cost numeric check (estimated_cost is null or estimated_cost >= 0),
  anyone_injured boolean not null default false,
  other_party_involved boolean not null default false,
  other_party_details text,
  photos_taken boolean not null default false,
  photo_file_names jsonb not null default '[]'::jsonb,
  witness_statements_attached boolean not null default false,
  police_report_filed boolean not null default false,
  file_report_number text,
  immediate_action_taken text not null,
  corrective_actions text not null,
  corrective_action_owner text,
  corrective_action_due_date date,
  witnesses jsonb not null default '[]'::jsonb,
  supervisor_name text,
  supervisor_signed_name text,
  supervisor_signed_at timestamptz,
  supervisor_comments text,
  reviewed_by_user_id uuid references profiles(id) on delete set null,
  reviewed_by_position text,
  further_action_required boolean,
  further_action_details text,
  created_at timestamptz not null default now()
);

alter table crew_incident_report enable row level security;

create policy "incident reports self insert" on crew_incident_report for insert with check (
  reported_by_user_id = auth.uid()
);

create policy "incident reports self or manager readable" on crew_incident_report for select using (
  reported_by_user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "incident reports manager update" on crew_incident_report for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
