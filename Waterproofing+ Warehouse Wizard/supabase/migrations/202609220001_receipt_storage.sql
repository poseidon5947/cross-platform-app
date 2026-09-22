-- Gas Station Check receipt photos were never actually stored - only the
-- filename was saved. Adds the bucket and policies so the file itself lands
-- in storage, matching the existing sop-media pattern.
insert into storage.buckets (id, name, public)
values ('warehouse-receipts', 'warehouse-receipts', false)
on conflict (id) do nothing;

drop policy if exists "team can read warehouse receipts" on storage.objects;
create policy "team can read warehouse receipts" on storage.objects for select using (
  bucket_id = 'warehouse-receipts' and auth.uid() is not null
);

drop policy if exists "team can upload warehouse receipts" on storage.objects;
create policy "team can upload warehouse receipts" on storage.objects for insert with check (
  bucket_id = 'warehouse-receipts' and auth.uid() is not null
);
