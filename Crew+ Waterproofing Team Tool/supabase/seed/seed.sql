insert into crew_value (name, wording, daily_ritual, weekly_ritual, monthly_ritual, exercise) values
('Safety First, Always', 'Safety First, Always.', '30-second pre-job hazard call-out logged by the Crew Lead.', 'Share one near-miss or catch with the crew, no blame.', '10-minute toolbox talk led by a different tech.', 'Name one hazard, one control, and one person accountable.'),
('Do It Right the First Time', 'Do It Right the First Time.', 'Log one detail you would be happy to inspect yourself.', 'Review any callback/rework and what would have prevented it.', 'Recognize a quality win of the month.', 'Explain why one finished detail will hold up.'),
('Own the Outcome', 'Own the Outcome.', 'Close out your own tool/material logging same day.', 'Move every open 1:1 action forward or close it.', 'Name one thing to own more fully next month.', 'Pick one open loop and write the next action.'),
('Leave It Better', 'Leave It Better.', 'Photo the site as you leave it.', 'Make one improvement to a truck, process, or warehouse area.', 'Vote on the cleanest job site.', 'Fix one small mess and record before/after.'),
('Grow the Crew', 'Grow the Crew.', 'Apprentices log one thing learned; leads log one thing taught.', 'Senior tech coaches one skill.', 'Progress one cert or skill goal.', 'Write one skill taught, learned, or practiced.')
on conflict do nothing;

delete from crew_reward
where name in ('Team lunch', 'Company hoodie / gear', 'Leave 1 hr early Friday', '$50 gas or gift card', 'First pick of next job / schedule', '$100 gift card', 'Extra paid day off', 'Boots / premium tool allowance', 'Quarterly leaderboard champion', 'Cash - $50', 'Cash - $100', 'Gift Card - $50', 'Gift Card - $100', 'PTO - half day', 'PTO - full day');

insert into crew_reward (name, points, approx_value, active, note) values
('Cash - $50', 200, '$50', true, 'Quarter-end cash redemption.'),
('Cash - $100', 400, '$100', true, 'Quarter-end cash redemption.'),
('Gift Card - $50', 200, '$50', true, 'Quarter-end gift card redemption.'),
('Gift Card - $100', 400, '$100', true, 'Quarter-end gift card redemption.'),
('PTO - half day', 800, '~$200', true, 'Quarter-end PTO redemption; manager scheduling required.'),
('PTO - full day', 1600, '~$400', true, 'Quarter-end PTO redemption; manager scheduling required.');


insert into crew_earning_rule (id, action, points, source, habit, active) values
('earn-ww-day', 'Perfect daily truck-task day', 25, 'warehouse', false, true),
('earn-ww-streak', '5-day truck-task streak bonus', 25, 'warehouse', false, true),
('earn-sop', 'SOP created & approved', 20, 'sop', false, true),
('earn-log-week', 'Clean material/tool logging week', 40, 'warehouse', true, true),
('earn-tools', 'All tools returned, none damaged', 30, 'warehouse', true, true),
('earn-daily', 'Daily value ritual', 5, 'crew', true, true),
('earn-weekly', 'Weekly value exercise', 5, 'crew', true, true),
('earn-monthly', 'Monthly value ritual', 5, 'crew', true, true),
('earn-swot', 'Quarterly SWOT on time', 5, 'crew', false, true),
('earn-feedback', 'Company feedback form submitted', 5, 'crew', false, true),
('earn-certs', 'All certs current', 5, 'crew', false, true),
('earn-review', 'Review completed on time', 5, 'crew', false, true),
('earn-kpi', 'KPI target hit', 5, 'crew', false, true),
('earn-google', '5-star Google review naming you', 200, 'crew', false, true),
('earn-compliment', 'Written customer compliment', 5, 'crew', false, true),
('earn-safety', 'Crew safety milestone', 5, 'crew', false, true),
('earn-peer', 'Peer recognition received', 5, 'crew', false, true)
on conflict (id) do update set action = excluded.action, points = excluded.points, source = excluded.source, habit = excluded.habit, active = excluded.active;

