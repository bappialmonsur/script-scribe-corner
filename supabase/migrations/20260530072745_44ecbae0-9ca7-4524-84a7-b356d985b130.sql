-- 1. external link on feed posts (for YouTube embeds)
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS link_url text;

-- 2. curated educational YouTube channels
CREATE TABLE public.video_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sources TO authenticated;
GRANT ALL ON public.video_sources TO service_role;

ALTER TABLE public.video_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_sources admin all"
ON public.video_sources
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));