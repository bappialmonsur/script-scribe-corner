import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Loader2, PencilLine } from "lucide-react";
import { bnClass, bnNum } from "@/lib/grading";
import { FeedHeader, FeedList, type FeedPost } from "@/components/news-feed";
import { ClassMeritStrip } from "@/components/class-merit";
import { FeatureCards } from "@/components/feature-cards";
import { ReelsStrip } from "@/components/reels";

export const Route = createFileRoute("/student/")({
  component: StudentFeed,
});

function StudentFeed() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["student-feed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select(
          "id, body, media_type, media_path, link_url, class_level, created_at, author_id, author_name, author_role, author_meta, status",
        )
        .eq("is_reel", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as FeedPost[];
    },
  });

  // Realtime: refresh feed on new/approved posts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("student-feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["student-feed", user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!body.trim() || !student) return;
    setPosting(true);
    try {
      const meta = `${bnClass(student.class_level)} শ্রেণি · রোল ${bnNum(student.roll ?? "")}`;
      const { error } = await supabase.from("feed_posts").insert({
        body: body.trim(),
        media_type: "text",
        media_path: null,
        class_level: null,
        author_id: user!.id,
        author_name: student.full_name,
        author_role: "student",
        author_meta: meta,
        status: "pending",
      });
      if (error) throw error;
      toast.success("পোস্টটি জমা হয়েছে — এডমিন অনুমোদনের পর প্রকাশিত হবে");
      setBody("");
      qc.invalidateQueries({ queryKey: ["student-feed", user!.id] });
    } catch (e: any) {
      toast.error(e.message ?? "পোস্ট ব্যর্থ হয়েছে");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">
      {/* শ্রেণির মেধাতালিকা (মাসের ১ তারিখ থেকে) */}
      <ClassMeritStrip userId={user?.id} />

      {/* ফিচার্ড অপশন */}
      <FeatureCards variant="student" />

      <FeedHeader />

      {/* রিলস — সবাই রিল যোগ করতে পারবে */}
      <ReelsStrip />


      {/* Student composer */}
      <div className="bg-card rounded-3xl border border-border/70 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-academy-navy">
          <PencilLine className="size-4 text-academy-gold" />
          কিছু শেয়ার করুন
        </div>
        <Textarea
          rows={3}
          placeholder="আপনার মনের কথা লিখুন... (এডমিন অনুমোদনের পর সবার ফিডে যাবে)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            আপনার নাম, শ্রেণি ও রোল পোস্টে দেখানো হবে
          </span>
          <Button
            onClick={submit}
            disabled={posting || !body.trim()}
            className="bg-academy-navy text-white"
            size="sm"
          >
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            পোস্ট করুন
          </Button>
        </div>
      </div>

      <FeedList posts={posts} isLoading={isLoading} />
    </div>
  );
}
