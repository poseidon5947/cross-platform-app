alter type points_event_type add value if not exists 'crew_swot';

alter table if exists crew_form add column if not exists cadence text;
alter table if exists crew_form add column if not exists due_month_days text[];
alter table if exists crew_form add column if not exists description text;
alter table if exists crew_form_question add column if not exists word_limit integer check (word_limit is null or word_limit > 0);

create table if not exists crew_form_submission (
  id uuid primary key default gen_random_uuid(),
  form_id text not null references crew_form(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  period_key text not null,
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (form_id, user_id, period_key)
);

create table if not exists crew_policy_document (
  id text primary key,
  title text not null,
  version text not null,
  effective_date date not null,
  file_url text not null,
  annual_due_month_day text not null check (annual_due_month_day ~ '^[0-9]{2}-[0-9]{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists crew_policy_acknowledgment (
  id uuid primary key default gen_random_uuid(),
  policy_id text not null references crew_policy_document(id) on delete restrict,
  user_id uuid not null references profiles(id) on delete cascade,
  year integer not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  unique (policy_id, user_id, year)
);

insert into crew_policy_document (id, title, version, effective_date, file_url, annual_due_month_day, active)
values ('policy-bullying-harassment', 'Workplace Bullying and Harassment Policy Statement', '2026', '2026-01-30', '/workplace-bullying-harassment-policy-2026.pdf', '08-31', true)
on conflict (id) do update set
  title = excluded.title,
  version = excluded.version,
  effective_date = excluded.effective_date,
  file_url = excluded.file_url,
  annual_due_month_day = excluded.annual_due_month_day,
  active = excluded.active;

update crew_form
set cadence = 'quarterly',
    due_month_days = array['03-31', '06-30', '09-30', '12-31'],
    description = 'Share the team''s strengths, weaknesses, opportunities, and threats every quarter.'
where id = 'form-swot';

update crew_form_question set word_limit = 500 where form_id = 'form-swot';

alter table crew_form_submission enable row level security;
alter table crew_policy_document enable row level security;
alter table crew_policy_acknowledgment enable row level security;

create policy "form submissions self insert" on crew_form_submission for insert with check (user_id = auth.uid());
create policy "form submissions self or manager readable" on crew_form_submission for select using (
  user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
create policy "active policies authenticated readable" on crew_policy_document for select using (auth.uid() is not null and active);
create policy "policy acknowledgments self insert" on crew_policy_acknowledgment for insert with check (user_id = auth.uid());
create policy "policy acknowledgments self or manager readable" on crew_policy_acknowledgment for select using (
  user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
