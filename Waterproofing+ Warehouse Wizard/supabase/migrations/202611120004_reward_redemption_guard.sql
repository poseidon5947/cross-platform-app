-- A crew member could approve their own cash reward, at a price they chose.
--
-- Found 2026-11-11 with a throwaway crew account, posting straight to the REST
-- API rather than going through the app:
--
--   POST /rest/v1/crew_reward_redemption
--   { "user_id": <self>, "reward_id": <"Cash - $50">,
--     "points": 1, "status": "approved" }
--
-- HTTP 201. The catalogue price is 200 points; this claimed it for 1, and
-- marked it approved without an admin touching it. An approved cash redemption
-- lands directly in "Payroll cash-outs due" on the Crew+ admin tab, with a
-- dollar figure next to it, ready to be confirmed for the next payroll run.
--
-- The app's own flow is right - requestRedemption writes status "requested" at
-- reward.points, and the Request button is disabled unless the wallet balance
-- covers it; approveRedemption is gated behind canApproveRedemptions. None of
-- that binds anyone who skips the UI, and the anon key ships in the bundle.
--
-- So the rules move to the database. A crew member may only ever file a
-- request, for themselves, at the catalogue price. Approving stays with
-- admins, which keeps a human in front of every payout - so the wallet balance
-- check can stay in the UI where it is.

create or replace function public.guard_reward_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (edge functions, seeds) and admins are the ones allowed to
  -- approve. Same carve-outs as guard_profile_privileges.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  new.user_id := auth.uid();
  new.status := 'requested';
  -- The catalogue sets the price, not the caller. If the reward has gone,
  -- leave what was sent and let the foreign key refuse the row.
  new.points := coalesce(
    (select r.points from public.crew_reward r where r.id = new.reward_id),
    new.points);
  new.approved_at := null;
  new.approved_by := null;

  return new;
end;
$$;

drop trigger if exists guard_reward_redemption on public.crew_reward_redemption;

-- Insert and update both: filing an approved request and editing a filed one
-- into an approved one are the same exploit.
create trigger guard_reward_redemption
  before insert or update on public.crew_reward_redemption
  for each row
  execute function public.guard_reward_redemption();
