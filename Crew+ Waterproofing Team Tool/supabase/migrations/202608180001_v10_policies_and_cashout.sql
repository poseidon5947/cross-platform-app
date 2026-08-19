-- V10: Crew Policies & Code of Conduct (per-section initials) + quarterly
-- points cash-out to payroll.

alter table if exists crew_policy_document add column if not exists sections jsonb;
alter table if exists crew_policy_acknowledgment add column if not exists section_initials jsonb;

insert into crew_policy_document (id, title, version, effective_date, file_url, annual_due_month_day, active, sections)
values (
  'policy-crew-code-of-conduct',
  'Crew Policies & Code of Conduct',
  '2026',
  '2026-08-18',
  'https://docs.google.com/document/d/1h_XmTTdiMI0v0bMSOr7Q7s1HNOFElITKEG898dARUB0/edit?usp=sharing',
  '08-31',
  true,
  '["Crew Policies","Our Values","Payday","Breaks","Travel Time","BuilderTrend","Work Orders & Daily Logs","Overtime","Time Off","Vacation","Cell Phones & Ear Buds","Social Media","Company Vehicles","Dress Code","Work Gear","Property Damage","Fire Safety","Substances","Google Reviews","Code of Conduct","Professionalism & Work Ethic","Respect for People & Property","Health & Safety Compliance","Substance Use","Tools, Equipment, and Materials","Communication & Conflict","Confidentiality","Disciplinary Action","New Policies and Procedures","Van-Isle Company Contact Info","Acknowledgment"]'::jsonb
)
on conflict (id) do update set
  title = excluded.title,
  version = excluded.version,
  effective_date = excluded.effective_date,
  file_url = excluded.file_url,
  annual_due_month_day = excluded.annual_due_month_day,
  active = excluded.active,
  sections = excluded.sections;

insert into crew_reward (name, points, approx_value, active, note)
select 'Cash out to payroll', 0, null, false, 'Cashes out your full current balance; paid on the next payroll after admin approval.'
where not exists (select 1 from crew_reward where name = 'Cash out to payroll');
