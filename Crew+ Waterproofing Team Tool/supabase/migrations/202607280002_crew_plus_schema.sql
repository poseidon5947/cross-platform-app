alter type points_event_type add value if not exists 'crew_habit_ritual';
alter type points_event_type add value if not exists 'crew_review_completed';
alter type points_event_type add value if not exists 'crew_kpi_hit';
alter type points_event_type add value if not exists 'crew_feedback';
alter type points_event_type add value if not exists 'crew_certs_current';
alter type points_event_type add value if not exists 'crew_google_review';
alter type points_event_type add value if not exists 'crew_compliment';
alter type points_event_type add value if not exists 'crew_safety_milestone';
alter type points_event_type add value if not exists 'crew_peer_recognition';
alter type points_event_type add value if not exists 'crew_cert_detail';
alter type points_event_type add value if not exists 'redeem';

alter table if exists profiles add column if not exists org_role text;
alter table if exists profiles add column if not exists branch text;
alter table if exists profiles add column if not exists manager_id uuid references profiles(id);
alter table if exists profiles add column if not exists hire_date date;
alter table if exists profiles add column if not exists employee_id text;
alter table if exists profiles add column if not exists first_name text;
alter table if exists profiles add column if not exists last_name text;
alter table if exists profiles add column if not exists department text;
alter table if exists profiles add column if not exists employment_status text;
alter table if exists profiles add column if not exists reports_to text;
alter table if exists profiles add column if not exists probation_end_date date;
alter table if exists profiles add column if not exists agreement_signed_date date;
alter table if exists profiles add column if not exists birthday text;
alter table if exists profiles add column if not exists phone text;
alter table if exists profiles add column if not exists address text;
alter table if exists profiles add column if not exists emergency_contact_name text;
alter table if exists profiles add column if not exists emergency_contact_email text;
alter table if exists profiles add column if not exists emergency_contact_phone text;
alter table if exists profiles add column if not exists pay_band text;
alter table if exists profiles add column if not exists bonus_role_weight numeric;
alter table if exists profiles add column if not exists gross_annual_wages numeric;
alter table if exists profiles add column if not exists under_notice boolean not null default false;
alter table if exists profiles add column if not exists disciplinary_action_at date;
alter table if exists profiles add column if not exists next_quarterly_review_date date;
alter table if exists profiles add column if not exists review_eligibility text;

create unique index if not exists points_events_type_ref_idx on points_events(type, ref);

