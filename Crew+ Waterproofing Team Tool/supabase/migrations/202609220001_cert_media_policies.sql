-- The crew-cert-media bucket was created in the initial schema but never got
-- policies and was never used by the app, so certificate photos were only ever
-- recorded as a filename. Adds the policies so uploads actually work.
drop policy if exists "team can read crew cert media" on storage.objects;
create policy "team can read crew cert media" on storage.objects for select using (
  bucket_id = 'crew-cert-media' and auth.uid() is not null
);

drop policy if exists "team can upload crew cert media" on storage.objects;
create policy "team can upload crew cert media" on storage.objects for insert with check (
  bucket_id = 'crew-cert-media' and auth.uid() is not null
);
