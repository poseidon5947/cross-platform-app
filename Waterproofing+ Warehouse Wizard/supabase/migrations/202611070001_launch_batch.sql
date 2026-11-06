-- Everything the 17 November launch needs from the database, in one pass.
-- Run this once; the application work that follows needs no further SQL.

-- 1. INACTIVE instead of delete -------------------------------------------
-- Tara's suggestion, and the cheaper half of the delete work: a product that
-- has been used stays in every past report but disappears from every picker.
alter table public.materials add column if not exists active boolean not null default true;
alter table public.tools     add column if not exists active boolean not null default true;
alter table public.trucks    add column if not exists active boolean not null default true;
alter table public.sites     add column if not exists active boolean not null default true;

-- 2. Delete, but only for records nothing points at ------------------------
-- A hard delete is allowed only where there is no history. Postgres enforces
-- it rather than the UI, so a mistake cannot quietly rewrite a signed-off month.
drop policy if exists "manager deletes unused materials" on public.materials;
create policy "manager deletes unused materials" on public.materials for delete to authenticated
  using (is_manager() and not exists (select 1 from transactions t where t.material_id = materials.id));
drop policy if exists "manager deletes unused tools" on public.tools;
create policy "manager deletes unused tools" on public.tools for delete to authenticated using (is_manager());
drop policy if exists "manager deletes unused trucks" on public.trucks;
create policy "manager deletes unused trucks" on public.trucks for delete to authenticated
  using (is_manager() and not exists (select 1 from truck_logs l where l.truck_id = trucks.id));
drop policy if exists "manager deletes unused sites" on public.sites;
create policy "manager deletes unused sites" on public.sites for delete to authenticated
  using (is_manager()
     and not exists (select 1 from transactions t where t.site_id = sites.id)
     and not exists (select 1 from daily_logs d where d.site_id = sites.id));
drop policy if exists "manager deletes daily logs" on public.daily_logs;
create policy "manager deletes daily logs" on public.daily_logs for delete to authenticated using (is_manager());
drop policy if exists "manager deletes transactions" on public.transactions;
create policy "manager deletes transactions" on public.transactions for delete to authenticated using (is_manager());
drop policy if exists "manager deletes maintenance" on public.maintenance_request;
create policy "manager deletes maintenance" on public.maintenance_request for delete to authenticated using (is_manager());

-- 3. Daily logs become editable -------------------------------------------
drop policy if exists "manager updates daily logs" on public.daily_logs;
create policy "manager updates daily logs" on public.daily_logs for update to authenticated
  using (is_manager()) with check (is_manager());

-- 4. Inventory held on a truck --------------------------------------------
-- Each vehicle carries its own list. Quantity is what should be on board, so
-- the crew can check the truck against it before leaving the yard.
create table if not exists public.truck_inventory (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  qty numeric not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (truck_id, material_id)
);
alter table public.truck_inventory enable row level security;
drop policy if exists "team reads truck inventory" on public.truck_inventory;
create policy "team reads truck inventory" on public.truck_inventory for select to authenticated using (auth.uid() is not null);
drop policy if exists "manager writes truck inventory" on public.truck_inventory;
create policy "manager writes truck inventory" on public.truck_inventory for all to authenticated
  using (is_manager()) with check (is_manager());

-- 5. Tasks assigned to a person -------------------------------------------
alter table public.truck_tasks add column if not exists assigned_to uuid references public.profiles(id);

-- 6. Vehicle servicing -----------------------------------------------------
alter table public.trucks add column if not exists oil_change_due_km numeric;
alter table public.trucks add column if not exists next_service_date date;
alter table public.trucks add column if not exists fleet_number text;

-- 7. Mechanic paperwork against a vehicle ----------------------------------
create table if not exists public.truck_file (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  storage_key text not null,
  label text,
  kind text not null default 'document',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.truck_file enable row level security;
drop policy if exists "team reads truck files" on public.truck_file;
create policy "team reads truck files" on public.truck_file for select to authenticated using (auth.uid() is not null);
drop policy if exists "manager writes truck files" on public.truck_file;
create policy "manager writes truck files" on public.truck_file for all to authenticated
  using (is_manager()) with check (is_manager());

-- 8. The extra power box the crew asked about ------------------------------
alter table public.tools add column if not exists extra_power_box boolean not null default false;
