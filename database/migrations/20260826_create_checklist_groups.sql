BEGIN;

CREATE TABLE IF NOT EXISTS public.checklist_groups (
    id BIGSERIAL PRIMARY KEY,
    internship_id BIGINT NOT NULL
        REFERENCES public.internships(id)
        ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    due_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checklist_items
    ADD COLUMN IF NOT EXISTS group_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'checklist_items_group_id_fkey'
    ) THEN
        ALTER TABLE public.checklist_items
            ADD CONSTRAINT checklist_items_group_id_fkey
            FOREIGN KEY (group_id)
            REFERENCES public.checklist_groups(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

-- Preserve existing checklist items by placing each internship/category into
-- one editable group. No item content or completion state is changed.
INSERT INTO public.checklist_groups (
    internship_id,
    title,
    category,
    priority,
    due_at
)
SELECT
    items.internship_id,
    CASE items.category
        WHEN 'PROFILE' THEN 'Chuẩn bị hồ sơ'
        WHEN 'WEEKLY' THEN 'Công việc trong tuần'
        WHEN 'FINAL' THEN 'Hoàn tất kỳ thực tập'
    END,
    items.category,
    'MEDIUM',
    MIN(items.due_at)
FROM public.checklist_items AS items
WHERE items.group_id IS NULL
  AND items.category IN ('PROFILE', 'WEEKLY', 'FINAL')
  AND NOT EXISTS (
      SELECT 1
      FROM public.checklist_groups AS existing_group
      WHERE existing_group.internship_id = items.internship_id
        AND existing_group.category = items.category
  )
GROUP BY items.internship_id, items.category;

WITH group_matches AS (
    SELECT
        items.id AS item_id,
        (
            SELECT groups.id
            FROM public.checklist_groups AS groups
            WHERE groups.internship_id = items.internship_id
              AND groups.category = items.category
            ORDER BY groups.id ASC
            LIMIT 1
        ) AS group_id
    FROM public.checklist_items AS items
    WHERE items.group_id IS NULL
      AND items.category IN ('PROFILE', 'WEEKLY', 'FINAL')
)
UPDATE public.checklist_items AS items
SET group_id = group_matches.group_id
FROM group_matches
WHERE items.id = group_matches.item_id
  AND group_matches.group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_groups_internship
    ON public.checklist_groups(internship_id);

CREATE INDEX IF NOT EXISTS idx_checklist_items_group
    ON public.checklist_items(group_id);

COMMIT;
