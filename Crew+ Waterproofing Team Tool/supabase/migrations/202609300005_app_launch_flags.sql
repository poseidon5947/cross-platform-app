-- Crew+ and SOP+ stay shut to everyone but admin until the client opens them.
--
-- The flag lives here rather than in the build so it can be flipped the moment
-- they are ready, with no deploy and no waiting on me. Both default to false,
-- and the apps also treat a missing column or a failed read as shut - opening
-- up is always a deliberate act.
alter table crew_config add column if not exists crew_plus_live boolean not null default false;
alter table crew_config add column if not exists sop_plus_live boolean not null default false;

comment on column crew_config.crew_plus_live is
  'false = Crew+ is admin-only. Set true to open it to managers and crew.';
comment on column crew_config.sop_plus_live is
  'false = SOP+ is admin-only. Set true to open it to managers and crew.';

-- To open an app later:
--   update crew_config set crew_plus_live = true where id = 'crew-config';
--   update crew_config set sop_plus_live  = true where id = 'crew-config';
