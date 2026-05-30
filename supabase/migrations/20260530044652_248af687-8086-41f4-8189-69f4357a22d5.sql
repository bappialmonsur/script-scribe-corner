CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  post_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_meta text,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications read own"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications update own"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications delete own"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- Resolve a display name for an actor (student first, then profile)
CREATE OR REPLACE FUNCTION public.notify_resolve_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT full_name FROM public.students WHERE user_id = _user_id AND is_active = true LIMIT 1),
    (SELECT full_name FROM public.profiles WHERE id = _user_id LIMIT 1),
    'একজন ব্যবহারকারী'
  )
$$;

-- Resolve meta (class + roll) for a student actor, NULL for staff
CREATE OR REPLACE FUNCTION public.notify_resolve_meta(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.class_level IS NOT NULL
      THEN (s.class_level::text || ' শ্রেণি · রোল ' || COALESCE(s.roll, ''))
    ELSE NULL
  END
  FROM public.students s
  WHERE s.user_id = _user_id AND s.is_active = true
  LIMIT 1
$$;

-- Trigger: notify post author on a new like
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _author uuid;
BEGIN
  SELECT author_id INTO _author FROM public.feed_posts WHERE id = NEW.post_id;
  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, post_id, actor_id, actor_name, actor_meta)
    VALUES (
      _author, 'like', NEW.post_id, NEW.user_id,
      public.notify_resolve_name(NEW.user_id),
      public.notify_resolve_meta(NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Trigger: notify post author on a new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _author uuid;
BEGIN
  SELECT author_id INTO _author FROM public.feed_posts WHERE id = NEW.post_id;
  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, post_id, actor_id, actor_name, actor_meta, body)
    VALUES (
      _author, 'comment', NEW.post_id, NEW.user_id,
      COALESCE(NEW.author_name, public.notify_resolve_name(NEW.user_id)),
      COALESCE(NEW.author_meta, public.notify_resolve_meta(NEW.user_id)),
      left(NEW.body, 140)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;