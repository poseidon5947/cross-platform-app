alter table public.trucks add column if not exists make text;
alter table public.trucks add column if not exists model text;
alter table public.trucks add column if not exists model_year text;
alter table public.trucks add column if not exists vin text;
alter table public.trucks add column if not exists registration text;
alter table public.trucks add column if not exists license_plate text;
alter table public.trucks add column if not exists insurance_policy text;
alter table public.trucks add column if not exists show_to_crew boolean not null default true;
