import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MathText } from "@/components/math-text";
import { Loader2, Newspaper, ImageOff } from "lucide-react";

export const Route = createFileRoute("/student/")({
  component: StudentFeed,
});

type FeedPost = {
  id: string;
  body: string | null;
  media_type: "text" | "image" | "video" | "audio";
  media_path: string | null;
  class_level: string | null;
  created_at: string;
};

function mediaUrl(path: string) {
  return supabase.storage.from("feed-media").getPublicUrl(path).data.publicUrl;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} দিন আগে`;
  return d.toLocaleDateString("bn-BD");
}

function StudentFeed() {
  const { user } = useSession();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["student-feed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("id, body, media_type, media_path, class_level, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as FeedPost[];
    },
  });

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 text-academy-navy">
        <Newspaper className="size-5" />
        <h1 className="text-lg font-bold">নিউজফিড</h1>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-academy-navy" /></div>
      ) : !posts || posts.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">
          <ImageOff className="size-10 mx-auto mb-3 opacity-50" />
          এখনো কোনো পোস্ট নেই
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  return (
    <article className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 pb-3">
        <div className="size-10 rounded-full bg-academy-gold text-academy-navy flex items-center justify-center font-bold shrink-0">স</div>
        <div className="min-w-0">
          <div className="font-bold text-academy-navy text-sm truncate">সমীকরণ শিক্ষা পরিবার</div>
          <div className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</div>
        </div>
      </header>

      {/* Body text */}
      {post.body && (
        <div className="px-4 pb-3 text-sm text-academy-navy/90 whitespace-pre-wrap leading-relaxed">
          <MathText>{post.body}</MathText>
        </div>
      )}

      {/* Media */}
      {post.media_type === "image" && post.media_path && (
        <img
          src={mediaUrl(post.media_path)}
          alt={post.body ?? "পোস্ট ছবি"}
          loading="lazy"
          className="w-full max-h-[600px] object-cover bg-academy-soft"
        />
      )}
      {post.media_type === "video" && post.media_path && (
        <video
          src={mediaUrl(post.media_path)}
          controls
          playsInline
          className="w-full max-h-[600px] bg-black"
        />
      )}
      {post.media_type === "audio" && post.media_path && (
        <div className="px-4 pb-4">
          <audio src={mediaUrl(post.media_path)} controls className="w-full" />
        </div>
      )}
    </article>
  );
}
