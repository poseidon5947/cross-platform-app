alter table transactions alter column material_id drop not null;
alter table transactions add column if not exists needs_review boolean not null default false;
alter table transactions add column if not exists raw_item_text text;
alter table transactions add column if not exists raw_qty_text text;
alter table transactions add column if not exists raw_unit_text text;
