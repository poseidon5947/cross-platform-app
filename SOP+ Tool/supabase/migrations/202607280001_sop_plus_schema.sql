create extension if not exists pgcrypto;

do $$ begin
  create type sop_status as enum ('assigned','in_progress','in_review','published','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sop_media_type as enum ('photo','video');
exception when duplicate_object then null;
end $$;

alter type points_event_type add value if not exists 'sop_completed';

alter table if exists profiles add column if not exists crew_plus_id text;

create table if not exists prompt_set (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop_category (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  prompt_set_id uuid references prompt_set(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid not null references sop_category(id) on delete restrict,
  description text not null default '',
  status sop_status not null default 'assigned',
  assigned_to uuid references profiles(id),
  created_by uuid not null references profiles(id),
  requires_photo boolean not null default false,
  requires_video boolean not null default false,
  due_date date,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  review_comments text,
  points_awarded boolean not null default false,
  schema_version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop_step (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references sop(id) on delete cascade,
  sort_order integer not null default 0,
  text text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sop_media (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references sop_step(id) on delete cascade,
  type sop_media_type not null,
  storage_key text not null,
  thumbnail_url text not null default '',
  size bigint not null default 0,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists points_award (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references sop(id) on delete cascade,
  crew_member_id uuid not null references profiles(id),
  points integer not null default 20,
  awarded_at timestamptz not null default now(),
  external_ref text not null,
  status text not null default 'sent',
  unique (sop_id)
);

create index if not exists idx_sop_status on sop(status);
create index if not exists idx_sop_assigned_to on sop(assigned_to);
create index if not exists idx_sop_category on sop(category_id);
create index if not exists idx_sop_step_sop_sort on sop_step(sop_id, sort_order);
create index if not exists idx_sop_media_step on sop_media(step_id);
create unique index if not exists points_events_sop_completed_ref_idx on points_events(ref) where type::text = 'sop_completed';

alter table prompt_set enable row level security;
alter table sop_category enable row level security;
alter table sop enable row level security;
alter table sop_step enable row level security;
alter table sop_media enable row level security;
alter table points_award enable row level security;

create policy "prompt sets are readable" on prompt_set for select using (auth.uid() is not null);
create policy "managers edit prompt sets" on prompt_set for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

create policy "categories are readable" on sop_category for select using (auth.uid() is not null);
create policy "managers edit categories" on sop_category for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

create policy "sops are readable by team" on sop for select using (auth.uid() is not null);
create policy "managers create sops" on sop for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);
create policy "assigned or published sops are editable" on sop for update using (
  status = 'published'
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
) with check (
  status = 'published'
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

create policy "steps are readable by team" on sop_step for select using (auth.uid() is not null);
create policy "steps follow sop edit permission" on sop_step for all using (
  exists (
    select 1 from sop s
    where s.id = sop_step.sop_id
      and (s.status = 'published' or s.assigned_to = auth.uid() or s.created_by = auth.uid()
        or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  )
) with check (
  exists (
    select 1 from sop s
    where s.id = sop_step.sop_id
      and (s.status = 'published' or s.assigned_to = auth.uid() or s.created_by = auth.uid()
        or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  )
);

create policy "media is readable by team" on sop_media for select using (auth.uid() is not null);
create policy "media follows step permission" on sop_media for all using (
  exists (
    select 1 from sop_step st
    join sop s on s.id = st.sop_id
    where st.id = sop_media.step_id
      and (s.status = 'published' or s.assigned_to = auth.uid() or s.created_by = auth.uid()
        or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  )
) with check (
  exists (
    select 1 from sop_step st
    join sop s on s.id = st.sop_id
    where st.id = sop_media.step_id
      and (s.status = 'published' or s.assigned_to = auth.uid() or s.created_by = auth.uid()
        or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  )
);

create policy "points awards readable by managers or self" on points_award for select using (
  crew_member_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

create policy "managers record sop point awards" on points_award for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

create policy "managers update sop point awards" on points_award for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
);

insert into storage.buckets (id, name, public)
values ('sop-media', 'sop-media', false)
on conflict (id) do nothing;

create policy "team can read sop media objects" on storage.objects for select using (
  bucket_id = 'sop-media' and auth.uid() is not null
);

create policy "team can upload sop media objects" on storage.objects for insert with check (
  bucket_id = 'sop-media' and auth.uid() is not null
);
