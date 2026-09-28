-- Resolving a needs-review entry never moved the stock count.
--
-- transactions_apply_stock is AFTER INSERT only. A needs-review row is
-- inserted with material_id null, so the insert moves nothing - correct, that
-- is the point of holding it back. Resolving it is an UPDATE that fills in the
-- material and the quantity, and no trigger was listening, so the count never
-- caught up. The Reports guide tells Jordan "this is the moment the stock count
-- actually updates", which has never been true.
--
-- Fires only on the one transition that matters: a row that was flagged,
-- is no longer flagged, and now names a real material. Dismissing leaves
-- needs_review true, so it does not fire. Editing an already-resolved row has
-- old.needs_review false, so it cannot double-apply.
create or replace function public.apply_resolved_stock_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  signed numeric;
begin
  if old.needs_review and not new.needs_review and new.material_id is not null then
    signed := case
      when new.type in ('use','deliver','loss') then -abs(new.qty)
      when new.type in ('receive','return') then abs(new.qty)
      when new.type = 'adjust' then new.qty
      else new.qty
    end;
    update materials set qty = greatest(0, qty + signed), updated_at = now() where id = new.material_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists transactions_apply_stock_on_resolve on public.transactions;
create trigger transactions_apply_stock_on_resolve
  after update on public.transactions
  for each row execute function public.apply_resolved_stock_transaction();
