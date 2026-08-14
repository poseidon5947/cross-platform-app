create table if not exists maintenance_request (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('truck', 'tool')),
  target_id uuid not null,
  target_label text not null,
  description text not null,
  requested_by uuid not null references profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved')),
  responded_by uuid references profiles(id) on delete set null,
  responded_at timestamptz,
  response_note text
);

alter table maintenance_request enable row level security;

create policy "maintenance requests readable by team" on maintenance_request for select using (auth.uid() is not null);

create policy "maintenance requests self insert" on maintenance_request for insert with check (requested_by = auth.uid());

-- Resolving is limited to whoever holds the Crew Lead or Owner org role, per
-- the client's ask ("alert should go to the Crew Lead & Owner ... to review
-- and respond"), not the broader manager tier.
create policy "maintenance requests crew lead or owner resolve" on maintenance_request for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
);
