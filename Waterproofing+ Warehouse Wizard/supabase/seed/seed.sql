insert into services (id, name) values
  ('wp','Waterproofing'),
  ('ins','Insulation'),
  ('inj','Crack Injection'),
  ('trf','Traffic Coatings'),
  ('veh','Vehicle / General')
on conflict (id) do update set name = excluded.name;

-- The full 121-item real workbook catalogue is in src/data/seed.ts and is loaded by the PWA for local demos.
-- In production, import that catalogue with the Admin CSV importer or transform it into INSERTs.
-- Demo auth users must be created through Supabase Auth, then profiles can be seeded with matching UUIDs.
