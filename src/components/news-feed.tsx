import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles, ImageOff, BadgeCheck, Heart, MessageCircle, Share2, Loader2, Clock,
  GraduationCap, Send, Trash2,
} from "lucide-react";

export type FeedPost = {
  id: string;
  body: string | null;
  media_type: "text" | "image" | "video" | "audio";
  media_path: string | null;
  class_level: string | null;
  created_at: string;
  author_name?: string | null;
  author_role?: string | null;
  author_meta?: string | null;
  status?: string | null;
};

export function mediaUrl(path: string) {
  return supabase.storage.from("feed-media").getPublicUrl(path).data.publicUrl;
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} দিন আগে`;
  return d.toLocaleDateString("bn-BD");
}

const ROLE_LABEL: Record<string, string> = {
  admin: "এডমিন",
  teacher: "শিক্ষক",
  student: "শিক্ষার্থী",
};

/** Identity of the currently signed-in viewer, used when commenting. */
function useViewerIdentity(userId: string | undefined) {
  return useQuery({
    queryKey: ["viewer-identity", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Student?
      const { data: stu } = await supabase
        .from("students")
        .select("full_name, class_level, roll")
        .eq("user_id", userId!)
        .maybeSingle();
      if (stu) {
        const meta = stu.class_level
          ? `${stu.class_level} শ্রেণি · রোল ${stu.roll ?? ""}`.trim()
          : null;
        return { name: stu.full_name, role: "student", meta };
      }
      // Staff (admin/teacher) — use profile + role
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      return {
        name: prof?.full_name || (isAdmin ? "এডমিন" : "শিক্ষক"),
        role: isAdmin ? "admin" : "teacher",
        meta: null as string | null,
      };
    },
  });
}

export function FeedHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div
        className="absolute -right-10 -top-12 size-40 rounded-full opacity-25 blur-2xl"
        style={{ background: "var(--gradient-gold)" }}
      />
      <div className="absolute -left-8 bottom-0 size-24 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-center gap-3">
        <div
          className="size-12 rounded-2xl flex items-center justify-center text-academy-navy font-extrabold text-xl shadow-lg ring-2 ring-white/30"
          style={{ background: "var(--gradient-gold)" }}
        >
          স
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold leading-tight truncate">নিউজফিড</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full ring-1 ring-white/25">
              <Sparkles className="size-3" /> এক্সক্লুসিভ
            </span>
          </div>
          <p className="text-xs text-white/75 mt-0.5">
            {subtitle ?? "সমীকরণ শিক্ষা পরিবারের সর্বশেষ আপডেট"}
          </p>
        </div>
      </div>
    </header>
  );
}

type CommentRow = {
  id: string;
  user_id: string;
  author_name: string | null;
  author_role: string | null;
  author_meta: string | null;
  body: string;
  created_at: string;
};

function CommentSection({ postId }: { postId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: viewer } = useViewerIdentity(user?.id);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, user_id, author_name, author_role, author_meta, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`comments-rt-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["post-comments", postId] });
          qc.invalidateQueries({ queryKey: ["post-comment-count", postId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, qc]);

  const submit = async () => {
    if (!text.trim() || !user || !viewer) return;
    setSending(true);
    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        author_name: viewer.name,
        author_role: viewer.role,
        author_meta: viewer.meta,
        body: text.trim(),
      });
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["post-comments", postId] });
      qc.invalidateQueries({ queryKey: ["post-comment-count", postId] });
    } catch (e: any) {
      toast.error(e.message ?? "মন্তব্য ব্যর্থ হয়েছে");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
    qc.invalidateQueries({ queryKey: ["post-comment-count", postId] });
  };

  return (
    <div className="px-4 pb-4 pt-1 space-y-3 bg-academy-soft/30 border-t border-border/60">
      {isLoading ? (
        <div className="py-3 flex justify-center">
          <Loader2 className="size-4 animate-spin text-academy-gold" />
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-2 pt-2">
          {comments.map((c) => {
            const initial = (c.author_name || "?").charAt(0);
            return (
              <div key={c.id} className="flex items-start gap-2">
                <div className="size-7 shrink-0 rounded-full bg-academy-navy/10 text-academy-navy text-xs font-bold flex items-center justify-center">
                  {initial}
                </div>
                <div className="flex-1 min-w-0 bg-card rounded-2xl px-3 py-2 border border-border/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-academy-navy">{c.author_name}</span>
                    {(c.author_role === "admin" || c.author_role === "teacher") && (
                      <BadgeCheck className="size-3 text-academy-gold" />
                    )}
                    {c.author_meta && (
                      <span className="text-[10px] text-muted-foreground">· {c.author_meta}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-academy-navy/90 whitespace-pre-wrap break-words mt-0.5">
                    {c.body}
                  </p>
                </div>
                {user?.id === c.user_id && (
                  <button
                    onClick={() => remove(c.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">প্রথম মন্তব্যটি করুন</p>
      )}

      <div className="flex items-end gap-2 pt-1">
        <Textarea
          rows={1}
          placeholder="মন্তব্য লিখুন..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="resize-none min-h-9 py-2 text-sm bg-card"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          onClick={submit}
          disabled={sending || !text.trim()}
          size="icon"
          className="bg-academy-navy text-white shrink-0"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const name = post.author_name?.trim() || "সমীকরণ শিক্ষা পরিবার";
  const role = post.author_role || "admin";
  const isStaff = role === "admin" || role === "teacher";
  const initial = name.charAt(0) || "স";
  const pending = post.status === "pending";
  const [showComments, setShowComments] = useState(false);

  // Likes: total count + whether current user liked
  const { data: likeData } = useQuery({
    queryKey: ["post-likes", post.id, user?.id],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase
          .from("post_likes")
          .select("id", { count: "exact", head: true })
          .eq("post_id", post.id),
        user
          ? supabase
              .from("post_likes")
              .select("id")
              .eq("post_id", post.id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, liked: !!(mine as any).data };
    },
  });

  const { data: commentCount } = useQuery({
    queryKey: ["post-comment-count", post.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("post_comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id);
      return count ?? 0;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`likes-rt-${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` },
        () => qc.invalidateQueries({ queryKey: ["post-likes", post.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, qc]);

  const toggleLike = async () => {
    if (!user) return toast.error("পছন্দ দিতে লগইন করুন");
    try {
      if (likeData?.liked) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      }
      qc.invalidateQueries({ queryKey: ["post-likes", post.id] });
    } catch (e: any) {
      toast.error(e.message ?? "ব্যর্থ হয়েছে");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    const shareData = { title: "সমীকরণ শিক্ষা নিউজফিড", text: post.body ?? "", url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("লিংক কপি হয়েছে");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      className="group bg-card rounded-3xl border border-border/70 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden scroll-mt-20"
    >
      <header className="flex items-center gap-3 p-4 pb-3">
        <div className="relative shrink-0">
          <div
            className="size-11 rounded-full flex items-center justify-center text-academy-navy font-bold shadow ring-2 ring-academy-gold/30"
            style={{ background: "var(--gradient-gold)" }}
          >
            {initial}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-academy-navy text-sm truncate">{name}</span>
            {isStaff && <BadgeCheck className="size-4 text-academy-gold shrink-0" />}
            {!isStaff && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-academy-navy/70 bg-academy-soft px-1.5 py-0.5 rounded-full">
                <GraduationCap className="size-3" /> {ROLE_LABEL[role]}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>{timeAgo(post.created_at)}</span>
            {post.author_meta && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{post.author_meta}</span>
              </>
            )}
          </div>
        </div>
        {pending && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
            <Clock className="size-3" /> অপেক্ষমাণ
          </span>
        )}
        {!pending && post.class_level && (
          <span className="text-[10px] font-semibold text-academy-navy bg-academy-soft px-2.5 py-1 rounded-full border border-academy-gold/30 shrink-0">
            {post.class_level}
          </span>
        )}
      </header>

      {post.body && (
        <div className="px-4 pb-3 text-[15px] text-academy-navy/90 whitespace-pre-wrap leading-relaxed">
          <MathText>{post.body}</MathText>
        </div>
      )}

      {post.media_type === "image" && post.media_path && (
        <div className="overflow-hidden bg-academy-soft">
          <img
            src={mediaUrl(post.media_path)}
            alt={post.body ?? "পোস্ট ছবি"}
            loading="lazy"
            className="w-full max-h-[600px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      )}
      {post.media_type === "video" && post.media_path && (
        <video src={mediaUrl(post.media_path)} controls playsInline className="w-full max-h-[600px] bg-black" />
      )}
      {post.media_type === "audio" && post.media_path && (
        <div className="px-4 pb-2">
          <audio src={mediaUrl(post.media_path)} controls className="w-full" />
        </div>
      )}

      {((likeData?.count ?? 0) > 0 || (commentCount ?? 0) > 0) && (
        <div className="flex items-center gap-3 px-4 pt-3 text-xs text-muted-foreground">
          {(likeData?.count ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="size-3 fill-rose-500 text-rose-500" /> {likeData?.count}
            </span>
          )}
          {(commentCount ?? 0) > 0 && (
            <button onClick={() => setShowComments(true)} className="ml-auto hover:underline">
              {commentCount} মন্তব্য
            </button>
          )}
        </div>
      )}

      <footer className="flex items-center gap-1 px-2 py-1.5 mt-1 border-t border-border/60 text-muted-foreground">
        <button
          onClick={toggleLike}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-academy-soft ${
            likeData?.liked ? "text-rose-500" : ""
          }`}
        >
          <Heart className={`size-4 ${likeData?.liked ? "fill-rose-500" : ""}`} /> পছন্দ
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-academy-soft"
        >
          <MessageCircle className="size-4" /> মন্তব্য
        </button>
        <button
          onClick={share}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-academy-soft"
        >
          <Share2 className="size-4" /> শেয়ার
        </button>
      </footer>

      {showComments && <CommentSection postId={post.id} />}
    </article>
  );
}

export function FeedList({
  posts,
  isLoading,
}: {
  posts: FeedPost[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-16 flex justify-center">
        <Loader2 className="animate-spin text-academy-gold" />
      </div>
    );
  }
  if (!posts || posts.length === 0) {
    return (
      <div className="bg-card rounded-3xl border p-14 text-center text-muted-foreground shadow-sm">
        <ImageOff className="size-12 mx-auto mb-3 opacity-40" />
        এখনো কোনো পোস্ট নেই
      </div>
    );
  }
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </>
  );
}
