alter type points_event_type add value if not exists 'sop_completed';
alter type points_event_type add value if not exists 'crew_habit_ritual';
alter type points_event_type add value if not exists 'crew_review_completed';
alter type points_event_type add value if not exists 'crew_kpi_hit';
alter type points_event_type add value if not exists 'crew_feedback';
alter type points_event_type add value if not exists 'crew_certs_current';
alter type points_event_type add value if not exists 'crew_google_review';
alter type points_event_type add value if not exists 'crew_compliment';
alter type points_event_type add value if not exists 'crew_safety_milestone';
alter type points_event_type add value if not exists 'crew_peer_recognition';
alter type points_event_type add value if not exists 'redeem';

drop policy if exists "service/admin writes points events" on points_events;
create policy "service/admin writes points events" on points_events
for insert to authenticated
with check (is_manager());

drop policy if exists "service/admin writes streaks" on streaks;
create policy "service/admin writes streaks" on streaks
for all to authenticated
using (is_manager())
with check (is_manager());
