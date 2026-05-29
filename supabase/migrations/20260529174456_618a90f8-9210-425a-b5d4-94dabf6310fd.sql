-- Restrict students to only their own class for notices and MCQ questions.

-- NOTICES: replace broad "all active" read with class-scoped read.
DROP POLICY IF EXISTS "notices authenticated read active" ON public.notices;
CREATE POLICY "notices read own class or broadcast"
ON public.notices
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_active = true
    AND (
      class_level IS NULL
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid()
          AND s.is_active = true
          AND s.class_level = notices.class_level
      )
    )
  )
);

-- MCQ QUESTIONS: replace broad "all active" read with class-scoped read.
DROP POLICY IF EXISTS "authenticated read active mcq" ON public.mcq_questions;
CREATE POLICY "mcq read own class"
ON public.mcq_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.class_level = mcq_questions.class_level
    )
  )
);