ALTER TABLE public.feed_posts
ADD COLUMN IF NOT EXISTS is_reel boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_feed_posts_is_reel
ON public.feed_posts (is_reel, created_at DESC)
WHERE is_reel = true;