-- Shot and pins are counted in hundreds.
--
-- step was constrained to 0.25, 0.5 or 1, which was fine while quarters were
-- the only thing anyone wanted. Then the catalogue moved to quarters across
-- the board and adding 150 shots became 600 taps of the + button. The crew
-- asked for those products to move in tens.
--
-- Any positive step is allowed now, and the application offers a fixed set
-- (0.25, 0.5, 1, 5, 10, 25, 50, 100) per product rather than deriving it from
-- the unit. The constraint still rejects zero and negatives, which would make
-- the + button do nothing or run backwards.
alter table public.materials drop constraint if exists materials_step_check;
alter table public.materials add constraint materials_step_check check (step > 0);
