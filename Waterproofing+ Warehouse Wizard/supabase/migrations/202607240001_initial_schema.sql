create extension if not exists "pgcrypto";

create type app_role as enum ('admin','manager','crew');
create type material_category as enum ('waterproofing','drainage','caulking','insulation','crack_injection','traffic_coatings','termination_fasteners','consumables','ppe','shop');
create type tx_type as enum ('use','deliver','loss','receive','return','adjust');
create type tool_status as enum ('in','out');
create type tool_condition as enum ('good','repair','damaged');
create type task_frequency as enum ('daily','weekly','monthly');
create type points_event_type as enum ('daily_100','daily_100_reversal','streak_bonus','manual_adjust');
alter type points_event_type add value if not exists 'sop_completed';
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
create type source_type as enum ('manual','quickbooks');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role app_role not null default 'crew',
  color text not null default '#0b6ea8',
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category material_category not null,
  unit text not null,
  step numeric not null check (step in (0.25, 0.5, 1)),
  pack text not null default '',
  units_per_pallet integer not null default 0,
  cost numeric(12,2) not null default 0,
  previous_cost numeric(12,2),
  price_changed_at timestamptz,
  qty numeric(12,2) not null default 0,
  reorder_point numeric(12,2) not null default 0,
  bin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table materials add column if not exists previous_cost numeric(12,2);
alter table materials add column if not exists price_changed_at timestamptz;
create index materials_category_idx on materials(category);
create index materials_reorder_idx on materials(qty, reorder_point);

create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  qbo_customer_name text,
  qbo_project_id text unique,
  qbo_project_name text,
  source source_type not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id),
  qty numeric(12,2) not null check (type = 'adjust' or qty >= 0),
  type tx_type not null,
  site_id uuid references sites(id),
  service_id text references services(id),
  user_id uuid not null references profiles(id),
  note text,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_material_ts_idx on transactions(material_id, ts desc);
create index transactions_site_ts_idx on transactions(site_id, ts desc);
create index transactions_user_ts_idx on transactions(user_id, ts desc);

create table tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_id text references services(id),
  battery boolean not null default false,
  status tool_status not null default 'in',
  condition tool_condition not null default 'good',
  last_charged timestamptz,
  note text,
  out_by uuid references profiles(id),
  out_job uuid references sites(id),
  out_service text references services(id),
  out_ts timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  km integer not null default 0,
  last_serviced date,
  last_oil integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table truck_logs (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references trucks(id),
  ts timestamptz not null default now(),
  km integer not null,
  driver_id uuid not null references profiles(id),
  site_id uuid references sites(id),
  service_id text references services(id),
  oil_checked boolean not null default false,
  fuel_topped boolean not null default false,
  gas_station text,
  total_cost numeric(12,2),
  receipt_photo_name text,
  exterior_wash boolean not null default false,
  repairs text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table truck_tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  service_id text references services(id),
  freq task_frequency not null,
  time_of_day text,
  required_for_daily_points boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  task_id uuid not null references truck_tasks(id),
  period_key text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, task_id, period_key)
);

create table points_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type points_event_type not null,
  points integer not null,
  reason text not null,
  ref text not null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index points_events_user_ts_idx on points_events(user_id, ts desc);
create index points_events_ts_idx on points_events(ts desc);

create table streaks (
  user_id uuid primary key references profiles(id),
  count integer not null default 0,
  last date,
  awarded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  realm_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function app_current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_current_role() in ('admin','manager')
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_current_role() = 'admin'
$$;

create or replace function apply_stock_transaction()
returns trigger
language plpgsql
as $$
declare
  signed numeric;
begin
  signed := case
    when new.type in ('use','deliver','loss') then -abs(new.qty)
    when new.type in ('receive','return') then abs(new.qty)
    when new.type = 'adjust' then new.qty
    else new.qty
  end;
  update materials set qty = greatest(0, qty + signed), updated_at = now() where id = new.material_id;
  return new;
end;
$$;

create trigger transactions_apply_stock
after insert on transactions
for each row execute function apply_stock_transaction();

create or replace function apply_truck_log()
returns trigger
language plpgsql
as $$
begin
  update trucks
  set
    km = greatest(km, new.km),
    last_oil = case when new.oil_checked then greatest(last_oil, new.km) else last_oil end,
    updated_at = now()
  where id = new.truck_id;
  return new;
end;
$$;

create trigger truck_logs_apply_truck
after insert on truck_logs
for each row execute function apply_truck_log();

alter table profiles enable row level security;
alter table services enable row level security;
alter table materials enable row level security;
alter table sites enable row level security;
alter table transactions enable row level security;
alter table tools enable row level security;
alter table trucks enable row level security;
alter table truck_logs enable row level security;
alter table truck_tasks enable row level security;
alter table task_completions enable row level security;
alter table points_events enable row level security;
alter table streaks enable row level security;
alter table integration_connections enable row level security;

create policy "authenticated read profiles" on profiles for select to authenticated using (true);
create policy "admin manages profiles" on profiles for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read services" on services for select to authenticated using (true);
create policy "manager writes services" on services for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read materials" on materials for select to authenticated using (true);
create policy "manager writes materials" on materials for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read sites" on sites for select to authenticated using (true);
create policy "manager writes sites" on sites for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read transactions" on transactions for select to authenticated using (true);
create policy "crew inserts usage transactions" on transactions for insert to authenticated with check (
  auth.uid() = user_id and type in ('use','deliver','loss','return')
);
create policy "manager inserts stock transactions" on transactions for insert to authenticated with check (
  auth.uid() = user_id and (type in ('use','deliver','loss','return') or is_manager())
);

create policy "authenticated read tools" on tools for select to authenticated using (true);
create policy "crew updates tool movement" on tools for update to authenticated using (true) with check (true);
create policy "manager manages tools" on tools for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read trucks" on trucks for select to authenticated using (true);
create policy "manager writes trucks" on trucks for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read truck logs" on truck_logs for select to authenticated using (true);
create policy "crew inserts truck logs" on truck_logs for insert to authenticated with check (auth.uid() = driver_id);

create policy "authenticated read truck tasks" on truck_tasks for select to authenticated using (true);
create policy "manager writes truck tasks" on truck_tasks for all to authenticated using (is_manager()) with check (is_manager());

create policy "authenticated read task completions" on task_completions for select to authenticated using (true);
create policy "crew manages own completions" on task_completions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated read points events" on points_events for select to authenticated using (true);
create policy "service/admin writes points events" on points_events for insert to authenticated with check (is_manager());

create policy "authenticated read streaks" on streaks for select to authenticated using (true);
create policy "service/admin writes streaks" on streaks for all to authenticated using (is_manager()) with check (is_manager());

create policy "admin manages integrations" on integration_connections for all to authenticated using (is_admin()) with check (is_admin());