update crew_earning_rule set weekly_cap = case id
  when 'earn-log-week' then 40
  when 'earn-tools' then 30
  when 'earn-daily' then 150
  when 'earn-weekly' then 80
  when 'earn-monthly' then 60
  else null
end;

insert into crew_config (id, legal_name, display_name, app_name, primary_admin_name, primary_admin_email, timezone, week_starts_on, share_logins, share_wallet, official_brand_primary, official_brand_accent, intake_brand_primary, intake_brand_accent, points_anchor, intake_points_anchor, google_review_url, office_address, data_residency)
values ('crew-config', 'Van-Isle Coating & Sealants Ltd.', 'Van Isle Waterproofing+', 'Crew+', 'Tara Clark', 'ops@vanislecoatings.com', 'Canada/Vancouver', 'Monday', true, true, '#14A2A4', '#1C1E20', '#1C5CAB', '#12A37A', 0.25, 0.25, 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation', '7 - 933 Ellery Street', 'Canada')
on conflict (id) do update set legal_name = excluded.legal_name, display_name = excluded.display_name, points_anchor = excluded.points_anchor, intake_points_anchor = excluded.intake_points_anchor, google_review_url = excluded.google_review_url, intake_brand_primary = excluded.intake_brand_primary, intake_brand_accent = excluded.intake_brand_accent;

insert into points_events (user_id, type, points, reason, ref, ts)
select p.id, e.type::points_event_type, e.points, e.reason, e.ref, e.ts::timestamptz
from (values
  ('Jesse', 'crew_google_review', 200, 'Seeded 5-star Google review naming Jesse Dares', 'google_seed:u1:2026-07', '2026-07-29T10:00:00-07:00'),
  ('Jon', 'crew_google_review', 200, 'Seeded 5-star Google review naming Jon Gregoire', 'google_seed:u3:2026-07', '2026-07-29T10:05:00-07:00'),
  ('J. Thorpe', 'crew_google_review', 200, 'TODO_CONFIRM seeded 5-star Google review for Jordan; defaulted to Jordan Thorpe', 'google_seed:TODO_CONFIRM_JORDAN_THORPE:u6:2026-07', '2026-07-29T10:10:00-07:00')
) as e(profile_name, type, points, reason, ref, ts)
join profiles p on p.name = e.profile_name
on conflict (type, ref) do nothing;

insert into crew_role_permission (org_role, app_role, reports_to, permissions) values
('Senior Technician','crew','Crew Lead','{"viewOwnData":true,"viewProbation":true,"viewWriteUps":true,"editEmergencyContact":true,"editAddress":true}'::jsonb),
('Technician','crew','Crew Lead','{"viewOwnData":true,"viewProbation":true,"viewWriteUps":true,"editEmergencyContact":true,"editAddress":true}'::jsonb),
('Assistant Technician','crew','Crew Lead','{"viewOwnData":true,"viewProbation":true,"viewWriteUps":true,"editEmergencyContact":true,"editAddress":true}'::jsonb),
('Crew Lead','manager','CEO','{"viewOwnData":true,"viewOthersProfiles":"team","viewProbation":true,"viewWriteUps":true,"manageReviews":true,"editEmergencyContact":true,"editAddress":true}'::jsonb),
('Operations / Admin','admin','CEO','{"viewOwnData":true,"viewOthersProfiles":"all","viewProbation":true,"viewCompensation":true,"viewBonusDollars":true,"viewWriteUps":true,"manageReviews":true,"editConfig":true,"editEmergencyContact":true,"editAddress":true,"exportReports":true}'::jsonb),
('CFO','admin','CEO','{"viewOwnData":true,"viewProbation":true,"viewCompensation":true,"viewBonusDollars":true,"editEmergencyContact":true,"editAddress":true,"exportReports":true}'::jsonb),
('CEO / Owner','admin','-','{"viewOwnData":true,"viewOthersProfiles":"all","viewProbation":true,"viewCompensation":true,"viewBonusDollars":true,"viewWriteUps":true,"manageReviews":true,"editConfig":true,"editEmergencyContact":true,"editAddress":true,"exportReports":true}'::jsonb)
on conflict (org_role) do update set app_role = excluded.app_role, reports_to = excluded.reports_to, permissions = excluded.permissions;

insert into crew_cert_type (id, name, category, validity_months, alert_lead_days, required_for_roles, notes) values
('ct-whmis','WHMIS','Safety',12,'{60,30,7}','{"All field"}','Confirm refresher cadence'),
('ct-hearing','Hearing test','Safety / Health',12,'{60,30}','{"All field"}',null),
('ct-first-aid','Level 1 First Aid','Safety',36,'{60,30,7}','{"All field"}',null),
('ct-fit','Fit Test (respirator)','Safety',12,'{60,30,7}','{"All field"}','Annual'),
('ct-lift','Lift Operation','Equipment',36,'{60,30}','{"All field"}',null),
('ct-confined','Confined Spaces','Safety',36,'{60,30,7}','{"As required"}',null),
('ct-fall','Fall Arrest','Safety',36,'{60,30,7}','{"Working at height"}',null),
('ct-applicator','Manufacturer applicator (Tremco/Xypex)','Trade',null,'{90,30}','{"Applicators"}','Optional')
on conflict (id) do update set validity_months = excluded.validity_months, alert_lead_days = excluded.alert_lead_days, notes = excluded.notes;

insert into crew_kpi (org_role, name, target, period, active) values
('Crew Lead', 'Crew jobs on schedule', '', 'quarterly', true),
('Crew Lead', 'Callback/rework rate', '', 'quarterly', true),
('Crew Lead', 'Safety incidents', '', 'quarterly', true),
('Crew Lead', 'Logging accuracy', '', 'quarterly', true),
('Crew Lead', 'Apprentice development', '', 'quarterly', true),
('Technician', 'Jobs completed to spec', '', 'quarterly', true),
('Technician', 'Rework on own work', '', 'quarterly', true),
('Technician', 'Safety compliance', '', 'quarterly', true),
('Technician', 'Tool/material logging discipline', '', 'quarterly', true),
('Technician', 'Certs kept current', '', 'quarterly', true),
('Senior Technician', 'Quality on complex scopes', '', 'quarterly', true),
('Senior Technician', 'Mentoring contribution', '', 'quarterly', true),
('Operations', 'Job scheduling/throughput', '', 'quarterly', true),
('Operations', 'Review-lead generation', '', 'quarterly', true),
('Operations', 'Google-review volume', '', 'quarterly', true),
('Operations', 'AP/AR or invoicing timeliness', '', 'quarterly', true),
('CFO', 'Gross margin by job', '', 'quarterly', true),
('CFO', 'Cost-report timeliness', '', 'quarterly', true),
('CFO', 'Cash/forecast accuracy', '', 'quarterly', true),
('CFO', 'Profit figure for bonus pool', '', 'quarterly', true),
('CEO', 'Revenue', '', 'annual', true),
('CEO', 'Margin', '', 'annual', true),
('CEO', 'Retention', '', 'annual', true),
('CEO', 'Safety record', '', 'annual', true)
on conflict do nothing;

insert into crew_bonus_config (profit_share_percent, role_weights, rating_factors, floors_caps, tenure_bump)
values (
  0,
  '{"Operations":1,"CFO":1.15,"CEO":0,"Crew Lead":1.2,"Technician":1,"Senior Technician":1.1}'::jsonb,
  '{"below":0.7,"meets":1,"exceeds":1.3}'::jsonb,
  'Editable floors/caps - client to provide current bonus program.',
  0
)
on conflict do nothing;

insert into crew_bonus_period (year, annual_profit, pool_percent, status)
values (2026, 250000, 0.05, 'draft')
on conflict (year) do nothing;

insert into crew_form (id, name, anonymous_allowed) values
('form-swot','Quarterly SWOT',false),
('form-feedback','Company feedback form',true)
on conflict (id) do update set name = excluded.name, anonymous_allowed = excluded.anonymous_allowed;

insert into crew_form_question (id, form_id, sort_order, question, response_type, required, anonymous_allowed) values
('form-swot-1','form-swot',1,'What are your Strengths right now?','Text',true,false),
('form-swot-2','form-swot',2,'What are your Weaknesses / areas to grow?','Text',true,false),
('form-swot-3','form-swot',3,'What Opportunities do you see (for you or the company)?','Text',true,false),
('form-swot-4','form-swot',4,'What Threats or obstacles are in the way?','Text',true,false),
('form-feedback-1','form-feedback',1,'What''s working well right now?','Text',true,true),
('form-feedback-2','form-feedback',2,'What''s frustrating or slowing you down?','Text',true,true),
('form-feedback-3','form-feedback',3,'One idea to make us better?','Text',false,true),
('form-feedback-4','form-feedback',4,'How supported do you feel? (1-5)','Scale 1-5',true,true)
on conflict (id) do update set question = excluded.question, response_type = excluded.response_type, required = excluded.required, anonymous_allowed = excluded.anonymous_allowed;

insert into crew_integration_decision (id, name, needed, details) values
('database-supabase-firebase','Database (Supabase / Firebase)','Yes','Shared hosted DB with offline sync (per spec)'),
('reuse-waterproofing-backend','Reuse Waterproofing+ backend','Yes','Same stack / one account across apps'),
('user-logins-auth','User logins / auth','Yes','Per-person, role-based'),
('offline-sync','Offline sync','Yes','Field sites with no signal'),
('google-business-profile-api-reviews','Google Business Profile API (reviews)','Later','Auto-pull 5-star reviews to points. Manual log day one'),
('buildertrend-integration','BuilderTrend integration','Later','Job/schedule data for KPIs'),
('push-notifications','Push notifications','Yes','Web push for nudges'),
('email-digests','Email digests','Yes','Manager weekly digest'),
('calendar-sync-google-outlook','Calendar sync (Google/Outlook)','Later','Reviews, cert expiries, birthdays')
on conflict (id) do update set needed = excluded.needed, details = excluded.details;

insert into crew_certification (user_id, name, issued_at, expires_at, status, note)
select p.id, c.name, c.issued_at::date, c.expires_at::date, c.status, c.note
from (values
  ('Jesse','WHMIS',null,null,'date_needed','Active; expiry date needed.'),
  ('Jesse','Hearing',null,null,'date_needed','Active; expiry date needed.'),
  ('Jesse','Level 1 First Aid',null,null,'expired','Renew now.'),
  ('Jesse','Fit Test','2025-09-09','2026-09-09','active','Annual; confirm renewal.'),
  ('Jesse','Lift',null,null,'date_needed','Active; expiry date needed.'),
  ('Shane','Lift Operation',null,null,'date_needed','Only cert on file; audit WHMIS / First Aid / Fit Test.'),
  ('Jon','Lift Operation',null,null,'date_needed',null),
  ('Jon','Level 1 First Aid',null,'2028-02-01','current',null),
  ('Jon','Fit Test',null,null,'date_needed',null),
  ('Jon','Confined Spaces',null,null,'date_needed',null),
  ('Josh','Fall Arrest',null,null,'date_needed',null),
  ('Josh','Lift',null,null,'date_needed',null),
  ('Josh','Confined Spaces',null,null,'date_needed',null),
  ('Logan','No certs on file',null,null,'missing','Full audit needed before high-risk work.'),
  ('Thorpe','Lift Operation',null,null,'date_needed',null),
  ('Thorpe','Level 1 First Aid',null,'2028-02-01','current',null),
  ('Thorpe','Fit Test',null,null,'date_needed',null),
  ('Thorpe','Confined Spaces',null,null,'date_needed',null),
  ('Rogers','Level 1 First Aid',null,'2028-02-01','current',null),
  ('Rogers','Fit Test',null,null,'date_needed',null)
) as c(person, name, issued_at, expires_at, status, note)
join profiles p on p.name = c.person
on conflict do nothing;
