-- Real Quarterly Review Scorecard content, sourced directly from the client's
-- shared employee/manager Google Docs (V9 round). Replaces the earlier
-- placeholder question set for form-quarterly-scorecard, which used generic
-- guessed content (e.g. wrong core values) never surfaced in any UI and had
-- no submissions against it, so it is safe to replace outright.

alter table if exists crew_review add column if not exists overall_rating jsonb;
alter table if exists crew_review add column if not exists quarterly_detail jsonb;

delete from crew_form_question where form_id = 'form-quarterly-scorecard';

update crew_form
set description = 'Complete at least 1 day before your quarterly review. Your manager reviews these answers with you and completes the rest during the meeting.'
where id = 'form-quarterly-scorecard';

insert into crew_form_question (id, form_id, sort_order, question, response_type, required, anonymous_allowed, visibility, options, word_limit) values
  ('form-quarterly-scorecard-1', 'form-quarterly-scorecard', 1, 'How are things going?', 'Checkbox', true, false, 'both', '["Excellent","Good","Fair","Struggling"]'::jsonb, null),
  ('form-quarterly-scorecard-2', 'form-quarterly-scorecard', 2, 'I have the tools I need', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-3', 'form-quarterly-scorecard', 3, 'I receive clear instructions', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-4', 'form-quarterly-scorecard', 4, 'I understand what success looks like', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-5', 'form-quarterly-scorecard', 5, 'Communication is good', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-6', 'form-quarterly-scorecard', 6, 'I feel respected', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-7', 'form-quarterly-scorecard', 7, 'Attention to detail', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-8', 'form-quarterly-scorecard', 8, 'Waterproofing quality', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-9', 'form-quarterly-scorecard', 9, 'Caulking quality', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-10', 'form-quarterly-scorecard', 10, 'Protection of finished work', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-11', 'form-quarterly-scorecard', 11, 'Organization', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-12', 'form-quarterly-scorecard', 12, 'Productivity', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-13', 'form-quarterly-scorecard', 13, 'Following SOPs', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-14', 'form-quarterly-scorecard', 14, 'Pride in workmanship', 'Scale 1-5', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-15', 'form-quarterly-scorecard', 15, 'Top three strengths', 'Text', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-16', 'form-quarterly-scorecard', 16, 'What do you think you do best?', 'Text', false, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-17', 'form-quarterly-scorecard', 17, 'What one or two improvements would have the biggest impact?', 'Text', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-18', 'form-quarterly-scorecard', 18, 'Quarterly goal 1', 'Text', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-19', 'form-quarterly-scorecard', 19, 'Quarterly goal 2', 'Text', true, false, 'both', '[]'::jsonb, null),
  ('form-quarterly-scorecard-20', 'form-quarterly-scorecard', 20, 'Quarterly goal 3', 'Text', false, false, 'both', '[]'::jsonb, null);
