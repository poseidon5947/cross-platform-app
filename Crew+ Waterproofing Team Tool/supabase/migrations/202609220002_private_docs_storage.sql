-- Onboarding documents (direct deposit form, driver's licence photos) and
-- incident report photos were only ever recorded as a filename. These hold
-- personal data - a licence number, banking details - so they get their own
-- bucket rather than the team-wide read the receipt and certificate buckets
-- use: an employee can upload into their own folder, but only admin can read
-- anything back.
insert into storage.buckets (id, name, public)
values ('crew-private-docs', 'crew-private-docs', false)
on conflict (id) do nothing;

-- Read is admin-only. is_admin() is security definer over profiles.role, so it
-- resolves the same way here as it does on the crew_onboarding table itself.
drop policy if exists "admin can read crew private docs" on storage.objects;
create policy "admin can read crew private docs" on storage.objects for select using (
  bucket_id = 'crew-private-docs' and public.is_admin()
);

-- Upload is scoped to the signed-in user's own folder: keys are laid out as
-- <scope>/<user id>/<uuid>-<filename>, so foldername()[2] is the owner. This
-- stops one employee writing into another's folder without needing a read
-- grant to check it.
drop policy if exists "own folder upload of crew private docs" on storage.objects;
create policy "own folder upload of crew private docs" on storage.objects for insert with check (
  bucket_id = 'crew-private-docs'
  and auth.uid() is not null
  and (storage.foldername(name))[2] = auth.uid()::text
);
