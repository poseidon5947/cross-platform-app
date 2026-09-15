-- Jobs tab (V19): sites gain contact/date fields for the new Jobs main menu item.
alter table sites add column if not exists company text;
alter table sites add column if not exists site_contact_name text;
alter table sites add column if not exists site_contact_phone text;
alter table sites add column if not exists site_contact_email text;
alter table sites add column if not exists start_date date;
alter table sites add column if not exists end_date date;
