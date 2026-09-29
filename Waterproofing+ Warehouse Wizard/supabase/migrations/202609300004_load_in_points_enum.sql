-- points_events.type is an enum, so the new award had nowhere to land: the
-- edge function returned 500 "invalid input value for enum points_event_type".
-- Found by running the whole flow against the live project rather than
-- trusting the deploy.
alter type points_event_type add value if not exists 'load_in_complete';
