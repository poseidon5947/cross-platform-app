-- Splitting one review row into several.
--
-- A crew member writes one line for the whole day -- "42 360 38 950", or
-- "gallon elastocol stick , 35x 2 BSVW , 35x2 drain mat , 6 pieces of term
-- bar" -- and the review screen could only ever resolve it to a single
-- product. Everything after the first item was silently dropped: eight rows
-- went through that way, including 38 pails of Vulkem 950 at Bear Mountain.
--
-- Two things have to be true before the app can split a row.

-- 1. The insert trigger has to honour the same flags the update trigger does.
--    It did not: inserting a row with skip_stock or needs_review set still
--    moved stock, because apply_stock_transaction never looked. The September
--    import survived that only because its rows carried no material_id, so the
--    update matched nothing. A split writes rows that do carry one, so the
--    gap would start double-counting the moment the feature shipped.
create or replace function public.apply_stock_transaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  signed numeric;
begin
  -- A row still awaiting review is not a movement yet, and a back-dated line
  -- sits behind a stock count that already happened. Both are records only.
  if coalesce(new.needs_review, false) or coalesce(new.skip_stock, false) or new.material_id is null then
    return new;
  end if;
  signed := case
    when new.type in ('use','deliver','loss') then -abs(new.qty)
    when new.type in ('receive','return') then abs(new.qty)
    when new.type = 'adjust' then new.qty
    else new.qty
  end;
  update materials set qty = greatest(0, qty + signed), updated_at = now() where id = new.material_id;
  return new;
end;
$function$;

-- 2. A manager has to be able to write a row that belongs to someone else.
--    Both insert policies require auth.uid() = user_id, so Jordan splitting
--    Bobby's log line could only file it under his own name -- which would put
--    the wrong person against the material on every report. Managers can
--    already update any transaction; this lets them insert one the same way.
--    The crew policy is untouched, so crew still only write their own.
drop policy if exists "manager inserts on behalf" on public.transactions;
create policy "manager inserts on behalf" on public.transactions
  for insert to authenticated
  with check (is_manager());
