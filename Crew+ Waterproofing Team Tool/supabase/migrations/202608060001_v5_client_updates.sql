alter table if exists profiles add column if not exists vacation_days_annual numeric check (vacation_days_annual is null or vacation_days_annual >= 0);

create table if not exists crew_time_off_policy (
  id text primary key,
  year integer not null unique,
  paid_sick_days numeric not null default 5 check (paid_sick_days >= 0),
  unpaid_sick_days numeric not null default 3 check (unpaid_sick_days >= 0),
  eligibility_days integer not null default 90 check (eligibility_days >= 0),
  renewal_month_day text not null default '01-01' check (renewal_month_day ~ '^[0-9]{2}-[0-9]{2}$'),
  created_at timestamptz not null default now()
);

create table if not exists crew_time_off_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('paid_sick', 'unpaid_sick', 'vacation')),
  days numeric not null check (days > 0),
  entry_date date not null,
  note text,
  created_at timestamptz not null default now()
);

insert into crew_time_off_policy (id, year, paid_sick_days, unpaid_sick_days, eligibility_days, renewal_month_day)
values ('time-off-2026', 2026, 5, 3, 90, '01-01')
on conflict (year) do update set
  paid_sick_days = excluded.paid_sick_days,
  unpaid_sick_days = excluded.unpaid_sick_days,
  eligibility_days = excluded.eligibility_days,
  renewal_month_day = excluded.renewal_month_day;

alter table crew_time_off_policy enable row level security;
alter table crew_time_off_entry enable row level security;

create policy "time off policy authenticated readable" on crew_time_off_policy for select using (auth.uid() is not null);
create policy "time off entries self or manager readable" on crew_time_off_entry for select using (
  user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
create policy "time off entries self or manager insert" on crew_time_off_entry for insert with check (
  user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);
