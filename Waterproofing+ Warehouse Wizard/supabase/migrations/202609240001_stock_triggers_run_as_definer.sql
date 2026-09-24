-- Stock never moved when a crew member logged materials.
--
-- Live verification (pass 4 and the follow-up) put a 1-unit `use` of Tremco BG
-- Grip Tape on the server as Jon (crew). The transactions row is there; the
-- material still reads 104. The row was inserted under the "crew inserts usage
-- transactions" policy, and then transactions_apply_stock fired
-- apply_stock_transaction(), which does `update materials ...`. That function is
-- plain plpgsql - security invoker - so the update runs as the crew member, and
-- the only write policy on materials is "manager writes materials". Zero rows
-- match. Postgres does not treat that as an error, so the insert succeeds, the
-- app says "Log submitted", and the count is wrong from then on. Managers' own
-- logs were the only ones that ever moved stock.
--
-- apply_truck_log() has the identical shape against "manager writes trucks": a
-- crew driver's odometer and oil check never reached the truck row.
--
-- Both now run as the function owner, with search_path pinned as the other
-- definer functions in this schema already do. They only ever touch the row
-- the trigger's NEW record points at, so there is nothing new a caller can reach.
--
-- This does not rewrite historical quantities. Every crew-logged use since
-- launch is missing from materials.qty, but managers have also set exact counts
-- in that time, and those adjustments were made against the numbers on screen.
-- Reconciling is a stock-take decision, not something a migration should guess.

create or replace function apply_stock_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signed numeric;
begin
  signed := case
    when new.type in ('use','deliver','loss') then -abs(new.qty)
    when new.type in ('receive','return') then abs(new.qty)
    when new.type = 'adjust' then new.qty
    else new.qty
  end;
  update materials set qty = greatest(0, qty + signed), updated_at = now() where id = new.material_id;
  return new;
end;
$$;

create or replace function apply_truck_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update trucks
  set
    km = greatest(km, new.km),
    last_oil = case when new.oil_checked then greatest(last_oil, new.km) else last_oil end,
    updated_at = now()
  where id = new.truck_id;
  return new;
end;
$$;

-- The daily_logs select policy from 202609040001 never reached production, so
-- the triggers themselves are re-declared here rather than assumed. Idempotent.
drop trigger if exists transactions_apply_stock on transactions;
create trigger transactions_apply_stock
after insert on transactions
for each row execute function apply_stock_transaction();

drop trigger if exists truck_logs_apply_truck on truck_logs;
create trigger truck_logs_apply_truck
after insert on truck_logs
for each row execute function apply_truck_log();
