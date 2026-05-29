import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { useMyAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Newspaper, Trash2, ImagePlus, Video, Music, X, Send, Clock, Check, GraduationCap,
} from "lucide-react";
import { CLASS_LEVELS, bnClass } from "@/lib/grading";

export const Route = createFileRoute("/admin/feed")({
  component: FeedAdmin,
});

type MediaType = "text" | "image" | "video" | "audio";

function mediaUrl(path: string) {
  return supabase.storage.from("feed-media").getPublicUrl(path).data.publicUrl;
}

function FeedAdmin() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: access } = useMyAccess(user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [classLevel, setClassLevel] = useState<string>("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const mediaType: MediaType = !file
    ? "text"
    : file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "text";

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-feed"] });
        qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const pending = (posts ?? []).filter((p: any) => p.status === "pending");
  const published = (posts ?? []).filter((p: any) => p.status !== "pending");

  const pickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const clearFile = () => {
    pickFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!body.trim() && !file) {
      toast.error("কিছু লিখুন অথবা একটি মিডিয়া যোগ করুন");
      return;
    }
    setPosting(true);
    try {
      let media_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feed-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        media_path = path;
      }

      const isAdmin = !!access?.isAdmin;
      const authorRole = isAdmin ? "admin" : "teacher";
      const authorName = isAdmin
        ? "সমীকরণ শিক্ষা পরিবার"
        : (profile?.full_name || "শিক্ষক");

      const { error } = await supabase.from("feed_posts").insert({
        body: body.trim() || null,
        media_type: mediaType,
        media_path,
        class_level: classLevel === "all" ? null : (classLevel as any),
        author_id: user!.id,
        author_name: authorName,
        author_role: authorRole,
        status: "approved",
      });
      if (error) throw error;

      toast.success("পোস্ট প্রকাশিত হয়েছে");
      setBody("");
      setClassLevel("all");
      clearFile();
      qc.invalidateQueries({ queryKey: ["admin-feed"] });
    } catch (e: any) {
      toast.error(e.message ?? "পোস্ট ব্যর্থ হয়েছে");
    } finally {
      setPosting(false);
    }
  };

  const approve = async (id: string) => {
    const { error } = await supabase.from("feed_posts").update({ status: "approved" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("অনুমোদিত হয়েছে — এখন ফিডে দেখা যাবে");
    qc.invalidateQueries({ queryKey: ["admin-feed"] });
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  };

  const reject = async (id: string, path: string | null) => {
    if (!confirm("পোস্টটি বাতিল করবেন?")) return;
    if (path) await supabase.storage.from("feed-media").remove([path]);
    const { error } = await supabase.from("feed_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("বাতিল করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-feed"] });
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  };

  const toggleActive = async (id: string, val: boolean) => {
    await supabase.from("feed_posts").update({ is_active: val }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-feed"] });
  };

  const handleDelete = async (id: string, path: string | null) => {
    if (!confirm("পোস্টটি মুছবেন?")) return;
    if (path) await supabase.storage.from("feed-media").remove([path]);
    const { error } = await supabase.from("feed_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-feed"] });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
          <Newspaper />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">নিউজফিড পোস্ট</h1>
          <p className="text-sm text-muted-foreground">ছবি, ভিডিও, অডিও বা লেখা পোস্ট করুন — শিক্ষার্থীরা ফিডে দেখবে</p>
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <Textarea
          rows={3}
          placeholder="কিছু লিখুন..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {preview && (
          <div className="relative rounded-xl overflow-hidden border bg-academy-soft">
            <button
              onClick={clearFile}
              className="absolute top-2 right-2 z-10 size-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
            {mediaType === "image" && <img src={preview} alt="preview" className="w-full max-h-80 object-contain" />}
            {mediaType === "video" && <video src={preview} controls className="w-full max-h-80" />}
            {mediaType === "audio" && <audio src={preview} controls className="w-full p-3" />}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4 mr-1" /> মিডিয়া যোগ
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
            <Video className="size-3.5" /> <Music className="size-3.5" /> ছবি/ভিডিও/অডিও
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সবার জন্য</SelectItem>
                {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={posting} className="bg-academy-navy text-white">
              {posting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
              পোস্ট
            </Button>
          </div>
        </div>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-200 bg-amber-100/60">
            <Clock className="size-4 text-amber-700" />
            <span className="font-bold text-amber-800 text-sm">শিক্ষার্থীদের অপেক্ষমাণ পোস্ট ({pending.length})</span>
          </div>
          <ul className="divide-y divide-amber-200">
            {pending.map((p: any) => (
              <li key={p.id} className="p-4">
                <div className="flex items-center gap-2 text-xs text-academy-navy mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <GraduationCap className="size-3.5" /> {p.author_name}
                  </span>
                  {p.author_meta && <span className="text-muted-foreground">· {p.author_meta}</span>}
                  <span className="text-muted-foreground">· {new Date(p.created_at).toLocaleString("bn-BD")}</span>
                </div>
                {p.body && <div className="text-sm text-academy-navy whitespace-pre-wrap">{p.body}</div>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approve(p.id)}>
                    <Check className="size-4 mr-1" /> অনুমোদন
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => reject(p.id, p.media_path)}>
                    <X className="size-4 mr-1" /> বাতিল
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Existing posts */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : published.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">কোনো পোস্ট নেই</div>
        ) : (
          <ul className="divide-y">
            {published.map((p: any) => (
              <li key={p.id} className="p-4 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  {p.author_name && (
                    <div className="text-xs font-semibold text-academy-navy mb-1">
                      {p.author_name}
                      {p.author_meta ? <span className="text-muted-foreground font-normal"> · {p.author_meta}</span> : null}
                    </div>
                  )}
                  {p.body && <div className="text-sm text-academy-navy whitespace-pre-wrap line-clamp-3">{p.body}</div>}
                  {p.media_type === "image" && p.media_path && (
                    <img src={mediaUrl(p.media_path)} alt="" className="mt-2 rounded-lg max-h-32 border" />
                  )}
                  {p.media_type === "video" && p.media_path && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1"><Video className="size-3.5" /> ভিডিও পোস্ট</div>
                  )}
                  {p.media_type === "audio" && p.media_path && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1"><Music className="size-3.5" /> অডিও পোস্ট</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2 flex gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-academy-soft rounded-full">
                      {p.class_level ? `${bnClass(p.class_level)} শ্রেণি` : "সবার জন্য"}
                    </span>
                    <span>{new Date(p.created_at).toLocaleString("bn-BD")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive(p.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.media_path)}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
