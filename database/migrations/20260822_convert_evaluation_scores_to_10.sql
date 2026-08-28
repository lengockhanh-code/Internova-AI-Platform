BEGIN;

-- Convert existing official grades from the 100-point scale to the
-- 10-point scale. Values already stored on the 10-point scale are kept.
UPDATE public.evaluations
SET total_score = ROUND(total_score / 10.0, 2)
WHERE total_score > 10;

UPDATE public.weekly_reports
SET lecturer_score = ROUND(lecturer_score / 10.0, 2)
WHERE lecturer_score > 10;

ALTER TABLE public.evaluations
    DROP CONSTRAINT IF EXISTS evaluations_total_score_check;

ALTER TABLE public.evaluations
    ADD CONSTRAINT evaluations_total_score_check
    CHECK (total_score BETWEEN 0 AND 10);

ALTER TABLE public.weekly_reports
    DROP CONSTRAINT IF EXISTS weekly_reports_lecturer_score_check;

ALTER TABLE public.weekly_reports
    ADD CONSTRAINT weekly_reports_lecturer_score_check
    CHECK (lecturer_score BETWEEN 0 AND 10);

COMMIT;
