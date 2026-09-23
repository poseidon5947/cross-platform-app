-- The "What should we improve?" box on Crew+ > Feedback awarded points and threw
-- the message away: submitFeedback only ever created a points event, and no table
-- existed to hold the text. People have been told their feedback is wanted, so it
-- needs somewhere to land and someone able to read it.
--
-- Company feedback is often a criticism of management, so reads are admin-only
-- plus the author's own. Written idempotently so re-running is safe.

create table if not exists crew_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  message text not null,
  ts timestamptz not null default now(),
  points_event_ref text
);

alter table crew_feedback enable row level security;

drop policy if exists "feedback self insert" on crew_feedback;
create policy "feedback self insert" on crew_feedback for insert with check (
  user_id = auth.uid()
);

drop policy if exists "feedback admin or own readable" on crew_feedback;
create policy "feedback admin or own readable" on crew_feedback for select using (
  user_id = auth.uid() or public.is_admin()
);

create index if not exists crew_feedback_ts_idx on crew_feedback (ts desc);
