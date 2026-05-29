import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendBulkSms } from "@/lib/sms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, MessageSquare, Search, Send, Users } from "lucide-react";
import { CLASS_LEVELS, bnClass } from "@/lib/grading";

export const Route = createFileRoute("/admin/sms")({
  component: SmsPage,
});

type S = {
  id: string;
  full_name: string;
  phone: string | null;
  guardian_phone: string | null;
  class_level: string;
  is_active: boolean;
};

function SmsPage() {
  const [cls, setCls] = useState("all");
  const [q, setQ] = useState("");
  const [recipientKind, setRecipientKind] = useState<"student" | "guardian" | "both">("guardian");
  const [open, setOpen] = useState<null | { numbers: string[]; label: string }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sms-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, phone, guardian_phone, class_level, is_active")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data as S[];
    },
  });

  const filtered = useMemo(() => {
    const rows = (data ?? []).filter((r) => cls === "all" || r.class_level === cls);
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => r.full_name.toLowerCase().includes(t) ||
        (r.phone ?? "").includes(t) ||
        (r.guardian_phone ?? "").includes(t),
    );
  }, [data, cls, q]);

  const numbersFor = (r: S): string[] => {
    const arr: string[] = [];
    if ((recipientKind === "student" || recipientKind === "both") && r.phone) arr.push(r.phone);
    if ((recipientKind === "guardian" || recipientKind === "both") && r.guardian_phone) arr.push(r.guardian_phone);
    return arr;
  };

  const allNumbers = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((r) => numbersFor(r).forEach((n) => set.add(n)));
    return Array.from(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, recipientKind]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
          <MessageSquare />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">এস এম এস প্যানেল</h1>
          <p className="text-sm text-muted-foreground">শ্রেণি ওয়াইজ ইনডিভিজুয়াল বা সবাইকে একসাথে মেসেজ পাঠান</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-4 gap-3">
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব শ্রেণি</SelectItem>
            {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={recipientKind} onValueChange={(v) => setRecipientKind(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="guardian">অভিভাবকের নাম্বারে</SelectItem>
            <SelectItem value="student">শিক্ষার্থীর নাম্বারে</SelectItem>
            <SelectItem value="both">দুই নাম্বারেই</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="নাম বা ফোন..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          মোট {filtered.length} জন · {allNumbers.length}টি ইউনিক নাম্বার
        </div>
        <Button
          className="bg-academy-navy text-white"
          disabled={allNumbers.length === 0}
          onClick={() => setOpen({ numbers: allNumbers, label: `সবাইকে (${allNumbers.length})` })}
        >
          <Users className="size-4 mr-1" /> সবাইকে পাঠান
        </Button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">কোনো শিক্ষার্থী নেই</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => {
              const nums = numbersFor(r);
              return (
                <li key={r.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-academy-navy truncate">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {bnClass(r.class_level)} · {nums.length === 0 ? "কোনো নাম্বার নেই" : nums.join(", ")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={nums.length === 0}
                    onClick={() => setOpen({ numbers: nums, label: r.full_name })}
                  >
                    <Send className="size-4 mr-1" /> মেসেজ
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SendDialog open={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function SendDialog({
  open, onClose,
}: { open: null | { numbers: string[]; label: string }; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendBulkSms);

  const submit = async () => {
    if (!open) return;
    if (!msg.trim()) return toast.error("মেসেজ লিখুন");
    setSending(true);
    try {
      const res = await send({ data: { message: msg.trim(), numbers: open.numbers } });
      toast.success(`${res.sent}টি নাম্বারে পাঠানো হয়েছে`);
      setMsg("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>মেসেজ পাঠান — {open?.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {open?.numbers.length}টি নাম্বারে SMS যাবে
          </div>
          <Textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="মেসেজ লিখুন..."
            rows={5}
            maxLength={1000}
          />
          <div className="text-xs text-muted-foreground text-right">{msg.length}/1000</div>
          <Button
            onClick={submit}
            disabled={sending || !msg.trim()}
            className="bg-academy-navy text-white w-full"
          >
            {sending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
            {sending ? "পাঠানো হচ্ছে..." : "পাঠান"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
