create policy "self updates own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "manager updates team profiles" on profiles for update using (is_manager()) with check (is_manager());

create policy "certs self or manager insert" on crew_certification for insert with check (user_id = auth.uid() or is_manager());
create policy "certs self or manager update" on crew_certification for update using (user_id = auth.uid() or is_manager()) with check (user_id = auth.uid() or is_manager());

create policy "recognition self insert" on crew_recognition for insert with check (from_user_id = auth.uid());

create policy "redemptions self insert" on crew_reward_redemption for insert with check (user_id = auth.uid());
create policy "redemptions admin approve" on crew_reward_redemption for update using (is_admin()) with check (is_admin());

create policy "kpi results self or manager update" on crew_kpi_result for update using (user_id = auth.uid() or is_manager()) with check (user_id = auth.uid() or is_manager());

create policy "reviews manager update" on crew_review for update using (is_manager() or manager_id = auth.uid()) with check (is_manager() or manager_id = auth.uid());
