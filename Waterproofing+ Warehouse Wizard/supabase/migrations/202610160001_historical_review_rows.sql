-- A needs-review row imported from a back-dated daily log is a record of what
-- happened, not a movement still to be applied. September's usage already sits
-- behind the 1 October stock count, so resolving one of those rows - which is
-- Jordan naming the product properly - must not deduct it a second time.
alter table public.transactions add column if not exists skip_stock boolean not null default false;

create or replace function public.apply_resolved_stock_transaction()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  signed numeric;
begin
  if old.needs_review and not new.needs_review and new.material_id is not null and not coalesce(new.skip_stock, false) then
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
$$;

-- Everything imported from the September print is historical.
update public.transactions set skip_stock = true
where needs_review and ts >= '2026-09-01' and ts < '2026-10-01';
