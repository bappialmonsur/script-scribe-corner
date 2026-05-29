-- 1. feed_posts: author + approval columns
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS author_id uuid,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS author_meta text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Students may create their own posts but only as pending
CREATE POLICY "student create pending feed"
ON public.feed_posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status = 'pending'
  AND author_role = 'student'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

-- Recreate read policy to respect approval status + own pending posts
DROP POLICY IF EXISTS "feed read own class or broadcast" ON public.feed_posts;
CREATE POLICY "feed read approved or own"
ON public.feed_posts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_teacher_permission(auth.uid(), 'newsfeed'::teacher_feature)
  OR author_id = auth.uid()
  OR (
    is_active = true
    AND status = 'approved'
    AND (
      class_level IS NULL
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid() AND s.is_active = true
          AND s.class_level = feed_posts.class_level
      )
    )
  )
);

-- 2. messages table (student <-> admin)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  sender_role text NOT NULL,
  sender_name text,
  sender_meta text,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages read own or admin"
ON public.messages FOR SELECT TO authenticated
USING (student_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "messages insert student or admin"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  (student_user_id = auth.uid() AND sender_role = 'student')
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "messages update own or admin"
ON public.messages FOR UPDATE TO authenticated
USING (student_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "messages delete admin"
ON public.messages FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_messages_student ON public.messages (student_user_id, created_at);

-- 3. realtime
ALTER TABLE public.feed_posts REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;