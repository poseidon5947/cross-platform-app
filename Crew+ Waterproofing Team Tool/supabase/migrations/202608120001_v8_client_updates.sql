-- V8: new hire restricted access, employment type, bonus-notification plumbing,
-- restricted compensation data, and updated point values.

alter table profiles add column if not exists employment_type text check (employment_type in ('full_time', 'part_time', 'temp', 'seasonal'));
alter table profiles add column if not exists new_hire_until date;
alter table profiles add column if not exists access_upgraded_at timestamptz;

-- Compensation data is deliberately NOT on the broadly-readable `profiles` table
-- (every authenticated user can read every profiles row today). Gross wages and
-- pay band already lived there unrestricted; this migrates them out alongside
-- the new retention-bonus / cost-of-living fields, all admin/HR-only per client
-- instruction ("make sure anything YELLOW ... only seen by the admin/HR").
create table if not exists crew_compensation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  gross_annual_wages numeric,
  pay_band text,
  retention_bonus_amount numeric,
  retention_bonus_payout_date date,
  cost_of_living_increase numeric,
  updated_at timestamptz not null default now()
);

insert into crew_compensation (user_id, gross_annual_wages, pay_band, updated_at)
select id, gross_annual_wages, pay_band, now()
from profiles
where gross_annual_wages is not null or pay_band is not null
on conflict (user_id) do nothing;

alter table crew_compensation enable row level security;

create policy "compensation self or admin readable" on crew_compensation for select using (user_id = auth.uid() or is_admin());
create policy "compensation admin write" on crew_compensation for insert with check (is_admin());
create policy "compensation admin update" on crew_compensation for update using (is_admin()) with check (is_admin());

-- Point value updates confirmed by the client (V8): regular small-tier actions
-- move from +5 to +10; SOP creation moves from +20 to +50 (the SOP value itself
-- lives in the award-points Edge Function, redeployed separately — this just
-- keeps the reference-data row in sync for display).
update crew_earning_rule set points = 10 where id in (
  'earn-daily', 'earn-weekly', 'earn-monthly', 'earn-cert-detail', 'earn-swot',
  'earn-feedback', 'earn-certs', 'earn-review', 'earn-kpi', 'earn-compliment',
  'earn-safety', 'earn-peer'
);
update crew_earning_rule set points = 50 where id = 'earn-sop';
