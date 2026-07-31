insert into prompt_set (id, name, prompts) values
('00000000-0000-0000-0000-000000000101', 'Warehouse / Truck', '["What recent hiccups should this SOP prevent?","Why is each tool or material loaded?","Is there at least a half tank of gas, and where is fuel paid for?","What are the first 10 things to check if the tool fails?"]'::jsonb),
('00000000-0000-0000-0000-000000000102', 'Site Prep / Crew Lead', '["Has the site manager confirmed access, scaffolding, and readiness?","Do plans need to be reviewed before sending the crew?","Has product quantity been double-checked?","What happens if the site is not ready or product runs out?","Does fence signage need to be installed or removed?"]'::jsonb),
('00000000-0000-0000-0000-000000000103', 'Service Execution', '["What is the go/no-go weather policy?","What quality checks happen before, during, and after the work?","What common mistakes does this SOP avoid?","How do you know the crew is ready to spray or install?"]'::jsonb),
('00000000-0000-0000-0000-000000000104', 'Site Wrap-Up', '["What needs to come back to the warehouse?","Are ladders, batteries, tools, and signage accounted for?","Which job site is next?","What must be photographed before leaving?"]'::jsonb)
on conflict (id) do nothing;

insert into sop_category (id, name, sort_order, prompt_set_id) values
('10000000-0000-0000-0000-000000000001', 'Warehouse Operations', 1, '00000000-0000-0000-0000-000000000101'),
('10000000-0000-0000-0000-000000000002', 'Daily Start-Up', 2, '00000000-0000-0000-0000-000000000101'),
('10000000-0000-0000-0000-000000000003', 'End-of-Day Closeout', 3, '00000000-0000-0000-0000-000000000104'),
('10000000-0000-0000-0000-000000000004', 'Truck Loadout (start of day) by Service', 4, '00000000-0000-0000-0000-000000000101'),
('10000000-0000-0000-0000-000000000005', 'Truck Closeout (end of day)', 5, '00000000-0000-0000-0000-000000000104'),
('10000000-0000-0000-0000-000000000006', 'Service Execution', 6, '00000000-0000-0000-0000-000000000103'),
('10000000-0000-0000-0000-000000000007', 'Site Prep', 7, '00000000-0000-0000-0000-000000000102'),
('10000000-0000-0000-0000-000000000008', 'Daily Job Site Closeout', 8, '00000000-0000-0000-0000-000000000104'),
('10000000-0000-0000-0000-000000000009', 'Crew Lead', 9, '00000000-0000-0000-0000-000000000102'),
('10000000-0000-0000-0000-000000000010', 'Travel & Mobilization', 10, '00000000-0000-0000-0000-000000000102'),
('10000000-0000-0000-0000-000000000011', 'Quality Assurance', 11, '00000000-0000-0000-0000-000000000103'),
('10000000-0000-0000-0000-000000000012', 'Demobilization (100%)', 12, '00000000-0000-0000-0000-000000000104'),
('10000000-0000-0000-0000-000000000013', 'Warranty', 13, '00000000-0000-0000-0000-000000000103'),
('10000000-0000-0000-0000-000000000014', 'Other', 14, '00000000-0000-0000-0000-000000000101')
on conflict (id) do nothing;
