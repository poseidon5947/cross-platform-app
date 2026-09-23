-- crew_bonus_role_weight already admits CEO / Owner and Operations / Admin, but
-- crew_bonus_config and crew_bonus_period were left at ('CFO','Operations').
-- The owner is an admin with org_role 'CEO / Owner', so the single config row
-- was filtered out for them, bonusConfig came back undefined and the Bonus tab
-- crashed the app. Align all three lists.
drop policy if exists "bonus config admin cfo only" on crew_bonus_config;
create policy "bonus config admin cfo only" on crew_bonus_config for select using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
      and coalesce(p.org_role, '') in ('CFO', 'Operations / Admin', 'Operations', 'CEO / Owner', 'CEO')
  )
);

drop policy if exists "bonus period admin cfo only" on crew_bonus_period;
create policy "bonus period admin cfo only" on crew_bonus_period for select using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
      and coalesce(p.org_role, '') in ('CFO', 'Operations / Admin', 'Operations', 'CEO / Owner', 'CEO')
  )
);
