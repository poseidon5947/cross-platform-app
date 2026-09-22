-- Replaces the upload policy from 202609220002 with one that does not depend
-- on storage.foldername()'s array indexing. Same intent - you may only write
-- into your own folder - but the rule now names the exact key layout the app
-- writes (<scope>/<user id>/<uuid>-<filename>), so it can be checked by
-- reading it rather than by testing the function's behaviour.
drop policy if exists "own folder upload of crew private docs" on storage.objects;
create policy "own folder upload of crew private docs" on storage.objects for insert with check (
  bucket_id = 'crew-private-docs'
  and auth.uid() is not null
  and (
    name like ('onboarding/' || auth.uid()::text || '/%')
    or name like ('incidents/' || auth.uid()::text || '/%')
  )
);
