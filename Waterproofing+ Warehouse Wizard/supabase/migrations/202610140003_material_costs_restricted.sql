-- Prices are hidden from the crew on Inventory and Tremco, but only on screen:
-- "materials" carries an authenticated-read policy with USING (true), so any
-- crew account could read every unit cost straight from the API. Costs move to
-- their own table with the same role test used for vehicle paperwork.
create table if not exists public.material_costs (
  material_id uuid primary key references public.materials(id) on delete cascade,
  cost numeric(12,2) not null default 0,
  previous_cost numeric(12,2),
  price_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  -- loadRemoteState orders every table by created_at unless told otherwise,
  -- so a table without this column 400s and takes the whole app load down.
  created_at timestamptz not null default now()
);

alter table public.material_costs enable row level security;

drop policy if exists "material costs readable by office" on public.material_costs;
create policy "material costs readable by office" on public.material_costs
  for select using (can_see_everything());

drop policy if exists "material costs written by managers" on public.material_costs;
create policy "material costs written by managers" on public.material_costs
  for all using (is_manager()) with check (is_manager());

insert into public.material_costs (material_id, cost, previous_cost, price_changed_at)
select id, coalesce(cost,0), previous_cost, price_changed_at from public.materials
on conflict (material_id) do update set
  cost=excluded.cost, previous_cost=excluded.previous_cost,
  price_changed_at=excluded.price_changed_at, updated_at=now();

alter table public.materials drop column if exists cost;
alter table public.materials drop column if exists previous_cost;
alter table public.materials drop column if exists price_changed_at;
