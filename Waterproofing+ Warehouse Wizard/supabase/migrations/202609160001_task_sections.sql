-- Split Trucks/Warehouse/Services tasks into distinct sections, per V18 client feedback.
alter type task_frequency add value if not exists 'quarterly';
alter type task_frequency add value if not exists 'yearly';
alter type task_frequency add value if not exists 'as_needed';

alter table truck_tasks add column if not exists section text not null default 'trucks' check (section in ('trucks', 'warehouse', 'services'));
alter table truck_tasks add column if not exists category text;
alter table truck_tasks add column if not exists person_responsible text;

insert into services (id, name) values
  ('cfi', 'CFI'),
  ('xps', 'XPS'),
  ('always', 'Always on Vehicle')
on conflict (id) do nothing;
