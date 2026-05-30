import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Youtube, Trash2, Plus, Zap } from "lucide-react";

export const Route = createFileRoute("/admin/videos")({
  component: VideoSourcesAdmin,
});

type VideoSource = {
  id: string;
  channel_id: string;
  name: string;
  is_active: boolean;
};

function VideoSourcesAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [adding, setAdding] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["video-sources"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("video_sources")
        .select("id, channel_id, name, is_active")
        .order("name");
      if (error) throw error;
      return data as VideoSource[];
    },
  });

  const add = async () => {
    if (!name.trim() || !channelId.trim()) {
      toast.error("চ্যানেলের নাম ও আইডি দিন");
      return;
    }
    setAdding(true);
    try {
      const { error } = await (supabase as any).from("video_sources").insert({
        name: name.trim(),
        channel_id: channelId.trim(),
      });
      if (error) throw error;
      toast.success("চ্যানেল যোগ হয়েছে");
      setName("");
      setChannelId("");
      qc.invalidateQueries({ queryKey: ["video-sources"] });
    } catch (e: any) {
      toast.error(e.message ?? "যোগ করা ব্যর্থ হয়েছে");
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (id: string, val: boolean) => {
    await (supabase as any).from("video_sources").update({ is_active: val }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["video-sources"] });
  };

  const remove = async (id: string) => {
    if (!confirm("চ্যানেলটি মুছবেন?")) return;
    const { error } = await (supabase as any).from("video_sources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["video-sources"] });
  };

  const doPost = async (channelId?: string) => {
    try {
      const res = await fetch("/api/public/hooks/youtube-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channelId ? { channel_id: channelId } : {}),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(`পোস্ট হয়েছে: ${json.posted?.channel ?? "ভিডিও"}`);
      } else if (json.reason === "no_active_channels") {
        toast.error("কোনো সক্রিয় চ্যানেল নেই");
      } else if (json.reason === "no_fresh_video") {
        toast.info("নতুন কোনো ভিডিও পাওয়া যায়নি");
      } else {
        toast.error(json.error ?? "পোস্ট ব্যর্থ হয়েছে");
      }
    } catch (e: any) {
      toast.error(e.message ?? "পোস্ট ব্যর্থ হয়েছে");
    }
  };

  const postNow = async () => {
    setPosting(true);
    try {
      await doPost();
    } finally {
      setPosting(false);
    }
  };

  const postFromChannel = async (channelId: string) => {
    setPostingId(channelId);
    try {
      await doPost(channelId);
    } finally {
      setPostingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-red-500/15 text-red-600 flex items-center justify-center">
          <Youtube />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-academy-navy">শিক্ষামূলক ভিডিও</h1>
          <p className="text-sm text-muted-foreground">
            প্রতি ঘন্টায় এই চ্যানেলগুলো থেকে র‍্যান্ডম শিক্ষামূলক ভিডিও স্বয়ংক্রিয়ভাবে নিউজফিডে পোস্ট হবে
          </p>
        </div>
        <Button onClick={postNow} disabled={posting} className="bg-academy-navy text-white">
          {posting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Zap className="size-4 mr-1" />}
          এখনই একটি পোস্ট করুন
        </Button>
      </div>

      {/* Add channel */}
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="text-sm font-semibold text-academy-navy">নতুন চ্যানেল যোগ করুন</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="চ্যানেলের নাম (যেমন Khan Academy)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="চ্যানেল আইডি (UCxxxx...)"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          />
          <Button onClick={add} disabled={adding} className="bg-academy-gold text-academy-navy">
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            যোগ
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          চ্যানেল আইডি পেতে: YouTube চ্যানেলের পেজে গিয়ে "Share channel" → "Copy channel ID" (UC দিয়ে শুরু হয়)।
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : !sources || sources.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">কোনো চ্যানেল নেই</div>
        ) : (
          <ul className="divide-y">
            {sources.map((s) => (
              <li key={s.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-academy-navy text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.channel_id}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={postingId === s.channel_id || !s.is_active}
                  onClick={() => postFromChannel(s.channel_id)}
                  title="এই চ্যানেল থেকে এখনই পোস্ট করুন"
                >
                  {postingId === s.channel_id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap className="size-4" />
                  )}
                  পোস্ট
                </Button>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggle(s.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
