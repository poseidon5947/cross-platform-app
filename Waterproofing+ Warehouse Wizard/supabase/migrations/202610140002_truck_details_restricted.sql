-- Vehicle paperwork lives apart from the truck itself. "trucks" is readable by
-- every signed-in account, because the crew need the fleet list to book a
-- vehicle and log fuel - so a VIN or an insurance policy number stored there is
-- readable by the whole crew through the API even when the screen hides it.
-- The client's answer was "Admin, Manager and Finance can see anything", which
-- means the crew cannot.
create table if not exists public.truck_details (
  truck_id uuid primary key references public.trucks(id) on delete cascade,
  make text,
  model text,
  model_year text,
  vin text,
  registration text,
  license_plate text,
  insurance_policy text,
  updated_at timestamptz not null default now()
);

alter table public.truck_details enable row level security;

create or replace function public.can_see_everything() returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select app_current_role() in ('admin', 'manager', 'cfo') $$;

drop policy if exists "truck details readable by office" on public.truck_details;
create policy "truck details readable by office" on public.truck_details
  for select using (can_see_everything());

drop policy if exists "truck details written by managers" on public.truck_details;
create policy "truck details written by managers" on public.truck_details
  for all using (is_manager()) with check (is_manager());

-- Move what was already written onto trucks, then take it off that table.
insert into public.truck_details (truck_id, make, model, model_year, vin, registration, license_plate, insurance_policy)
select id, make, model, model_year, vin, registration, license_plate, insurance_policy
from public.trucks
on conflict (truck_id) do update set
  make=excluded.make, model=excluded.model, model_year=excluded.model_year,
  vin=excluded.vin, registration=excluded.registration,
  license_plate=excluded.license_plate, insurance_policy=excluded.insurance_policy,
  updated_at=now();

alter table public.trucks drop column if exists make;
alter table public.trucks drop column if exists model;
alter table public.trucks drop column if exists model_year;
alter table public.trucks drop column if exists vin;
alter table public.trucks drop column if exists registration;
alter table public.trucks drop column if exists license_plate;
alter table public.trucks drop column if exists insurance_policy;
