alter table profiles add column if not exists termination_reason text check (termination_reason in ('voluntary', 'terminated'));
