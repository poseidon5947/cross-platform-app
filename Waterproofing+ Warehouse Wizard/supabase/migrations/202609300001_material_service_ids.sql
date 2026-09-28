-- Which services a material is used on, so the daily log can show a crew
-- member the twenty items their service actually uses instead of all of them.
--
-- An array rather than a single value: drainage board, caulking, consumables
-- and PPE are used across several services, and forcing one would hide them.
-- Null means "not assigned yet", which the app treats as "show it for every
-- service" - so nothing disappears before the mapping is filled in.
alter table materials add column if not exists service_ids text[];

comment on column materials.service_ids is
  'Service ids (wp, ins, inj, trf, cfi, xps, veh, always) this material is used on. Null or empty = show for all services.';