create table if not exists crew_value (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wording text not null default '',
  daily_ritual text not null default '',
  weekly_ritual text not null default '',
  monthly_ritual text not null default '',
  exercise text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crew_earning_rule (
  id text primary key,
  action text not null,
  points integer not null,
  source text not null default 'crew',
  weekly_cap integer,
  habit boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table if exists crew_earning_rule add column if not exists weekly_cap integer;

create table if not exists crew_review (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  manager_id uuid references profiles(id),
  type text not null,
  scheduled_for date not null,
  completed_at timestamptz,
  status text not null default 'scheduled',
  ratings jsonb not null default '{}'::jsonb,
  notes text not null default '',
  swot text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crew_review_note (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  manager_id uuid not null references profiles(id),
  note text not null,
  ts timestamptz not null default now()
);

create table if not exists crew_kpi (
  id uuid primary key default gen_random_uuid(),
  org_role text not null,
  name text not null,
  description text not null default '',
  unit text not null default '',
  target text not null default '',
  period text not null default 'quarterly',
  data_source text not null default '',
  active boolean not null default true
);
alter table if exists crew_kpi add column if not exists description text not null default '';
alter table if exists crew_kpi add column if not exists unit text not null default '';
alter table if exists crew_kpi add column if not exists data_source text not null default '';

create table if not exists crew_kpi_result (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references crew_kpi(id) on delete cascade,
  user_id uuid not null references profiles(id),
  period_key text not null,
  status text not null default 'not_started',
  value text,
  points_event_ref uuid references points_events(id),
  unique (kpi_id, user_id, period_key)
);

create table if not exists crew_bonus_config (
  id uuid primary key default gen_random_uuid(),
  profit_share_percent numeric not null default 0,
  role_weights jsonb not null default '{}'::jsonb,
  rating_factors jsonb not null default '{"below":0.7,"meets":1,"exceeds":1.3}'::jsonb,
  floors_caps text not null default '',
  tenure_bump numeric not null default 0,
  payout_timing text not null default 'December',
  quarterly_component boolean not null default false,
  who_confirms_profit text not null default 'CFO',
  who_approves_payouts text not null default 'CEO',
  created_at timestamptz not null default now()
);
alter table if exists crew_bonus_config add column if not exists payout_timing text not null default 'December';
alter table if exists crew_bonus_config add column if not exists quarterly_component boolean not null default false;
alter table if exists crew_bonus_config add column if not exists who_confirms_profit text not null default 'CFO';
alter table if exists crew_bonus_config add column if not exists who_approves_payouts text not null default 'CEO';
alter table if exists crew_bonus_config add column if not exists model text;
alter table if exists crew_bonus_config add column if not exists score_bands jsonb not null default '[]'::jsonb;
alter table if exists crew_bonus_config add column if not exists eligibility_rules text[] not null default '{}';
alter table if exists crew_bonus_config add column if not exists discretionary boolean not null default true;
alter table if exists crew_bonus_config add column if not exists review_average_source text;
alter table if exists crew_bonus_config add column if not exists gross_wages_pending boolean not null default true;

create table if not exists crew_bonus_period (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  annual_profit numeric not null default 0,
  pool_percent numeric not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists crew_certification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  cert_type_id text,
  name text not null,
  issuing_body text,
  issued_at date,
  expires_at date,
  status text not null default 'date_needed',
  scan_file text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists crew_certification add column if not exists cert_type_id text;
alter table if exists crew_certification add column if not exists issuing_body text;
alter table if exists crew_certification add column if not exists scan_file text;
alter table if exists crew_certification add column if not exists course_date date;
alter table if exists crew_certification add column if not exists certificate_number text;
alter table if exists crew_certification add column if not exists certificate_photo_key text;

insert into storage.buckets (id, name, public)
values ('crew-cert-media', 'crew-cert-media', false)
on conflict (id) do nothing;

create table if not exists crew_reward (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  approx_value text,
  limit_stock text,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table if exists crew_reward add column if not exists approx_value text;
alter table if exists crew_reward add column if not exists limit_stock text;

create table if not exists crew_config (
  id text primary key default 'crew-config',
  legal_name text not null,
  display_name text not null,
  app_name text not null default 'Crew+',
  primary_admin_name text not null default '',
  primary_admin_email text not null default '',
  timezone text not null default 'Canada/Vancouver',
  week_starts_on text not null default 'Monday',
  share_logins boolean not null default true,
  share_wallet boolean not null default true,
  official_brand_primary text not null default '#14A2A4',
  official_brand_accent text not null default '#1C1E20',
  intake_brand_primary text not null default '#1C5CAB',
  intake_brand_accent text not null default '#12A37A',
  points_anchor numeric not null default 0.25,
  intake_points_anchor numeric not null default 0.25,
  google_review_url text not null default 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation',
  office_address text,
  data_residency text,
  updated_at timestamptz not null default now()
);

alter table if exists crew_config add column if not exists google_review_url text not null default 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation';
alter table if exists crew_config alter column points_anchor set default 0.25;
alter table if exists crew_config alter column intake_points_anchor set default 0.25;

create table if not exists crew_role_permission (
  org_role text primary key,
  app_role text not null,
  reports_to text not null default '',
  permissions jsonb not null default '{}'::jsonb
);

create table if not exists crew_job_description (
  id text primary key,
  org_role text not null,
  jd_version text not null default '',
  responsibility text not null default '',
  required_certifications text[] not null default '{}',
  linked_kpis text[] not null default '{}',
  reports_to text not null default ''
);

create table if not exists crew_cert_type (
  id text primary key,
  name text not null unique,
  category text not null default '',
  issuing_body text,
  validity_months integer,
  alert_lead_days integer[] not null default '{60,30,7}',
  required_for_roles text[] not null default '{}',
  notes text
);

create table if not exists crew_value_ritual (
  id text primary key,
  value_id uuid references crew_value(id) on delete cascade,
  value_name text not null,
  cadence text not null,
  prompt text not null default '',
  exercise text not null default '',
  points integer not null default 0,
  active boolean not null default true
);

create table if not exists crew_review_type (
  id text primary key,
  type text not null,
  applies_to text not null,
  cadence text not null,
  rating_scale text not null,
  purpose text not null default ''
);

create table if not exists crew_rating_scale (
  label text primary key,
  value integer not null,
  meaning text not null,
  performance_factor numeric not null
);

create table if not exists crew_review_competency (
  id text primary key,
  competency text not null,
  applies_to_roles text[] not null default '{}',
  description text not null default '',
  weight_percent numeric
);

create table if not exists crew_bonus_role_weight (
  org_role text primary key,
  weight numeric,
  notes text
);

create table if not exists crew_form (
  id text primary key,
  name text not null,
  anonymous_allowed boolean not null default false
);

create table if not exists crew_form_question (
  id text primary key,
  form_id text not null references crew_form(id) on delete cascade,
  sort_order integer not null,
  question text not null,
  response_type text not null,
  required boolean not null default false,
  anonymous_allowed boolean not null default false
);
alter table if exists crew_form_question add column if not exists visibility text not null default 'both';
alter table if exists crew_form_question add column if not exists options jsonb not null default '[]'::jsonb;

create table if not exists crew_integration_decision (
  id text primary key,
  name text not null,
  needed text not null,
  details text not null default ''
);

create table if not exists crew_reward_redemption (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  reward_id uuid not null references crew_reward(id),
  points integer not null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  external_ref uuid references points_events(id)
);

create table if not exists crew_recognition (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  message text not null,
  ts timestamptz not null default now(),
  points_event_ref uuid references points_events(id)
);

create table if not exists crew_nudge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type text not null,
  name text,
  trigger_type text,
  cadence text,
  audience text,
  channel text,
  lead_time text,
  active boolean not null default true,
  title text not null,
  due_at timestamptz not null,
  read boolean not null default false
);
alter table if exists crew_nudge add column if not exists name text;
alter table if exists crew_nudge add column if not exists trigger_type text;
alter table if exists crew_nudge add column if not exists cadence text;
alter table if exists crew_nudge add column if not exists audience text;
alter table if exists crew_nudge add column if not exists channel text;
alter table if exists crew_nudge add column if not exists lead_time text;
alter table if exists crew_nudge add column if not exists active boolean not null default true;

alter table crew_value enable row level security;
alter table crew_earning_rule enable row level security;
alter table crew_review enable row level security;
alter table crew_review_note enable row level security;
alter table crew_kpi enable row level security;
alter table crew_kpi_result enable row level security;
alter table crew_bonus_config enable row level security;
alter table crew_bonus_period enable row level security;
alter table crew_certification enable row level security;
alter table crew_reward enable row level security;
alter table crew_reward_redemption enable row level security;
alter table crew_recognition enable row level security;
alter table crew_nudge enable row level security;
alter table crew_config enable row level security;
alter table crew_role_permission enable row level security;
alter table crew_job_description enable row level security;
alter table crew_cert_type enable row level security;
alter table crew_value_ritual enable row level security;
alter table crew_review_type enable row level security;
alter table crew_rating_scale enable row level security;
alter table crew_review_competency enable row level security;
alter table crew_bonus_role_weight enable row level security;
alter table crew_form enable row level security;
alter table crew_form_question enable row level security;
alter table crew_integration_decision enable row level security;

create policy "crew config readable" on crew_value for select using (auth.uid() is not null);
create policy "earning rules readable" on crew_earning_rule for select using (auth.uid() is not null);
create policy "rewards readable" on crew_reward for select using (auth.uid() is not null);
create policy "kpis readable" on crew_kpi for select using (auth.uid() is not null);
create policy "reviews self or manager readable" on crew_review for select using (user_id = auth.uid() or manager_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "review notes self or manager readable" on crew_review_note for select using (user_id = auth.uid() or manager_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "kpi results self or manager readable" on crew_kpi_result for select using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "certs self or manager readable" on crew_certification for select using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "redemptions self or admin readable" on crew_reward_redemption for select using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "recognition readable" on crew_recognition for select using (auth.uid() is not null);
create policy "nudges self readable" on crew_nudge for select using (user_id = auth.uid());
create policy "intake config readable" on crew_config for select using (auth.uid() is not null);
create policy "role permissions readable" on crew_role_permission for select using (auth.uid() is not null);
create policy "job descriptions readable" on crew_job_description for select using (auth.uid() is not null);
create policy "cert types readable" on crew_cert_type for select using (auth.uid() is not null);
create policy "value rituals readable" on crew_value_ritual for select using (auth.uid() is not null);
create policy "review types readable" on crew_review_type for select using (auth.uid() is not null);
create policy "rating scale readable" on crew_rating_scale for select using (auth.uid() is not null);
create policy "review competencies readable" on crew_review_competency for select using (auth.uid() is not null);
create policy "bonus role weights admin cfo only" on crew_bonus_role_weight for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.org_role,'') in ('CFO','Operations / Admin','Operations','CEO / Owner','CEO')));
create policy "forms readable" on crew_form for select using (auth.uid() is not null);
create policy "form questions readable" on crew_form_question for select using (auth.uid() is not null);
create policy "integration decisions readable" on crew_integration_decision for select using (auth.uid() is not null);

create policy "bonus config admin cfo only" on crew_bonus_config for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.org_role,'') in ('CFO','Operations')));
create policy "bonus period admin cfo only" on crew_bonus_period for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.org_role,'') in ('CFO','Operations')));
