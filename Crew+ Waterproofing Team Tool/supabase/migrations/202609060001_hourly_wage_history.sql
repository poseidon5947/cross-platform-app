alter table crew_compensation add column if not exists starting_hourly_wage numeric;
alter table crew_compensation add column if not exists last_increase_date date;
alter table crew_compensation add column if not exists last_increase_hourly_wage numeric;
