alter table if exists materials add column if not exists strict_tracking boolean not null default true;

comment on column materials.strict_tracking is 'V5: true when client Column J/On Hand identifies an item for strict high-value inventory logging.';
