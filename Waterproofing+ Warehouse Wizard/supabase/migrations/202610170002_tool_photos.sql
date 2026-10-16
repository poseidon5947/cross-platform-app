-- Two photos per tool: the tool itself, and a wider shot of where it lives in
-- the warehouse. The second one is the point - "where is the Lavina grinder"
-- is the question the crew actually ask, and a close-up of the tool does not
-- answer it.
alter table public.tools
  add column if not exists photo_key text,
  add column if not exists location_photo_key text;

comment on column public.tools.photo_key is
  'Storage key in the warehouse-receipts bucket, under tools/. That bucket is private and already carries team-read and team-upload policies, so tool photos reuse it rather than adding a second set of storage rules.';
comment on column public.tools.location_photo_key is
  'Storage key for the wider warehouse-location shot. Same bucket and prefix as photo_key.';
