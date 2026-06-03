import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Plus, Loader2, X, Play, ChevronUp, ChevronDown, Clock, BadgeCheck, Trash2, Film,
} from "lucide-react";
import { bnClass, bnNum } from "@/lib/grading";

type Reel = {
  id: string;
  body: string | null;
  media_path: string | null;
  author_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_meta: string | null;
  status: string | null;
  created_at: string;
};

function reelUrl(path: string) {
  return supabase.storage.from("feed-media").getPublicUrl(path).data.publicUrl;
}

async function getViewerIdentity(userId: string) {
  const { data: stu } = await supabase
    .from("students")
    .select("full_name, class_level, roll")
    .eq("user_id", userId)
    .maybeSingle();
  if (stu) {
    const meta = stu.class_level
      ? `${bnClass(stu.class_level)} শ্রেণি · রোল ${bnNum(stu.roll ?? "")}`.trim()
      : null;
    return { name: stu.full_name, role: "student", meta };
  }
  const [{ data: prof }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  return {
    name: prof?.full_name || (isAdmin ? "সমীকরণ শিক্ষা পরিবার" : "শিক্ষক"),
    role: isAdmin ? "admin" : "teacher",
    meta: null as string | null,
  };
}

export function ReelsStrip() {
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { data: reels } = useQuery({
    queryKey: ["reels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("id, body, media_path, author_id, author_name, author_role, author_meta, status, created_at")
        .eq("is_reel", true)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data as Reel[]).filter(
        (r) => r.status === "approved" || (!!user && r.author_id === user.id),
      );
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("reels-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["reels", user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const onPick = async (f: File | null) => {
    if (!f || !user) return;
    if (!f.type.startsWith("video/")) {
      toast.error("শুধু ভিডিও ফাইল রিল হিসেবে যোগ করা যাবে");
      return;
    }
    if (f.size > 60 * 1024 * 1024) {
      toast.error("ভিডিওটি ৬০ MB এর বেশি — ছোট ভিডিও দিন");
      return;
    }
    setUploading(true);
    try {
      const ident = await getViewerIdentity(user.id);
      const ext = f.name.split(".").pop() ?? "mp4";
      const path = `reels/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("feed-media")
        .upload(path, f, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const isStaff = ident.role === "admin" || ident.role === "teacher";
      const { error } = await supabase.from("feed_posts").insert({
        body: null,
        media_type: "video",
        media_path: path,
        is_reel: true,
        class_level: null,
        author_id: user.id,
        author_name: ident.name,
        author_role: ident.role,
        author_meta: ident.meta,
        status: isStaff ? "approved" : "pending",
      });
      if (error) throw error;
      toast.success(
        isStaff ? "রিল প্রকাশিত হয়েছে" : "রিল জমা হয়েছে — এডমিন অনুমোদনের পর প্রকাশিত হবে",
      );
      qc.invalidateQueries({ queryKey: ["reels", user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "রিল আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const list = reels ?? [];

  return (
    <div className="bg-card rounded-3xl border border-border/70 shadow-sm p-3">
      <div className="flex items-center gap-1.5 px-1 pb-2 text-sm font-semibold text-academy-navy">
        <Film className="size-4 text-academy-gold" />
        রিলস
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Add reel tile */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 w-24 h-40 rounded-2xl border-2 border-dashed border-academy-gold/50 bg-academy-soft/50 flex flex-col items-center justify-center gap-2 text-academy-navy hover:bg-academy-soft transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-academy-gold" />
          ) : (
            <span className="size-10 rounded-full bg-academy-gold/20 flex items-center justify-center">
              <Plus className="size-5 text-academy-gold" />
            </span>
          )}
          <span className="text-[11px] font-semibold">রিল যোগ</span>
        </button>

        {list.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setViewerIndex(i)}
            className="shrink-0 w-24 h-40 rounded-2xl overflow-hidden relative bg-black group"
          >
            {r.media_path && (
              <video
                src={reelUrl(r.media_path)}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="size-9 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                <Play className="size-4 text-white fill-white" />
              </span>
            </div>
            {r.status === "pending" && (
              <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Clock className="size-2.5" /> অপেক্ষমাণ
              </span>
            )}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 text-left">
              <div className="text-[10px] font-bold text-white truncate flex items-center gap-0.5">
                {r.author_name}
                {(r.author_role === "admin" || r.author_role === "teacher") && (
                  <BadgeCheck className="size-2.5 text-academy-gold shrink-0" />
                )}
              </div>
            </div>
          </button>
        ))}

        {list.length === 0 && (
          <div className="shrink-0 flex items-center text-xs text-muted-foreground px-2">
            এখনো কোনো রিল নেই — প্রথম রিলটি যোগ করুন
          </div>
        )}
      </div>

      {viewerIndex != null && list[viewerIndex] && (
        <ReelViewer
          reels={list}
          index={viewerIndex}
          setIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          currentUserId={user?.id}
          onDeleted={() => qc.invalidateQueries({ queryKey: ["reels", user?.id] })}
        />
      )}
    </div>
  );
}

function ReelViewer({
  reels,
  index,
  setIndex,
  onClose,
  currentUserId,
  onDeleted,
}: {
  reels: Reel[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  currentUserId?: string;
  onDeleted: () => void;
}) {
  const r = reels[index];
  const [deleting, setDeleting] = useState(false);
  const canDelete = !!currentUserId && r.author_id === currentUserId;

  const remove = async () => {
    if (!confirm("রিলটি মুছে ফেলবেন?")) return;
    setDeleting(true);
    try {
      if (r.media_path) await supabase.storage.from("feed-media").remove([r.media_path]);
      const { error } = await supabase.from("feed_posts").delete().eq("id", r.id);
      if (error) throw error;
      toast.success("রিল মুছে ফেলা হয়েছে");
      onDeleted();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "মুছে ফেলা ব্যর্থ হয়েছে");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/15 text-white flex items-center justify-center"
        aria-label="বন্ধ"
      >
        <X className="size-5" />
      </button>

      <div
        className="relative w-full max-w-sm h-full sm:h-[85vh] sm:rounded-3xl overflow-hidden bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {r.media_path && (
          <video
            key={r.id}
            src={reelUrl(r.media_path)}
            autoPlay
            controls
            playsInline
            loop
            className="w-full h-full object-contain bg-black"
          />
        )}

        <div className="absolute bottom-4 left-4 right-16 text-white">
          <div className="font-bold text-sm flex items-center gap-1">
            {r.author_name}
            {(r.author_role === "admin" || r.author_role === "teacher") && (
              <BadgeCheck className="size-3.5 text-academy-gold" />
            )}
          </div>
          {r.author_meta && <div className="text-xs text-white/70">{r.author_meta}</div>}
          {r.body && <div className="text-sm text-white/90 mt-1 line-clamp-3">{r.body}</div>}
        </div>

        {/* Nav */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          <button
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            className="size-10 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-30"
            aria-label="আগের রিল"
          >
            <ChevronUp className="size-5" />
          </button>
          <button
            disabled={index === reels.length - 1}
            onClick={() => setIndex(index + 1)}
            className="size-10 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-30"
            aria-label="পরের রিল"
          >
            <ChevronDown className="size-5" />
          </button>
          {canDelete && (
            <button
              onClick={remove}
              disabled={deleting}
              className="size-10 rounded-full bg-red-500/80 text-white flex items-center justify-center"
              aria-label="মুছুন"
            >
              {deleting ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
