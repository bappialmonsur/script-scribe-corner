import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { FeedHeader, FeedList, type FeedPost } from "@/components/news-feed";

export const Route = createFileRoute("/admin/newsfeed")({
  component: PanelNewsfeed,
});

function PanelNewsfeed() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["panel-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select(
          "id, body, media_type, media_path, link_url, class_level, created_at, author_id, author_name, author_role, author_meta, status",
        )
        .eq("status", "approved")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as FeedPost[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("panel-feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["panel-feed"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">
      <FeedHeader subtitle="সর্বশেষ অনুমোদিত পোস্টসমূহ" />
      <FeedList posts={posts} isLoading={isLoading} />
    </div>
  );
}
